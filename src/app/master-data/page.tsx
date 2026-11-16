'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import {
  Building2,
  FolderArchive,
  MapPin,
  Archive,
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Download,
  Search,
  X,
  FileText,
  ShieldAlert,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

export interface LokasiItem {
  id: string
  kode?: string
  nama: string
  tingkat: 'Gedung' | 'Ruangan' | 'Rak'
  status?: 'Aktif' | 'Nonaktif'
  parent_id: string | null
  created_at?: string
}

export interface LokasiHierarchy {
  id: string
  kode?: string
  nama: string
  tingkat: 'Gedung'
  status?: 'Aktif' | 'Nonaktif'
  ruangan: {
    id: string
    kode?: string
    nama: string
    tingkat: 'Ruangan'
    status?: 'Aktif' | 'Nonaktif'
    rak: {
      id: string
      kode?: string
      nama: string
      tingkat: 'Rak'
      status?: 'Aktif' | 'Nonaktif'
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

type TabType = 'lokasi' | 'organisasi' | 'kategori' | 'boks'

export default function MasterDataPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [userRole, setUserRole] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [activeTab, setActiveTab] = useState<TabType>('lokasi')
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

  // Form Tambah/Ubah Lokasi State (Card Panel sesuai referensi)
  const [isLokasiFormOpen, setIsLokasiFormOpen] = useState(false)
  const [editingLokasiId, setEditingLokasiId] = useState<string | null>(null)
  const [formLokasiKode, setFormLokasiKode] = useState('')
  const [formLokasiNama, setFormLokasiNama] = useState('')
  const [formLokasiInduk, setFormLokasiInduk] = useState<string>('root')
  const [savingLokasi, setSavingLokasi] = useState(false)

  // Modal Dialog Konfirmasi Hapus Lokasi
  const [deletingLokasi, setDeletingLokasi] = useState<LokasiItem | null>(null)
  const [isDeletingLokasi, setIsDeletingLokasi] = useState(false)

  // Modal State Tambah Organisasi
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false)
  const [namaOrgBaru, setNamaOrgBaru] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)

  // Modal QR Boks
  const [qrModalBoks, setQrModalBoks] = useState<BoksItem | null>(null)

