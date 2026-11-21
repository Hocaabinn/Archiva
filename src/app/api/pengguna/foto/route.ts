import { NextResponse } from 'next/server'
import { requireLogin } from '@/lib/server-admin'

export const dynamic = 'force-dynamic'

// Foto diperkecil di klien (256px JPEG/WebP); batas server sengaja ketat.
const MAKS_KARAKTER = 150_000
const POLA = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/

/** POST /api/pengguna/foto — ubah foto profil milik sendiri. Body: { foto: dataURL } */
export async function POST(request: Request) {
  try {
    const auth = await requireLogin()
    if ('error' in auth) return auth.error

    const body = await request.json().catch(() => null)
    const foto = body?.foto
    if (typeof foto !== 'string' || foto.length > MAKS_KARAKTER || !POLA.test(foto)) {
      return NextResponse.json({ error: 'Foto tidak valid atau terlalu besar.' }, { status: 400 })
    }

    const { error } = await auth.admin
      .from('profiles')
      .update({ avatar_url: foto, updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
    if (error) throw error

    return NextResponse.json({ data: { avatar_url: foto } })
  } catch (err: unknown) {
    console.error('Error POST /api/pengguna/foto:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }, { status: 500 })
  }
}

/** DELETE /api/pengguna/foto — kembali ke foto bawaan role. */
export async function DELETE() {
  try {
    const auth = await requireLogin()
    if ('error' in auth) return auth.error

    const { error } = await auth.admin
      .from('profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
    if (error) throw error

    return NextResponse.json({ data: { avatar_url: null } })
  } catch (err: unknown) {
    console.error('Error DELETE /api/pengguna/foto:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }, { status: 500 })
  }
}
