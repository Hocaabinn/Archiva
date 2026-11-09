import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  catatLogAktivitas,
  kirimNotifikasiKePeran,
} from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

/**
 * POST /api/peminjaman/ajukan
 * Mengajukan peminjaman dokumen Inaktif (Blueprint 3.6 & Kamus Data 4.4).
 * - Pengguna login mengajukan ke PIC Arsip Inaktif.
 * - ATURAN KERAS: Hanya dokumen dengan status 'inaktif' yang dapat dipinjam.
 * - Status dokumen TETAP 'inaktif' dan file TETAP di bucket 'arsip-inaktif'.
 * - Tidak ada batas lama pinjam atau pengembalian otomatis.
 */
export async function POST(request: NextRequest) {
  try {
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role === 'viewer') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Peran Viewer tidak diizinkan mengajukan peminjaman.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const dokumenId = body.dokumen_id
    const keperluan = (body.keperluan || '').trim()

    if (!dokumenId) {
      return NextResponse.json(
        { error: 'ID dokumen wajib dipilih untuk pengajuan peminjaman.' },
        { status: 400 }
      )
    }

    if (!keperluan) {
      return NextResponse.json(
        { error: 'Keperluan peminjaman wajib diisi.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Ambil data dokumen
    const { data: doc, error: docError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, status, bucket, lokasi_saat_ini')
      .eq('id', dokumenId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Dokumen tidak ditemukan dalam sistem.' },
        { status: 404 }
      )
    }

    // ATURAN KERAS BLUEPRINT 3.6:
    // Hanya dokumen Inaktif yang boleh dipinjam
    if (doc.status !== 'inaktif') {
      return NextResponse.json(
        {
          error: `Dokumen tidak dapat dipinjam karena status saat ini '${doc.status}'. Sesuai ketentuan Blueprint 3.6, hanya dokumen Inaktif yang dapat dipinjam. Dokumen Aktif dapat diakses langsung.`,
        },
        { status: 400 }
      )
    }

    // Cek apakah ada pengajuan aktif lain yang belum selesai untuk dokumen ini
    const { data: activeLoan } = await admin
      .from('peminjaman')
      .select('id, status, peminjam_id')
      .eq('dokumen_id', doc.id)
      .in('status', ['Diajukan', 'Disetujui', 'Dipinjam'])
      .maybeSingle()

    if (activeLoan) {
      return NextResponse.json(
        {
          error: `Dokumen ini sedang dalam status peminjaman (${activeLoan.status}) dan belum dikembalikan.`,
        },
        { status: 400 }
      )
    }

    // Insert ke tabel peminjaman
    const { data: newLoan, error: insError } = await admin
      .from('peminjaman')
      .insert({
        dokumen_id: doc.id,
        peminjam_id: user.id,
        tanggal_pinjam: new Date().toISOString(),
        status: 'Diajukan',
        keperluan,
      })
      .select()
      .single()

    if (insError) {
      console.error('Error insert peminjaman:', insError)
      return NextResponse.json({ error: insError.message }, { status: 500 })
    }

    const peminjamNama = profile.nama_lengkap || profile.nama || user.email || 'Pengguna'

    // Catat ke log aktivitas
    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'peminjaman',
      keterangan: `Pengajuan peminjaman dokumen Inaktif "${doc.judul}" (${doc.kode_arsip}) oleh ${peminjamNama}. Keperluan: "${keperluan}".`,
    })

    // Kirim notifikasi ke PIC Arsip Inaktif (semua pic_arsip)
    await kirimNotifikasiKePeran({
      roles: ['pic_arsip'],
      judul: 'Pengajuan Peminjaman Dokumen Inaktif',
      isi: `${peminjamNama} mengajukan peminjaman dokumen inaktif "${doc.judul}" (${doc.kode_arsip}). Keperluan: "${keperluan}".`,
      dokumenId: doc.id,
    })

    return NextResponse.json({
      success: true,
      message: 'Pengajuan peminjaman dokumen inaktif berhasil dikirim ke PIC Arsip.',
      data: newLoan,
    })
  } catch (err: unknown) {
    console.error('Error in POST /api/peminjaman/ajukan:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

