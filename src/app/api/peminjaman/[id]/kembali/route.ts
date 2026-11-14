import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  catatLogAktivitas,
  kirimNotifikasiKeUser,
  kirimNotifikasiKePeran,
} from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

/**
 * POST /api/peminjaman/[id]/kembali
 * Pengembalian Dokumen Inaktif (Blueprint 3.6).
 * - Peminjam atau PIC Arsip (atau Admin) mencatat pengembalian berkas fisik.
 * - Status peminjaman menjadi 'Dikembalikan', tanggal_kembali dicatat.
 * - ATURAN KERAS: Status dokumen TETAP 'inaktif' dan berkas TETAP di bucket 'arsip-inaktif' (Gudang Inaktif).
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

    // Hanya peminjam atau PIC Arsip Inaktif/Superadmin yang boleh mengonfirmasi pengembalian
    const isBorrower = loan.peminjam_id === user.id
    const isStaff = profile?.role === 'pic_inaktif' || profile?.role === 'superadmin'

    if (!isBorrower && !isStaff) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya peminjam dokumen atau PIC Arsip Inaktif yang dapat memproses pengembalian.' },
        { status: 403 }
      )
    }

    if (loan.status !== 'Dipinjam') {
      return NextResponse.json(
        { error: `Dokumen tidak sedang dalam status Dipinjam (status saat ini: '${loan.status}').` },
        { status: 400 }
      )
    }

    const userNama = profile?.nama_lengkap || profile?.nama || user.email || 'Pengguna'
    const doc = Array.isArray(loan.dokumen) ? loan.dokumen[0] : loan.dokumen
    const returnTime = new Date().toISOString()

    // Update peminjaman status menjadi 'Dikembalikan'
    const { data: updatedLoan, error: upError } = await admin
      .from('peminjaman')
      .update({
        status: 'Dikembalikan',
        tanggal_kembali: returnTime,
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
      keterangan: `Dokumen Inaktif "${doc?.judul}" (${doc?.kode_arsip}) telah dikembalikan ke Gudang Inaktif oleh ${userNama}. Status peminjaman: Dikembalikan. Status dokumen tetap Inaktif.`,
    })

    // Kirim notifikasi ke Peminjam (jika yang memproses adalah PIC)
    if (!isBorrower) {
      await kirimNotifikasiKeUser({
        userId: loan.peminjam_id,
        judul: 'Dokumen Inaktif Telah Dikembalikan',
        isi: `Dokumen "${doc?.judul}" (${doc?.kode_arsip}) telah dikonfirmasi pengembaliannya oleh PIC Arsip (${userNama}) dan tersimpan di Gudang Inaktif.`,
        dokumenId: loan.dokumen_id,
      })
    }

    // Kirim notifikasi ke seluruh PIC Arsip (jika yang memproses adalah peminjam)
    if (isBorrower) {
      await kirimNotifikasiKePeran({
        roles: ['pic_inaktif'],
        judul: 'Dokumen Inaktif Dikembalikan oleh Peminjam',
        isi: `Peminjam (${userNama}) telah mengembalikan dokumen inaktif "${doc?.judul}" (${doc?.kode_arsip}) ke Gudang Inaktif.`,
        dokumenId: loan.dokumen_id,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Dokumen inaktif berhasil dikembalikan ke Gudang Inaktif. Status peminjaman selesai (Dikembalikan).',
      data: updatedLoan,
    })
  } catch (err: unknown) {
    console.error('Error in POST /api/peminjaman/[id]/kembali:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

