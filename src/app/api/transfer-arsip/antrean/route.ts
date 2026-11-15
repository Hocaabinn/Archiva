import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/transfer-arsip/antrean
 * Mengambil daftar dokumen yang sedang diajukan untuk transfer dan menunggu verifikasi PIC Arsip Inaktif.
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

    const admin = createAdminClient()

    const { data: list, error: listErr } = await admin
      .from('serah_terima')
      .select(`
        id, dokumen_id, dari_user_id, ke_user_id, dari_lokasi, ke_lokasi,
        status_serah, tanggal_serah, tanggal_terima, keterangan, bukti_pdf_path, created_at,
        dokumen:dokumen_id (
          id, kode_arsip, judul, status, jumlah_halaman, tanggal_kadaluarsa,
          kategori_dokumen:kategori_id ( nama )
        ),
        penyerah:dari_user_id ( id, nama_lengkap, email, jabatan )
      `)
      .ilike('keterangan', '%TRANSFER_INAKTIF%')
      .order('created_at', { ascending: false })

    if (listErr) {
      throw listErr
    }

    return NextResponse.json({
      success: true,
      data: list || [],
    })
  } catch (err: unknown) {
    console.error('Error get antrean transfer:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
