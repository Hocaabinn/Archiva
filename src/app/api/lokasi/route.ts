import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLokasiMetadataMap, saveLokasiMetadata } from '@/lib/server-lokasi'

export const dynamic = 'force-dynamic'

export interface LokasiItem {
  id: string
  kode: string
  nama: string
  tingkat: 'Gedung' | 'Ruangan' | 'Rak'
  status: 'Aktif' | 'Nonaktif'
  parent_id: string | null
  created_at?: string
}

export interface LokasiHierarchyGedung {
  id: string
  kode: string
  nama: string
  tingkat: 'Gedung'
  status: 'Aktif' | 'Nonaktif'
  ruangan: {
    id: string
    kode: string
    nama: string
    tingkat: 'Ruangan'
    status: 'Aktif' | 'Nonaktif'
    rak: {
      id: string
      kode: string
      nama: string
      tingkat: 'Rak'
      status: 'Aktif' | 'Nonaktif'
    }[]
  }[]
}

// Fallback kode generator jika belum diset
function generateFallbackCode(item: { nama: string; tingkat: string }): string {
  const norm = item.nama.toUpperCase().replace(/\s+/g, '-')
  if (item.tingkat === 'Gedung') return `LOC-G-${norm.replace('GEDUNG-', '')}`
  if (item.tingkat === 'Ruangan') return `LOC-R-${norm.replace('RUANG-ARSIP-', '').replace('RUANG-', '')}`
  return `LOC-RAK-${norm.replace('RAK-', '').replace('RAK', '')}`
}

/**
 * GET /api/lokasi
 * Mengembalikan seluruh data Master Lokasi bertingkat Gedung > Ruangan > Rak
 * Mendukung filter ?status=Aktif
 */
