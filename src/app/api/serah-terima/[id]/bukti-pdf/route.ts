import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBuktiSerahTerimaPDF } from '@/lib/pdf-serah-terima'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/serah-terima/[id]/bukti-pdf
 * Mengunduh atau menampilkan berkas resmi PDF Bukti Serah Terima (BAST).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: serahTerimaId } = await params

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const admin = createAdminClient()

    const { data: st, error: stError } = await admin
      .from('serah_terima')
      .select(`
        id, dokumen_id, dari_user_id, ke_user_id, dari_lokasi, ke_lokasi,
        status_serah, tanggal_serah, tanggal_terima, keterangan, bukti_pdf_path,
        dokumen:dokumen_id (
          id, kode_arsip, judul, nomor_dokumen, nomor_ppl, status,
          kategori_dokumen:kategori_id ( nama )
        ),
        penyerah:dari_user_id ( id, nama_lengkap, email, jabatan ),
        penerima:ke_user_id ( id, nama_lengkap, email, jabatan )
      `)
      .eq('id', serahTerimaId)
      .single()

    if (stError || !st) {
      return NextResponse.json({ error: 'Data serah terima tidak ditemukan.' }, { status: 404 })
    }

    if (st.status_serah !== 'Diterima') {
      return NextResponse.json(
        { error: 'Bukti PDF hanya tersedia untuk serah terima yang telah Diterima & Terkonfirmasi.' },
        { status: 400 }
      )
    }

    // Cek hak akses: penyerah, penerima, atau privileged role
    const isParty = st.dari_user_id === user.id || st.ke_user_id === user.id
    const isPrivileged =
      profile?.role === 'superadmin' ||
      profile?.role === 'pic_aktif' ||
      profile?.role === 'atasan_aktif' ||
      profile?.role === 'pic_inaktif' ||
      profile?.role === 'atasan_inaktif'
    if (!isParty && !isPrivileged) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda tidak memiliki wewenang untuk mengunduh bukti serah terima ini.' },
        { status: 403 }
      )
    }

    // 1. Cek apakah file sudah tersimpan di Supabase Storage
    if (st.bukti_pdf_path) {
      const { data: fileData, error: downloadError } = await admin.storage
        .from('arsip-aktif')
        .download(st.bukti_pdf_path)

      if (!downloadError && fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer())
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="BAST_${st.id.slice(0, 8)}.pdf"`,
            'Cache-Control': 'public, max-age=3600',
          },
        })
      }
    }

    // 2. Jika belum ada di storage, buat on-the-fly dan simpan
    const doc = st.dokumen as any
    const penyerahData = st.penyerah as any
    const penerimaData = st.penerima as any
    const nomorBast = `BAST/${new Date(st.tanggal_serah).getFullYear()}${String(new Date(st.tanggal_serah).getMonth() + 1).padStart(2, '0')}/${st.id.slice(0, 8).toUpperCase()}`

    const pdfBytes = await generateBuktiSerahTerimaPDF({
      id: st.id,
      nomorBast,
      tanggalSerah: st.tanggal_serah,
      tanggalTerima: st.tanggal_terima || new Date().toISOString(),
      statusSerah: 'Diterima',
      dokumen: {
        id: doc?.id || '',
        kodeArsip: doc?.kode_arsip || '',
        judul: doc?.judul || '',
        nomorDokumen: doc?.nomor_dokumen || undefined,
        nomorPpl: doc?.nomor_ppl || undefined,
        kategori: doc?.kategori_dokumen?.nama || 'Umum',
      },
      penyerah: {
        nama: penyerahData?.nama_lengkap || penyerahData?.email || 'Penyerah',
        email: penyerahData?.email || '',
        jabatan: penyerahData?.jabatan,
        lokasiAsal: st.dari_lokasi || 'Lokasi Penyerah',
      },
      penerima: {
        nama: penerimaData?.nama_lengkap || penerimaData?.email || 'Penerima',
        email: penerimaData?.email || '',
        jabatan: penerimaData?.jabatan,
        lokasiTujuan: st.ke_lokasi || 'Lokasi Penerima',
      },
      keterangan: st.keterangan || undefined,
    })

    // Simpan ke storage untuk request berikutnya
    const storageFilePath = `serah-terima/${st.id}_${nomorBast.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`
    await admin.storage.from('arsip-aktif').upload(storageFilePath, Buffer.from(pdfBytes), {
      contentType: 'application/pdf',
      upsert: true,
    })
    await admin.from('serah_terima').update({ bukti_pdf_path: storageFilePath }).eq('id', st.id)

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="BAST_${st.id.slice(0, 8)}.pdf"`,
      },
    })
  } catch (err: unknown) {
    console.error('Error in GET /api/serah-terima/[id]/bukti-pdf:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
