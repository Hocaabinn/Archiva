import { NextRequest, NextResponse } from 'next/server'
import { requireLogin, PERAN_OPERASIONAL } from '@/lib/server-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/transfer-arsip/ba-pdf?path=...
 * Mengunduh atau menampilkan berkas PDF Berita Acara Penyerahan Arsip.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireLogin(PERAN_OPERASIONAL)
    if ('error' in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    // Hanya berkas Berita Acara (awalan berita-acara/) yang boleh diambil lewat endpoint ini.
    if (
      !filePath ||
      !filePath.startsWith('berita-acara/') ||
      filePath.includes('..') ||
      filePath.includes('\\')
    ) {
      return NextResponse.json({ error: 'Parameter path tidak valid.' }, { status: 400 })
    }

    const admin = createAdminClient()
    let downloadRes = await admin.storage.from('arsip-aktif').download(filePath)
    if (downloadRes.error || !downloadRes.data) {
      downloadRes = await admin.storage.from('arsip-inaktif').download(filePath)
    }

    const { data: fileData, error: dlErr } = downloadRes

    if (dlErr || !fileData) {
      return NextResponse.json({ error: 'Berkas Berita Acara tidak ditemukan.' }, { status: 404 })
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Berita_Acara_Penyerahan.pdf"`,
      },
    })
  } catch (err: unknown) {
    console.error('Error download BA PDF:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

