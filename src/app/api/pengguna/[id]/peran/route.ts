import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, DAFTAR_PERAN, LABEL_PERAN, type Peran } from '@/lib/server-admin'
import { catatLogAktivitas, kirimNotifikasiKeUser } from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/pengguna/[id]/peran  body: { role }
 * Mengubah peran pengguna. Hanya Admin Sistem (selain itu 403).
 * Peran baru berlaku saat pengguna tersebut login kembali.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request)
    if ('error' in auth) return auth.error

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const role = body?.role as Peran

    if (!DAFTAR_PERAN.includes(role)) {
      return NextResponse.json(
        { error: `Peran tidak valid. Pilihan: ${DAFTAR_PERAN.join(', ')}.` },
        { status: 400 }
      )
    }

    // Cegah Admin menurunkan perannya sendiri (agar sistem tidak kehilangan Admin secara tidak sengaja)
    if (id === auth.user.id && role !== 'admin') {
      return NextResponse.json(
        { error: 'Anda tidak dapat mengubah peran akun Anda sendiri. Minta Admin lain untuk melakukannya.' },
        { status: 400 }
      )
    }

    const { data: target } = await auth.admin
      .from('profiles')
      .select('id, email, nama_lengkap, role')
      .eq('id', id)
      .single()

    if (!target) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 })
    }

    if (target.role === role) {
      return NextResponse.json({ success: true, unchanged: true, data: target })
    }

    const { data: updated, error } = await auth.admin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, email, nama_lengkap, role')
      .single()

    if (error) throw error

    const namaTarget = target.nama_lengkap || target.email
    const namaAdmin = auth.profile?.nama_lengkap || auth.profile?.email || 'Admin'
    const dari = LABEL_PERAN[target.role as Peran] || target.role
    const ke = LABEL_PERAN[role]

    await catatLogAktivitas({
      user_id: auth.user.id,
      aksi: 'ubah_peran',
      keterangan: `Peran ${namaTarget} diubah dari ${dari} menjadi ${ke} oleh ${namaAdmin}.`,
    })
    await kirimNotifikasiKeUser({
      userId: id,
      judul: 'Peran Akun Diperbarui',
      isi: `Peran akun Anda diubah dari ${dari} menjadi ${ke}. Silakan keluar lalu masuk kembali agar menu dan hak akses mengikuti peran baru.`,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Peran ${namaTarget} berhasil diubah menjadi ${ke}.`,
    })
  } catch (err: unknown) {
    console.error('Error PATCH /api/pengguna/[id]/peran:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
