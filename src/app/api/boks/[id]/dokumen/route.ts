import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/boks/[id]/dokumen
 * Mengambil daftar dokumen yang menempati boks ini beserta jumlah lembar dokumen di dalam boks (Aturan M9)
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const admin = createAdminClient()

    // 1. Ambil dari relasi multi-boks (dokumen_boks)
    const { data: dboksList, error: errDboks } = await admin
      .from('dokumen_boks')
      .select(`
        id, dokumen_id, jumlah_lembar, urutan,
        dokumen:dokumen_id (
          id, kode_arsip, judul, status, jumlah_halaman,
          pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email )
        )
      `)
      .eq('boks_id', id)
      .order('urutan', { ascending: true })

    if (errDboks) {
      console.error('Error fetch dokumen_boks:', errDboks)
    }

    if (dboksList && dboksList.length > 0) {
      const items = dboksList.map((db: any) => ({
        id: db.dokumen?.id || db.dokumen_id,
        kode_arsip: db.dokumen?.kode_arsip || '-',
        judul: db.dokumen?.judul || 'Dokumen Arsip',
        status: db.dokumen?.status || 'aktif',
        total_halaman: db.dokumen?.jumlah_halaman || db.jumlah_lembar,
        lembar_di_boks: db.jumlah_lembar,
        urutan: db.urutan,
        pemilik_nama: db.dokumen?.pemilik?.nama_lengkap || db.dokumen?.pemilik?.email || 'PIC Unit',
      }))

      return NextResponse.json({ success: true, dokumen: items })
    }

    // 2. Fallback untuk dokumen lama sebelum migrasi dokumen_boks
    const { data: fallbackDocs, error: errFallback } = await admin
      .from('dokumen')
      .select(`
        id, kode_arsip, judul, status, jumlah_halaman,
        pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email )
      `)
      .eq('boks_id', id)
      .order('created_at', { ascending: false })

    if (errFallback) {
      return NextResponse.json({ error: errFallback.message }, { status: 500 })
    }

    const fallbackItems = (fallbackDocs || []).map((d: any) => ({
      id: d.id,
      kode_arsip: d.kode_arsip,
      judul: d.judul,
      status: d.status,
      total_halaman: d.jumlah_halaman || 1,
      lembar_di_boks: d.jumlah_halaman || 1,
      urutan: 1,
      pemilik_nama: d.pemilik?.nama_lengkap || d.pemilik?.email || 'PIC Unit',
    }))

    return NextResponse.json({ success: true, dokumen: fallbackItems })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

