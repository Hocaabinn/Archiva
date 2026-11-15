import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/boks
 * Mengambil daftar seluruh Boks Arsip beserta info Rak dan Lokasinya
 */
export async function GET() {
  try {
    const admin = createAdminClient()
    const { data: boksList, error } = await admin
      .from('boks')
      .select(`
        id, nomor_boks, rak_id, kapasitas_maks_lembar, jumlah_lembar_terisi, qr_path, status, created_at,
        rak:rak_id ( id, nama, tingkat, parent_id )
      `)
      .order('nomor_boks', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: boksList || [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
