import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/master-data
 * Mengambil data Master Organisasi dan Master Kategori (khusus Superadmin)
 */
export async function GET() {
  try {
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

    if (profile?.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Superadmin yang berhak mengakses Master Data.' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    // 1. Ambil Unit Organisasi
    const { data: organisasi, error: orgErr } = await admin
      .from('unit_organisasi')
      .select('*')
      .order('nama', { ascending: true })

    if (orgErr) {
      console.warn('Gagal memuat unit_organisasi:', orgErr)
    }

    // 2. Ambil Kategori Dokumen
    const { data: kategori, error: katErr } = await admin
      .from('kategori_dokumen')
      .select('*')
      .order('nama', { ascending: true })

    if (katErr) {
      console.warn('Gagal memuat kategori_dokumen:', katErr)
    }

    return NextResponse.json({
      success: true,
      organisasi: organisasi || [
        { id: '1', nama: 'Keuangan', kode_perusahaan: '2000' },
        { id: '2', nama: 'Legal', kode_perusahaan: '2000' },
      ],
      kategori: kategori || [
        { id: 'keu', nama: 'Keuangan', kode: 'KEU', deskripsi: 'Arsip pertanggungjawaban keuangan, bukti kas, invoice, dan perpajakan', is_active: true },
        { id: 'sdm', nama: 'SDM', kode: 'SDM', deskripsi: 'Arsip kepegawaian, surat tugas, berkas pelamar, dan penilaian kinerja', is_active: true },
        { id: 'ktr', nama: 'Kontrak', kode: 'KTR', deskripsi: 'Perjanjian kerjasama pengadaan barang/jasa dan berkas hukum kemitraan', is_active: true },
      ],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/master-data
 * Menambah unit organisasi atau kategori baru
 */
export async function POST(req: NextRequest) {
  try {
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

    if (profile?.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Superadmin yang berhak menambah Master Data.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { tipe, nama, kode, deskripsi } = body

    const admin = createAdminClient()

    if (tipe === 'organisasi') {
      if (!nama || !nama.trim()) {
        return NextResponse.json({ error: 'Nama unit organisasi wajib diisi.' }, { status: 400 })
      }
      const { data: newOrg, error: orgErr } = await admin
        .from('unit_organisasi')
        .insert({
          nama: nama.trim(),
          kode_perusahaan: '2000',
        })
        .select()
        .single()

      if (orgErr) {
        return NextResponse.json({ error: orgErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, data: newOrg })
    }

    if (tipe === 'kategori') {
      if (!nama || !kode) {
        return NextResponse.json({ error: 'Nama dan kode kategori wajib diisi.' }, { status: 400 })
      }
      const { data: newKat, error: katErr } = await admin
        .from('kategori_dokumen')
        .insert({
          nama: nama.trim(),
          kode: kode.trim().toUpperCase(),
          deskripsi: deskripsi?.trim() || null,
          is_active: true,
        })
        .select()
        .single()

      if (katErr) {
        return NextResponse.json({ error: katErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, data: newKat })
    }

    return NextResponse.json({ error: 'Tipe master data tidak valid.' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

