import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/transfer-arsip/ba-pdf?path=...
 * Mengunduh atau menampilkan berkas PDF Berita Acara Penyerahan Arsip.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda belum login.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
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

