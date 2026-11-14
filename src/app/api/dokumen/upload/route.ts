import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'
import {
  validateKodeArsipSIG,
  generateNextDocVoucher,
  catatLogAktivitas,
  kirimNotifikasiKePeran,
} from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Sesi pengguna terautentikasi
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

    // 2. Ambil profil pengguna & periksa role
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role, unit_id, unit:unit_organisasi(id, nama, kode_perusahaan)')
      .eq('id', user.id)
      .single()

    if (profError || !profile) {
      return NextResponse.json(
        { error: 'Profil pengguna tidak ditemukan.' },
        { status: 403 }
      )
    }

    // ATURAN KERAS BLUEPRINT BAB 5 & RENCANA MIGRASI M3:
    // HANYA PIC Arsip Aktif (role: 'pic_aktif') yang berhak mengentri dokumen baru.
    // Staff, Superadmin, Atasan, dan Inaktif DILARANG mengentri dokumen (403).
    if (profile.role !== 'pic_aktif') {
      return NextResponse.json(
        {
          error: `Akses Ditolak: Hanya PIC Arsip Aktif (pic_aktif) yang berhak mengentri dokumen baru sesuai Blueprint Bab 5. Akun Anda memiliki peran '${profile.role}'.`,
        },
        { status: 403 }
      )
    }

    // Ambil data unit organisasi PIC
    let unitData = profile.unit as unknown as { id: string; nama: string; kode_perusahaan: string } | null
    if (!unitData && profile.unit_id) {
      const { data: u } = await supabase
        .from('unit_organisasi')
        .select('id, nama, kode_perusahaan')
        .eq('id', profile.unit_id)
        .single()
      unitData = u
    }

    const unitId = profile.unit_id || unitData?.id || null
    const kodePerusahaan = unitData?.kode_perusahaan || '2000'

    // 3. Baca Form Data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const judul = (formData.get('judul') as string || '').trim()
    const kategoriId = (formData.get('kategori_id') as string || '').trim()
    const tanggalDokumenRaw = (formData.get('tanggal_dokumen') as string || '').trim()
    const jumlahHalamanRaw = (formData.get('jumlah_halaman') as string || '').trim()
    const nomorPplInput = (formData.get('nomor_ppl') as string || '').trim()
    const isNonPayment = formData.get('is_non_payment') === 'true'
    const nomorDokumenNonPayment = (formData.get('nomor_dokumen_non_payment') as string || '').trim()
    const penandatangan = (formData.get('penandatangan') as string || '').trim()
    const deskripsi = (formData.get('deskripsi') as string || '').trim()
    const lokasiFisik = (formData.get('lokasi_saat_ini') as string || '').trim() || 'Ruang Arsip Aktif'

    const lampiranFiles = formData.getAll('lampiran') as File[]

    // 4. Validasi Input Wajib
    if (!judul) {
      return NextResponse.json({ error: 'Judul dokumen wajib diisi.' }, { status: 400 })
    }
    if (!kategoriId) {
      return NextResponse.json({ error: 'Kategori dokumen master wajib dipilih.' }, { status: 400 })
    }
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Berkas utama dokumen wajib diunggah.' }, { status: 400 })
    }

    // Validasi Tanggal Dokumen
    const tanggalDokumen = tanggalDokumenRaw || new Date().toISOString().slice(0, 10)
    const tahunDokumen = tanggalDokumen.slice(0, 4)

    // Validasi Jumlah Halaman (Wajib R.03 - untuk kapasitas boks)
    const jumlahHalaman = parseInt(jumlahHalamanRaw, 10)
    if (isNaN(jumlahHalaman) || jumlahHalaman <= 0) {
      return NextResponse.json(
        { error: 'Jumlah halaman (lembar fisik) wajib diisi dengan bilangan bulat positif minimal 1.' },
        { status: 400 }
      )
    }

    // 5. Susun Kode Arsip Otomatis (R.03 M3)
    let kodeArsipFinal = ''
    let docVoucherFinal = ''
    let nomorPplFinal: string | null = null

    if (isNonPayment) {
      // Blueprint 3.2 poin 5: Untuk kontrak/sertifikat tanpa payment
      if (!nomorDokumenNonPayment) {
        return NextResponse.json(
          { error: 'Nomor dokumen kontrak/sertifikat wajib diisi untuk dokumen non-payment.' },
          { status: 400 }
        )
      }
      kodeArsipFinal = nomorDokumenNonPayment
      docVoucherFinal = nomorDokumenNonPayment
    } else {
      // Standar SIG: TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
      if (!nomorPplInput) {
        return NextResponse.json(
          { error: 'Nomor payment / PPL wajib diisi (bisa diketik, discan barcode/QR, atau voice typing).' },
          { status: 400 }
        )
      }

      // Bersihkan karakter selain alfanumerik
      nomorPplFinal = nomorPplInput.replace(/[^a-zA-Z0-9]/g, '')
      if (nomorPplFinal.length < 5) {
        return NextResponse.json(
          { error: 'Nomor payment / PPL minimal 5 karakter (standar SIG: 10 digit).' },
          { status: 400 }
        )
      }

      // Dapatkan nomor doc voucher otomatis dari sistem
      docVoucherFinal = await generateNextDocVoucher()

      // Susun kode arsip otomatis
      kodeArsipFinal = `${tahunDokumen}_${kodePerusahaan}_${nomorPplFinal}_${docVoucherFinal}`
    }

    // Validasi pola kode arsip SIG
    const kodeValidation = validateKodeArsipSIG(kodeArsipFinal)
    if (!kodeValidation.isValid) {
      return NextResponse.json({ error: kodeValidation.message }, { status: 400 })
    }

    // Validasi ukuran lampiran (maks 25 MB sesuai Blueprint 6.5)
    const MAX_ATTACHMENTS_SIZE = 25 * 1024 * 1024
    let totalLampiranSize = 0
    for (const lamp of lampiranFiles) {
      if (lamp && typeof lamp !== 'string') {
        totalLampiranSize += lamp.size
      }
    }
    if (totalLampiranSize > MAX_ATTACHMENTS_SIZE) {
      return NextResponse.json(
        { error: 'Total ukuran lampiran melebihi batas 25 MB sesuai ketentuan sistem.' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // 6. Cek keunikan kode_arsip
    const { data: existingDoc } = await adminClient
      .from('dokumen')
      .select('id')
      .eq('kode_arsip', kodeArsipFinal)
      .maybeSingle()

    if (existingDoc) {
      return NextResponse.json(
        {
          error: `Kode arsip ${kodeArsipFinal} sudah terdaftar dalam sistem. Kode arsip unik dan tidak boleh dipakai ulang.`,
        },
        { status: 409 }
      )
    }

    // 7. Unggah Berkas Utama ke Storage (arsip-aktif)
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

    // 8. Terbitkan Gambar QR Code Label dan simpan ke bucket barcode
    let barcodeStoragePath: string | null = null
    try {
      const qrBuffer = await QRCode.toBuffer(kodeArsipFinal, {
        width: 300,
        margin: 1,
        color: { dark: '#1A1D21', light: '#FFFFFF' },
      })
      const qrFileName = `qr/${kodeArsipFinal}.png`
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

    // 9. Simpan Dokumen via Authenticated Client (memvalidasi policy RLS dokumen_insert)
    const { data: newDoc, error: insertDocError } = await supabase
      .from('dokumen')
      .insert({
        kode_arsip: kodeArsipFinal,
        judul,
        nomor_dokumen: docVoucherFinal || null,
        nomor_ppl: nomorPplFinal || null,
        penandatangan: penandatangan || null,
        kategori_id: kategoriId,
        unit_id: unitId,
        jumlah_halaman: jumlahHalaman,
        status: 'menunggu_persetujuan',
        bucket: 'arsip-aktif',
        file_path: filePath,
        file_tipe: file.type || 'application/pdf',
        ukuran_file: file.size,
        barcode_path: barcodeStoragePath,
        pemilik_id: user.id,
        pemegang_saat_ini: user.id,
        lokasi_saat_ini: lokasiFisik,
        tanggal_dokumen: tanggalDokumen,
        deskripsi: deskripsi || null,
      })
      .select('id, kode_arsip, judul, status, unit_id, jumlah_halaman')
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

    // 10. Simpan Lampiran (jika ada)
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

    // 11. Catat log aktivitas (aksi: 'entri')
    const pengunggahNama = profile.nama_lengkap || profile.nama || user.email || 'PIC Arsip Aktif'
    await catatLogAktivitas({
      dokumen_id: newDoc.id,
      user_id: user.id,
      aksi: 'entri',
      keterangan: `Entri dokumen arsip baru ${newDoc.kode_arsip} (${newDoc.judul}) oleh PIC Arsip Aktif ${pengunggahNama}`,
    })

    // 12. Kirim Notifikasi ke Atasan Arsip Aktif
    await kirimNotifikasiKePeran({
      roles: ['atasan_aktif'],
      judul: 'Dokumen Baru Menunggu Persetujuan',
      isi: `Dokumen baru "${newDoc.judul}" (${newDoc.kode_arsip}) telah dientri oleh PIC Arsip Aktif dan menunggu persetujuan Anda.`,
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
