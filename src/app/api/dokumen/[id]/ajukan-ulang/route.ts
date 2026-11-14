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
      .select('id, kode_arsip, judul, status, pemilik_id, file_path')
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

    // 4. Baca metadata yang diperbaiki (JSON, atau multipart/form-data bila menyertakan berkas baru)
    let body: Record<string, any> = {}
    let berkasBaru: File | null = null
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      for (const key of ['judul', 'nomor_dokumen', 'nomor_ppl', 'penandatangan', 'kategori_id', 'deskripsi', 'lokasi_saat_ini']) {
        const v = form.get(key)
        if (typeof v === 'string') body[key] = v.trim()
      }
      const f = form.get('file')
      if (f && typeof f !== 'string' && f.size > 0) berkasBaru = f
    } else {
      body = await request.json().catch(() => ({}))
    }

    // 4a. Unggah berkas pengganti (opsional). Berkas lama TIDAK dihapus agar jejak arsip tetap ada.
    let fileUpdate: Record<string, unknown> = {}
    let keteranganBerkas = ''
    if (berkasBaru) {
      const ext = (berkasBaru.name.split('.').pop() || '').toLowerCase()
      if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
        return NextResponse.json(
          { error: 'Format berkas tidak didukung. Gunakan PDF, PNG, atau JPG.' },
          { status: 400 }
        )
      }
      const cleanFileName = berkasBaru.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${doc.pemilik_id}/${Date.now()}_${cleanFileName}`
      const { error: uploadError } = await admin.storage
        .from('arsip-aktif')
        .upload(filePath, Buffer.from(await berkasBaru.arrayBuffer()), {
          contentType: berkasBaru.type || 'application/pdf',
          upsert: false,
        })
      if (uploadError) {
        return NextResponse.json(
          { error: `Gagal mengunggah berkas pengganti: ${uploadError.message}` },
          { status: 500 }
        )
      }
      fileUpdate = {
        bucket: 'arsip-aktif',
        file_path: filePath,
        file_tipe: berkasBaru.type || 'application/pdf',
        ukuran_file: berkasBaru.size,
      }
      keteranganBerkas = ` Berkas utama diganti dengan "${berkasBaru.name}" (berkas sebelumnya tetap tersimpan: ${doc.file_path || '-'}).`
    }

    const updatePayload: Record<string, unknown> = {
      status: 'menunggu_persetujuan',
      verifikasi_pic_oleh: null,
      disetujui_oleh: null,
      tanggal_disetujui: null,
      tanggal_kadaluarsa: null,
      alasan_penolakan: null,
      updated_at: new Date().toISOString(),
      ...fileUpdate,
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
      keterangan: `Dokumen diperbaiki dan diajukan ulang oleh ${pengajuNama}. Alur verifikasi diulang dari tahap 1.${keteranganBerkas}`,
    })

    // 7. Kirim notifikasi ke Atasan Arsip Aktif
    await kirimNotifikasiKePeran({
      roles: ['atasan_aktif'],
      judul: 'Pengajuan Ulang Dokumen',
      isi: `Dokumen "${updatePayload.judul || doc.judul}" (${doc.kode_arsip}) telah diperbaiki oleh PIC Arsip Aktif dan menunggu persetujuan Atasan.`,
      dokumenId: doc.id,
    })

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} berhasil diajukan ulang dan masuk ke antrean persetujuan Atasan.`,
    })
  } catch (err: unknown) {
    console.error('Error ajukan-ulang:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

