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

    // 2. Ambil profil pengguna & cek role
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role, unit_id')
      .eq('id', user.id)
      .single()

    // Blueprint Bab 5: Hanya PIC Arsip Aktif pengentri (atau superadmin) yang dapat memperbaiki & mengajukan ulang
    if (!profile || (profile.role !== 'pic_aktif' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya PIC Arsip Aktif (pic_aktif) yang berhak memperbaiki dan mengajukan ulang dokumen yang ditolak.' },
        { status: 403 }
      )
    }

    // 3. Ambil data dokumen
    const admin = createAdminClient()
    const { data: doc, error: docError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, status, pemilik_id, unit_id, file_path')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    // Pastikan PIC yang mengajukan ulang adalah pemilik dokumen atau dari unit yang sama
    const isAuthorized = doc.pemilik_id === user.id || doc.unit_id === profile.unit_id || profile.role === 'superadmin'
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya PIC Arsip Aktif pengentri atau dari unit yang sama yang berhak mengajukan ulang dokumen ini.' },
        { status: 403 }
      )
    }

    if (doc.status !== 'ditolak') {
      return NextResponse.json(
        { error: `Dokumen tidak dalam status ditolak (status saat ini: ${doc.status}). Pengajuan ulang hanya berlaku untuk dokumen yang berstatus ditolak.` },
        { status: 400 }
      )
    }

    // 4. Baca metadata yang diperbaiki
    let body: Record<string, unknown> = {}
    let berkasBaru: File | null = null
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      for (const key of ['judul', 'penandatangan', 'kategori_id', 'deskripsi', 'lokasi_saat_ini', 'jumlah_halaman']) {
        const v = form.get(key)
        if (typeof v === 'string') body[key] = v.trim()
      }
      const f = form.get('file')
      if (f && typeof f !== 'string' && f.size > 0) berkasBaru = f
    } else {
      body = await request.json().catch(() => ({}))
    }

    // 4a. Unggah berkas pengganti bila ada
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
      keteranganBerkas = ` Berkas utama diganti dengan "${berkasBaru.name}".`
    }

    const nowISO = new Date().toISOString()
    const updatePayload: Record<string, unknown> = {
      status: 'menunggu_persetujuan',
      disetujui_oleh: null,
      tanggal_disetujui: null,
      tanggal_kadaluarsa: null,
      alasan_penolakan: null,
      updated_at: nowISO,
      ...fileUpdate,
    }

    if (body.judul && typeof body.judul === 'string' && body.judul.trim()) {
      updatePayload.judul = body.judul.trim()
    }
    if (body.penandatangan !== undefined) updatePayload.penandatangan = body.penandatangan || null
    if (body.kategori_id !== undefined) updatePayload.kategori_id = body.kategori_id || null
    if (body.deskripsi !== undefined) updatePayload.deskripsi = body.deskripsi || null
    if (body.lokasi_saat_ini !== undefined) updatePayload.lokasi_saat_ini = body.lokasi_saat_ini || 'Ruang Arsip Aktif'
    if (body.jumlah_halaman) {
      const jml = parseInt(String(body.jumlah_halaman), 10)
      if (!isNaN(jml) && jml > 0) updatePayload.jumlah_halaman = jml
    }

    // 5. Eksekusi update
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

    // 6. Catat log aktivitas (aksi: 'ajukan_ulang')
    const pengajuNama = profile?.nama_lengkap || profile?.nama || user.email || 'PIC Arsip Aktif'
    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'ajukan_ulang',
      keterangan: `Dokumen diperbaiki dan diajukan ulang oleh PIC Arsip Aktif (${pengajuNama}). Masuk ke antrean persetujuan Atasan.${keteranganBerkas}`,
    })

    // 7. Kirim notifikasi ke Atasan Arsip Aktif
    await kirimNotifikasiKePeran({
      roles: ['atasan_aktif'],
      judul: 'Dokumen Diajukan Ulang',
      isi: `Dokumen "${updatePayload.judul || doc.judul}" (${doc.kode_arsip}) telah diperbaiki oleh PIC Arsip Aktif dan menunggu persetujuan Anda.`,
      dokumenId: doc.id,
    })

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} berhasil diajukan ulang dan berstatus Menunggu Persetujuan Atasan.`,
    })
  } catch (err: unknown) {
    console.error('Error ajukan-ulang:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
