import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/riwayat
 * Mengambil data Buku Log Riwayat / Audit Trail (Blueprint 3.7 & 1210).
 * Filter didukung:
 * - `dokumen_id`: riwayat spesifik per dokumen
 * - `user_id`: riwayat spesifik per pelaku / pengguna
 * - `aksi`: jenis aksi (upload, verifikasi, approve, tolak, download, pindah_inaktif, peminjaman, serah_terima, pembatalan)
 * - `start_date` / `end_date`: rentang waktu
 * - `q`: pencarian teks pada keterangan
 */
export async function GET(request: NextRequest) {
  try {
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const { searchParams } = new URL(request.url)
    const dokumenId = searchParams.get('dokumen_id')
    const filterUserId = searchParams.get('user_id')
    const filterAksi = searchParams.get('aksi')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const searchQuery = (searchParams.get('q') || '').trim()
    const limit = Math.min(Number(searchParams.get('limit') || 200), 500)

    const isPrivileged = profile?.role === 'admin' || profile?.role === 'pic_arsip' || profile?.role === 'atasan' || profile?.role === 'accounting'

    const admin = createAdminClient()

    let query = admin
      .from('log_aktivitas')
      .select(`
        id, dokumen_id, user_id, aksi, keterangan, created_at,
        dokumen:dokumen_id ( id, kode_arsip, judul, status, nomor_dokumen, nomor_ppl ),
        user:user_id ( id, nama_lengkap, email, role, jabatan )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Jika pengguna biasa (user / viewer), hanya dapat melihat log terkait dirinya atau dokumen miliknya
    if (!isPrivileged) {
      if (dokumenId) {
        // Cek kepemilikan dokumen
        const { data: userDoc } = await admin
          .from('dokumen')
          .select('id')
          .eq('id', dokumenId)
          .or(`pemilik_id.eq.${user.id},pemegang_saat_ini.eq.${user.id}`)
          .maybeSingle()

        if (!userDoc) {
          query = query.eq('user_id', user.id)
        } else {
          query = query.eq('dokumen_id', dokumenId)
        }
      } else {
        query = query.eq('user_id', user.id)
      }
    } else {
      // Privileged role (Admin, PIC, Atasan, Accounting): dapat memfilter bebas
      if (dokumenId) {
        query = query.eq('dokumen_id', dokumenId)
      }
      if (filterUserId) {
        query = query.eq('user_id', filterUserId)
      }
    }

    if (filterAksi && filterAksi !== 'semua') {
      query = query.eq('aksi', filterAksi)
    }

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00Z`)
    }

    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59Z`)
    }

    if (searchQuery) {
      query = query.ilike('keterangan', `%${searchQuery}%`)
    }

    const { data: logs, error: logsError } = await query

    if (logsError) {
      console.error('Error fetching log_aktivitas:', logsError)
      return NextResponse.json({ error: logsError.message }, { status: 500 })
    }

    return NextResponse.json({
      data: logs || [],
      total: logs?.length || 0,
    })
  } catch (err: unknown) {
    console.error('Error in GET /api/riwayat:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
