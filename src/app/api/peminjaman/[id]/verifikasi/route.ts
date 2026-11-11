import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  catatLogAktivitas,
  kirimNotifikasiKeUser,
} from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

/**
 * POST /api/peminjaman/[id]/verifikasi
 * Verifikasi & Persetujuan/Penolakan Peminjaman oleh PIC Arsip Inaktif (Blueprint 3.6).
 * - Hanya PIC Arsip (pic_arsip).
 * - Aksi: 'setujui' -> status peminjaman menjadi 'Dipinjam'.
 * - Aksi: 'tolak' -> status peminjaman menjadi 'Ditolak'.
 * - ATURAN KERAS: Status dokumen TETAP 'inaktif' dan file berkas TETAP di bucket 'arsip-inaktif'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID peminjaman wajib disertakan.' }, { status: 400 })
    }

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

    // Cek peran pengguna: Hanya PIC Arsip yang berhak memverifikasi peminjaman
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'pic_arsip') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya PIC Arsip (pic_arsip) yang berhak memverifikasi peminjaman.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const aksi = body.aksi // 'setujui' | 'tolak'
    const alasan = (body.alasan || '').trim()

    if (aksi !== 'setujui' && aksi !== 'tolak') {
      return NextResponse.json(
        { error: "Aksi tidak valid. Pilih 'setujui' atau 'tolak'." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Ambil data peminjaman
    const { data: loan, error: loanError } = await admin
      .from('peminjaman')
      .select(`
        id, dokumen_id, peminjam_id, status, keperluan,
        dokumen:dokumen ( id, kode_arsip, judul, status, bucket )
      `)
      .eq('id', id)
      .single()

    if (loanError || !loan) {
      return NextResponse.json(
        { error: 'Data peminjaman tidak ditemukan.' },
        { status: 404 }
      )
    }

    if (loan.status !== 'Diajukan') {
      return NextResponse.json(
        { error: `Peminjaman ini sudah diproses sebelumnya dengan status '${loan.status}'.` },
        { status: 400 }
      )
    }

    const picNama = profile.nama_lengkap || profile.nama || user.email || 'PIC Arsip'
    const doc = Array.isArray(loan.dokumen) ? loan.dokumen[0] : loan.dokumen

    if (aksi === 'setujui') {
      // Setujui: Status peminjaman menjadi 'Dipinjam', tanggal_pinjam dicatat, status dokumen TETAP inaktif
      const { data: updatedLoan, error: upError } = await admin
        .from('peminjaman')
        .update({
          status: 'Dipinjam',
          pic_inaktif_id: user.id,
          tanggal_pinjam: new Date().toISOString(),
        })
        .eq('id', loan.id)
        .select()
        .single()

      if (upError) {
        return NextResponse.json({ error: upError.message }, { status: 500 })
      }

      // Catat log aktivitas
      await catatLogAktivitas({
        dokumen_id: loan.dokumen_id,
        user_id: user.id,
        aksi: 'peminjaman',
        keterangan: `Peminjaman dokumen Inaktif "${doc?.judul}" (${doc?.kode_arsip}) disetujui oleh PIC Arsip (${picNama}). Berkas fisik diserahkan kepada peminjam. Status peminjaman: Dipinjam. Status dokumen tetap Inaktif.`,
      })

      // Kirim notifikasi ke peminjam
      await kirimNotifikasiKeUser({
        userId: loan.peminjam_id,
        judul: 'Peminjaman Dokumen Inaktif Disetujui',
        isi: `Pengajuan peminjaman dokumen "${doc?.judul}" (${doc?.kode_arsip}) telah disetujui oleh PIC Arsip (${picNama}). Status: Dipinjam. Silakan ambil berkas fisik di Gudang Inaktif.`,
        dokumenId: loan.dokumen_id,
      })

      return NextResponse.json({
        success: true,
        message: 'Peminjaman dokumen inaktif disetujui. Status peminjaman menjadi Dipinjam.',
        data: updatedLoan,
      })
    } else {
      // Tolak peminjaman
      const { data: updatedLoan, error: upError } = await admin
        .from('peminjaman')
        .update({
          status: 'Ditolak',
          pic_inaktif_id: user.id,
        })
        .eq('id', loan.id)
        .select()
        .single()

      if (upError) {
        return NextResponse.json({ error: upError.message }, { status: 500 })
      }

      // Catat log aktivitas
      await catatLogAktivitas({
        dokumen_id: loan.dokumen_id,
        user_id: user.id,
        aksi: 'peminjaman',
        keterangan: `Pengajuan peminjaman dokumen Inaktif "${doc?.judul}" (${doc?.kode_arsip}) ditolak oleh PIC Arsip (${picNama}). Alasan: "${alasan || 'Tidak ada alasan spesifik'}"`,
      })

      // Kirim notifikasi ke peminjam
      await kirimNotifikasiKeUser({
        userId: loan.peminjam_id,
        judul: 'Peminjaman Dokumen Inaktif Ditolak',
        isi: `Pengajuan peminjaman dokumen "${doc?.judul}" (${doc?.kode_arsip}) ditolak oleh PIC Arsip (${picNama}). Alasan: "${alasan || 'Tidak ada alasan spesifik'}"`,
        dokumenId: loan.dokumen_id,
      })

      return NextResponse.json({
        success: true,
        message: 'Pengajuan peminjaman dokumen inaktif telah ditolak.',
        data: updatedLoan,
      })
    }
  } catch (err: unknown) {
    console.error('Error in POST /api/peminjaman/[id]/verifikasi:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

