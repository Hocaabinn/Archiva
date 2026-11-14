import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/serah-terima
 * Mengambil daftar serah terima:
 * - Query param `type=menunggu`: khusus serah terima yang ditujukan ke user ini dan berstatus 'Menunggu konfirmasi'
 * - Query param `type=diajukan`: serah terima yang diajukan oleh user ini
 * - Query param `type=semua`: seluruh serah terima (admin/pic melihat semua, user biasa melihat yang terkait)
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
    const type = searchParams.get('type') || 'semua'
    const statusFilter = searchParams.get('status')

    const admin = createAdminClient()

    let query = admin
      .from('serah_terima')
      .select(`
        id, dokumen_id, dari_user_id, ke_user_id, dari_lokasi, ke_lokasi,
        status_serah, tanggal_serah, tanggal_terima, keterangan, bukti_pdf_path, created_at,
        dokumen:dokumen_id (
          id, kode_arsip, judul, nomor_dokumen, nomor_ppl, status, lokasi_saat_ini,
          kategori_dokumen:kategori_id ( nama )
        ),
        penyerah:dari_user_id ( id, nama_lengkap, email, jabatan ),
        penerima:ke_user_id ( id, nama_lengkap, email, jabatan )
      `)
      .order('created_at', { ascending: false })

    if (type === 'menunggu') {
      query = query.eq('ke_user_id', user.id).eq('status_serah', 'Menunggu konfirmasi')
    } else if (type === 'diajukan') {
      query = query.eq('dari_user_id', user.id)
    } else {
      // Jika bukan admin/pic/atasan/accounting, batasi hanya serah terima terkait user
      const isPrivileged =
        profile?.role === 'superadmin' ||
        profile?.role === 'pic_aktif' ||
        profile?.role === 'atasan_aktif' ||
        profile?.role === 'pic_inaktif' ||
        profile?.role === 'atasan_inaktif'
      if (!isPrivileged) {
        query = query.or(`dari_user_id.eq.${user.id},ke_user_id.eq.${user.id}`)
      }
    }

    if (statusFilter && statusFilter !== 'semua') {
      query = query.eq('status_serah', statusFilter)
    }

    const { data: list, error: queryErr } = await query

    if (queryErr) {
      console.error('Error fetching serah_terima list:', queryErr)
      return NextResponse.json({ error: queryErr.message }, { status: 500 })
    }

    return NextResponse.json({
      data: list || [],
    })
  } catch (err: unknown) {
    console.error('Error in GET /api/serah-terima:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
