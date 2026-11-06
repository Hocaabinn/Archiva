'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { StampBadge } from '@/components/ui/stamp-badge'
import { UserRole } from '@/types'
import { 
  FolderArchive, 
  Search, 
  Filter, 
  QrCode, 
  FileText, 
  ArrowUpRight, 
  Download, 
  Eye, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  FileDown, 
  FileSpreadsheet, 
  Calendar,
  Grid,
  List,
  SlidersHorizontal,
  Plus
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DocumentItem {
  id: string
  kode_arsip: string
  nomor_dokumen: string
  judul: string
  kategori: string
  status: 'aktif' | 'menunggu_persetujuan' | 'nonaktif' | 'ditolak'
  pemegang: string
  lokasi_saat_ini: string
  tanggal_dokumen: string
  tanggal_kadaluarsa: string | null
  sisa_hari: number | null
  file_size: string
  mime_type: string
  tingkat_sensitif: 'Biasa' | 'Rahasia' | 'Sangat Rahasia'
}

const defaultDocuments: DocumentItem[] = [
  {
    id: '1',
    kode_arsip: 'ARS-2026-0001',
    nomor_dokumen: '042/LEG-KTR/PL/I/2026',
    judul: 'Kontrak Kerja Sama Vendor PT Prima Logistik 2026',
    kategori: 'Kontrak & Legal',
    status: 'aktif',
    pemegang: 'Bambang S. (PIC Arsip)',
    lokasi_saat_ini: 'Ruang Arsip Aktif - Rak A1',
    tanggal_dokumen: '03 Jan 2026',
    tanggal_kadaluarsa: '03 Nov 2029',
    sisa_hari: 1095,
    file_size: '4.8 MB',
    mime_type: 'application/pdf',
    tingkat_sensitif: 'Biasa',
  },
  {
    id: '2',
    kode_arsip: 'ARS-2026-0002',
    nomor_dokumen: '118/KEU-AUD/X/2026',
    judul: 'Laporan Keuangan & Audit Neraca Kas Triwulan III 2026',
    kategori: 'Keuangan',
    status: 'menunggu_persetujuan',
    pemegang: 'Siti Aminah (Pengaju)',
    lokasi_saat_ini: 'Meja Verifikasi PIC',
    tanggal_dokumen: '18 Okt 2026',
    tanggal_kadaluarsa: null,
    sisa_hari: null,
    file_size: '12.3 MB',
    mime_type: 'application/pdf',
    tingkat_sensitif: 'Rahasia',
  },
  {
    id: '3',
    kode_arsip: 'ARS-2026-0003',
    nomor_dokumen: '007/SK-DIR/SDM/2026',
    judul: 'Surat Keputusan Direksi Tentang Kebijakan Mutasi & Promosi 2026',
    kategori: 'SDM & Kepegawaian',
    status: 'aktif',
    pemegang: 'Drs. Hendra M.',
    lokasi_saat_ini: 'Ruang Direksi Lt. 3',
    tanggal_dokumen: '15 Des 2023',
    tanggal_kadaluarsa: '15 Des 2026',
    sisa_hari: 42,
    file_size: '2.1 MB',
    mime_type: 'application/pdf',
    tingkat_sensitif: 'Sangat Rahasia',
  },
  {
    id: '4',
    kode_arsip: 'ARS-2023-0045',
    nomor_dokumen: 'BA-240/TIK-LOG/XI/2023',
    judul: 'Berita Acara Pengadaan Server & Komponen Basis Data Utama 2023',
    kategori: 'Operasional & Logistik',
    status: 'nonaktif',
    pemegang: 'Sistem (Gudang)',
    lokasi_saat_ini: 'Gudang Non-Aktif - Kotak B-12',
    tanggal_dokumen: '01 Nov 2023',
    tanggal_kadaluarsa: '01 Nov 2026',
    sisa_hari: 0,
    file_size: '8.4 MB',
    mime_type: 'application/pdf',
    tingkat_sensitif: 'Biasa',
  },
  {
    id: '5',
    kode_arsip: 'ARS-2026-0004',
    nomor_dokumen: 'NDA-099/LGL/2026',
    judul: 'Dokumen Perjanjian Kerahasiaan Data Klien (NDA) Multinasional',
    kategori: 'Kontrak & Legal',
    status: 'aktif',
    pemegang: 'Bambang S. (PIC Arsip)',
    lokasi_saat_ini: 'Ruang Arsip Aktif - Rak A2',
    tanggal_dokumen: '12 Feb 2026',
    tanggal_kadaluarsa: '12 Feb 2029',
    sisa_hari: 1045,
    file_size: '1.9 MB',
    mime_type: 'application/pdf',
    tingkat_sensitif: 'Rahasia',
  },
]

function DaftarDokumenContent() {
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('demo_role') as UserRole | null

  const [documents, setDocuments] = useState<DocumentItem[]>(defaultDocuments)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('semua')
  const [selectedKategori, setSelectedKategori] = useState<string>('semua')
  const [selectedUrutan, setSelectedUrutan] = useState<string>('terbaru')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showQrModal, setShowQrModal] = useState<DocumentItem | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('user')

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profile?.role) {
          setCurrentUserRole(profile.role as UserRole)
        }
      }

      // Ambil data dokumen dari supabase jika tersedia
      try {
        const { data: docs, error } = await supabase
          .from('dokumen')
          .select(`
            id,
            kode_arsip,
            nomor_dokumen,
            judul,
            status,
            file_size,
            mime_type,
            lokasi_saat_ini,
            tanggal_dokumen,
            tanggal_kadaluarsa,
            kategori_dokumen ( nama )
          `)
          .order('tanggal_diajukan', { ascending: false })

        if (!error && docs && docs.length > 0) {
          const mapped: DocumentItem[] = docs.map((d: any) => {
            let sisa: number | null = null
            if (d.tanggal_kadaluarsa) {
              const diff = new Date(d.tanggal_kadaluarsa).getTime() - new Date().getTime()
              sisa = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
            }
            return {
              id: d.id,
              kode_arsip: d.kode_arsip,
              nomor_dokumen: d.nomor_dokumen || '-',
              judul: d.judul,
              kategori: d.kategori_dokumen?.nama || 'Umum',
              status: d.status,
              pemegang: 'Pengguna Terdaftar',
              lokasi_saat_ini: d.lokasi_saat_ini || 'Ruang Arsip',
              tanggal_dokumen: d.tanggal_dokumen ? new Date(d.tanggal_dokumen).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
              tanggal_kadaluarsa: d.tanggal_kadaluarsa ? new Date(d.tanggal_kadaluarsa).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
              sisa_hari: sisa,
              file_size: d.file_size ? `${(d.file_size / (1024 * 1024)).toFixed(1)} MB` : '1.5 MB',
              mime_type: d.mime_type || 'application/pdf',
              tingkat_sensitif: 'Biasa',
            }
          })
          setDocuments(mapped)
        }
      } catch (err) {
        console.warn('Fallback ke default mock documents:', err)
      }
    }

    loadData()
  }, [])

  // Filter & sorting
  const filteredAndSortedDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchSearch =
          doc.kode_arsip.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.nomor_dokumen.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.pemegang.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.lokasi_saat_ini.toLowerCase().includes(searchQuery.toLowerCase())

        const matchKategori =
          selectedKategori === 'semua' || doc.kategori === selectedKategori

        let matchStatus = true
        if (selectedStatus === 'aktif') matchStatus = doc.status === 'aktif'
        else if (selectedStatus === 'menunggu_persetujuan') matchStatus = doc.status === 'menunggu_persetujuan'
        else if (selectedStatus === 'nonaktif') matchStatus = doc.status === 'nonaktif'
        else if (selectedStatus === 'ditolak') matchStatus = doc.status === 'ditolak'
        else if (selectedStatus === 'kritis') matchStatus = doc.status === 'aktif' && doc.sisa_hari !== null && doc.sisa_hari < 90

        return matchSearch && matchKategori && matchStatus
      })
      .sort((a, b) => {
        if (selectedUrutan === 'terbaru') return b.kode_arsip.localeCompare(a.kode_arsip)
        if (selectedUrutan === 'terlama') return a.kode_arsip.localeCompare(b.kode_arsip)
        if (selectedUrutan === 'judul_az') return a.judul.localeCompare(b.judul)
        if (selectedUrutan === 'kadaluarsa_terdekat') {
          return (a.sisa_hari ?? 9999) - (b.sisa_hari ?? 9999)
        }
        return 0
      })
  }, [documents, searchQuery, selectedStatus, selectedKategori, selectedUrutan])

  // Hitung jumlah per status
  const countAktif = documents.filter(d => d.status === 'aktif').length
  const countMenunggu = documents.filter(d => d.status === 'menunggu_persetujuan').length
  const countNonaktif = documents.filter(d => d.status === 'nonaktif').length
  const countKritis = documents.filter(d => d.status === 'aktif' && d.sisa_hari !== null && d.sisa_hari < 90).length

  return (
    <AppLayout currentRole={roleParam || undefined}>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* ======================================================== */}
        {/* HEADER KATALOG DOKUMEN                                  */}
        {/* ======================================================== */}
        <div className="border-b border-[#D8D2C4] pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 bg-[#1E2429] text-[#F7F3EB] font-bold">
                  REGISTER ARSIP DIGITAL RESMI
                </span>
                <span className="text-xs text-[#5B6166] font-mono">
                  Standar Retensi 3 Tahun • Klasifikasi Dokumen Terstruktur
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1D21] tracking-tight">
                Daftar & Katalog Dokumen
              </h1>
              <p className="text-xs sm:text-sm text-[#5B6166] mt-1 max-w-2xl leading-relaxed">
                Kelola dan telusuri seluruh berkas fisik maupun digital dengan verifikasi barcode, status cap pengesahan, dan lokasi penyimpanan.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/serah-terima"
                className="px-3.5 py-2 bg-white border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <QrCode className="w-4 h-4" />
                <span>Penyimpanan (Scan)</span>
              </Link>
              <Link
                href="/dokumen/upload"
                className="px-4 py-2 bg-[#1F5C55] hover:bg-[#184843] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Unggah Dokumen</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* BILAH KONTROL: PENCARIAN, FILTER, URUTAN, VIEW MODE      */}
        {/* ======================================================== */}
        <div className="bg-white border border-[#D8D2C4] p-4 space-y-3.5 shadow-2xs">
          {/* Baris Atas: Input Pencarian & Dropdown Kategori / Urutan */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Input Pencarian */}
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C9399]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode arsip (ARS-...), judul, nomor surat, pemegang..."
                className="w-full pl-9 pr-8 py-2 text-xs font-sans bg-[#F7F3EB]/40 border border-[#D8D2C4] focus:border-[#1A1D21] focus:bg-white focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8C9399] hover:text-[#1A1D21]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Klasifikasi Kategori */}
            <div className="md:col-span-3">
              <select
                value={selectedKategori}
                onChange={(e) => setSelectedKategori(e.target.value)}
                className="w-full text-xs bg-white border border-[#D8D2C4] px-3 py-2 text-[#1A1D21] focus:border-[#1A1D21] focus:outline-none font-medium cursor-pointer"
              >
                <option value="semua">Semua Klasifikasi Kategori</option>
                <option value="Kontrak & Legal">Kontrak & Legal</option>
                <option value="Keuangan">Keuangan</option>
                <option value="SDM & Kepegawaian">SDM & Kepegawaian</option>
                <option value="Operasional & Logistik">Operasional & Logistik</option>
              </select>
            </div>

            {/* Urutan & Mode Tampilan */}
            <div className="md:col-span-3 flex items-center gap-2">
              <select
                value={selectedUrutan}
                onChange={(e) => setSelectedUrutan(e.target.value)}
                className="flex-1 text-xs bg-white border border-[#D8D2C4] px-3 py-2 text-[#1A1D21] focus:border-[#1A1D21] focus:outline-none font-mono cursor-pointer"
              >
                <option value="terbaru">Terbaru (Kode ↓)</option>
                <option value="terlama">Terlama (Kode ↑)</option>
                <option value="kadaluarsa_terdekat">Kadaluarsa Terdekat</option>
                <option value="judul_az">Judul (A-Z)</option>
              </select>

              {/* View Mode Toggle */}
              <div className="flex border border-[#D8D2C4] shrink-0 bg-[#F7F3EB]">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 transition-colors ${viewMode === 'table' ? 'bg-[#1E2429] text-white' : 'text-[#5B6166] hover:text-[#1A1D21]'}`}
                  title="Tampilan Tabel Berkas"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-[#1E2429] text-white' : 'text-[#5B6166] hover:text-[#1A1D21]'}`}
                  title="Tampilan Kartu Map Berkas"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Baris Bawah: Tab Status Berkas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[#F7F3EB] text-xs">
            {[
              { id: 'semua', label: 'Semua Dokumen', count: documents.length },
              { id: 'aktif', label: 'Arsip Aktif', count: countAktif },
              { id: 'menunggu_persetujuan', label: 'Menunggu Approval', count: countMenunggu },
              { id: 'kritis', label: 'Kritis (<90 Hari)', count: countKritis },
              { id: 'nonaktif', label: 'Non-Aktif (Gudang)', count: countNonaktif },
            ].map((tab) => {
              const isActive = selectedStatus === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStatus(tab.id)}
                  className={`px-3 py-1 font-mono text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    isActive
                      ? 'bg-[#1E2429] text-white border-[#1E2429] font-bold'
                      : 'bg-white text-[#5B6166] border-[#D8D2C4] hover:bg-[#F7F3EB] hover:text-[#1A1D21]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1 py-0.2 rounded-none text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-[#F7F3EB] text-[#5B6166]'}`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: TABEL DATA BUKU KENDALI (RESPONSIVE TABLE)       */}
        {/* ======================================================== */}
        {viewMode === 'table' ? (
          <div className="bg-white border border-[#D8D2C4] shadow-2xs">
            <div 
              tabIndex={0} 
              role="region" 
              aria-label="Tabel Katalog Seluruh Dokumen"
              className="overflow-x-auto max-h-[640px] focus:outline-none focus:ring-1 focus:ring-[#1F5C55]"
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[#F7F3EB] border-b border-[#D8D2C4] shadow-2xs">
                  <tr className="text-[#5B6166] font-mono uppercase text-[11px] tracking-wider">
                    <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 whitespace-nowrap">
                      Kode Arsip & Barcode
                    </th>
                    <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 min-w-[280px]">
                      Judul & Nomor Surat
                    </th>
                    <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 whitespace-nowrap">
                      Klasifikasi
                    </th>
                    <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 whitespace-nowrap">
                      Status Cap
                    </th>
                    <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 whitespace-nowrap">
                      Pemegang & Lokasi
                    </th>
                    <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 text-right whitespace-nowrap">
                      Masa Retensi
                    </th>
                    <th scope="col" className="py-3 px-3.5 font-bold text-center whitespace-nowrap">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8D2C4] text-[#1A1D21]">
                  {filteredAndSortedDocs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#5B6166]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FolderArchive className="w-8 h-8 text-[#8C9399]" />
                          <p className="font-semibold text-sm text-[#1A1D21]">Tidak ada dokumen yang ditemukan.</p>
                          <p className="text-xs">Ubah kata kunci pencarian atau sesuaikan filter status klasifikasi.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedDocs.map((doc) => {
                      const isKritis = doc.sisa_hari !== null && doc.sisa_hari < 90 && doc.status === 'aktif'
                      return (
                        <tr 
                          key={doc.id} 
                          className={`hover:bg-[#F7F3EB]/70 transition-colors ${isKritis ? 'bg-[#FEFBE8]/40' : ''}`}
                        >
                          {/* Kode Arsip & QR */}
                          <td className="py-3 px-3.5 font-mono border-r border-[#D8D2C4]/40 align-top whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setShowQrModal(doc)}
                                className="p-1 bg-[#F7F3EB] border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] transition-colors"
                                title="Lihat Label QR Code Berkas"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                              <div>
                                <span className="font-bold text-[#1A1D21] block tracking-tight">
                                  {doc.kode_arsip}
                                </span>
                                <span className="text-[10px] text-[#8C9399] font-mono">
                                  {doc.file_size}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Judul & Nomor Surat */}
                          <td className="py-3 px-3.5 border-r border-[#D8D2C4]/40 align-top">
                            <Link 
                              href={`/dokumen/${doc.id}`}
                              className="font-semibold text-[#1A1D21] hover:text-[#1F5C55] hover:underline block leading-snug"
                            >
                              {doc.judul}
                            </Link>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-[#5B6166] font-mono">
                              <span className="text-[#1A1D21] font-semibold">{doc.nomor_dokumen}</span>
                              <span>•</span>
                              <span>Terbit: {doc.tanggal_dokumen}</span>
                            </div>
                          </td>

                          {/* Kategori */}
                          <td className="py-3 px-3.5 border-r border-[#D8D2C4]/40 align-top whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-[#F7F3EB] border border-[#D8D2C4] text-[11px] font-mono text-[#1E2429]">
                              {doc.kategori}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3.5 border-r border-[#D8D2C4]/40 align-top whitespace-nowrap">
                            <StampBadge status={doc.status} />
                          </td>

                          {/* Pemegang & Lokasi */}
                          <td className="py-3 px-3.5 border-r border-[#D8D2C4]/40 align-top whitespace-nowrap">
                            <div className="font-medium text-[#1A1D21] text-xs">
                              {doc.pemegang}
                            </div>
                            <div className="text-[10px] text-[#5B6166] font-mono mt-0.5 flex items-center gap-1">
                              <span>📍</span>
                              <span>{doc.lokasi_saat_ini}</span>
                            </div>
                          </td>

                          {/* Retensi */}
                          <td className="py-3 px-3.5 border-r border-[#D8D2C4]/40 text-right align-top whitespace-nowrap font-mono">
                            {doc.sisa_hari !== null ? (
                              <div>
                                {doc.sisa_hari <= 0 ? (
                                  <span className="text-[#8C9399] font-bold">KADALUARSA</span>
                                ) : isKritis ? (
                                  <span className="text-[#B42318] font-bold flex items-center justify-end gap-1">
                                    <AlertTriangle className="w-3 h-3 text-[#B42318]" />
                                    <span>{doc.sisa_hari} hari lagi</span>
                                  </span>
                                ) : (
                                  <span className="text-[#1F5C55] font-semibold">{doc.sisa_hari} hari</span>
                                )}
                                <span className="block text-[10px] text-[#8C9399]">
                                  s.d. {doc.tanggal_kadaluarsa}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#8C9399]">-</span>
                            )}
                          </td>

                          {/* Aksi */}
                          <td className="py-3 px-3.5 text-center align-top whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <Link
                                href={`/dokumen/${doc.id}`}
                                className="px-2.5 py-1 bg-white border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] font-mono text-[11px] font-semibold transition-colors shadow-2xs"
                              >
                                Detail
                              </Link>
                              {currentUserRole !== 'viewer' && (
                                <Link
                                  href={`/dokumen/${doc.id}`}
                                  className="p-1 bg-[#F7F3EB] border border-[#D8D2C4] hover:bg-[#1E2429] hover:text-white text-[#1E2429] transition-colors"
                                  title="Unduh Lembar Berkas"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 bg-[#F7F3EB] border-t border-[#D8D2C4] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-mono">
              <span className="text-[#5B6166]">
                Menampilkan <strong>{filteredAndSortedDocs.length}</strong> dari <strong>{documents.length}</strong> dokumen resmi terdaftar
              </span>
              <div className="flex items-center gap-1">
                <button disabled className="px-2.5 py-1 bg-white border border-[#D8D2C4] text-[#8C9399] cursor-not-allowed">
                  Sebelumnya
                </button>
                <button className="px-2.5 py-1 bg-[#1E2429] text-white border border-[#1E2429] font-bold">
                  1
                </button>
                <button disabled className="px-2.5 py-1 bg-white border border-[#D8D2C4] text-[#8C9399] cursor-not-allowed">
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* VIEW 2: TAMPILAN MAP FOLDER GRID BERKAS                  */
          /* ======================================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedDocs.map((doc) => {
              const isKritis = doc.sisa_hari !== null && doc.sisa_hari < 90 && doc.status === 'aktif'
              return (
                <div 
                  key={doc.id}
                  className={`bg-white border p-4 flex flex-col justify-between shadow-2xs transition-all hover:border-[#1A1D21] ${
                    isKritis ? 'border-[#9A6700] ring-1 ring-[#9A6700]' : 'border-[#D8D2C4]'
                  }`}
                >
                  <div>
                    {/* Header Map */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F7F3EB]">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#F7F3EB] border border-[#D8D2C4]">
                          <FileText className="w-4 h-4 text-[#1E2429]" />
                        </div>
                        <div>
                          <span className="font-mono font-bold text-xs text-[#1A1D21] block">
                            {doc.kode_arsip}
                          </span>
                          <span className="text-[10px] text-[#8C9399] font-mono">
                            {doc.kategori}
                          </span>
                        </div>
                      </div>
                      <StampBadge status={doc.status} />
                    </div>

                    {/* Judul & Nomor Dokumen */}
                    <div className="mt-3">
                      <Link 
                        href={`/dokumen/${doc.id}`}
                        className="font-serif font-bold text-sm text-[#1A1D21] hover:text-[#1F5C55] hover:underline line-clamp-2"
                      >
                        {doc.judul}
                      </Link>
                      <p className="text-[11px] font-mono text-[#5B6166] mt-1">
                        No: {doc.nomor_dokumen}
                      </p>
                    </div>

                    {/* Metadata Box */}
                    <div className="mt-4 p-2.5 bg-[#F7F3EB]/60 border border-[#D8D2C4]/70 space-y-1.5 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-[#5B6166]">Pemegang:</span>
                        <span className="font-medium text-[#1A1D21] truncate max-w-[150px]">{doc.pemegang}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#5B6166]">Lokasi:</span>
                        <span className="text-[#1A1D21] truncate max-w-[150px]">{doc.lokasi_saat_ini}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#5B6166]">Retensi 3 Thn:</span>
                        <span className={isKritis ? 'font-bold text-[#B42318]' : 'text-[#1F5C55]'}>
                          {doc.sisa_hari !== null ? `${doc.sisa_hari} hari lagi` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Aksi */}
                  <div className="mt-4 pt-3 border-t border-[#F7F3EB] flex items-center justify-between gap-2">
                    <button
                      onClick={() => setShowQrModal(doc)}
                      className="px-2.5 py-1 bg-[#F7F3EB] border border-[#D8D2C4] hover:border-[#1A1D21] text-xs font-mono flex items-center gap-1 transition-colors"
                      title="Lihat QR Code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR</span>
                    </button>
                    <Link
                      href={`/dokumen/${doc.id}`}
                      className="flex-1 text-center py-1 bg-[#1F5C55] hover:bg-[#184843] text-white text-xs font-mono font-medium transition-colors"
                    >
                      Buka Berkas
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL LABEL BARCODE & QR CODE RESMI                      */}
        {/* ======================================================== */}
        {showQrModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs">
            <div className="bg-white max-w-md w-full border-2 border-[#1E2429] p-6 space-y-4 shadow-xl">
              <div className="flex items-start justify-between border-b border-[#D8D2C4] pb-3">
                <div>
                  <span className="font-mono text-[10px] text-[#8C9399] uppercase tracking-wider block">
                    LABEL RESMI KEARSIPAN
                  </span>
                  <h3 className="font-serif font-bold text-lg text-[#1A1D21]">
                    {showQrModal.kode_arsip}
                  </h3>
                </div>
                <button
                  onClick={() => setShowQrModal(null)}
                  className="p-1 hover:bg-[#F7F3EB] text-[#5B6166] hover:text-[#1A1D21]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tampilan Visual Label Fisik */}
              <div className="p-4 border border-dashed border-[#1E2429] bg-[#F7F3EB] text-center space-y-3 font-mono">
                <div className="text-[10px] tracking-wider text-[#5B6166] uppercase">
                  INSTANSI ARSIP NASIONAL • RUANG SIMPAN VAULT
                </div>
                
                {/* Visual QR Barcode Box */}
                <div className="w-40 h-40 mx-auto bg-white border border-[#1E2429] p-2 flex flex-col items-center justify-center shadow-xs">
                  <QrCode className="w-32 h-32 text-[#1E2429]" />
                </div>
                
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-[#1A1D21] tracking-widest">
                    {showQrModal.kode_arsip}
                  </div>
                  <div className="text-[11px] text-[#5B6166] truncate max-w-xs mx-auto">
                    {showQrModal.judul}
                  </div>
                  <div className="text-[10px] text-[#8C9399]">
                    Lokasi: {showQrModal.lokasi_saat_ini}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8D2C4]">
                <button
                  onClick={() => setShowQrModal(null)}
                  className="px-3.5 py-1.5 border border-[#D8D2C4] text-xs font-mono font-medium hover:bg-[#F7F3EB]"
                >
                  Tutup
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white text-xs font-mono font-semibold flex items-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Cetak Label Stiker</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}

export default function DaftarDokumenPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-mono">Memuat Katalog Dokumen...</div>}>
      <DaftarDokumenContent />
    </Suspense>
  )
}

