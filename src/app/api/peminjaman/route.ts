import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/peminjaman
 * Mengambil daftar peminjaman dokumen inaktif.
 * - Pengaju (user): hanya melihat riwayat peminjaman miliknya.
 * - Admin, PIC Arsip, Atasan, Accounting: melihat semua peminjaman.
 * - Viewer: ditolak (tidak berhak melihat operasional peminjaman).
 */
export async function GET(request: NextRequest) {
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
      .select('id, role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'user'

    if (role === 'viewer') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Peran Viewer tidak diizinkan mengakses data peminjaman.' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()
    let query = admin
      .from('peminjaman')
      .select(`
        id, dokumen_id, peminjam_id, pic_inaktif_id,
        tanggal_pinjam, tanggal_kembali, status, keperluan, created_at,
        dokumen:dokumen (
          id, kode_arsip, judul, status, lokasi_saat_ini, bucket,
          kategori_dokumen ( nama )
        ),
        peminjam:profiles!peminjaman_peminjam_id_fkey (
          id, nama_lengkap, email, nomor_pegawai, jabatan
        ),
        pic_inaktif:profiles!peminjaman_pic_inaktif_id_fkey (
          id, nama_lengkap, email
        )
      `)
      .order('created_at', { ascending: false })

    if (role === 'user') {
      query = query.eq('peminjam_id', user.id)
    }

    const { data: list, error: qError } = await query

    if (qError) {
      console.error('Error fetching peminjaman:', qError)
      return NextResponse.json({ error: qError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: list || [],
    })
  } catch (err: unknown) {
    console.error('Error in GET /api/peminjaman:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

