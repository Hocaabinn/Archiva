import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { catatLogAktivitas, kirimNotifikasiKeUser } from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

/**
 * POST /api/serah-terima/ajukan
 * Mengajukan serah terima fisik dokumen Aktif (Blueprint 3.5 & 8.3).
 *
 * ATURAN KERAS:
 * 1. Hanya dokumen Aktif yang bisa diserahterimakan.
 * 2. Pemegang dan lokasi fisik pada tabel dokumen TIDAK BERUBAH sebelum penerima mengonfirmasi!
 * 3. Status serah terima diawali 'Menunggu konfirmasi'.
 * 4. Dicatat di log_aktivitas.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus login terlebih dahulu.' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil pengguna tidak ditemukan.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { dokumen_id, ke_user_id, ke_lokasi, keterangan } = body

    if (!dokumen_id) {
      return NextResponse.json({ error: 'ID dokumen wajib ditentukan.' }, { status: 400 })
    }

    if (!ke_user_id) {
      return NextResponse.json({ error: 'Penerima dokumen wajib dipilih.' }, { status: 400 })
    }

    if (!ke_lokasi || !ke_lokasi.trim()) {
      return NextResponse.json({ error: 'Lokasi tujuan fisik dokumen wajib diisi.' }, { status: 400 })
    }

    if (ke_user_id === user.id) {
      return NextResponse.json(
        { error: 'Calon penerima tidak boleh sama dengan penyerah dokumen.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // 1. Ambil data dokumen
    const { data: doc, error: docError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, status, lokasi_saat_ini, pemegang_saat_ini, pemilik_id')
      .eq('id', dokumen_id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan dalam sistem.' }, { status: 404 })
    }

    // 2. ATURAN KERAS BLUEPRINT: Hanya dokumen Aktif yang boleh diserahterimakan!
    if (doc.status !== 'aktif') {
      const statusIndo =
        doc.status === 'menunggu_persetujuan'
          ? 'Menunggu Persetujuan'
          : doc.status === 'inaktif'
          ? 'Inaktif'
          : doc.status === 'ditolak'
          ? 'Ditolak'
          : doc.status === 'dibatalkan'
          ? 'Dibatalkan'
          : doc.status

      return NextResponse.json(
        {
          error: `Dokumen "${doc.kode_arsip}" tidak dapat diserahterimakan karena berstatus '${statusIndo}'. Hanya dokumen Aktif yang dapat diproses serah terima.`,
        },
        { status: 400 }
      )
    }

    // 3. Validasi hak penyerah: Harus pemegang saat ini, pemilik, atau Admin/PIC
    const isCurrentHolder = doc.pemegang_saat_ini === user.id || doc.pemilik_id === user.id
    const isPrivileged = profile.role === 'admin' || profile.role === 'pic_arsip'
    if (!isCurrentHolder && !isPrivileged) {
      return NextResponse.json(
        {
          error: 'Akses Ditolak: Anda bukan pemegang dokumen ini saat ini, sehingga tidak dapat menyerahkannya.',
        },
        { status: 403 }
      )
    }

    // 4. Ambil profil penerima
    const { data: penerima } = await admin
      .from('profiles')
      .select('id, nama_lengkap, email, role')
      .eq('id', ke_user_id)
      .single()

    if (!penerima) {
      return NextResponse.json({ error: 'Penerima yang dipilih tidak terdaftar.' }, { status: 404 })
    }

    // 5. Cek apakah dokumen sedang dalam proses serah terima lain yang belum dikonfirmasi
    const { data: pendingTransfer } = await admin
      .from('serah_terima')
      .select('id')
      .eq('dokumen_id', doc.id)
      .eq('status_serah', 'Menunggu konfirmasi')
      .maybeSingle()

    if (pendingTransfer) {
      return NextResponse.json(
        {
          error: 'Dokumen ini masih memiliki pengajuan serah terima yang sedang menunggu konfirmasi penerima.',
        },
        { status: 400 }
      )
    }

    // 6. Buat record serah_terima (status_serah: 'Menunggu konfirmasi')
    // PENTING: pemegang_saat_ini dan lokasi_saat_ini pada tabel dokumen TIDAK BERUBAH!
    const dariLokasi = doc.lokasi_saat_ini || 'Lokasi Penyerah'
    const targetLokasi = ke_lokasi.trim()

    const { data: newSerahTerima, error: insertErr } = await admin
      .from('serah_terima')
      .insert({
        dokumen_id: doc.id,
        dari_user_id: user.id,
        ke_user_id: penerima.id,
        dari_lokasi: dariLokasi,
        ke_lokasi: targetLokasi,
        status_serah: 'Menunggu konfirmasi',
        keterangan: (keterangan || '').trim() || null,
        tanggal_serah: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertErr || !newSerahTerima) {
      console.error('Error insert serah_terima:', insertErr)
      return NextResponse.json(
        { error: `Gagal menyimpan serah terima: ${insertErr?.message}` },
        { status: 500 }
      )
    }

    // 7. Catat log_aktivitas
    const penyerahNama = profile.nama_lengkap || profile.nama || user.email || 'Penyerah'
    const penerimaNama = penerima.nama_lengkap || penerima.email || 'Penerima'

    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'serah_terima',
      keterangan: `Pengajuan serah terima fisik dokumen "${doc.judul}" (${doc.kode_arsip}) oleh ${penyerahNama} kepada ${penerimaNama} di lokasi "${targetLokasi}". Status: Menunggu konfirmasi penerima. Pemegang fisik belum berpindah.`,
    })

    // 8. Kirim notifikasi ke penerima
    await kirimNotifikasiKeUser({
      userId: penerima.id,
      judul: 'Serah Terima Dokumen Menunggu Konfirmasi',
      isi: `${penyerahNama} telah mengajukan serah terima fisik dokumen "${doc.judul}" (${doc.kode_arsip}) ke lokasi "${targetLokasi}". Silakan konfirmasi penerimaan setelah fisik dokumen diterima.`,
      dokumenId: doc.id,
    })

    return NextResponse.json({
      success: true,
      message: `Serah terima dokumen ${doc.kode_arsip} berhasil diajukan ke ${penerimaNama}. Menunggu konfirmasi penerimaan fisik.`,
      data: newSerahTerima,
    })
  } catch (err: unknown) {
    console.error('Error in POST /api/serah-terima/ajukan:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
