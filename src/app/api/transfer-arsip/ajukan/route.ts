import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { catatLogAktivitas, kirimNotifikasiKeUser, kirimNotifikasiKePeran } from '@/lib/server-dokumen'
import { generateBeritaAcaraTransferPDF } from '@/lib/pdf-transfer-arsip'

export const dynamic = 'force-dynamic'

/**
 * POST /api/transfer-arsip/ajukan
 * PIC Arsip Aktif mengajukan transfer berkas aktif (mendekati/sudah kedaluwarsa) ke Inaktif.
 * Menerbitkan Berita Acara Penyerahan Arsip (PDF) dan mencatat transaksi ke serah_terima dengan flag TRANSFER_INAKTIF.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda belum login.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, email, role, unit_id, unit_organisasi:unit_id(nama)')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'pic_aktif' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya PIC Arsip Aktif yang dapat mengajukan transfer berkas ke inaktif.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const dokumen_ids = body.dokumen_ids || body.dokumenIds
    const catatan = body.catatan

    if (!Array.isArray(dokumen_ids) || dokumen_ids.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal 1 dokumen untuk ditransfer ke Inaktif.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Ambil data PIC Arsip Inaktif sebagai penerima transfer
    const { data: picInaktifUser } = await admin
      .from('profiles')
      .select('id, nama_lengkap, email')
      .eq('role', 'pic_inaktif')
      .limit(1)
      .maybeSingle()

    if (!picInaktifUser) {
      return NextResponse.json(
        { error: 'Petugas PIC Arsip Inaktif belum terdaftar dalam sistem.' },
        { status: 404 }
      )
    }

    // Pastikan caller memiliki hak peran pengajuan transfer (pic_aktif atau superadmin)
    if (profile.role !== 'pic_aktif' && profile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya PIC Arsip Aktif atau Superadmin yang dapat mengajukan transfer dokumen.' },
        { status: 403 }
      )
    }

    // 2. Ambil dokumen-dokumen yang dipilih beserta relasi boks (M9)
    const { data: docs, error: docErr } = await admin
      .from('dokumen')
      .select(`
        id, kode_arsip, nomor_dokumen, nomor_ppl, judul, status, jumlah_halaman, tanggal_kadaluarsa, lokasi_saat_ini, boks_id,
        kategori_dokumen:kategori_id(nama),
        boks:boks_id(nomor_boks),
        dokumen_boks(urutan, jumlah_lembar, boks:boks_id(nomor_boks))
      `)
      .in('id', dokumen_ids)

    if (docErr || !docs || docs.length === 0) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    // Pastikan semua dokumen berstatus 'aktif'
    const nonActive = docs.filter((d) => d.status !== 'aktif')
    if (nonActive.length > 0) {
      return NextResponse.json(
        { error: `Terdapat dokumen yang tidak berstatus Aktif: ${nonActive.map((d) => d.kode_arsip).join(', ')}` },
        { status: 400 }
      )
    }

    // Cek apakah ada yang sedang menunggu konfirmasi serah terima sebelumnya
    const { data: pendingSt } = await admin
      .from('serah_terima')
      .select('dokumen_id')
      .in('dokumen_id', dokumen_ids)
      .eq('status_serah', 'Menunggu konfirmasi')

    if (pendingSt && pendingSt.length > 0) {
      return NextResponse.json(
        { error: 'Terdapat dokumen yang sedang dalam proses serah terima/transfer sebelumnya.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const nomorBa = `BAST-TRANSFER/${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}/${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // 3. Susun data untuk PDF Berita Acara (Mencantumkan seluruh nomor boks)
    const dokumenListForPdf = docs.map((d: any) => {
      const expDate = d.tanggal_kadaluarsa ? new Date(d.tanggal_kadaluarsa) : new Date()
      const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      let nomorBoksLabel = '-'
      if (d.dokumen_boks && Array.isArray(d.dokumen_boks) && d.dokumen_boks.length > 0) {
        nomorBoksLabel = d.dokumen_boks
          .sort((a: any, b: any) => (a.urutan || 0) - (b.urutan || 0))
          .map((db: any) => `B.${db.boks?.nomor_boks || '?'}`)
          .join(', ')
      } else if (d.boks?.nomor_boks) {
        nomorBoksLabel = `B.${d.boks.nomor_boks}`
      }

      const parts = (d.kode_arsip || '').split('_')
      const paymentNumber = d.nomor_ppl || d.nomor_dokumen || (parts.length >= 3 ? parts[2] : '-')

      return {
        nomorPayment: paymentNumber,
        kodeArsip: d.kode_arsip,
        judul: d.judul,
        kategori: d.kategori_dokumen?.nama || 'Umum',
        jumlahHalaman: d.jumlah_halaman || 1,
        tanggalKadaluarsa: d.tanggal_kadaluarsa || '-',
        sisaHari: diffDays,
        nomorBoks: nomorBoksLabel,
      }
    })

    const unitName = (profile.unit_organisasi as any)?.nama || 'Keuangan'

    const pdfBytes = await generateBeritaAcaraTransferPDF({
      nomorBa,
      tanggalBa: now.toISOString(),
      pengirim: {
        nama: profile.nama_lengkap || profile.email,
        email: profile.email,
        unit: unitName,
      },
      penerima: {
        nama: picInaktifUser.nama_lengkap || picInaktifUser.email,
        email: picInaktifUser.email,
      },
      dokumenList: dokumenListForPdf,
      catatan: catatan || undefined,
    })

    // Simpan PDF BA ke bucket arsip-aktif
    const baPdfPath = `berita-acara/${nomorBa.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`
    await admin.storage.from('arsip-aktif').upload(baPdfPath, Buffer.from(pdfBytes), {
      contentType: 'application/pdf',
      upsert: true,
    })

    // 4. Buat record serah_terima untuk masing-masing dokumen dengan penanda TRANSFER_INAKTIF
    const createdStIds: string[] = []
    for (const d of docs) {
      const { data: st, error: stErr } = await admin
        .from('serah_terima')
        .insert({
          dokumen_id: d.id,
          dari_user_id: user.id,
          ke_user_id: picInaktifUser.id,
          dari_lokasi: d.lokasi_saat_ini || 'Rak Aktif',
          ke_lokasi: 'Gudang Inaktif > Ruang Arsip Inaktif > Rak Inaktif 01',
          status_serah: 'Menunggu konfirmasi',
          keterangan: `TRANSFER_INAKTIF | ${nomorBa} | ${catatan || 'Penyerahan berkas masa retensi berakhir'}`,
          bukti_pdf_path: baPdfPath,
          tanggal_serah: now.toISOString(),
        })
        .select('id')
        .single()

      if (st) {
        createdStIds.push(st.id)
      }

      // Catat log aktivitas pengajuan transfer
      await catatLogAktivitas({
        dokumen_id: d.id,
        user_id: user.id,
        aksi: 'serah_terima',
        keterangan: `Pengajuan transfer berkas fisik ke Gudang Inaktif (${nomorBa}) oleh PIC Arsip Aktif. Menunggu verifikasi fisik oleh PIC Arsip Inaktif.`,
      })
    }

    // 5. Kirim notifikasi ke PIC Arsip Inaktif
    await kirimNotifikasiKeUser({
      userId: picInaktifUser.id,
      judul: 'Pengajuan Transfer Berkas ke Gudang Inaktif',
      isi: `PIC Arsip Aktif (${profile.nama_lengkap}) mengajukan transfer ${docs.length} berkas dokumen (${nomorBa}). Silakan periksa berkas fisik dan lakukan verifikasi scan QR.`,
    })

    return NextResponse.json({
      success: true,
      message: `${docs.length} berkas berhasil diajukan untuk transfer ke Gudang Inaktif. Berita Acara ${nomorBa} telah diterbitkan.`,
      nomorBa,
      baPdfUrl: `/api/transfer-arsip/ba-pdf?path=${encodeURIComponent(baPdfPath)}`,
      totalDokumen: docs.length,
      serahTerimaIds: createdStIds,
    })
  } catch (err: unknown) {
    console.error('Error ajukan transfer:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

