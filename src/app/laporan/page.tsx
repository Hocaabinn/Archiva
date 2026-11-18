'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { AppLayout, useAppUser } from '@/components/layout/app-layout'
import {
  FileSpreadsheet,
  Printer,
  Download,
  Filter,
  Layers,
  MapPin,
  Building2,
  FolderArchive,
  Archive,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  FileText,
  FileDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BoksLaporanGroup } from '@/app/api/laporan/route'
import { exportLaporanToPDF, exportLaporanToCSV } from '@/lib/pdf-laporan'
import { KodeArsip } from '@/components/documents/kode-arsip'
import { StampBadge } from '@/components/ui/stamp-badge'

interface LokasiRawItem {
  id: string
  nama: string
  tingkat: 'Gedung' | 'Ruangan' | 'Rak'
  parent_id: string | null
  status?: string
}

interface UnitOrgItem {
  id: string
  nama: string
  kode_perusahaan: string
}

function LaporanContent() {
  const { name: userName, role: userRole, roleTitle: userRoleTitle } = useAppUser()
  const [supabase] = useState(() => createClient())

  // Master Data Pilihan Filter
  const [allLokasi, setAllLokasi] = useState<LokasiRawItem[]>([])
  const [unitList, setUnitList] = useState<UnitOrgItem[]>([])
  const [loadingMaster, setLoadingMaster] = useState(true)

  // State Filter Berjenjang
  const [selectedGedungId, setSelectedGedungId] = useState<string>('')
  const [selectedRuanganId, setSelectedRuanganId] = useState<string>('')
  const [selectedRakId, setSelectedRakId] = useState<string>('')

  // State Filter Tambahan
  const [selectedStatus, setSelectedStatus] = useState<'semua' | 'aktif' | 'inaktif' | 'dipinjam'>('semua')
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [searchDocQuery, setSearchDocQuery] = useState<string>('')

  // Data Laporan State
  const [boksGroups, setBoksGroups] = useState<BoksLaporanGroup[]>([])
  const [statistik, setStatistik] = useState({
    totalBoks: 0,
    totalDokumen: 0,
    totalLembar: 0,
    totalKapasitasLembar: 0,
    totalTerisiLembar: 0,
    persentaseOkupansi: 0,
  })
  const [loadingData, setLoadingData] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // 1. Load Master Lokasi & Master Unit
  useEffect(() => {
    async function loadMaster() {
      try {
        setLoadingMaster(true)
        const [resLokasi, resMaster] = await Promise.all([
          fetch('/api/lokasi?status=Aktif'),
          fetch('/api/master-data'),
        ])

        const jsonLokasi = await resLokasi.json()
        const jsonMaster = await resMaster.json()

        if (resLokasi.ok) {
          const raw = jsonLokasi.allRaw || jsonLokasi.raw || []
          setAllLokasi(raw.filter((l: LokasiRawItem) => !l.status || l.status === 'Aktif'))
        }

        if (resMaster.ok) {
          setUnitList(jsonMaster.organisasi || [])
        }
      } catch (err: any) {
        console.error('Gagal memuat master lokasi:', err)
      } finally {
        setLoadingMaster(false)
      }
    }
    loadMaster()
  }, [])

  // Opsi Dropdown Berjenjang Lokasi
  const gedungOptions = useMemo(() => {
    return allLokasi.filter((l) => l.tingkat === 'Gedung')
  }, [allLokasi])

  const ruanganOptions = useMemo(() => {
    if (!selectedGedungId) return []
    return allLokasi.filter((l) => l.tingkat === 'Ruangan' && l.parent_id === selectedGedungId)
  }, [allLokasi, selectedGedungId])

  const rakOptions = useMemo(() => {
    if (!selectedRuanganId) return []
    return allLokasi.filter((l) => l.tingkat === 'Rak' && l.parent_id === selectedRuanganId)
  }, [allLokasi, selectedRuanganId])

  // String Keterangan Lokasi Terpilih
  const lokasiLabel = useMemo(() => {
    const g = allLokasi.find((l) => l.id === selectedGedungId)
    const r = allLokasi.find((l) => l.id === selectedRuanganId)
    const k = allLokasi.find((l) => l.id === selectedRakId)

    if (g && r && k) return `${g.nama} > ${r.nama} > ${k.nama}`
    if (g && r) return `${g.nama} > ${r.nama} (Seluruh Rak)`
    if (g) return `${g.nama} (Seluruh Ruangan)`
    return 'Seluruh Lokasi Fisik Arsip'
  }, [allLokasi, selectedGedungId, selectedRuanganId, selectedRakId])

  // 2. Fetch Data Laporan Rekapitulasi dari Server
  const fetchLaporanData = useCallback(async () => {
    try {
      setLoadingData(true)
      setFetchError(null)

      const params = new URLSearchParams()
      if (selectedGedungId) params.set('gedung_id', selectedGedungId)
      if (selectedRuanganId) params.set('ruangan_id', selectedRuanganId)
      if (selectedRakId) params.set('rak_id', selectedRakId)
      if (selectedStatus && selectedStatus !== 'semua') params.set('status', selectedStatus)
      if (selectedUnitId && userRole === 'superadmin') params.set('unit_id', selectedUnitId)

      const res = await fetch(`/api/laporan?${params.toString()}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat rekapitulasi arsip.')
      }

      setBoksGroups(json.data?.boksGroups || [])
      setStatistik(
        json.data?.statistik || {
          totalBoks: 0,
          totalDokumen: 0,
          totalLembar: 0,
          totalKapasitasLembar: 0,
          totalTerisiLembar: 0,
          persentaseOkupansi: 0,
        }
      )
    } catch (err: any) {
      console.error('Error load laporan:', err)
      setFetchError(err.message || 'Terjadi kesalahan sistem saat memuat laporan.')
    } finally {
      setLoadingData(false)
    }
  }, [selectedGedungId, selectedRuanganId, selectedRakId, selectedStatus, selectedUnitId, userRole])

  // Panggil data saat filter berubah
  useEffect(() => {
    fetchLaporanData()
  }, [fetchLaporanData])

  // Filter Dokumen Lokal Berdasarkan Input Pencarian Teks
  const filteredBoksGroups = useMemo(() => {
    if (!searchDocQuery.trim()) return boksGroups
    const q = searchDocQuery.toLowerCase()

    return boksGroups
      .map((boks) => {
        const matchesDoc = boks.dokumen_list.filter(
          (d) =>
            d.kode_arsip.toLowerCase().includes(q) ||
            d.nomor_payment.toLowerCase().includes(q) ||
            d.judul.toLowerCase().includes(q) ||
            d.kategori_nama.toLowerCase().includes(q)
        )
        const matchesBoksNumber = boks.nomor_boks.toLowerCase().includes(q)
        return {
          ...boks,
          dokumen_list: matchesBoksNumber ? boks.dokumen_list : matchesDoc,
        }
      })
      .filter((b) => b.dokumen_list.length > 0)
  }, [boksGroups, searchDocQuery])

  // 3. Handler Ekspor PDF
  const handleExportPDF = () => {
    const unitLabel =
      userRole === 'superadmin' && selectedUnitId
        ? unitList.find((u) => u.id === selectedUnitId)?.nama || 'Semua Unit'
        : 'Unit Pengolah Resmi'

    exportLaporanToPDF({
      lokasiString: lokasiLabel,
      statusFilterLabel: selectedStatus.toUpperCase(),
      unitFilterLabel: unitLabel,
      userName,
      userRoleTitle,
      statistik,
      boksGroups: filteredBoksGroups,
    })
  }

  // 4. Handler Ekspor Excel / CSV
  const handleExportCSV = () => {
    const unitLabel =
      userRole === 'superadmin' && selectedUnitId
        ? unitList.find((u) => u.id === selectedUnitId)?.nama || 'Semua Unit'
        : 'Unit Pengolah Resmi'

    exportLaporanToCSV({
      lokasiString: lokasiLabel,
      statusFilterLabel: selectedStatus.toUpperCase(),
      unitFilterLabel: unitLabel,
      userName,
      userRoleTitle,
      statistik,
      boksGroups: filteredBoksGroups,
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Banner Header Laporan */}
      <div className="rounded-2xl border border-[#CBD7E3] bg-gradient-to-r from-[#F0F5FA] to-[#E6F0F8] p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1E3A5F]/20 bg-white/80 px-3 py-1 text-xs font-semibold text-[#1E3A5F]">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Modul Inventarisasi &amp; Rekapitulasi
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1F2333]">
              Laporan Rekapitulasi Arsip per Lokasi
            </h1>
            <p className="text-sm text-[#4B5163]">
              Pengelompokan berkas arsip per boks di dalam rak fisik terpilih, kapasitas lembar, serta ekspor resmi PDF dan Excel/CSV.
            </p>
          </div>

          {/* Tombol Ekspor Aksi */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={loadingData || filteredBoksGroups.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#152842] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak / Ekspor PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loadingData || filteredBoksGroups.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-[#CBD7E3] bg-white px-4 py-2.5 text-xs font-bold text-[#1F2333] shadow-xs hover:bg-[#F0F5FA] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <FileDown className="h-4 w-4 text-[#0284C7]" />
              <span>Ekspor Excel / CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* PANEL FILTER BERJENJANG & TAMBAHAN */}
      <div className="rounded-xl border border-[#ECEEF5] bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1F2333] uppercase tracking-wider">
            <Filter className="h-4 w-4 text-[#1E3A5F]" />
            <span>Filter Berjenjang Lokasi &amp; Status Dokumen</span>
          </div>

          <button
            type="button"
            onClick={fetchLaporanData}
            className="inline-flex items-center gap-1.5 text-xs text-[#0284C7] hover:underline font-semibold"
            title="Muat ulang data rekapitulasi"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Baris 1: Filter Berjenjang Dropdown Gedung > Ruangan > Rak */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Dropdown Gedung */}
          <div>
            <label className="block text-[11px] font-bold text-[#4B5163] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-[#0284C7]" />
              <span>1. Gedung</span>
            </label>
            <select
              value={selectedGedungId}
              onChange={(e) => {
                const gid = e.target.value
                setSelectedGedungId(gid)
                setSelectedRuanganId('')
                setSelectedRakId('')
              }}
              className="w-full h-9 px-3 text-xs bg-white border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#0284C7] text-[#1F2333] font-medium"
            >
              <option value="">-- Semua Gedung Master --</option>
              {gedungOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Dropdown Ruangan */}
          <div>
            <label className="block text-[11px] font-bold text-[#4B5163] uppercase tracking-wider mb-1 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#0284C7]" />
              <span>2. Ruangan</span>
            </label>
            <select
              value={selectedRuanganId}
              disabled={!selectedGedungId}
              onChange={(e) => {
                const rid = e.target.value
                setSelectedRuanganId(rid)
                setSelectedRakId('')
              }}
              className="w-full h-9 px-3 text-xs bg-white border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#0284C7] text-[#1F2333] font-medium disabled:bg-[#F4F5FA] disabled:text-[#8A90A2]"
            >
              <option value="">
                {selectedGedungId ? '-- Seluruh Ruangan di Gedung --' : '-- Pilih Gedung Dahulu --'}
              </option>
              {ruanganOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nama}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Dropdown Rak */}
          <div>
            <label className="block text-[11px] font-bold text-[#4B5163] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Archive className="h-3.5 w-3.5 text-[#0284C7]" />
              <span>3. Rak Penyimpanan</span>
            </label>
            <select
              value={selectedRakId}
              disabled={!selectedRuanganId}
              onChange={(e) => setSelectedRakId(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#0284C7] text-[#1F2333] font-medium disabled:bg-[#F4F5FA] disabled:text-[#8A90A2]"
            >
              <option value="">
                {selectedRuanganId ? '-- Seluruh Rak di Ruangan --' : '-- Pilih Ruangan Dahulu --'}
              </option>
              {rakOptions.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Baris 2: Filter Status Dokumen & Filter Unit Organisasi (Superadmin) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#F0F2F7]">
          {/* Status Dokumen */}
          <div>
            <label className="block text-[11px] font-bold text-[#4B5163] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#0284C7]" />
              <span>Status Dokumen</span>
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full h-9 px-3 text-xs bg-white border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#0284C7] text-[#1F2333] font-medium"
            >
              <option value="semua">Semua Status (Aktif, Inaktif, Dipinjam)</option>
              <option value="aktif">Aktif Saja</option>
              <option value="inaktif">Inaktif Saja</option>
              <option value="dipinjam">Sedang Dipinjam</option>
            </select>
          </div>

          {/* Unit Organisasi (Jika Superadmin) */}
          {userRole === 'superadmin' ? (
            <div>
              <label className="block text-[11px] font-bold text-[#4B5163] uppercase tracking-wider mb-1 flex items-center gap-1">
                <FolderArchive className="h-3.5 w-3.5 text-[#0284C7]" />
                <span>Unit Organisasi (Superadmin)</span>
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#0284C7] text-[#1F2333] font-medium"
              >
                <option value="">-- Semua Unit Organisasi --</option>
                {unitList.map((u) => (
                  <option key={u.id} value={u.id}>
                    [{u.kode_perusahaan}] {u.nama}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-end">
              <div className="h-9 px-3 flex items-center text-xs text-[#6B7185] bg-[#F7F8FC] border border-[#ECEEF5] rounded-lg w-full">
                <span>Unit Pengolah: <strong>Otomatis Terikat Peran</strong></span>
              </div>
            </div>
          )}

          {/* Pencarian Teks Dokumen */}
          <div>
            <label className="block text-[11px] font-bold text-[#4B5163] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Search className="h-3.5 w-3.5 text-[#0284C7]" />
              <span>Cari No. Payment / Kode / Judul</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ketik pencarian berkas..."
                value={searchDocQuery}
                onChange={(e) => setSearchDocQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-xs bg-white border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#0284C7] text-[#1F2333]"
              />
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#8A90A2]" />
            </div>
          </div>
        </div>
      </div>

      {/* KARTU STATISTIK RINGKASAN OKUPANSI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-[#CBD7E3] bg-white p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#6B7185]">Lokasi Terpilih</span>
          <p className="text-xs font-bold text-[#1E3A5F] truncate" title={lokasiLabel}>
            {selectedRakId
              ? allLokasi.find((l) => l.id === selectedRakId)?.nama || 'Rak Terpilih'
              : selectedRuanganId
              ? allLokasi.find((l) => l.id === selectedRuanganId)?.nama || 'Ruangan'
              : selectedGedungId
              ? allLokasi.find((l) => l.id === selectedGedungId)?.nama || 'Gedung'
              : 'Semua Lokasi'}
          </p>
        </div>

        <div className="rounded-xl border border-[#CBD7E3] bg-white p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#6B7185]">Total Boks</span>
          <p className="text-base font-bold text-[#1F2333] font-mono">{statistik.totalBoks} Boks</p>
        </div>

        <div className="rounded-xl border border-[#CBD7E3] bg-white p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#6B7185]">Total Berkas</span>
          <p className="text-base font-bold text-[#0284C7] font-mono">{statistik.totalDokumen} Berkas</p>
        </div>

        <div className="rounded-xl border border-[#CBD7E3] bg-white p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#6B7185]">Total Lembar</span>
          <p className="text-base font-bold text-[#1F2333] font-mono">{statistik.totalTerisiLembar} Lembar</p>
        </div>

        <div className="rounded-xl border border-[#CBD7E3] bg-white p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#6B7185]">Kapasitas Total</span>
          <p className="text-base font-bold text-[#4B5163] font-mono">{statistik.totalKapasitasLembar} Lembar</p>
        </div>

        <div className="rounded-xl border border-[#CBD7E3] bg-white p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#6B7185]">Okupansi Rak</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-bold font-mono ${
                statistik.persentaseOkupansi >= 80 ? 'text-[#D64545]' : 'text-[#2F9E5B]'
              }`}
            >
              {statistik.persentaseOkupansi}%
            </span>
            <div className="flex-1 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  statistik.persentaseOkupansi >= 80 ? 'bg-[#D64545]' : 'bg-[#2F9E5B]'
                }`}
                style={{ width: `${statistik.persentaseOkupansi}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK ERROR JIKA TERJADI */}
      {fetchError && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl border border-[#FDECEC] bg-[#FFF5F5] text-xs text-[#D64545]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* TABEL DATA LAPORAN GROUPING PER BOKS */}
      <div className="space-y-4">
        {loadingData ? (
          <div className="py-24 rounded-xl border border-[#ECEEF5] bg-white flex flex-col items-center justify-center gap-3 text-[#6B7185]">
            <Loader2 className="h-8 w-8 animate-spin text-[#0284C7]" />
            <p className="text-xs font-semibold">Menyusun rekapitulasi inventarisasi arsip...</p>
          </div>
        ) : filteredBoksGroups.length === 0 ? (
          <div className="py-20 rounded-xl border border-[#ECEEF5] bg-white text-center text-[#8A90A2] space-y-2">
            <Archive className="h-10 w-10 mx-auto text-[#CBD5E1]" />
            <p className="text-sm font-semibold text-[#1F2333]">Tidak Ditemukan Arsip</p>
            <p className="text-xs text-[#6B7185] max-w-md mx-auto">
              Tidak ada berkas yang sesuai dengan kombinasi filter lokasi atau status yang dipilih. Silakan sesuaikan filter di atas.
            </p>
          </div>
        ) : (
          filteredBoksGroups.map((boks) => {
            const isFull = boks.status_boks === 'Penuh' || boks.persentase_terisi >= 100
            const isNearFull = boks.persentase_terisi >= 80

            return (
              <div
                key={boks.boks_id}
                className="rounded-xl border border-[#CBD7E3] bg-white shadow-2xs overflow-hidden transition-all"
              >
                {/* Header Grup Boks Sesuai Spesifikasi */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-[#F0F5FA] border-b border-[#CBD7E3]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-white border border-[#CBD7E3] rounded-md text-[#1E3A5F]">
                        <Archive className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-bold text-[#1E3A5F] uppercase font-mono tracking-wide">
                        BOKS {boks.nomor_boks}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        isFull
                          ? 'bg-[#FDECEC] text-[#D64545] border border-[#FCA5A5]'
                          : isNearFull
                          ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                          : 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                      }`}
                    >
                      {boks.status_boks}
                    </span>

                    <span className="text-xs text-[#6B7185]">
                      {boks.gedung_nama} &bull; {boks.ruangan_nama} &bull; {boks.rak_nama}
                    </span>
                  </div>

                  {/* Progres Kapasitas Lembar Boks (Misal: 350 / 500 Lembar) */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="block text-xs font-bold text-[#1F2333] font-mono">
                        {boks.jumlah_lembar_terisi} / {boks.kapasitas_maks_lembar} Lembar
                      </span>
                      <span className="block text-[10px] text-[#6B7185]">
                        Okupansi Boks: {boks.persentase_terisi}%
                      </span>
                    </div>

                    <div className="w-24 h-2 bg-[#D1D5DB] rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full rounded-full ${
                          isFull
                            ? 'bg-[#D64545]'
                            : isNearFull
                            ? 'bg-[#F59E0B]'
                            : 'bg-[#10B981]'
                        }`}
                        style={{ width: `${boks.persentase_terisi}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tabel Berkas di dalam Boks */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[11px] font-semibold text-[#475569] uppercase border-b border-[#ECEEF5]">
                      <tr>
                        <th className="px-4 py-2.5 w-12 text-center">No</th>
                        <th className="px-4 py-2.5 font-mono">No. Payment</th>
                        <th className="px-4 py-2.5 font-mono">Kode Arsip</th>
                        <th className="px-4 py-2.5">Judul Dokumen</th>
                        <th className="px-4 py-2.5">Kategori</th>
                        <th className="px-4 py-2.5 text-right">Jumlah Hal</th>
                        <th className="px-4 py-2.5">Tgl Dokumen</th>
                        <th className="px-4 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEEF5]">
                      {boks.dokumen_list.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-4 text-center text-[#8A90A2] italic">
                            Belum ada dokumen yang teralokasi di boks ini.
                          </td>
                        </tr>
                      ) : (
                        boks.dokumen_list.map((doc, idx) => {
                          const tglFormatted = doc.tanggal_dokumen
                            ? new Date(doc.tanggal_dokumen).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'

                          return (
                            <tr key={doc.id} className="hover:bg-[#F9FAFB] transition-colors">
                              <td className="px-4 py-3 text-center text-[#6B7185] font-mono">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-[#1E3A5F]">
                                {doc.nomor_payment}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">
                                <KodeArsip kode={doc.kode_arsip} className="font-mono text-xs text-[#0284C7]" />
                              </td>
                              <td className="px-4 py-3 text-[#1F2333] font-medium max-w-xs truncate" title={doc.judul}>
                                {doc.judul}
                              </td>
                              <td className="px-4 py-3 text-[#4B5163]">
                                {doc.kategori_nama}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-[#1F2333]">
                                {doc.jumlah_halaman} lbr
                              </td>
                              <td className="px-4 py-3 text-[#6B7185] whitespace-nowrap">
                                {tglFormatted}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {doc.is_dipinjam ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                                    Dipinjam
                                  </span>
                                ) : (
                                  <StampBadge status={doc.status as any} />
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function LaporanPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#0284C7]" />
          </div>
        }
      >
        <LaporanContent />
      </Suspense>
    </AppLayout>
  )
}
