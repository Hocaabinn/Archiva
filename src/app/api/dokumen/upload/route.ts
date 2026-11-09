import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  validateKodeArsipSIG,
  catatLogAktivitas,
  kirimNotifikasiKePeran,
} from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Sesi pengguna
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

    // Bab 5: Hanya Pengaju (user) dan Admin yang dapat mengunggah dokumen baru
    if (profile.role !== 'user' && profile.role !== 'admin') {
      return NextResponse.json(
        { error: `Peran ${profile.role} tidak memiliki hak akses untuk mengunggah dokumen.` },
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

    // Validasi pola kode arsip SIG
    const kodeValidation = validateKodeArsipSIG(kodeArsip)
    if (!kodeValidation.isValid) {
      return NextResponse.json({ error: kodeValidation.message }, { status: 400 })
    }

    // Validasi ukuran berkas utama (max 20MB)
    const MAX_FILE_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Ukuran berkas utama melebihi 20 MB.' }, { status: 400 })
    }

    // Validasi total lampiran (max 25MB) sesuai Blueprint 6.5
    const MAX_ATTACHMENTS_SIZE = 25 * 1024 * 1024
    let totalLampiranSize = 0
    for (const lamp of lampiranFiles) {
      if (lamp && typeof lamp !== 'string') {
        totalLampiranSize += lamp.size
      }
    }
    if (totalLampiranSize > MAX_ATTACHMENTS_SIZE) {
      return NextResponse.json({ error: 'Total ukuran lampiran melebihi 25 MB.' }, { status: 400 })
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

    // 6. Simpan baris ke tabel dokumen
    const { data: newDoc, error: insertDocError } = await adminClient
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
        pemilik_id: user.id,
        pemegang_saat_ini: user.id,
        lokasi_saat_ini: lokasiFisik,
        tanggal_dokumen: new Date().toISOString().slice(0, 10),
      })
      .select('id, kode_arsip, judul')
      .single()

    if (insertDocError || !newDoc) {
      console.error('Error insert dokumen:', insertDocError)
      // Rollback file jika insert gagal
      await adminClient.storage.from('arsip-aktif').remove([filePath])
      return NextResponse.json(
        { error: `Gagal menyimpan data dokumen: ${insertDocError?.message}` },
        { status: 500 }
      )
    }

    // 7. Simpan Lampiran (jika ada)
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

    // 8. Catat log aktivitas
    const pengunggahNama = profile.nama_lengkap || profile.nama || user.email || 'Pengaju'
    await catatLogAktivitas({
      dokumen_id: newDoc.id,
      user_id: user.id,
      aksi: 'upload',
      keterangan: `Pengajuan dokumen arsip baru ${newDoc.kode_arsip} (${newDoc.judul}) oleh ${pengunggahNama}`,
    })

    // 9. Kirim Notifikasi ke semua PIC Arsip
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
