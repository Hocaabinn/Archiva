import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { catatLogAktivitas, kirimNotifikasiKeUser } from '@/lib/server-dokumen'
import { generateBuktiSerahTerimaPDF } from '@/lib/pdf-serah-terima'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/serah-terima/[id]/konfirmasi
 * Penerima mengonfirmasi penerimaan fisik dokumen (Blueprint 3.5 & 8.3).
 *
 * ATURAN KERAS:
 * 1. Pemegang dokumen dan lokasi baru HANYA BERUBAH setelah penerima mengonfirmasi!
 * 2. Status serah terima diubah menjadi 'Diterima', tanggal_terima dicatat.
 * 3. Menerbitkan PDF Bukti Serah Terima resmi yang tersimpan di storage dan dapat diunduh.
 * 4. Dicatat di log_aktivitas.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: serahTerimaId } = await params

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
      .select('id, nama, nama_lengkap, role, email, jabatan')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil pengguna tidak ditemukan.' }, { status: 403 })
    }

    const admin = createAdminClient()

    // 1. Ambil data serah terima lengkap beserta relasi
    const { data: st, error: stError } = await admin
      .from('serah_terima')
      .select(`
        id, dokumen_id, dari_user_id, ke_user_id, dari_lokasi, ke_lokasi,
        status_serah, tanggal_serah, tanggal_terima, keterangan, bukti_pdf_path,
        dokumen:dokumen_id (
          id, kode_arsip, judul, nomor_dokumen, nomor_ppl, status, lokasi_saat_ini,
          kategori_dokumen:kategori_id ( nama )
        ),
        penyerah:dari_user_id ( id, nama_lengkap, email, jabatan ),
        penerima:ke_user_id ( id, nama_lengkap, email, jabatan )
      `)
      .eq('id', serahTerimaId)
      .single()

    if (stError || !st) {
      return NextResponse.json({ error: 'Data serah terima tidak ditemukan.' }, { status: 404 })
    }

    // 2. Validasi status serah terima
    if (st.status_serah !== 'Menunggu konfirmasi') {
      return NextResponse.json(
        {
          error: `Serah terima tidak dapat dikonfirmasi karena status saat ini '${st.status_serah}'.`,
        },
        { status: 400 }
      )
    }

    // 3. Validasi hak akses: Hanya penerima (ke_user_id) atau Admin/PIC Arsip yang berhak konfirmasi
    const isRecipient = st.ke_user_id === user.id
    const isPrivileged = profile.role === 'superadmin' || profile.role === 'pic_aktif'
    if (!isRecipient && !isPrivileged) {
      return NextResponse.json(
        {
          error: 'Akses Ditolak: Anda bukan pihak penerima yang dituju untuk dokumen ini.',
        },
        { status: 403 }
      )
    }

    const doc = st.dokumen as any
    if (!doc) {
      return NextResponse.json({ error: 'Dokumen terkait tidak ditemukan.' }, { status: 404 })
    }

    // 4. Pastikan dokumen masih berstatus Aktif
    if (doc.status !== 'aktif') {
      return NextResponse.json(
        {
          error: `Dokumen tidak dapat diserahterimakan karena status saat ini '${doc.status}'. Hanya dokumen Aktif yang dapat diserahterimakan.`,
        },
        { status: 400 }
      )
    }

    const nowISO = new Date().toISOString()
    const targetLokasi = st.ke_lokasi || 'Lokasi Penerima'
    const nomorBast = `BAST/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${st.id.slice(0, 8).toUpperCase()}`

    // 5. UPDATE DOKUMEN:
    // Pemegang fisik resmi berpindah ke penerima, dan lokasi berubah ke lokasi baru
    const { error: updateDocErr } = await admin
      .from('dokumen')
      .update({
        pemegang_saat_ini: st.ke_user_id,
        lokasi_saat_ini: targetLokasi,
        updated_at: nowISO,
      })
      .eq('id', doc.id)

    if (updateDocErr) {
      console.error('Error updating document holder:', updateDocErr)
      return NextResponse.json(
        { error: `Gagal memperbarui data pemegang dokumen: ${updateDocErr.message}` },
        { status: 500 }
      )
    }

    // 6. Terbitkan PDF Bukti Serah Terima Resmi
    let buktiStoragePath = st.bukti_pdf_path || null
    try {
      const penyerahData = st.penyerah as any
      const penerimaData = st.penerima as any

      const pdfBytes = await generateBuktiSerahTerimaPDF({
        id: st.id,
        nomorBast,
        tanggalSerah: st.tanggal_serah,
        tanggalTerima: nowISO,
        statusSerah: 'Diterima',
        dokumen: {
          id: doc.id,
          kodeArsip: doc.kode_arsip,
          judul: doc.judul,
          nomorDokumen: doc.nomor_dokumen || undefined,
          nomorPpl: doc.nomor_ppl || undefined,
          kategori: doc.kategori_dokumen?.nama || 'Umum',
          tanggalDokumen: doc.tanggal_dokumen,
        },
        penyerah: {
          nama: penyerahData?.nama_lengkap || penyerahData?.email || 'Penyerah',
          email: penyerahData?.email || '',
          jabatan: penyerahData?.jabatan,
          lokasiAsal: st.dari_lokasi || 'Ruang Pengaju',
        },
        penerima: {
          nama: penerimaData?.nama_lengkap || penerimaData?.email || 'Penerima',
          email: penerimaData?.email || '',
          jabatan: penerimaData?.jabatan,
          lokasiTujuan: targetLokasi,
        },
        keterangan: st.keterangan || undefined,
      })

      const storageFilePath = `serah-terima/${st.id}_${nomorBast.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`
      const { error: uploadPdfErr } = await admin.storage
        .from('arsip-aktif')
        .upload(storageFilePath, Buffer.from(pdfBytes), {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (!uploadPdfErr) {
        buktiStoragePath = storageFilePath
      } else {
        console.warn('Gagal menyimpan file PDF bukti ke storage:', uploadPdfErr)
      }
    } catch (pdfErr) {
      console.error('Gagal membuat PDF bukti serah terima:', pdfErr)
    }

    // 7. Update status serah terima menjadi 'Diterima'
    const { error: updateStErr } = await admin
      .from('serah_terima')
      .update({
        status_serah: 'Diterima',
        tanggal_terima: nowISO,
        bukti_pdf_path: buktiStoragePath,
      })
      .eq('id', st.id)

    if (updateStErr) {
      console.error('Error updating serah_terima status:', updateStErr)
    }

    // 8. Catat ke log_aktivitas
    const penyerahNama = (st.penyerah as any)?.nama_lengkap || (st.penyerah as any)?.email || 'Penyerah'
    const penerimaNama = (st.penerima as any)?.nama_lengkap || (st.penerima as any)?.email || profile.nama_lengkap || 'Penerima'

    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'serah_terima',
      keterangan: `Serah terima fisik dokumen "${doc.judul}" (${doc.kode_arsip}) resmi dikonfirmasi & diterima oleh ${penerimaNama}. Pemegang baru: ${penerimaNama}, Lokasi baru: "${targetLokasi}". Berita Acara ${nomorBast} telah diterbitkan.`,
    })

    // 9. Kirim notifikasi ke penyerah
    if (st.dari_user_id) {
      await kirimNotifikasiKeUser({
        userId: st.dari_user_id,
        judul: 'Serah Terima Dokumen Telah Diterima',
        isi: `Dokumen "${doc.judul}" (${doc.kode_arsip}) telah dikonfirmasi dan diterima fisik oleh ${penerimaNama} di lokasi "${targetLokasi}". Bukti PDF telah diterbitkan.`,
        dokumenId: doc.id,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} berhasil diterima. Pemegang dokumen resmi berpindah ke ${penerimaNama}.`,
      nomorBast,
      buktiPdfPath: buktiStoragePath,
    })
  } catch (err: unknown) {
    console.error('Error in POST /api/serah-terima/[id]/konfirmasi:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
