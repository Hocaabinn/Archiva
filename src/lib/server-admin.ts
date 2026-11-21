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

/** Peran operasional (semua selain staff yang hanya view + download). */
export const PERAN_OPERASIONAL: readonly Peran[] = [
  'superadmin',
  'pic_aktif',
  'atasan_aktif',
  'pic_inaktif',
  'atasan_inaktif',
]

/**
 * Memastikan pemanggil sudah login. Bila `peran` diberikan, role (dibaca dari
 * tabel profiles di server) harus termasuk di dalamnya, selain itu 403.
 */
export async function requireLogin(peran?: readonly Peran[]) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Akses Ditolak: Anda harus login terlebih dahulu.' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()

  if (peran && (!profile || !peran.includes(profile.role as Peran))) {
    return {
      error: NextResponse.json(
        { error: 'Akses Ditolak: Peran Anda tidak memiliki izin untuk fitur ini.' },
        { status: 403 }
      ),
    }
  }

  return { user, profile, admin }
}
