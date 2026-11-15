import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/dokumen/[id]/persetujuan-hapus
 * Atasan (atasan_aktif / atasan_inaktif) menyetujui rekomendasi penghapusan arsip (Blueprint Bab 5 & 10.2)
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda belum login.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, nama_lengkap, email')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    if (role !== 'atasan_aktif' && role !== 'atasan_inaktif') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Atasan Arsip yang berhak memberikan persetujuan hapus dokumen.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { alasan } = body

    if (!alasan || !alasan.trim()) {
      return NextResponse.json({ error: 'Alasan persetujuan hapus wajib diisi.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Cek keberadaan dokumen
    const { data: doc, error: docErr } = await admin
      .from('dokumen')
      .select('id, kode_arsip, status')
      .eq('id', id)
      .single()

    if (docErr || !doc) {
      return NextResponse.json({ error: 'Dokumen arsip tidak ditemukan.' }, { status: 404 })
    }

    const namaApprover = profile?.nama_lengkap || profile?.email || 'Atasan Arsip'

    // Catat log persetujuan_hapus
    const { error: logErr } = await admin.from('log_aktivitas').insert({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'persetujuan_hapus',
      keterangan: `Atasan (${namaApprover}) menyetujui permohonan penghapusan permanen arsip. Alasan: ${alasan.trim()}`,
    })

    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Persetujuan hapus untuk dokumen ${doc.kode_arsip} berhasil dicatat di log aktivitas. Superadmin kini berwenang mengeksekusi penghapusan permanen.`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
