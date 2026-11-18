import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export interface DokumenLaporanItem {
  id: string
  kode_arsip: string
  nomor_payment: string
  judul: string
  jumlah_halaman: number
  tanggal_dokumen: string
  status: string
  kategori_nama: string
  unit_nama: string
  lokasi_string: string
  is_dipinjam: boolean
}

export interface BoksLaporanGroup {
  boks_id: string
  nomor_boks: string
  status_boks: 'Aktif' | 'Penuh'
  kapasitas_maks_lembar: number
  jumlah_lembar_terisi: number
  persentase_terisi: number
  rak_id: string
  rak_nama: string
  ruangan_nama: string
  gedung_nama: string
  dokumen_list: DokumenLaporanItem[]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda belum masuk.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, role, unit_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil pengguna tidak ditemukan.' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const gedungId = searchParams.get('gedung_id') || ''
    const ruanganId = searchParams.get('ruangan_id') || ''
    const rakId = searchParams.get('rak_id') || ''
    const statusFilter = searchParams.get('status') || 'semua' // semua | aktif | inaktif | dipinjam
    const unitIdFilter = searchParams.get('unit_id') || ''

    const admin = createAdminClient()

    // 1. Ambil data master lokasi hierarki (Gedung, Ruangan, Rak)
    const { data: allLokasi } = await admin
      .from('lokasi')
      .select('id, nama, tingkat, parent_id, kode, status')
      .order('nama', { ascending: true })

    const lokasiList = allLokasi || []
    const lokasiMap = new Map(lokasiList.map((l) => [l.id, l]))

    // Cari seluruh Rak yang sesuai filter lokasi
    let targetRakIds: string[] = []
    if (rakId) {
      targetRakIds = [rakId]
    } else if (ruanganId) {
      targetRakIds = lokasiList
        .filter((l) => l.tingkat === 'Rak' && l.parent_id === ruanganId)
        .map((l) => l.id)
    } else if (gedungId) {
      const childRuangans = new Set(
        lokasiList.filter((l) => l.tingkat === 'Ruangan' && l.parent_id === gedungId).map((l) => l.id)
      )
      targetRakIds = lokasiList
        .filter((l) => l.tingkat === 'Rak' && l.parent_id && childRuangans.has(l.parent_id))
        .map((l) => l.id)
    } else {
      targetRakIds = lokasiList.filter((l) => l.tingkat === 'Rak').map((l) => l.id)
    }

    // 2. Ambil master boks yang berada di rak terpilih
    let boksQuery = admin
      .from('boks')
      .select('id, nomor_boks, status, kapasitas_maks_lembar, jumlah_lembar_terisi, rak_id')
      .order('nomor_boks', { ascending: true })

    if (targetRakIds.length > 0) {
      boksQuery = boksQuery.in('rak_id', targetRakIds)
    }

    const { data: rawBoksList, error: boksErr } = await boksQuery
    if (boksErr) throw boksErr

    const boksItems = rawBoksList || []
    const boksMap = new Map(boksItems.map((b) => [b.id, b]))

    // 3. Query dokumen
    let docQuery = admin
      .from('dokumen')
      .select(`
        id,
        kode_arsip,
        nomor_dokumen,
        nomor_ppl,
        judul,
        jumlah_halaman,
        tanggal_dokumen,
        status,
        boks_id,
        unit_id,
        lokasi_saat_ini,
        kategori_dokumen:kategori_id ( nama ),
        unit_organisasi:unit_id ( nama ),
        dokumen_boks ( boks_id, urutan, jumlah_lembar )
      `)
      .order('created_at', { ascending: false })

    // Filter unit jika bukan superadmin (terikat unit sendiri)
    if (profile.role !== 'superadmin') {
      if (profile.unit_id) {
        docQuery = docQuery.eq('unit_id', profile.unit_id)
      }
    } else if (unitIdFilter) {
      docQuery = docQuery.eq('unit_id', unitIdFilter)
    }

    // Filter status dokumen
    if (statusFilter === 'aktif') {
      docQuery = docQuery.eq('status', 'aktif')
    } else if (statusFilter === 'inaktif') {
      docQuery = docQuery.eq('status', 'inaktif')
    }

    const { data: rawDocs, error: docErr } = await docQuery
    if (docErr) throw docErr

    // 4. Periksa peminjaman aktif untuk status 'dipinjam'
    const { data: peminjamanAktif } = await admin
      .from('peminjaman')
      .select('dokumen_id')
      .in('status_pinjam', ['Disetujui', 'Dipinjam', 'Menunggu persetujuan'])

    const dipinjamDocIds = new Set((peminjamanAktif || []).map((p) => p.dokumen_id))

    // 5. Kelompokkan dokumen ke dalam boks
    const boksGroupMap = new Map<string, BoksLaporanGroup>()