export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') // 'Aktif' | 'Nonaktif' | null

    const { data: allLokasi, error } = await admin
      .from('lokasi')
      .select('*')
      .order('nama', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const metaMap = getLokasiMetadataMap()
    const rawList = allLokasi || []
    const lokasiList: LokasiItem[] = rawList.map((l: any) => {
      const meta = metaMap[l.id] || {}
      const resolvedKode = l.kode || meta.kode || generateFallbackCode(l)
      const resolvedStatus: 'Aktif' | 'Nonaktif' =
        (l.status as 'Aktif' | 'Nonaktif') || meta.status || 'Aktif'

      return {
        id: l.id,
        kode: resolvedKode,
        nama: l.nama,
        tingkat: l.tingkat,
        status: resolvedStatus,
        parent_id: l.parent_id,
        created_at: l.created_at,
      }
    })

    // Filter status jika diminta (misal cascade select hanya butuh Aktif)
    const filteredList = statusFilter
      ? lokasiList.filter((l) => l.status === statusFilter)
      : lokasiList

    // Susun hirarki
    const gedungList = filteredList.filter((l) => l.tingkat === 'Gedung')
    const ruanganList = filteredList.filter((l) => l.tingkat === 'Ruangan')
    const rakList = filteredList.filter((l) => l.tingkat === 'Rak')

    const hierarchy: LokasiHierarchyGedung[] = gedungList.map((g) => {
      const childRuangan = ruanganList
        .filter((r) => r.parent_id === g.id)
        .map((r) => {
          const childRak = rakList
            .filter((k) => k.parent_id === r.id)
            .map((k) => ({
              id: k.id,
              kode: k.kode,
              nama: k.nama,
              tingkat: 'Rak' as const,
              status: k.status,
            }))

          return {
            id: r.id,
            kode: r.kode,
            nama: r.nama,
            tingkat: 'Ruangan' as const,
            status: r.status,
            rak: childRak,
          }
        })

      return {
        id: g.id,
        kode: g.kode,
        nama: g.nama,
        tingkat: 'Gedung' as const,
        status: g.status,
        ruangan: childRuangan,
      }
    })

    return NextResponse.json({
      success: true,
      raw: filteredList,
      allRaw: lokasiList,
      hierarchy,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/lokasi
 * Tambah lokasi baru ke Master Lokasi (khusus Superadmin)
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
        { error: 'Akses Ditolak: Hanya Superadmin yang berhak mengelola Master Lokasi.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { kode, nama, parent_id, status } = body

    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama lokasi wajib diisi.' }, { status: 400 })
    }

    const cleanNama = nama.trim()
    const cleanKode = kode ? kode.trim().toUpperCase() : ''
    const cleanStatus: 'Aktif' | 'Nonaktif' = status === 'Nonaktif' ? 'Nonaktif' : 'Aktif'

    const admin = createAdminClient()

    // Cek parent dan tentukan tingkat otomatis
    let tingkat: 'Gedung' | 'Ruangan' | 'Rak' = 'Gedung'
    let resolvedParentId: string | null = null

    if (parent_id && parent_id !== 'root' && parent_id !== '') {
      const { data: parentLok, error: parentErr } = await admin
        .from('lokasi')
        .select('*')
        .eq('id', parent_id)
        .single()

      if (parentErr || !parentLok) {
        return NextResponse.json({ error: 'Lokasi induk yang dipilih tidak valid.' }, { status: 400 })
      }

      if (parentLok.tingkat === 'Gedung') {
        tingkat = 'Ruangan'
        resolvedParentId = parentLok.id
      } else if (parentLok.tingkat === 'Ruangan') {
        tingkat = 'Rak'
        resolvedParentId = parentLok.id
      } else if (parentLok.tingkat === 'Rak') {
        return NextResponse.json(
          { error: 'Tolak: Tingkat Rak tidak dapat memiliki lokasi anak (Maksimal 3 tingkat: Gedung > Ruangan > Rak).' },
          { status: 400 }
        )
      }
    }

    // Cek duplikasi kode
    if (cleanKode) {
      const metaMap = getLokasiMetadataMap()
      for (const [id, m] of Object.entries(metaMap)) {
        if (m.kode === cleanKode) {
          return NextResponse.json(
            { error: `Kode lokasi "${cleanKode}" sudah digunakan. Kode harus unik.` },
            { status: 400 }
          )
        }
      }
    }

    // Cek duplikasi nama di bawah induk yang sama
    const existingNameQuery = admin
      .from('lokasi')
      .select('id, nama')
      .ilike('nama', cleanNama)
      .eq('tingkat', tingkat)

    if (resolvedParentId) {
      existingNameQuery.eq('parent_id', resolvedParentId)
    } else {
      existingNameQuery.is('parent_id', null)
    }

    const { data: existingName } = await existingNameQuery.maybeSingle()
    if (existingName) {
      return NextResponse.json(
        { error: `Lokasi dengan nama "${cleanNama}" sudah ada pada tingkat ${tingkat} ini.` },
        { status: 400 }
      )
    }

    // Insert payload
    const insertPayload: Record<string, any> = {
      nama: cleanNama,
      tingkat,
      parent_id: resolvedParentId,
    }
    if (cleanKode) insertPayload.kode = cleanKode
    insertPayload.status = cleanStatus

    let created: any = null
    const { data: insData, error: insertErr } = await admin
      .from('lokasi')
      .insert(insertPayload)
      .select()

    if (insertErr) {
      // Jika kolom kode/status belum ada di DB table, insert kolom dasar
      const { data: fallbackIns, error: fbErr } = await admin
        .from('lokasi')
        .insert({
          nama: cleanNama,
          tingkat,
          parent_id: resolvedParentId,
        })
        .select()

      if (fbErr || !fallbackIns || fallbackIns.length === 0) {
        return NextResponse.json({ error: fbErr?.message || 'Gagal menambahkan lokasi.' }, { status: 500 })
      }

      const row = fallbackIns[0]
      const finalKode = cleanKode || generateFallbackCode(row)
      saveLokasiMetadata(row.id, { kode: finalKode, status: cleanStatus })
      created = {
        ...row,
        kode: finalKode,
        status: cleanStatus,
      }
    } else {
      created = insData[0]
    }

    return NextResponse.json({
      success: true,
      message: `Lokasi "${cleanNama}" (${tingkat}) berhasil ditambahkan.`,
      data: created,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
