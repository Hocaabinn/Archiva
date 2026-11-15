'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import {
  Building2,
  FolderArchive,
  MapPin,
  Archive,
  Plus,
  Edit2,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Layers,
  ChevronRight,
  Download,
  Search,
  X,
  Sparkles,
} from 'lucide-react'

interface UnitOrg {
  id: string
  nama: string
  kode_perusahaan: string
  created_at?: string
}

interface KategoriDoc {
  id: string
  nama: string
  kode: string
  deskripsi?: string
  is_active: boolean
}

interface LokasiItem {
  id: string
  nama: string
  tingkat: 'Gedung' | 'Ruangan' | 'Rak'
  parent_id: string | null
}

interface LokasiHierarchy {
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

interface BoksItem {
  id: string
  nomor_boks: string
  rak_id: string
  kapasitas_maks_lembar: number
  jumlah_lembar_terisi: number
  qr_path: string | null
  status: 'Aktif' | 'Penuh'
  rak?: {
    id: string
    nama: string
    tingkat: string
    parent_id: string | null
  }
}

type TabType = 'organisasi' | 'kategori' | 'lokasi' | 'boks'

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<TabType>('organisasi')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Data State
  const [organisasiList, setOrganisasiList] = useState<UnitOrg[]>([])
  const [kategoriList, setKategoriList] = useState<KategoriDoc[]>([])
  const [lokasiHierarchy, setLokasiHierarchy] = useState<LokasiHierarchy[]>([])
  const [rawLokasi, setRawLokasi] = useState<LokasiItem[]>([])
  const [boksList, setBoksList] = useState<BoksItem[]>([])

  // Modal State Boks Edit
  const [editingBoks, setEditingBoks] = useState<BoksItem | null>(null)
  const [editNomorBoks, setEditNomorBoks] = useState('')
  const [editKapasitasBoks, setEditKapasitasBoks] = useState<number>(500)
  const [editStatusBoks, setEditStatusBoks] = useState<'Aktif' | 'Penuh'>('Aktif')
  const [savingBoks, setSavingBoks] = useState(false)

  // Modal State Tambah Lokasi
  const [isAddLokasiOpen, setIsAddLokasiOpen] = useState(false)
  const [namaLokasiBaru, setNamaLokasiBaru] = useState('')
  const [tingkatLokasiBaru, setTingkatLokasiBaru] = useState<'Gedung' | 'Ruangan' | 'Rak'>('Gedung')
  const [parentGedungId, setParentGedungId] = useState('')
  const [parentRuanganId, setParentRuanganId] = useState('')
  const [savingLokasi, setSavingLokasi] = useState(false)

