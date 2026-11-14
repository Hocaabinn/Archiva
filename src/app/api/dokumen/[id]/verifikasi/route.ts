import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Tahap verifikasi PIC (Tahap 1) telah dihapus resmi pada R.03 (Blueprint 3.3 poin 2).
 * PIC Arsip Aktif adalah pengentri dokumennya sendiri dan tidak memverifikasi entrinya sendiri.
 * Alur approval langsung: PIC Arsip Aktif entri -> Atasan Arsip Aktif menyetujui/menolak.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Tahap verifikasi PIC telah dihapus pada spesifikasi R.03. Dokumen yang dientri oleh PIC Arsip Aktif langsung masuk ke antrean persetujuan Atasan Arsip Aktif.',
      status: 410,
    },
    { status: 410 }
  )
}
