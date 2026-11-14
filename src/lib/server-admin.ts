import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const DAFTAR_PERAN = [
  'superadmin',
  'pic_aktif',
  'atasan_aktif',
  'pic_inaktif',
  'atasan_inaktif',
  'staff',
] as const
export type Peran = (typeof DAFTAR_PERAN)[number]

export const LABEL_PERAN: Record<Peran, string> = {
  superadmin: 'Superadmin',
  pic_aktif: 'PIC Arsip Aktif',
  atasan_aktif: 'Atasan Arsip Aktif',
  pic_inaktif: 'PIC Arsip Inaktif',
  atasan_inaktif: 'Atasan Arsip Inaktif',
  staff: 'Staff',
}

/**
 * Memastikan pemanggil API sudah login DAN berperan Superadmin.
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

  if (profile?.role !== 'superadmin') {
    return {
      error: NextResponse.json(
        { error: 'Akses Ditolak: Hanya Superadmin yang dapat mengelola pengguna dan mengubah peran.' },
        { status: 403 }
      ),
    }
  }

  return { user, profile, admin }
}
