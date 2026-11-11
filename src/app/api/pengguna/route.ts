import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pengguna — daftar seluruh pengguna (khusus Admin Sistem).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('error' in auth) return auth.error

    const { data, error } = await auth.admin
      .from('profiles')
      .select('id, email, nama_lengkap, nama, nomor_pegawai, jabatan, role, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data: data || [], currentUserId: auth.user.id })
  } catch (err: unknown) {
    console.error('Error GET /api/pengguna:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
