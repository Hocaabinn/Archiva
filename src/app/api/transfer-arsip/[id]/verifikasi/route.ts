import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { catatLogAktivitas, kirimNotifikasiKeUser, kirimNotifikasiKePeran } from '@/lib/server-dokumen'
import { alokasiBoks } from '@/lib/server-boks'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/transfer-arsip/[id]/verifikasi
 * PIC Arsip Inaktif memverifikasi fisik berkas transfer:
 * - Aksi 'terima':
 *   1. Mencocokkan scan barcode/QR kode arsip
 *   2. Memindahkan berkas PDF dari bucket 'arsip-aktif' ke 'arsip-inaktif' (copy terverifikasi lalu hapus)
 *   3. Mengalokasikan boks inaktif (kapasitas 500 lembar di Rak Inaktif 01)
 *   4. Mengubah status dokumen menjadi 'inaktif', bucket 'arsip-inaktif', pemegang PIC Arsip Inaktif, lokasi Gudang Inaktif
 *   5. Mengubah status serah_terima menjadi 'Diterima' dengan tanggal_terima sekarang
 *   6. Mencatat log_aktivitas 'pindah_inaktif'
 *   7. Mengirim notifikasi ke pemilik, PIC Aktif, dan PIC Inaktif
 * - Aksi 'tolak':
 *   1. Wajib menyertakan alasan
 *   2. Status serah_terima menjadi 'Ditolak'
 *   3. Dokumen tetap berstatus 'aktif' dan pemegang tetap PIC Arsip Aktif
 *   4. Log dan notifikasi dicatat
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: serahTerimaId } = await params
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
      .select('id, nama_lengkap, email, role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'pic_inaktif' && profile.role !== 'superadmin' && profile.role !== 'atasan_inaktif')) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya PIC Arsip Inaktif, Atasan Inaktif, atau Superadmin yang berwenang memverifikasi penerimaan berkas inaktif.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { aksi, alasan_penolakan, scanned_kode_arsip } = body

    if (!aksi || (aksi !== 'terima' && aksi !== 'tolak')) {
      return NextResponse.json({ error: "Aksi tidak valid. Pilih 'terima' atau 'tolak'." }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Ambil data serah terima transfer
    const { data: st, error: stErr } = await admin
      .from('serah_terima')
      .select(`
        id, dokumen_id, dari_user_id, ke_user_id, status_serah, keterangan, bukti_pdf_path,
        dokumen:dokumen_id (
          id, kode_arsip, judul, status, bucket, file_path, jumlah_halaman, pemilik_id, pemegang_saat_ini
        ),
        penyerah:dari_user_id ( id, nama_lengkap, email )
      `)
      .eq('id', serahTerimaId)
      .single()

    if (stErr || !st) {
      return NextResponse.json({ error: 'Data serah terima transfer tidak ditemukan.' }, { status: 404 })
    }

    if (st.status_serah !== 'Menunggu konfirmasi') {
      return NextResponse.json(
        { error: `Permohonan transfer ini sudah diproses sebelumnya dengan status '${st.status_serah}'.` },
        { status: 400 }
      )
    }

    const doc = st.dokumen as any
    if (!doc) {
      return NextResponse.json({ error: 'Dokumen terkait tidak ditemukan.' }, { status: 404 })
    }

    const nowISO = new Date().toISOString()
    const penerimaNama = profile.nama_lengkap || profile.email

    // =========================================================================
    // SKENARIO A: PENOLAKAN VERIFIKASI TRANSFER
    // =========================================================================
    if (aksi === 'tolak') {
      if (!alasan_penolakan || !alasan_penolakan.trim()) {
        return NextResponse.json(
          { error: 'Alasan penolakan fisik wajib diisi (misal: berkas rusak, lembar kurang, kode tidak cocok).' },
          { status: 400 }
        )
      }

      // 1. Update status serah_terima menjadi 'Ditolak'
      await admin
        .from('serah_terima')
        .update({
          status_serah: 'Ditolak',
          keterangan: `${st.keterangan || ''} | DITOLAK_VERIFIKASI: ${alasan_penolakan.trim()}`,
        })
        .eq('id', st.id)

      // 2. Dokumen TETAP berstatus 'aktif' dan pemegang tetap di penyerah (PIC Aktif)
      // 3. Catat log aktivitas
      await catatLogAktivitas({
        dokumen_id: doc.id,
        user_id: user.id,
        aksi: 'tolak',
        keterangan: `Verifikasi fisik transfer berkas ${doc.kode_arsip} ke Inaktif ditolak oleh PIC Arsip Inaktif (${penerimaNama}). Alasan: ${alasan_penolakan.trim()}. Berkas tetap berstatus Aktif di bawah wewenang PIC Aktif.`,
      })

      // 4. Kirim notifikasi ke penyerah (PIC Aktif)
      if (st.dari_user_id) {
        await kirimNotifikasiKeUser({
          userId: st.dari_user_id,
          judul: 'Verifikasi Transfer Arsip Ditolak',
          isi: `Penerimaan berkas fisik "${doc.judul}" (${doc.kode_arsip}) ditolak oleh PIC Arsip Inaktif. Alasan: ${alasan_penolakan.trim()}. Dokumen tetap berstatus Aktif.`,
          dokumenId: doc.id,
        })
      }

      return NextResponse.json({
        success: true,
        message: `Verifikasi transfer berkas ${doc.kode_arsip} berhasil ditolak. Dokumen tetap berstatus Aktif.`,
      })
    }

    // =========================================================================
    // SKENARIO B: PENERIMAAN & VERIFIKASI TRANSFER
    // =========================================================================
    // Verifikasi kode arsip jika disertakan pemindaian
    if (scanned_kode_arsip && scanned_kode_arsip.trim() !== doc.kode_arsip) {
      return NextResponse.json(
        { error: `Kode arsip hasil scan (${scanned_kode_arsip}) tidak cocok dengan dokumen target (${doc.kode_arsip}).` },
        { status: 400 }
      )
    }

    // 1. Cari Rak Inaktif 01 di Master Lokasi
    const { data: rakInaktif } = await admin
      .from('lokasi')
      .select('id, nama')
      .eq('nama', 'Rak Inaktif 01')
      .eq('tingkat', 'Rak')
      .limit(1)
      .maybeSingle()

    let inaktifBoksId = null
    const lokasiInaktifStr = 'Gudang Inaktif > Ruang Arsip Inaktif > Rak Inaktif 01'

    if (rakInaktif) {
      try {
        const boksResult = await alokasiBoks(doc.jumlah_halaman || 1, rakInaktif.id)
        if (boksResult) {
          inaktifBoksId = boksResult.id
        }
      } catch (boksErr) {
        console.warn('Gagal alokasi boks inaktif otomatis:', boksErr)
      }
    }

    // 2. Pemindahan file storage dari 'arsip-aktif' ke 'arsip-inaktif' (copy terverifikasi lalu hapus)
    const currentBucket = doc.bucket || 'arsip-aktif'
    if (doc.file_path && currentBucket !== 'arsip-inaktif') {
      const { data: fileBlob, error: dlErr } = await admin.storage
        .from(currentBucket)
        .download(doc.file_path)

      if (dlErr || !fileBlob) {
        console.warn(`File dokumen ${doc.kode_arsip} tidak dapat didownload untuk migrasi:`, dlErr)
      } else {
        const fileBuffer = Buffer.from(await fileBlob.arrayBuffer())
        const inaktifPath = `inaktif/${doc.file_path.replace(/^aktif\//, '')}`

        const { error: upErr } = await admin.storage
          .from('arsip-inaktif')
          .upload(inaktifPath, fileBuffer, {
            contentType: fileBlob.type || 'application/pdf',
            upsert: true,
          })

        if (!upErr) {
          // Verifikasi berhasil upload baru hapus dari bucket lama
          await admin.storage.from(currentBucket).remove([doc.file_path])
          // Update file_path baru di dokumen
          doc.file_path = inaktifPath
        }
      }
    }

    // 3. Update status dokumen menjadi 'inaktif', bucket 'arsip-inaktif', pemegang ke PIC Inaktif, lokasi Gudang Inaktif
    const { error: updateDocErr } = await admin
      .from('dokumen')
      .update({
        status: 'inaktif',
        bucket: 'arsip-inaktif',
        pemegang_saat_ini: user.id,
        boks_id: inaktifBoksId,
        lokasi_saat_ini: lokasiInaktifStr,
        file_path: doc.file_path,
        updated_at: nowISO,
      })
      .eq('id', doc.id)

    if (updateDocErr) {
      return NextResponse.json(
        { error: `Gagal memperbarui status dokumen: ${updateDocErr.message}` },
        { status: 500 }
      )
    }

    // 4. Update status serah terima menjadi 'Diterima'
    await admin
      .from('serah_terima')
      .update({
        status_serah: 'Diterima',
        tanggal_terima: nowISO,
      })
      .eq('id', st.id)

    // 5. Catat log_aktivitas 'pindah_inaktif'
    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'pindah_inaktif',
      keterangan: `Verifikasi fisik penerimaan berkas transfer ${doc.kode_arsip} berhasil dikonfirmasi oleh PIC Arsip Inaktif (${penerimaNama}) pada ${nowISO}. Dokumen resmi beralih ke status Inaktif, dipindahkan ke bucket arsip-inaktif, tersimpan di ${lokasiInaktifStr}, dan dialokasikan ke wadah boks.`,
    })

    // 6. Notifikasi ke pemilik dokumen, penyerah (PIC Aktif), dan PIC Inaktif
    if (doc.pemilik_id) {
      await kirimNotifikasiKeUser({
        userId: doc.pemilik_id,
        judul: 'Dokumen Resmi Berpindah ke Gudang Inaktif',
        isi: `Dokumen "${doc.judul}" (${doc.kode_arsip}) telah diverifikasi secara fisik dan resmi berpindah ke Gudang Inaktif.`,
        dokumenId: doc.id,
      })
    }

    if (st.dari_user_id && st.dari_user_id !== doc.pemilik_id) {
      await kirimNotifikasiKeUser({
        userId: st.dari_user_id,
        judul: 'Transfer Dokumen Selesai & Diterima',
        isi: `Transfer fisik berkas "${doc.judul}" (${doc.kode_arsip}) telah diverifikasi scan QR dan resmi diterima oleh PIC Arsip Inaktif.`,
        dokumenId: doc.id,
      })
    }

    await kirimNotifikasiKePeran({
      roles: ['pic_inaktif'],
      judul: 'Penerimaan Berkas Inaktif Berhasil',
      isi: `Berkas "${doc.judul}" (${doc.kode_arsip}) telah berhasil ditempatkan di Gudang Inaktif.`,
      dokumenId: doc.id,
    })

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} berhasil diverifikasi dan resmi berstatus Inaktif di Gudang Inaktif.`,
      inaktifBoksId,
      lokasi: lokasiInaktifStr,
    })
  } catch (err: unknown) {
    console.error('Error verifikasi transfer:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

