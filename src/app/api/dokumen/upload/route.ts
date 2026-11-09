import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'
import {
  validateKodeArsipSIG,
  catatLogAktivitas,
  kirimNotifikasiKePeran,
} from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Sesi pengguna terautentikasi (meneruskan cookies & token sesi)
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

    // 2. Ambil profil pengguna & cek role
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role')
      .eq('id', user.id)
      .single()

    if (profError || !profile) {
      return NextResponse.json(
        { error: 'Profil pengguna tidak ditemukan.' },
        { status: 403 }
      )
    }

    // ATURAN KERAS BLUEPRINT BAB 5 & POLICY dokumen_insert:
    // HANYA Pengaju (role: 'user') yang berhak mengunggah dokumen baru.
    // Admin Sistem, PIC Arsip, Atasan, Accounting, dan Viewer DILARANG mengunggah.
    if (profile.role !== 'user') {
      return NextResponse.json(
        {
          error: `Akses Ditolak: Hanya Pengaju (user) yang berhak mengunggah dokumen baru sesuai Blueprint Bab 5. Akun Anda memiliki peran '${profile.role}'.`,
        },
        { status: 403 }
      )
    }

    // 3. Baca Form Data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const judul = (formData.get('judul') as string || '').trim()
    const kodeArsip = (formData.get('kode_arsip') as string || '').trim()
    const nomorDokumen = (formData.get('nomor_dokumen') as string || '').trim()
    const nomorPpl = (formData.get('nomor_ppl') as string || '').trim()
    const penandatangan = (formData.get('penandatangan') as string || '').trim()
    const kategoriId = (formData.get('kategori_id') as string || '').trim()
    const deskripsi = (formData.get('deskripsi') as string || '').trim()
    const lokasiFisik = (formData.get('lokasi_saat_ini') as string || '').trim() || 'Ruang Arsip Aktif'

    // Ambil file lampiran jika ada
    const lampiranFiles = formData.getAll('lampiran') as File[]

    // Validasi field utama
    if (!judul) {
      return NextResponse.json({ error: 'Judul dokumen wajib diisi.' }, { status: 400 })
    }
    if (!kategoriId) {
      return NextResponse.json({ error: 'Kategori dokumen wajib dipilih.' }, { status: 400 })
    }
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Berkas utama dokumen wajib diunggah.' }, { status: 400 })
    }

    // Validasi pola kode arsip SIG (TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER)
    const kodeValidation = validateKodeArsipSIG(kodeArsip)
    if (!kodeValidation.isValid) {
      return NextResponse.json({ error: kodeValidation.message }, { status: 400 })
    }

    // Catatan Berkas Utama: Tidak ada batas 20 MB di BLUEPRINT.md.
    // Batas yang tercantum di blueprint hanya pada Bab 6.5 poin 2 untuk total LAMPIRAN (maks 25 MB).
    const MAX_ATTACHMENTS_SIZE = 25 * 1024 * 1024
    let totalLampiranSize = 0
    for (const lamp of lampiranFiles) {
      if (lamp && typeof lamp !== 'string') {
        totalLampiranSize += lamp.size
      }
    }
    if (totalLampiranSize > MAX_ATTACHMENTS_SIZE) {
      return NextResponse.json({ error: 'Total ukuran lampiran melebihi batas 25 MB sesuai Bab 6.5.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 4. Periksa keunikan kode_arsip
    const { data: existingDoc } = await adminClient
      .from('dokumen')
      .select('id')
      .eq('kode_arsip', kodeArsip)
      .maybeSingle()

    if (existingDoc) {
      return NextResponse.json(
        { error: `Kode arsip ${kodeArsip} sudah terdaftar dalam sistem. Kode arsip harus unik dan tidak boleh dipakai ulang.` },
        { status: 409 }
      )
    }

    // 5. Upload Berkas Utama ke Supabase Storage (arsip-aktif)
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${user.id}/${Date.now()}_${cleanFileName}`

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await adminClient.storage
      .from('arsip-aktif')
      .upload(filePath, fileBuffer, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error upload file utama:', uploadError)
      return NextResponse.json(
        { error: `Gagal mengunggah berkas ke penyimpanan: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // 6. Terbitkan QR Code dan simpan ke bucket barcode (sesuai kolom barcode_path di Kamus Data 4.4)
    let barcodeStoragePath: string | null = null
    try {
      const qrBuffer = await QRCode.toBuffer(kodeArsip, {
        width: 300,
        margin: 1,
        color: { dark: '#1A1D21', light: '#FFFFFF' },
      })
      const qrFileName = `qr/${kodeArsip}.png`
      const { error: qrUploadError } = await adminClient.storage
        .from('barcode')
        .upload(qrFileName, qrBuffer, {
          contentType: 'image/png',
          upsert: true,
        })
      if (!qrUploadError) {
        barcodeStoragePath = qrFileName
      }
    } catch (qrErr) {
      console.warn('Peringatan: Gagal membuat/mengunggah gambar QR ke bucket barcode:', qrErr)
    }

    // 7. Simpan baris ke tabel dokumen menggunakan CLIENT TERAUTENTIKASI (supabase)
    // Hal ini memastikan PostgreSQL RLS policy "dokumen_insert" dievaluasi dan dihormati langsung oleh database!
    const { data: newDoc, error: insertDocError } = await supabase
      .from('dokumen')
      .insert({
        kode_arsip: kodeArsip,
        judul,
        nomor_dokumen: nomorDokumen || null,
        nomor_ppl: nomorPpl || null,
        penandatangan: penandatangan || null,
        kategori_id: kategoriId,
        deskripsi: deskripsi || null,
        status: 'menunggu_persetujuan',
        bucket: 'arsip-aktif',
        file_path: filePath,
        file_tipe: file.type || 'application/pdf',
        ukuran_file: file.size,
        barcode_path: barcodeStoragePath,
        pemilik_id: user.id,
        pemegang_saat_ini: user.id,
        lokasi_saat_ini: lokasiFisik,
        tanggal_dokumen: new Date().toISOString().slice(0, 10),
      })
      .select('id, kode_arsip, judul')
      .single()

    if (insertDocError || !newDoc) {
      console.error('Error insert dokumen via authenticated client (RLS):', insertDocError)
      // Rollback file jika insert ditolak oleh RLS / database
      await adminClient.storage.from('arsip-aktif').remove([filePath])
      if (barcodeStoragePath) {
        await adminClient.storage.from('barcode').remove([barcodeStoragePath])
      }
      return NextResponse.json(
        { error: `Penyimpanan dokumen ditolak oleh kebijakan keamanan (RLS): ${insertDocError?.message}` },
        { status: 403 }
      )
    }

    // 8. Simpan Lampiran (jika ada)
    for (const lamp of lampiranFiles) {
      if (lamp && typeof lamp !== 'string' && lamp.size > 0) {
        try {
          const lampCleanName = lamp.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const lampPath = `${user.id}/lampiran/${Date.now()}_${lampCleanName}`
          const lampBuffer = Buffer.from(await lamp.arrayBuffer())

          const { error: lampUploadError } = await adminClient.storage
            .from('arsip-aktif')
            .upload(lampPath, lampBuffer, {
              contentType: lamp.type || 'application/octet-stream',
              upsert: false,
            })

          if (!lampUploadError) {
            await adminClient.from('lampiran').insert({
              dokumen_id: newDoc.id,
              nama_file: lamp.name,
              file_path: lampPath,
              file_size: lamp.size,
              mime_type: lamp.type || 'application/octet-stream',
              diunggah_oleh: user.id,
            })
          }
        } catch (lampErr) {
          console.error('Gagal memproses lampiran:', lampErr)
        }
      }
    }

    // 9. Catat log aktivitas
    const pengunggahNama = profile.nama_lengkap || profile.nama || user.email || 'Pengaju'
    await catatLogAktivitas({
      dokumen_id: newDoc.id,
      user_id: user.id,
      aksi: 'upload',
      keterangan: `Pengajuan dokumen arsip baru ${newDoc.kode_arsip} (${newDoc.judul}) oleh ${pengunggahNama}`,
    })

    // 10. Kirim Notifikasi ke semua PIC Arsip
    await kirimNotifikasiKePeran({
      roles: ['pic_arsip'],
      judul: 'Pengajuan Dokumen Baru',
      isi: `Dokumen baru "${newDoc.judul}" (${newDoc.kode_arsip}) telah diajukan dan menunggu verifikasi tahap 1 oleh PIC Arsip.`,
      dokumenId: newDoc.id,
    })

    return NextResponse.json({
      success: true,
      message: `Dokumen ${newDoc.kode_arsip} berhasil diajukan dengan status Menunggu Persetujuan.`,
      dokumen: newDoc,
    })
  } catch (err: unknown) {
    console.error('Error upload route:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
