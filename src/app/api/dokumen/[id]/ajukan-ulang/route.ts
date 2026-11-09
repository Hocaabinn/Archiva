import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { catatLogAktivitas, kirimNotifikasiKePeran } from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID dokumen wajib disertakan.' }, { status: 400 })
    }

    // 1. Verifikasi sesi pengguna
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus login terlebih dahulu.' },
        { status: 401 }
      )
    }

    // 2. Ambil profil pengguna
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role')
      .eq('id', user.id)
      .single()

    // 3. Ambil data dokumen
    const admin = createAdminClient()
    const { data: doc, error: docError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, status, pemilik_id')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    // Hanya pemilik dokumen atau Admin yang dapat mengajukan ulang
    const isOwnerOrAdmin = doc.pemilik_id === user.id || profile?.role === 'admin'
    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya pemilik dokumen yang berhak memperbaiki dan mengajukan ulang.' },
        { status: 403 }
      )
    }

    if (doc.status !== 'ditolak') {
      return NextResponse.json(
        { error: `Dokumen tidak dalam status ditolak (status saat ini: ${doc.status}). Pengajuan ulang hanya berlaku untuk dokumen yang ditolak.` },
        { status: 400 }
      )
    }

    // 4. Baca metadata yang diperbaiki jika ada
    const body = await request.json().catch(() => ({}))
    const updatePayload: Record<string, unknown> = {
      status: 'menunggu_persetujuan',
      verifikasi_pic_oleh: null,
      disetujui_oleh: null,
      tanggal_disetujui: null,
      tanggal_kadaluarsa: null,
      alasan_penolakan: null,
      updated_at: new Date().toISOString(),
    }

    if (body.judul && typeof body.judul === 'string' && body.judul.trim()) {
      updatePayload.judul = body.judul.trim()
    }
    if (body.nomor_dokumen !== undefined) updatePayload.nomor_dokumen = body.nomor_dokumen || null
    if (body.nomor_ppl !== undefined) updatePayload.nomor_ppl = body.nomor_ppl || null
    if (body.penandatangan !== undefined) updatePayload.penandatangan = body.penandatangan || null
    if (body.kategori_id !== undefined) updatePayload.kategori_id = body.kategori_id || null
    if (body.deskripsi !== undefined) updatePayload.deskripsi = body.deskripsi || null
    if (body.lokasi_saat_ini !== undefined) updatePayload.lokasi_saat_ini = body.lokasi_saat_ini || 'Ruang Arsip Aktif'

    // 5. Eksekusi pengajuan ulang
    const { error: updateError } = await admin
      .from('dokumen')
      .update(updatePayload)
      .eq('id', doc.id)

    if (updateError) {
      return NextResponse.json(
        { error: `Gagal mengajukan ulang dokumen: ${updateError.message}` },
        { status: 500 }
      )
    }

    // 6. Catat log aktivitas
    const pengajuNama = profile?.nama_lengkap || profile?.nama || user.email || 'Pengaju'
    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'ajukan_ulang',
      keterangan: `Dokumen diperbaiki dan diajukan ulang oleh ${pengajuNama}. Alur verifikasi diulang dari tahap 1.`,
    })

    // 7. Kirim notifikasi ke semua PIC Arsip
    await kirimNotifikasiKePeran({
      roles: ['pic_arsip'],
      judul: 'Pengajuan Ulang Dokumen',
      isi: `Dokumen "${updatePayload.judul || doc.judul}" (${doc.kode_arsip}) telah diperbaiki oleh pemilik dan siap untuk verifikasi tahap 1 oleh PIC Arsip.`,
      dokumenId: doc.id,
    })

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} berhasil diajukan ulang dan masuk ke antrean verifikasi PIC Arsip.`,
    })
  } catch (err: unknown) {
    console.error('Error ajukan-ulang:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