  // Modal Detail Dokumen di Boks (M9)
  const [detailBoks, setDetailBoks] = useState<BoksItem | null>(null)
  const [detailDocs, setDetailDocs] = useState<any[]>([])
  const [loadingDetailDocs, setLoadingDetailDocs] = useState(false)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4500)
  }

  // 1. Otorisasi Ketat Superadmin (Frontend Check)
  useEffect(() => {
    async function checkSuperadmin() {
      try {
        setCheckingAuth(true)
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser()

        if (authErr || !user) {
          router.replace('/login')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'superadmin') {
          setUserRole(profile?.role || 'staff')
          showToast('error', 'Akses Ditolak: Modul Master Lokasi hanya dapat diakses oleh Superadmin.')
          return
        }

        setUserRole('superadmin')
      } catch (err) {
        console.error('Auth check error:', err)
      } finally {
        setCheckingAuth(false)
      }
    }
    checkSuperadmin()
  }, [supabase, router])

  const handleOpenDetailBoks = async (boks: BoksItem) => {
    setDetailBoks(boks)
    setLoadingDetailDocs(true)
    try {
      const res = await fetch(`/api/boks/${boks.id}/dokumen`)
      const json = await res.json()
      if (res.ok && json.dokumen) {
        setDetailDocs(json.dokumen)
      } else {
        setDetailDocs([])
      }
    } catch (err) {
      console.error('Gagal mengambil isi dokumen boks:', err)
      setDetailDocs([])
    } finally {
      setLoadingDetailDocs(false)
    }
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
        setRawLokasi(jsonLokasi.allRaw || jsonLokasi.raw || [])
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
    if (userRole === 'superadmin') {
      loadData()
    }
  }, [userRole, loadData])

  // Flat Tree Items untuk Tabel Hierarki Master Lokasi
  interface TreeRowItem {
    id: string
    kode: string
    nama: string
    tingkat: 'Gedung' | 'Ruangan' | 'Rak'
    status: 'Aktif' | 'Nonaktif'
    parent_id: string | null
    level: number // 0, 1, 2
  }

  const treeRows = useMemo<TreeRowItem[]>(() => {
    const rows: TreeRowItem[] = []
    const gedungs = rawLokasi.filter((l) => l.tingkat === 'Gedung')
    const ruangans = rawLokasi.filter((l) => l.tingkat === 'Ruangan')
    const raks = rawLokasi.filter((l) => l.tingkat === 'Rak')

    gedungs.forEach((g) => {
      rows.push({
        id: g.id,
        kode: g.kode || 'LOC-G',
        nama: g.nama,
        tingkat: 'Gedung',
        status: g.status || 'Aktif',
        parent_id: null,
        level: 0,
      })
      const childR = ruangans.filter((r) => r.parent_id === g.id)
      childR.forEach((r) => {
        rows.push({
          id: r.id,
          kode: r.kode || 'LOC-R',
          nama: r.nama,
          tingkat: 'Ruangan',
          status: r.status || 'Aktif',
          parent_id: g.id,
          level: 1,
        })
        const childK = raks.filter((k) => k.parent_id === r.id)
        childK.forEach((k) => {
          rows.push({
            id: k.id,
            kode: k.kode || 'LOC-RAK',
            nama: k.nama,
            tingkat: 'Rak',
            status: k.status || 'Aktif',
            parent_id: r.id,
            level: 2,
          })
        })
      })
    })

    return rows
  }, [rawLokasi])

  // Pilihan Induk (Parent) untuk Form Tambah/Ubah Lokasi
  // Hanya Gedung (level 1) dan Ruangan (level 2). Rak (level 3) tidak boleh jadi induk.
  const parentOptions = useMemo(() => {
    const list: { id: string; label: string; tingkat: 'Gedung' | 'Ruangan' }[] = []
    const gedungs = rawLokasi.filter((l) => l.tingkat === 'Gedung')
    const ruangans = rawLokasi.filter((l) => l.tingkat === 'Ruangan')

    gedungs.forEach((g) => {
      list.push({ id: g.id, label: g.nama, tingkat: 'Gedung' })
      const childR = ruangans.filter((r) => r.parent_id === g.id)
      childR.forEach((r) => {
        list.push({ id: r.id, label: `${g.nama} > ${r.nama}`, tingkat: 'Ruangan' })
      })
    })

    return list
  }, [rawLokasi])

  // Hitung tingkat otomatis berdasarkan induk terpilih
  const calculatedTingkat = useMemo<'Gedung' | 'Ruangan' | 'Rak'>(() => {
    if (!formLokasiInduk || formLokasiInduk === 'root') return 'Gedung'
    const parent = rawLokasi.find((l) => l.id === formLokasiInduk)
    if (parent?.tingkat === 'Gedung') return 'Ruangan'
    if (parent?.tingkat === 'Ruangan') return 'Rak'
    return 'Gedung'
  }, [formLokasiInduk, rawLokasi])

  // Handler Buka Form Tambah Lokasi Baru
  const handleOpenAddLokasi = () => {
    setEditingLokasiId(null)
    setFormLokasiKode('')
    setFormLokasiNama('')
    setFormLokasiInduk('root')
    setIsLokasiFormOpen(true)
  }

  // Handler Buka Form Ubah Lokasi
  const handleOpenEditLokasi = (item: TreeRowItem) => {
    setEditingLokasiId(item.id)
    setFormLokasiKode(item.kode || '')
    setFormLokasiNama(item.nama)
    setFormLokasiInduk(item.parent_id || 'root')
    setIsLokasiFormOpen(true)
  }

  // Handle Simpan (Tambah / Ubah) Lokasi
  const handleSaveLokasiSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formLokasiNama.trim()) {
      showToast('error', 'Nama lokasi wajib diisi.')
      return
    }

    try {
      setSavingLokasi(true)
      const parentId = formLokasiInduk === 'root' ? null : formLokasiInduk

      if (editingLokasiId) {
        // Mode Ubah
        const res = await fetch(`/api/lokasi/${editingLokasiId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kode: formLokasiKode.trim() || undefined,
            nama: formLokasiNama.trim(),
            parent_id: parentId,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Gagal mengubah lokasi.')
        showToast('success', `Lokasi "${formLokasiNama}" berhasil diperbarui.`)
      } else {
        // Mode Tambah
        const res = await fetch('/api/lokasi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kode: formLokasiKode.trim() || undefined,
            nama: formLokasiNama.trim(),
            parent_id: parentId,
            status: 'Aktif',
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Gagal menambahkan lokasi.')
        showToast('success', `Lokasi "${formLokasiNama}" berhasil ditambahkan ke Master Lokasi.`)
      }

      setIsLokasiFormOpen(false)
      setEditingLokasiId(null)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memproses data lokasi.')
    } finally {
      setSavingLokasi(false)
    }
  }

  // Handle Toggle Status Aktif / Nonaktif
  const handleToggleStatusLokasi = async (item: TreeRowItem) => {
    const newStatus = item.status === 'Aktif' ? 'Nonaktif' : 'Aktif'
    try {
      const res = await fetch(`/api/lokasi/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah status lokasi.')
      showToast(
        'success',
        `Lokasi "${item.nama}" berhasil diubah menjadi ${newStatus}.`
      )
      await loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengubah status lokasi.')
    }
  }

  // Handle Hapus Lokasi Permanen
  const handleExecuteDeleteLokasi = async () => {
    if (!deletingLokasi) return
    try {
      setIsDeletingLokasi(true)
      const res = await fetch(`/api/lokasi/${deletingLokasi.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus lokasi.')
      showToast('success', json.message || `Lokasi "${deletingLokasi.nama}" berhasil dihapus.`)
      setDeletingLokasi(null)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghapus lokasi.')
    } finally {
      setIsDeletingLokasi(false)
    }
  }

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

  if (checkingAuth) {
    return (
      <AppLayout currentRole="superadmin">
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#6B7185]">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
          <p className="text-sm font-medium">Memeriksa hak akses Superadmin...</p>
        </div>
      </AppLayout>
    )
  }

  if (userRole !== 'superadmin') {
    return (
      <AppLayout currentRole={(userRole as any) || 'staff'}>
        <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#FDECEC] text-[#D64545] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#1F2333]">Akses Terbatas: Khusus Superadmin</h2>
          <p className="text-sm text-[#64748B] leading-relaxed">
            Halaman Kelola Master Lokasi dan Master Data lainnya hanya dapat diakses dan dikelola oleh Superadmin sistem Archiva.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-5 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#152843]"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout currentRole="superadmin">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Toast Notifikasi */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg animate-in slide-in-from-top-2 ${
              toast.type === 'success'
                ? 'bg-[#137333] text-white'
                : 'bg-[#D64545] text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Header Modul Master Lokasi */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0284C7] text-white shadow-sm">
              <MapPin className="h-4 w-4 text-white" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1F2333]">Lokasi Fisik Arsip</h1>
              <p className="text-xs text-[#6B7185] mt-0.5">
                Struktur berjenjang <strong>Gedung &gt; Ruangan &gt; Rak</strong> untuk penyimpanan dokumen &amp; wadah boks.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigasi Master Data */}
        <div className="flex border-b border-[#ECEEF5] overflow-x-auto bg-white rounded-t-xl px-4 pt-2 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('lokasi')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'lokasi'
                ? 'border-[#0284C7] text-[#0284C7]'
                : 'border-transparent text-[#6B7185] hover:text-[#1F2333]'
            }`}
          >
            <MapPin className="h-3.5 w-3.5 text-[#0284C7]" />
            Master Lokasi ({rawLokasi.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('boks')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'boks'
                ? 'border-[#0284C7] text-[#0284C7]'
                : 'border-transparent text-[#6B7185] hover:text-[#1F2333]'
            }`}
          >
            <Archive className="h-3.5 w-3.5 text-[#0284C7]" />
            Master Boks ({boksList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('organisasi')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'organisasi'
                ? 'border-[#0284C7] text-[#0284C7]'
                : 'border-transparent text-[#6B7185] hover:text-[#1F2333]'
            }`}
          >
            <Building2 className="h-3.5 w-3.5 text-[#0284C7]" />
            Master Organisasi ({organisasiList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kategori')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'kategori'
                ? 'border-[#0284C7] text-[#0284C7]'
                : 'border-transparent text-[#6B7185] hover:text-[#1F2333]'
            }`}
          >
            <FolderArchive className="h-3.5 w-3.5 text-[#0284C7]" />
            Master Kategori ({kategoriList.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl border border-t-0 border-[#ECEEF5] p-6 shadow-xs min-h-[420px]">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#6B7185]">
              <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
              <p className="text-sm font-medium">Memuat data master...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: MASTER LOKASI (TREE VIEW TABEL & PANEL FORM) */}
              {activeTab === 'lokasi' && (
                <div className="space-y-6">
                  {/* Form Panel Tambah / Ubah Lokasi (Card Panel sesuai referensi UI) */}
                  {isLokasiFormOpen && (
                    <div className="rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] p-5 shadow-xs space-y-4 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between border-b border-[#E0F2FE] pb-3">
                        <h3 className="text-sm font-bold text-[#0369A1]">
                          {editingLokasiId ? 'Ubah Data Lokasi' : 'Tambah Lokasi Baru'}
                        </h3>
                        <span className="text-xs font-mono text-[#0284C7] bg-white border border-[#BAE6FD] px-2.5 py-0.5 rounded font-semibold">
                          Tingkat Terpilih: {calculatedTingkat}
                        </span>
                      </div>

                      <form onSubmit={handleSaveLokasiSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* 1. Kode Lokasi */}
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                              Kode Lokasi
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: LOC-G-A, LOC-R-AKTIF, LOC-RAK-02"
                              value={formLokasiKode}
                              onChange={(e) => setFormLokasiKode(e.target.value)}
                              className="w-full h-10 px-3.5 text-xs font-mono bg-white border border-[#BAE6FD] rounded-lg focus:outline-none focus:border-[#0284C7] text-[#111827]"
                            />
                            <p className="text-[11px] text-[#64748B] mt-1">
                              Kode unik identifikasi lokasi (opsional, otomatis dibuat jika kosong).
                            </p>
                          </div>

                          {/* 2. Nama Lokasi */}
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                              Nama Lokasi <span className="text-[#D64545]">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Contoh: Gedung A, Ruang Arsip Aktif, Rak 02"
                              value={formLokasiNama}
                              onChange={(e) => setFormLokasiNama(e.target.value)}
                              className="w-full h-10 px-3.5 text-xs bg-white border border-[#BAE6FD] rounded-lg focus:outline-none focus:border-[#0284C7] text-[#111827]"
                            />
                          </div>
                        </div>

                        {/* 3. Induk (Parent) Dropdown Berjenjang */}
                        <div>
                          <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                            Induk (Parent)
                          </label>
                          <select
                            value={formLokasiInduk}
                            onChange={(e) => setFormLokasiInduk(e.target.value)}
                            className="w-full h-10 px-3.5 text-xs bg-white border border-[#BAE6FD] rounded-lg focus:outline-none focus:border-[#0284C7] text-[#111827]"
                          >
                            <option value="root">Tanpa induk (Tingkat Gedung / Root)</option>
                            {parentOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.tingkat === 'Gedung' ? '🏢 [Gedung] ' : '🚪 [Ruangan] '}
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-[#64748B] mt-1">
                            Pilih &quot;Tanpa induk&quot; untuk level Gedung. Tingkat terisi otomatis: Tanpa induk &rarr; Gedung, Induk Gedung &rarr; Ruangan, Induk Ruangan &rarr; Rak.
                          </p>
                        </div>

                        {/* Tombol Batal & Simpan */}
                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E0F2FE]">
                          <button
                            type="button"
                            onClick={() => {
                              setIsLokasiFormOpen(false)
                              setEditingLokasiId(null)
                            }}
                            className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-black/5 rounded-lg transition-colors"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            disabled={savingLokasi}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0369A1] disabled:opacity-50 transition-colors"
                          >
                            {savingLokasi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Simpan Lokasi
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Tabel Hierarki Master Lokasi (Pola Referensi Gambar) */}
                  <div className="overflow-x-auto rounded-xl border border-[#BAE6FD]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F0F9FF] text-[11px] font-semibold text-[#0369A1] uppercase border-b border-[#BAE6FD]">
                        <tr>
                          <th className="px-5 py-3">Nama / Hierarki</th>
                          <th className="px-4 py-3 font-mono">Kode</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-5 py-3 text-right">
                            <div className="inline-flex items-center gap-3">
                              <span>Tindakan</span>
                              <button
                                type="button"
                                onClick={handleOpenAddLokasi}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0369A1] transition-colors normal-case"
                              >
                                <Plus className="h-3.5 w-3.5 text-white" />
                                <span>Tambah Lokasi</span>
                              </button>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEEF5]">
                        {treeRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-[#8A90A2]">
                              Belum ada data hierarki lokasi.
                            </td>
                          </tr>
                        ) : (
                          treeRows.map((row) => (
                            <tr key={row.id} className="hover:bg-[#F8FAFC] transition-colors">
                              {/* Nama / Hierarki dengan visual indentasi */}
                              <td className="px-5 py-3.5 text-[#1F2333]">
                                <div
                                  className="flex items-center gap-2"
                                  style={{ paddingLeft: `${row.level * 24}px` }}
                                >
                                  {row.level === 0 && (
                                    <Building2 className="h-4 w-4 text-[#0284C7] shrink-0" />
                                  )}
                                  {row.level === 1 && (
                                    <span className="text-[#38BDF8] font-mono text-xs select-none">
                                      └
                                    </span>
                                  )}
                                  {row.level === 2 && (
                                    <span className="text-[#38BDF8] font-mono text-xs select-none">
                                      └
                                    </span>
                                  )}
                                  <span
                                    className={`${
                                      row.level === 0
                                        ? 'font-bold text-[13px] text-[#0369A1]'
                                        : row.level === 1
                                        ? 'font-semibold text-xs text-[#1F2333]'
                                        : 'font-medium text-xs text-[#475569]'
                                    }`}
                                  >
                                    {row.nama}
                                  </span>
                                  <span className="text-[10px] text-[#0284C7] bg-[#E0F2FE] border border-[#BAE6FD] px-1.5 py-0.2 rounded font-mono">
                                    {row.tingkat}
                                  </span>
                                </div>
                              </td>

                              {/* Kode Lokasi */}
                              <td className="px-4 py-3.5 font-mono text-xs text-[#475569]">
                                {row.kode || '-'}
                              </td>

                              {/* Status Badge */}
                              <td className="px-4 py-3.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                    row.status === 'Aktif'
                                      ? 'bg-[#E6F4EA] text-[#137333]'
                                      : 'bg-[#F1F5F9] text-[#64748B]'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      row.status === 'Aktif' ? 'bg-[#137333]' : 'bg-[#64748B]'
                                    }`}
                                  />
                                  {row.status}
                                </span>
                              </td>

                              {/* Aksi: Ubah, Nonaktifkan / Aktifkan, Hapus */}
                              <td className="px-5 py-3.5 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {/* Ubah */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditLokasi(row)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[#D5D9E2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1F2333] hover:bg-[#F4F5FA] transition-colors"
                                  >
                                    <Edit2 className="h-3 w-3 text-[#64748B]" />
                                    Ubah
                                  </button>

                                  {/* Toggle Nonaktifkan / Aktifkan */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatusLokasi(row)}
                                    title={row.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                      row.status === 'Aktif'
                                        ? 'border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                                        : 'border-[#BBEFCA] bg-[#E6F4EA] text-[#137333]'
                                    }`}
                                  >
                                    {row.status === 'Aktif' ? (
                                      <>
                                        <PowerOff className="h-3 w-3 text-[#64748B]" />
                                        Nonaktifkan
                                      </>
                                    ) : (
                                      <>
                                        <Power className="h-3 w-3 text-[#137333]" />
                                        Aktifkan
                                      </>
                                    )}
                                  </button>

                                  {/* Hapus */}
                                  <button
                                    type="button"
                                    onClick={() => setDeletingLokasi(row)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[#FCA5A5] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#D64545] hover:bg-[#FDECEC] transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3 text-[#D64545]" />
                                    Hapus
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: MASTER BOKS */}
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
                          const filled = Math.min(boks.jumlah_lembar_terisi || 0, maxCap)
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
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-[#F0F2F7] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        pct >= 100
                                          ? 'bg-[#D64545]'
                                          : pct >= 80
                                          ? 'bg-[#E37427]'
                                          : 'bg-[#34A853]'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono text-[#4B5163]">{pct}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    boks.status === 'Penuh'
                                      ? 'bg-[#FDECEC] text-[#D64545]'
                                      : 'bg-[#E6F4EA] text-[#137333]'
                                  }`}
                                >
                                  {boks.status || 'Aktif'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetailBoks(boks)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#D5D9E2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1F2333] hover:bg-[#F4F5FA]"
                                  title="Lihat isi dokumen boks"
                                >
                                  <Archive className="h-3.5 w-3.5 text-[#3BA4E8]" />
                                  Isi
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBoks(boks)
                                    setEditNomorBoks(boks.nomor_boks)
                                    setEditKapasitasBoks(boks.kapasitas_maks_lembar || 500)
                                    setEditStatusBoks(boks.status || 'Aktif')
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#D5D9E2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1F2333] hover:bg-[#F4F5FA]"
                                  title="Edit Boks"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                {boks.qr_path && (
                                  <button
                                    type="button"
                                    onClick={() => setQrModalBoks(boks)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[#D5D9E2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#4B5163] hover:bg-[#F4F5FA]"
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

              {/* TAB 3: MASTER ORGANISASI */}
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
                      className="inline-flex items-center gap-2 rounded-xl bg-[#091E42] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#152843]"
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
                              <Building2 className="h-4 w-4 text-[#091E42]" />
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

              {/* TAB 4: MASTER KATEGORI */}
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
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#BCE1F9] px-2.5 py-1 font-mono text-xs font-bold text-[#091E42]">
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
            </>
          )}
        </div>

        {/* DIALOG KONFIRMASI HAPUS LOKASI */}
        {deletingLokasi && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
                <div className="flex items-center gap-2 text-[#D64545] font-bold">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Konfirmasi Hapus Lokasi</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingLokasi(null)}
                  className="rounded-lg p-1 text-[#6B7185] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="text-xs text-[#4B5163] leading-relaxed space-y-2">
                <p>
                  Apakah Anda yakin ingin menghapus lokasi <strong>{deletingLokasi.nama}</strong> ({deletingLokasi.tingkat}) secara permanen?
                </p>
                <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[#991B1B]">
                  <strong>Perhatian:</strong> Penghapusan permanen akan diblokir oleh sistem bila lokasi ini masih memuat sub-lokasi, boks, atau dokumen aktif/inaktif di bawahnya. Bila lokasi tidak lagi dipakai untuk entri baru, Anda disarankan menggunakan opsi <strong>Nonaktifkan</strong>.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#ECEEF5]">
                <button
                  type="button"
                  onClick={() => setDeletingLokasi(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7185] hover:bg-black/5 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingLokasi}
                  onClick={handleExecuteDeleteLokasi}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#D64545] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#B93838] disabled:opacity-50"
                >
                  {isDeletingLokasi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Ya, Hapus Lokasi
                </button>
              </div>
            </div>
          </div>
        )}

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
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm font-mono focus:border-[#091E42] focus:outline-none"
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
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#091E42] focus:outline-none"
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
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#091E42] focus:outline-none"
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
                    className="inline-flex items-center gap-2 rounded-xl bg-[#091E42] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#152843] disabled:opacity-50"
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
                className="w-full py-2.5 rounded-xl bg-[#091E42] text-white text-xs font-semibold hover:bg-[#152843]"
              >
                Tutup
              </button>
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
                    className="w-full rounded-xl border border-[#D5D9E2] px-3.5 py-2 text-sm focus:border-[#091E42] focus:outline-none"
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
                    className="inline-flex items-center gap-2 rounded-xl bg-[#091E42] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#152843] disabled:opacity-50"
                  >
                    {savingOrg && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Daftarkan Unit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DETAIL ISI DOKUMEN BOKS (M9) */}
        {detailBoks && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#ECEEF5] px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FD] text-[#3BA4E8]">
                    <Archive className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#1F2333]">
                      Daftar Dokumen di BOKS-{detailBoks.nomor_boks}
                    </h3>
                    <p className="text-xs text-[#6B7185]">
                      {detailBoks.rak?.nama || 'Rak Arsip'} &bull; Kapasitas Maksimal: {detailBoks.kapasitas_maks_lembar || 500} lembar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailBoks(null)}
                  className="rounded-lg p-1 text-[#6B7185] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F8FBFE] p-4 border border-[#ECEEF5]">
                  <div>
                    <span className="text-xs text-[#8A90A2]">Keterisian Boks Saat Ini</span>
                    <p className="text-sm font-bold text-[#1F2333]">
                      {Math.min(detailBoks.jumlah_lembar_terisi || 0, detailBoks.kapasitas_maks_lembar || 500)} / {detailBoks.kapasitas_maks_lembar || 500} lembar
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#8A90A2]">Status Fisik Boks</span>
                    <p className="text-sm font-bold text-[#1F2333] flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          detailBoks.status === 'Penuh' ? 'bg-[#D64545]' : 'bg-[#137333]'
                        }`}
                      />
                      {detailBoks.status || 'Aktif'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#8A90A2]">Jumlah Entri Dokumen</span>
                    <p className="text-sm font-bold text-[#1F2333]">
                      {detailDocs.length} dokumen
                    </p>
                  </div>
                </div>

                {loadingDetailDocs ? (
                  <div className="py-12 text-center text-xs text-[#6B7185]">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#3BA4E8]" />
                    Memuat daftar dokumen di dalam boks...
                  </div>
                ) : detailDocs.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#8A90A2]">
                    Belum ada dokumen yang dialokasikan ke boks ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#ECEEF5]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FBFE] text-[#4B5163] uppercase border-b border-[#ECEEF5] font-semibold">
                        <tr>
                          <th className="px-3.5 py-2.5">Kode Arsip</th>
                          <th className="px-3.5 py-2.5">Judul Dokumen</th>
                          <th className="px-3.5 py-2.5">Lembar di Boks</th>
                          <th className="px-3.5 py-2.5">Total Fisik</th>
                          <th className="px-3.5 py-2.5">Status</th>
                          <th className="px-3.5 py-2.5">PIC Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEEF5]">
                        {detailDocs.map((docItem, idx) => (
                          <tr key={docItem.id || idx} className="hover:bg-[#F8FAFC]">
                            <td className="px-3.5 py-2.5 font-mono font-bold text-[#3BA4E8]">
                              {docItem.kode_arsip}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-[#1F2333] max-w-[200px] truncate">
                              {docItem.judul}
                            </td>
                            <td className="px-3.5 py-2.5 font-bold text-[#1F2333]">
                              {docItem.lembar_di_boks} lbr
                            </td>
                            <td className="px-3.5 py-2.5 text-[#6B7185]">
                              {docItem.total_halaman} lbr
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                                  docItem.status === 'aktif'
                                    ? 'bg-[#E6F4EA] text-[#137333]'
                                    : docItem.status === 'inaktif'
                                    ? 'bg-[#EEF0F4] text-[#4B5163]'
                                    : 'bg-[#FEF7E0] text-[#B06000]'
                                }`}
                              >
                                {docItem.status}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-[#6B7185]">
                              {docItem.pemilik_nama}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="border-t border-[#ECEEF5] px-6 py-3 bg-[#F8FBFE] flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetailBoks(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#1F2333] bg-white border border-[#D5D9E2] rounded-xl hover:bg-[#F4F5FA]"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
