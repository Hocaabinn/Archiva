import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'
import { catatLogAktivitas, kirimNotifikasiKeUser } from '@/lib/server-dokumen'

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

    // 1. Verifikasi pengguna
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

    // 2. Cek peran pengguna: Hanya Atasan Arsip Aktif yang berhak memberikan persetujuan
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role, unit_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'atasan_aktif') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Atasan Arsip Aktif (atasan_aktif) yang berhak memberikan persetujuan penerbitan arsip.' },
        { status: 403 }
      )
    }

    // 3. Ambil data dokumen
    const admin = createAdminClient()
    const { data: doc, error: docError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, status, verifikasi_pic_oleh, pemilik_id')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    if (doc.status !== 'menunggu_persetujuan') {
      return NextResponse.json(
        { error: `Dokumen tidak dalam status menunggu persetujuan (status saat ini: ${doc.status}).` },
        { status: 400 }
      )
    }

    // Alur Tabel 14: Dokumen harus melalui verifikasi tahap 1 PIC Arsip sebelum persetujuan akhir Atasan
    if (!doc.verifikasi_pic_oleh) {
      return NextResponse.json(
        { error: 'Dokumen belum melalui verifikasi tahap 1 oleh PIC Arsip.' },
        { status: 400 }
      )
    }

    // 4. Hitung masa retensi aktif: persis 3 tahun dari tanggal disetujui (Blueprint 3.3 poin 4)
    const now = new Date()
    const expDate = new Date(now)
    expDate.setFullYear(expDate.getFullYear() + 3)

    const nowISO = now.toISOString()
    const expDateISO = expDate.toISOString().slice(0, 10) // format YYYY-MM-DD

    // 5. Terbitkan QR Code ke bucket barcode bila belum ada
    let barcodeStoragePath: string | null = null
    try {
      const qrBuffer = await QRCode.toBuffer(doc.kode_arsip, {
        width: 300,
        margin: 1,
        color: { dark: '#1A1D21', light: '#FFFFFF' },
      })
      const qrFileName = `qr/${doc.kode_arsip}.png`
      const { error: qrErr } = await admin.storage
        .from('barcode')
        .upload(qrFileName, qrBuffer, {
          contentType: 'image/png',
          upsert: true,
        })
      if (!qrErr) barcodeStoragePath = qrFileName
    } catch (e) {
      console.warn('Gagal menerbitkan file QR di storage:', e)
    }

    // 6. Update data: ubah status menjadi aktif, isi tanggal disetujui, tanggal kadaluarsa, barcode_path, dan disetujui_oleh
    const updatePayload: Record<string, unknown> = {
      status: 'aktif',
      disetujui_oleh: user.id,
      tanggal_disetujui: nowISO,
      tanggal_kadaluarsa: expDateISO,
      updated_at: nowISO,
    }
    if (barcodeStoragePath) {
      updatePayload.barcode_path = barcodeStoragePath
    }

    const { error: updateError } = await admin
      .from('dokumen')
      .update(updatePayload)
      .eq('id', doc.id)

    if (updateError) {
      return NextResponse.json(
        { error: `Gagal menyetujui dokumen: ${updateError.message}` },
        { status: 500 }
      )
    }

    // 6. Catat log aktivitas
    const approverNama = profile.nama_lengkap || profile.nama || user.email || 'Atasan'
    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'approve',
      keterangan: `Persetujuan akhir disahkan oleh ${approverNama}. Dokumen berstatus Aktif selama 3 tahun (kedaluwarsa: ${expDateISO}).`,
    })

    // 7. Kirim notifikasi ke Pengaju (pemilik_id)
    if (doc.pemilik_id) {
      await kirimNotifikasiKeUser({
        userId: doc.pemilik_id,
        judul: 'Dokumen Disetujui (Aktif)',
        isi: `Dokumen Anda "${doc.judul}" (${doc.kode_arsip}) telah disahkan oleh Atasan dan berstatus Aktif dengan masa retensi hingga ${expDateISO}.`,
        dokumenId: doc.id,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} berhasil disahkan menjadi Arsip Aktif selama 3 tahun.`,
      tanggal_disetujui: nowISO,
      tanggal_kadaluarsa: expDateISO,
    })
  } catch (err: unknown) {
    console.error('Error approve:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

