import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export interface LokasiItem {
  id: string
  nama: string
  tingkat: 'Gedung' | 'Ruangan' | 'Rak'
  parent_id: string | null
  created_at: string
}

export interface LokasiHierarchyGedung {
  id: string
  nama: string
  tingkat: 'Gedung'
  ruangan: {
    id: string
    nama: string
    tingkat: 'Ruangan'
    rak: {
      id: string
      nama: string
      tingkat: 'Rak'
    }[]
  }[]
}

/**
 * GET /api/lokasi
 * Mengembalikan seluruh data Master Lokasi bertingkat Gedung > Ruangan > Rak
 */
export async function GET() {
  try {
    const admin = createAdminClient()
    const { data: allLokasi, error } = await admin
      .from('lokasi')
      .select('*')
      .order('nama', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const lokasiList: LokasiItem[] = allLokasi || []

    // Susun hirarki
    const gedungList = lokasiList.filter((l) => l.tingkat === 'Gedung')
    const ruanganList = lokasiList.filter((l) => l.tingkat === 'Ruangan')
    const rakList = lokasiList.filter((l) => l.tingkat === 'Rak')

    const hierarchy: LokasiHierarchyGedung[] = gedungList.map((g) => {
      const childRuangan = ruanganList
        .filter((r) => r.parent_id === g.id)
        .map((r) => {
          const childRak = rakList.filter((k) => k.parent_id === r.id).map((k) => ({
            id: k.id,
            nama: k.nama,
            tingkat: 'Rak' as const,
          }))

          return {
            id: r.id,
            nama: r.nama,
            tingkat: 'Ruangan' as const,
            rak: childRak,
          }
        })

      return {
        id: g.id,
        nama: g.nama,
        tingkat: 'Gedung' as const,
        ruangan: childRuangan,
      }
    })

    return NextResponse.json({
      success: true,
      raw: lokasiList,
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
    const { nama, tingkat, parent_id } = body

    if (!nama || !tingkat) {
      return NextResponse.json({ error: 'Nama dan tingkat lokasi wajib diisi.' }, { status: 400 })
    }

    if (!['Gedung', 'Ruangan', 'Rak'].includes(tingkat)) {
      return NextResponse.json(
        { error: 'Tingkat lokasi tidak valid (harus Gedung, Ruangan, atau Rak).' },
        { status: 400 }
      )
    }

    if (tingkat !== 'Gedung' && !parent_id) {
      return NextResponse.json(
        { error: `Tingkat ${tingkat} wajib memiliki lokasi induk (parent_id).` },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data: created, error: insertErr } = await admin
      .from('lokasi')
      .insert({
        nama: nama.trim(),
        tingkat,
        parent_id: parent_id || null,
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: created })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
