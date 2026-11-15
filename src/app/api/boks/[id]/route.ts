import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndUploadBoksQR } from '@/lib/server-boks'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/boks/[id]
 * Superadmin mengedit nomor boks atau kapasitas maksimal boks (Blueprint 3.5 & RENCANA-MIGRASI M5)
 */
export async function PATCH(
  request: NextRequest,
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
      .select('role')
      .eq('id', user.id)
      .single()

    // Hanya Superadmin yang boleh mengedit boks
    if (profile?.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Superadmin yang berhak mengedit data Boks Arsip.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { nomor_boks, kapasitas_maks_lembar, status } = body

    const updatePayload: Record<string, unknown> = {}

    if (nomor_boks !== undefined) {
      const cleanNomor = String(nomor_boks).trim()
      if (!cleanNomor) {
        return NextResponse.json({ error: 'Nomor boks tidak boleh kosong.' }, { status: 400 })
      }
      updatePayload.nomor_boks = cleanNomor
    }

    if (kapasitas_maks_lembar !== undefined) {
      const cap = parseInt(kapasitas_maks_lembar, 10)
      if (isNaN(cap) || cap <= 0) {
        return NextResponse.json({ error: 'Kapasitas maksimal boks harus bilangan bulat positif.' }, { status: 400 })
      }
      updatePayload.kapasitas_maks_lembar = cap
    }

    if (status !== undefined) {
      if (!['Aktif', 'Penuh'].includes(status)) {
        return NextResponse.json({ error: 'Status boks harus Aktif atau Penuh.' }, { status: 400 })
      }
      updatePayload.status = status
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan data yang dikirim.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Update data boks
    const { data: updatedBoks, error: updateErr } = await admin
      .from('boks')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateErr || !updatedBoks) {
      return NextResponse.json({ error: updateErr?.message || 'Boks tidak ditemukan.' }, { status: 500 })
    }

    // Jika nomor_boks diubah, terbitkan QR code baru untuk boks
    if (nomor_boks !== undefined) {
      const newQrPath = await generateAndUploadBoksQR(updatedBoks.id, updatedBoks.nomor_boks)
      if (newQrPath) {
        await admin.from('boks').update({ qr_path: newQrPath }).eq('id', updatedBoks.id)
        updatedBoks.qr_path = newQrPath
      }
    }

    // Catat log audit aktivitas
    await admin.from('log_aktivitas').insert({
      user_id: user.id,
      aksi: 'edit_boks',
      keterangan: `Superadmin mengubah boks id "${id}" -> ${JSON.stringify(updatePayload)}`,
    })

    return NextResponse.json({
      success: true,
      message: 'Data boks berhasil diperbarui.',
      data: updatedBoks,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