    // Inisialisasi grup untuk setiap boks yang masuk filter rak
    boksItems.forEach((b) => {
      const rak = lokasiMap.get(b.rak_id)
      const ruangan = rak?.parent_id ? lokasiMap.get(rak.parent_id) : undefined
      const gedung = ruangan?.parent_id ? lokasiMap.get(ruangan.parent_id) : undefined

      const maxCap = Number(b.kapasitas_maks_lembar) || 500
      const filled = Number(b.jumlah_lembar_terisi) || 0
      const pct = Math.min(100, Math.round((filled / maxCap) * 100))

      boksGroupMap.set(b.id, {
        boks_id: b.id,
        nomor_boks: b.nomor_boks || 'Tanpa Nomor',
        status_boks: (b.status as any) || 'Aktif',
        kapasitas_maks_lembar: maxCap,
        jumlah_lembar_terisi: filled,
        persentase_terisi: pct,
        rak_id: b.rak_id,
        rak_nama: rak?.nama || 'Rak Tidak Diketahui',
        ruangan_nama: ruangan?.nama || 'Ruangan Arsip',
        gedung_nama: gedung?.nama || 'Gedung Utama',
        dokumen_list: [],
      })
    })

    // Masukkan dokumen ke dalam boks-boks terkait
    let totalDokumenMatch = 0
    let totalLembarMatch = 0

    ;(rawDocs || []).forEach((doc: any) => {
      const isDipinjam = dipinjamDocIds.has(doc.id)

      // Jika filter khusus 'dipinjam', skip jika tidak sedang dipinjam
      if (statusFilter === 'dipinjam' && !isDipinjam) {
        return
      }

      const parts = (doc.kode_arsip || '').split('_')
      const paymentNumber = doc.nomor_ppl || doc.nomor_dokumen || (parts.length >= 3 ? parts[2] : '-')
      const unitNama = (doc.unit_organisasi as any)?.nama || 'Unit Kerja'
      const kategoriNama = (doc.kategori_dokumen as any)?.nama || 'Umum'
      const hal = doc.jumlah_halaman || 1

      const docItem: DokumenLaporanItem = {
        id: doc.id,
        kode_arsip: doc.kode_arsip,
        nomor_payment: paymentNumber,
        judul: doc.judul,
        jumlah_halaman: hal,
        tanggal_dokumen: doc.tanggal_dokumen,
        status: doc.status,
        kategori_nama: kategoriNama,
        unit_nama: unitNama,
        lokasi_string: doc.lokasi_saat_ini || '-',
        is_dipinjam: isDipinjam,
      }

      // Cari boks dokumen (bisa lewat relasi dokumen_boks atau boks_id)
      const targetBoksIds = new Set<string>()
      if (doc.dokumen_boks && Array.isArray(doc.dokumen_boks) && doc.dokumen_boks.length > 0) {
        doc.dokumen_boks.forEach((db: any) => {
          if (db.boks_id) targetBoksIds.add(db.boks_id)
        })
      }
      if (doc.boks_id) {
        targetBoksIds.add(doc.boks_id)
      }

      // Masukkan ke grup boks yang sesuai
      let inserted = false
      targetBoksIds.forEach((bid) => {
        if (boksGroupMap.has(bid)) {
          boksGroupMap.get(bid)!.dokumen_list.push(docItem)
          inserted = true
        }
      })

      // Jika dokumen belum teralokasi ke boks yang ada di filter, namun filter rak/ruangan/gedung tidak ditentukan
      if (!inserted && !rakId && !ruanganId && !gedungId) {
        const unassignedKey = 'unassigned'
        if (!boksGroupMap.has(unassignedKey)) {
          boksGroupMap.set(unassignedKey, {
            boks_id: unassignedKey,
            nomor_boks: 'Belum Masuk Boks',
            status_boks: 'Aktif',
            kapasitas_maks_lembar: 500,
            jumlah_lembar_terisi: 0,
            persentase_terisi: 0,
            rak_id: '',
            rak_nama: 'Belum Ditentukan',
            ruangan_nama: '-',
            gedung_nama: '-',
            dokumen_list: [],
          })
        }
        boksGroupMap.get(unassignedKey)!.dokumen_list.push(docItem)
        inserted = true
      }

      if (inserted) {
        totalDokumenMatch += 1
        totalLembarMatch += hal
      }
    })

    // Saring boks: tampilkan boks yang terdaftar dalam filter rak terpilih
    const boksGroups = Array.from(boksGroupMap.values()).filter(
      (bg) => bg.dokumen_list.length > 0 || (rakId && bg.rak_id === rakId)
    )

    // Hitung total kapasitas & terisi
    const totalBoks = boksGroups.length
    const totalKapasitas = boksGroups.reduce((acc, b) => acc + b.kapasitas_maks_lembar, 0)
    const totalTerisi = boksGroups.reduce((acc, b) => acc + b.jumlah_lembar_terisi, 0)
    const persentaseOkupansi = totalKapasitas > 0 ? Math.min(100, Math.round((totalTerisi / totalKapasitas) * 100)) : 0

    return NextResponse.json({
      success: true,
      data: {
        filterTerpilih: {
          gedungId,
          ruanganId,
          rakId,
          statusFilter,
          unitIdFilter,
        },
        statistik: {
          totalBoks,
          totalDokumen: totalDokumenMatch,
          totalLembar: totalLembarMatch,
          totalKapasitasLembar: totalKapasitas,
          totalTerisiLembar: totalTerisi,
          persentaseOkupansi,
        },
        boksGroups,
      },
    })
  } catch (err: any) {
    console.error('Error GET /api/laporan:', err)
    return NextResponse.json(
      { error: err.message || 'Gagal menyusun laporan rekapitulasi arsip.' },
      { status: 500 }
    )
  }
}
