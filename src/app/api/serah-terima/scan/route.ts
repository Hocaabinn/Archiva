import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/serah-terima/scan?code=...
 * Mencari dokumen berdasarkan kode arsip (atau nomor payment / doc voucher)
 * untuk alur serah terima scan (Blueprint 3.5 & 8.3).
 *
 * ATURAN KERAS:
 * - Hanya dokumen berstatus 'aktif' yang dapat diserahterimakan!
 * - Menolak dokumen inaktif, menunggu persetujuan, ditolak, atau dibatalkan.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus login terlebih dahulu.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    let rawCode = (searchParams.get('code') || '').trim()

    if (!rawCode) {
      return NextResponse.json(
        { error: 'Kode arsip atau hasil pemindaian tidak boleh kosong.' },
        { status: 400 }
      )
    }

    // Jika pemindaian membaca teks URL (misal http://localhost:3000/dokumen/... atau tautan sistem lain),
    // sistem mengekstrak kode arsip murni dari segmen URL terakhir secara cerdas
    if (rawCode.startsWith('http://') || rawCode.startsWith('https://')) {
      try {
        const parsed = new URL(rawCode)
        const segments = parsed.pathname.split('/').filter(Boolean)
        const lastSegment = segments[segments.length - 1]
        if (lastSegment) {
          rawCode = decodeURIComponent(lastSegment).trim()
        }
      } catch {
        // Biarkan rawCode apa adanya jika gagal parse URL
      }
    }

    // Hapus tanda petik bila terbawa dari scanner
    rawCode = rawCode.replace(/^["']|["']$/g, '').trim()

    const admin = createAdminClient()

    // 1. Cari exact match kode_arsip lebih dulu (atau ID jika UUID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCode)

    let { data: doc } = await admin
      .from('dokumen')
      .select(`
        id, kode_arsip, nomor_dokumen, nomor_ppl, judul, status,
        kategori_id, lokasi_saat_ini, bucket, file_path, barcode_path,
        pemilik_id, pemegang_saat_ini, tanggal_dokumen, tanggal_disetujui, tanggal_kadaluarsa,
        kategori_dokumen:kategori_id ( id, nama, kode ),
        pemegang:pemegang_saat_ini ( id, nama_lengkap, email, jabatan, nomor_pegawai ),
        pemilik:pemilik_id ( id, nama_lengkap, email )
      `)
      .or(isUuid ? `id.eq.${rawCode},kode_arsip.ilike.${rawCode}` : `kode_arsip.ilike.${rawCode}`)
      .maybeSingle()

    // 2. Jika tidak ditemukan, coba cari berdasarkan nomor_ppl atau nomor_dokumen (doc voucher)
    if (!doc) {
      const { data: altDoc } = await admin
        .from('dokumen')
        .select(`
          id, kode_arsip, nomor_dokumen, nomor_ppl, judul, status,
          kategori_id, lokasi_saat_ini, bucket, file_path, barcode_path,
          pemilik_id, pemegang_saat_ini, tanggal_dokumen, tanggal_disetujui, tanggal_kadaluarsa,
          kategori_dokumen:kategori_id ( id, nama, kode ),
          pemegang:pemegang_saat_ini ( id, nama_lengkap, email, jabatan, nomor_pegawai ),
          pemilik:pemilik_id ( id, nama_lengkap, email )
        `)
        .or(`nomor_ppl.eq.${rawCode},nomor_dokumen.eq.${rawCode},kode_arsip.ilike.%${rawCode}%`)
        .limit(1)
        .maybeSingle()

      doc = altDoc
    }

    if (!doc) {
      return NextResponse.json(
        {
          error: `Dokumen dengan kode atau nomor "${rawCode}" tidak ditemukan dalam pangkalan data arsip.`,
          found: false,
        },
        { status: 404 }
      )
    }

    // 3. ATURAN KERAS BLUEPRINT 3.5 & 8.3:
    // "Hanya dokumen Aktif yang dapat diserahterimakan. Melarang serah terima dokumen Inaktif sebagai dokumen aktif sampai diaktivasi ulang."
    if (doc.status !== 'aktif') {
      const statusIndo =
        doc.status === 'menunggu_persetujuan'
          ? 'Menunggu Persetujuan'
          : doc.status === 'inaktif'
          ? 'Inaktif'
          : doc.status === 'ditolak'
          ? 'Ditolak'
          : doc.status === 'dibatalkan'
          ? 'Dibatalkan'
          : doc.status

      return NextResponse.json(
        {
          error: `Dokumen "${doc.kode_arsip}" ditemukan tetapi berstatus '${statusIndo}'. Sesuai ketentuan kearsipan resmi (Blueprint Bab 7, 3.5, & 8.3), hanya dokumen berstatus Aktif yang dapat diserahterimakan fisik. Dokumen ${statusIndo} tidak dapat diproses serah terima.`,
          found: true,
          status: doc.status,
          canTransfer: false,
          dokumen: {
            id: doc.id,
            kode_arsip: doc.kode_arsip,
            judul: doc.judul,
            status: doc.status,
          },
        },
        { status: 400 }
      )
    }

    // Dokumen aktif dan siap untuk diserahterimakan
    return NextResponse.json({
      found: true,
      canTransfer: true,
      dokumen: {
        id: doc.id,
        kode_arsip: doc.kode_arsip,
        nomor_dokumen: doc.nomor_dokumen,
        nomor_ppl: doc.nomor_ppl,
        judul: doc.judul,
        status: doc.status,
        kategori: (doc.kategori_dokumen as any)?.nama || 'Umum',
        lokasi_saat_ini: doc.lokasi_saat_ini || 'Ruang Arsip Aktif',
        pemegang_id: doc.pemegang_saat_ini || doc.pemilik_id,
        pemegang_nama: (doc.pemegang as any)?.nama_lengkap || (doc.pemegang as any)?.email || (doc.pemilik as any)?.nama_lengkap || 'Belum Ditentukan',
        pemegang_email: (doc.pemegang as any)?.email || (doc.pemilik as any)?.email || '',
        pemegang_jabatan: (doc.pemegang as any)?.jabatan || '-',
        tanggal_dokumen: doc.tanggal_dokumen,
        tanggal_kadaluarsa: doc.tanggal_kadaluarsa,
        barcode_path: doc.barcode_path,
      },
    })
  } catch (err: unknown) {
    console.error('Error in GET /api/serah-terima/scan:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
