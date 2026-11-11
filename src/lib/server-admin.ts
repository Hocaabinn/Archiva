import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const DAFTAR_PERAN = ['admin', 'pic_arsip', 'atasan', 'user', 'accounting', 'viewer'] as const
export type Peran = (typeof DAFTAR_PERAN)[number]

export const LABEL_PERAN: Record<Peran, string> = {
  admin: 'Admin Sistem',
  pic_arsip: 'PIC Arsip',
  atasan: 'Atasan',
  user: 'Pengaju',
  accounting: 'Accounting',
  viewer: 'Viewer',
}

/**
 * Memastikan pemanggil API sudah login DAN berperan Admin Sistem.
 * Peran dibaca dari tabel profiles di server (bukan dari klien).
 * Mengembalikan { error } berupa NextResponse 401/403 bila gagal.
 */
export async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Akses Ditolak: Anda harus login terlebih dahulu.' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, nama_lengkap, email')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return {
      error: NextResponse.json(
        { error: 'Akses Ditolak: Hanya Admin Sistem yang dapat mengelola pengguna dan mengubah peran.' },
        { status: 403 }
      ),
    }
  }

  return { user, profile, admin }
}