  // Modal State Tambah Organisasi
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false)
  const [namaOrgBaru, setNamaOrgBaru] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)

  // Modal QR Boks
  const [qrModalBoks, setQrModalBoks] = useState<BoksItem | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4500)
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      // 1. Fetch Organisasi & Kategori
      const resMaster = await fetch('/api/master-data')
      const jsonMaster = await resMaster.json()
      if (resMaster.ok) {
        setOrganisasiList(jsonMaster.organisasi || [])
        setKategoriList(jsonMaster.kategori || [])
      }

      // 2. Fetch Lokasi
      const resLokasi = await fetch('/api/lokasi')
      const jsonLokasi = await resLokasi.json()
      if (resLokasi.ok) {
        setLokasiHierarchy(jsonLokasi.hierarchy || [])
        setRawLokasi(jsonLokasi.raw || [])
      }

      // 3. Fetch Boks
      const resBoks = await fetch('/api/boks')
      const jsonBoks = await resBoks.json()
      if (resBoks.ok) {
        setBoksList(jsonBoks.data || [])
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat master data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle Edit Boks
  const handleSaveBoks = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBoks) return

    try {
      setSavingBoks(true)
      const res = await fetch(`/api/boks/${editingBoks.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomor_boks: editNomorBoks.trim(),
          kapasitas_maks_lembar: editKapasitasBoks,
          status: editStatusBoks,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal memperbarui data boks.')

      showToast('success', `Boks ${editNomorBoks} berhasil diperbarui.`)
      setEditingBoks(null)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan perubahan boks.')
    } finally {
      setSavingBoks(false)
    }
  }

  // Handle Tambah Lokasi
  const handleSaveLokasi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaLokasiBaru.trim()) {
      showToast('error', 'Nama lokasi wajib diisi.')
      return
    }

    let parentId: string | null = null
    if (tingkatLokasiBaru === 'Ruangan') {
      if (!parentGedungId) {
        showToast('error', 'Pilih Gedung induk untuk Ruangan.')
        return
      }
      parentId = parentGedungId
    } else if (tingkatLokasiBaru === 'Rak') {
      if (!parentRuanganId) {
        showToast('error', 'Pilih Ruangan induk untuk Rak.')
        return
      }
      parentId = parentRuanganId
    }

    try {
      setSavingLokasi(true)
      const res = await fetch('/api/lokasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: namaLokasiBaru.trim(),
          tingkat: tingkatLokasiBaru,
          parent_id: parentId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menambahkan lokasi.')

      showToast('success', `Lokasi ${namaLokasiBaru} (${tingkatLokasiBaru}) berhasil ditambahkan.`)
      setIsAddLokasiOpen(false)
      setNamaLokasiBaru('')
      setParentGedungId('')
      setParentRuanganId('')
      await loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menambah lokasi.')
    } finally {
      setSavingLokasi(false)
    }
  }

  // Handle Tambah Organisasi
  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaOrgBaru.trim()) {
      showToast('error', 'Nama unit organisasi wajib diisi.')
      return
    }

    try {
      setSavingOrg(true)
      const res = await fetch('/api/master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipe: 'organisasi',
          nama: namaOrgBaru.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menambah unit organisasi.')

      showToast('success', `Unit ${namaOrgBaru} berhasil didaftarkan.`)
      setIsAddOrgOpen(false)
      setNamaOrgBaru('')
      await loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menambah unit organisasi.')
    } finally {
      setSavingOrg(false)
    }
  }

  return (
    <AppLayout currentRole="superadmin">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Banner Header */}
        <div className="rounded-2xl border border-[#BCE1F9] bg-gradient-to-r from-[#F0F8FF] to-[#E6F3FD] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#3BA4E8]/30 bg-white/80 px-3 py-1 text-xs font-semibold text-[#1E86C8]">
                <Layers className="h-3.5 w-3.5" />
                Master Data Kedinasan (M8 — R.03)
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1F2333]">
                Kelola Master Data Sistem
              </h1>
              <p className="text-sm text-[#4B5163]">
                Konfigurasi Master Organisasi/Unit, Kategori Dokumen, Hierarki Lokasi Fisik, dan Pengaturan Boks Arsip dinamis.
              </p>
            </div>
          </div>
        </div>

        {/* Toast Notifikasi */}
        {toast && (
          <div
            className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm animate-in fade-in ${
              toast.type === 'success'
                ? 'border-[#CEEAD6] bg-[#E6F4EA] text-[#137333]'
                : 'border-[#FDECEC] bg-[#FFF5F5] text-[#D64545]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#137333]" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-[#D64545]" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E3E6F0] bg-white rounded-t-xl px-4 pt-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('organisasi')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'organisasi'
                ? 'border-[#3BA4E8] text-[#1E86C8]'
                : 'border-transparent text-[#6B7185] hover:text-[#1F2333]'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Master Organisasi ({organisasiList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kategori')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'kategori'
                ? 'border-[#3BA4E8] text-[#1E86C8]'
                : 'border-transparent text-[#6B7185] hover:text-[#1F2333]'
            }`}
          >
            <FolderArchive className="h-4 w-4" />
            Master Kategori ({kategoriList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lokasi')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'lokasi'
                ? 'border-[#3BA4E8] text-[#1E86C8]'
                : 'border-transparent text-[#6B7185] hover:text-[#1F2333]'
            }`}
          >
            <MapPin className="h-4 w-4" />
            Master Lokasi ({rawLokasi.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('boks')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'boks'
                ? 'border-[#3BA4E8] text-[#1E86C8]'
                : 'border-transparent text-[#6B7185] hover:text-[#1F2333]'
            }`}
          >
            <Archive className="h-4 w-4" />
            Master Boks &amp; Kapasitas ({boksList.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl border border-t-0 border-[#ECEEF5] p-6 shadow-xs min-h-[400px]">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#6B7185]">
              <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
              <p className="text-sm font-medium">Memuat data master...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: MASTER ORGANISASI */}
              {activeTab === 'organisasi' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#1F2333]">Daftar Unit Organisasi</h3>
                      <p className="text-xs text-[#6B7185] mt-0.5">
                        Dokumen yang dientri otomatis terikat ke unit PIC yang sedang login. Kode Perusahaan SIG: <strong>2000</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddOrgOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#3BA4E8] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2A93D7]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tambah Unit
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[#ECEEF5]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#F8FBFE] text-xs font-semibold text-[#4B5163] uppercase border-b border-[#ECEEF5]">
                        <tr>
                          <th className="px-4 py-3">Nama Unit</th>
                          <th className="px-4 py-3">Kode Perusahaan</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEEF5]">
                        {organisasiList.map((org) => (
                          <tr key={org.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3.5 font-semibold text-[#1F2333] flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-[#3BA4E8]" />
                              {org.nama}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[#4B5163]">{org.kode_perusahaan || '2000'}</td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4EA] px-2.5 py-0.5 text-xs font-semibold text-[#137333]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#137333]" />
                                Aktif
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: MASTER KATEGORI */}
              {activeTab === 'kategori' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-[#1F2333]">Kategori Arsip Resmi (Blueprint 3.1)</h3>
                    <p className="text-xs text-[#6B7185] mt-0.5">
                      3 kategori dokumen resmi dengan singkatan kode SIG (Keuangan: KEU, SDM: SDM, Kontrak: KTR).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {kategoriList.map((kat) => (
                      <div key={kat.id} className="rounded-xl border border-[#ECEEF5] bg-[#F8FBFE] p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#BCE1F9] px-2.5 py-1 font-mono text-xs font-bold text-[#1E86C8]">
                            {kat.kode}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4EA] px-2 py-0.5 text-[11px] font-semibold text-[#137333]">
                            Aktif
                          </span>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-[#1F2333]">{kat.nama}</h4>
                          <p className="text-xs text-[#6B7185] mt-1 leading-relaxed">
                            {kat.deskripsi || 'Arsip kedinasan resmi unit kerja.'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: MASTER LOKASI */}
              {activeTab === 'lokasi' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#1F2333]">Hierarki Lokasi Fisik Arsip</h3>
                      <p className="text-xs text-[#6B7185] mt-0.5">
                        Struktur berjenjang <strong>Gedung &gt; Ruangan &gt; Rak</strong>. Lokasi dipilih dari dropdown berjenjang tanpa isian bebas (free text).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddLokasiOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#3BA4E8] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2A93D7]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tambah Lokasi
                    </button>
                  </div>

                  <div className="space-y-4">
                    {lokasiHierarchy.length === 0 ? (
                      <p className="text-sm text-[#8A90A2] py-8 text-center">Belum ada data hierarki lokasi gedung.</p>
                    ) : (
                      lokasiHierarchy.map((gedung) => (
                        <div key={gedung.id} className="rounded-xl border border-[#ECEEF5] overflow-hidden">
                          <div className="bg-[#F8FBFE] px-4 py-3 flex items-center justify-between border-b border-[#ECEEF5]">
                            <div className="flex items-center gap-2 font-bold text-[#1F2333]">
                              <Building2 className="h-4 w-4 text-[#3BA4E8]" />
                              <span>{gedung.nama}</span>
                              <span className="text-[11px] font-normal text-[#8A90A2] bg-white border border-[#D5D9E2] px-2 py-0.5 rounded-full">
                                Gedung
                              </span>
                            </div>
                            <span className="text-xs text-[#6B7185]">
                              {gedung.ruangan.length} Ruangan
                            </span>
                          </div>

                          <div className="p-4 space-y-3 bg-white">
                            {gedung.ruangan.length === 0 ? (
                              <p className="text-xs text-[#8A90A2] italic pl-4">Belum ada ruangan di gedung ini.</p>
                            ) : (
                              gedung.ruangan.map((ruangan) => (
                                <div key={ruangan.id} className="rounded-lg border border-[#F0F2F7] bg-[#FAFAFC] p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs font-semibold text-[#1F2333]">
                                    <div className="flex items-center gap-2">
                                      <ChevronRight className="h-3.5 w-3.5 text-[#3BA4E8]" />
                                      <span>{ruangan.nama}</span>
                                      <span className="text-[10px] text-[#6B7185] bg-white border border-[#E3E6F0] px-1.5 py-0.2 rounded">
                                        Ruangan
                                      </span>
                                    </div>
                                    <span className="text-[#8A90A2]">{ruangan.rak.length} Rak</span>
                                  </div>

                                  <div className="flex flex-wrap gap-2 pl-5 pt-1">
                                    {ruangan.rak.length === 0 ? (
                                      <span className="text-[11px] text-[#8A90A2] italic">Belum ada rak</span>
                                    ) : (
                                      ruangan.rak.map((rak) => (
                                        <span
                                          key={rak.id}
                                          className="inline-flex items-center gap-1.5 rounded-md bg-white border border-[#D5D9E2] px-2.5 py-1 text-xs font-medium text-[#4B5163]"
                                        >
                                          <MapPin className="h-3 w-3 text-[#3BA4E8]" />
                                          {rak.nama}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: MASTER BOKS */}
              {activeTab === 'boks' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#1F2333]">Master Boks &amp; Kapasitas Dinamis</h3>
                      <p className="text-xs text-[#6B7185] mt-0.5">
                        Setiap boks tersimpan di dalam Rak dengan kapasitas dinamis (default 500 lembar), QR boks unik, dan status Aktif/Penuh.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[#ECEEF5]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#F8FBFE] text-xs font-semibold text-[#4B5163] uppercase border-b border-[#ECEEF5]">
                        <tr>
                          <th className="px-4 py-3">No. Boks</th>
                          <th className="px-4 py-3">Lokasi Rak</th>
                          <th className="px-4 py-3">Kapasitas Maksimal</th>
                          <th className="px-4 py-3">Terisi (Lembar)</th>
                          <th className="px-4 py-3">Okupansi</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEEF5]">
                        {boksList.map((boks) => {
                          const maxCap = boks.kapasitas_maks_lembar || 500
                          const filled = boks.jumlah_lembar_terisi || 0
                          const pct = Math.min(100, Math.round((filled / maxCap) * 100))
                          return (
                            <tr key={boks.id} className="hover:bg-[#F8FAFC]">
                              <td className="px-4 py-3.5 font-bold font-mono text-[#1F2333]">
                                BOKS-{boks.nomor_boks}
                              </td>
                              <td className="px-4 py-3.5 text-xs text-[#4B5163]">
                                {boks.rak?.nama || 'Rak Default'}
                              </td>
                              <td className="px-4 py-3.5 font-semibold text-[#1F2333]">
                                {maxCap} lembar
                              </td>
                              <td className="px-4 py-3.5 text-xs text-[#4B5163]">
                                {filled} lembar
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="w-28 space-y-1">
                                  <div className="h-2 w-full bg-[#EEF0F4] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        pct >= 100 ? 'bg-[#D64545]' : pct >= 80 ? 'bg-[#F29900]' : 'bg-[#3BA4E8]'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-[#8A90A2] font-semibold">{pct}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    boks.status === 'Penuh' || pct >= 100
                                      ? 'bg-[#FDECEC] text-[#D64545]'
                                      : 'bg-[#E6F4EA] text-[#137333]'
                                  }`}
                                >
                                  {boks.status || (pct >= 100 ? 'Penuh' : 'Aktif')}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBoks(boks)
                                    setEditNomorBoks(boks.nomor_boks)
                                    setEditKapasitasBoks(boks.kapasitas_maks_lembar || 500)
                                    setEditStatusBoks(boks.status || 'Aktif')
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#D5D9E2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#4B5163] hover:bg-[#F4F5FA]"
                                  title="Edit Nomor & Kapasitas Boks"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                {boks.qr_path && (
                                  <button
                                    type="button"
                                    onClick={() => setQrModalBoks(boks)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[#BCE1F9] bg-[#F0F8FF] px-2.5 py-1.5 text-xs font-semibold text-[#1E86C8] hover:bg-[#E1F1FD]"
                                    title="Lihat QR Boks"
                                  >
                                    <QrCode className="h-3.5 w-3.5" />
                                    QR
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL EDIT BOKS */}
        {editingBoks && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
                <h3 className="text-base font-bold text-[#1F2333]">Edit Parameter Boks Arsip</h3>
                <button
                  type="button"
                  onClick={() => setEditingBoks(null)}
                  className="rounded-lg p-1 text-[#6B7185] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBoks} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                    Nomor Boks <span className="text-[#D64545]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editNomorBoks}
                    onChange={(e) => setEditNomorBoks(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm font-mono focus:border-[#3BA4E8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                    Kapasitas Maksimal (Lembar) <span className="text-[#D64545]">*</span>
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="5000"
                    value={editKapasitasBoks}
                    onChange={(e) => setEditKapasitasBoks(parseInt(e.target.value, 10) || 500)}
                    required
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#3BA4E8] focus:outline-none"
                  />
                  <p className="text-[11px] text-[#8A90A2] mt-1">Standar default adalah 500 lembar per boks.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                    Status Boks <span className="text-[#D64545]">*</span>
                  </label>
                  <select
                    value={editStatusBoks}
                    onChange={(e) => setEditStatusBoks(e.target.value as 'Aktif' | 'Penuh')}
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#3BA4E8] focus:outline-none"
                  >
                    <option value="Aktif">Aktif (Tersedia untuk pengisian)</option>
                    <option value="Penuh">Penuh (Terkunci)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ECEEF5]">
                  <button
                    type="button"
                    onClick={() => setEditingBoks(null)}
                    className="px-4 py-2 text-xs font-semibold text-[#6B7185] hover:bg-black/5 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingBoks}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#3BA4E8] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2A93D7] disabled:opacity-50"
                  >
                    {savingBoks && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL QR BOKS */}
        {qrModalBoks && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4">
              <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
                <h3 className="text-base font-bold text-[#1F2333]">Label QR Boks Arsip</h3>
                <button
                  type="button"
                  onClick={() => setQrModalBoks(null)}
                  className="rounded-lg p-1 text-[#6B7185] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="py-2">
                <p className="font-mono font-bold text-lg text-[#1F2333]">BOKS-{qrModalBoks.nomor_boks}</p>
                <p className="text-xs text-[#6B7185]">{qrModalBoks.rak?.nama || 'Rak Arsip'}</p>
              </div>

              {qrModalBoks.qr_path ? (
                <div className="flex justify-center p-4 bg-white rounded-xl border border-[#ECEEF5]">
                  <img
                    src={`/api/serah-terima/scan?qr=${encodeURIComponent(qrModalBoks.qr_path)}`}
                    alt={`QR Boks ${qrModalBoks.nomor_boks}`}
                    className="h-44 w-44 object-contain"
                  />
                </div>
              ) : (
                <p className="text-xs text-[#8A90A2]">QR belum digenerate untuk boks ini.</p>
              )}

              <button
                type="button"
                onClick={() => setQrModalBoks(null)}
                className="w-full py-2.5 rounded-xl bg-[#3BA4E8] text-white text-xs font-semibold hover:bg-[#2A93D7]"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* MODAL TAMBAH LOKASI */}
        {isAddLokasiOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
                <h3 className="text-base font-bold text-[#1F2333]">Tambah Lokasi Baru</h3>
                <button
                  type="button"
                  onClick={() => setIsAddLokasiOpen(false)}
                  className="rounded-lg p-1 text-[#6B7185] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveLokasi} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                    Tingkat Lokasi <span className="text-[#D64545]">*</span>
                  </label>
                  <select
                    value={tingkatLokasiBaru}
                    onChange={(e) => setTingkatLokasiBaru(e.target.value as 'Gedung' | 'Ruangan' | 'Rak')}
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#3BA4E8] focus:outline-none"
                  >
                    <option value="Gedung">Gedung (Tingkat Teratas)</option>
                    <option value="Ruangan">Ruangan (Di dalam Gedung)</option>
                    <option value="Rak">Rak (Di dalam Ruangan)</option>
                  </select>
                </div>

                {tingkatLokasiBaru === 'Ruangan' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                      Pilih Gedung Induk <span className="text-[#D64545]">*</span>
                    </label>
                    <select
                      value={parentGedungId}
                      onChange={(e) => setParentGedungId(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#3BA4E8] focus:outline-none"
                    >
                      <option value="">-- Pilih Gedung --</option>
                      {lokasiHierarchy.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {tingkatLokasiBaru === 'Rak' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                      Pilih Ruangan Induk <span className="text-[#D64545]">*</span>
                    </label>
                    <select
                      value={parentRuanganId}
                      onChange={(e) => setParentRuanganId(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#3BA4E8] focus:outline-none"
                    >
                      <option value="">-- Pilih Ruangan --</option>
                      {lokasiHierarchy.flatMap((g) =>
                        g.ruangan.map((r) => (
                          <option key={r.id} value={r.id}>
                            {g.nama} &gt; {r.nama}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                    Nama Lokasi <span className="text-[#D64545]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Gedung Arsip B, Ruang 201, Rak 04"
                    value={namaLokasiBaru}
                    onChange={(e) => setNamaLokasiBaru(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#3BA4E8] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ECEEF5]">
                  <button
                    type="button"
                    onClick={() => setIsAddLokasiOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#6B7185] hover:bg-black/5 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingLokasi}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#3BA4E8] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2A93D7] disabled:opacity-50"
                  >
                    {savingLokasi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Simpan Lokasi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL TAMBAH ORGANISASI */}
        {isAddOrgOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
                <h3 className="text-base font-bold text-[#1F2333]">Tambah Unit Organisasi</h3>
                <button
                  type="button"
                  onClick={() => setIsAddOrgOpen(false)}
                  className="rounded-lg p-1 text-[#6B7185] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveOrg} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                    Nama Unit Organisasi <span className="text-[#D64545]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Logistik, Produksi, Pemasaran"
                    value={namaOrgBaru}
                    onChange={(e) => setNamaOrgBaru(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#3BA4E8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                    Kode Perusahaan SIG
                  </label>
                  <input
                    type="text"
                    value="2000"
                    disabled
                    className="w-full rounded-xl border border-[#D5D9E2] bg-[#F7F8FC] px-3.5 py-2 text-sm font-mono text-[#6B7185] cursor-not-allowed"
                  />
                  <p className="text-[11px] text-[#8A90A2] mt-1">Kode perusahaan terstandarisasi 2000 untuk PT Semen Indonesia.</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ECEEF5]">
                  <button
                    type="button"
                    onClick={() => setIsAddOrgOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#6B7185] hover:bg-black/5 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingOrg}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#3BA4E8] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2A93D7] disabled:opacity-50"
                  >
                    {savingOrg && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Daftarkan Unit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
