'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useMemo } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { StampBadge } from '@/components/ui/stamp-badge'
import { UserRole } from '@/types'
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowUpRight, 
  QrCode, 
  Search, 
  Filter, 
  FolderArchive, 
  ShieldCheck, 
  Layers, 
  HardDrive, 
  ExternalLink, 
  RefreshCw, 
  FileDown, 
  ChevronRight, 
  Calendar,
  X
} from 'lucide-react'

// Model data arsip sesuai PRD & DESIGN.md
interface DocumentItem {
  id: string
  kode_arsip: string
  judul: string
  nomor_surat: string
  kategori: string
  status: 'aktif' | 'menunggu_persetujuan' | 'nonaktif' | 'ditolak'
  pemegang: string
  lokasi: string
  tanggal_terbit: string
  kadaluarsa: string
  sisa_hari: number | null
  ukuran_file: string
  tingkat_sensitif: 'Biasa' | 'Rahasia' | 'Sangat Rahasia'
}

const sampleDocuments: DocumentItem[] = [
  {
    id: '1',
    kode_arsip: 'ARS-2026-0001',
    judul: 'Kontrak Kerja Sama Vendor PT Prima Logistik 2026',
    nomor_surat: '042/LEG-KTR/PL/I/2026',
    kategori: 'Kontrak & Legal',
    status: 'aktif',
    pemegang: 'Bambang S. (PIC Arsip)',
    lokasi: 'Ruang Arsip Aktif - Rak A1',
    tanggal_terbit: '03 Jan 2026',
    kadaluarsa: '03 Nov 2029',
    sisa_hari: 1095,
    ukuran_file: '4.8 MB (PDF)',
    tingkat_sensitif: 'Biasa',
  },
  {
    id: '2',
    kode_arsip: 'ARS-2026-0002',
    judul: 'Laporan Keuangan & Audit Neraca Kas Triwulan III 2026',
    nomor_surat: '118/KEU-AUD/X/2026',
    kategori: 'Keuangan',
    status: 'menunggu_persetujuan',
    pemegang: 'Siti Aminah (Pengaju)',
    lokasi: 'Meja Verifikasi PIC',
    tanggal_terbit: '18 Okt 2026',
    kadaluarsa: '-',
    sisa_hari: null,
    ukuran_file: '12.3 MB (PDF)',
    tingkat_sensitif: 'Rahasia',
  },
  {
    id: '3',
    kode_arsip: 'ARS-2026-0003',
    judul: 'Surat Keputusan Direksi Tentang Kebijakan Mutasi & Promosi 2026',
    nomor_surat: '007/SK-DIR/SDM/2026',
    kategori: 'SDM & Kepegawaian',
    status: 'aktif',
    pemegang: 'Drs. Hendra M.',
    lokasi: 'Ruang Direksi Lt. 3',
    tanggal_terbit: '15 Des 2023',
    kadaluarsa: '15 Des 2026',
    sisa_hari: 42, // Peringatan kritis < 90 hari
    ukuran_file: '2.1 MB (PDF)',
    tingkat_sensitif: 'Sangat Rahasia',
  },
  {
    id: '4',
    kode_arsip: 'ARS-2023-0045',
    judul: 'Berita Acara Pengadaan Server & Komponen Basis Data Utama 2023',
    nomor_surat: 'BA-240/TIK-LOG/XI/2023',
    kategori: 'Operasional & Logistik',
    status: 'nonaktif',
    pemegang: 'Sistem (Gudang)',
    lokasi: 'Gudang Non-Aktif - Kotak B-12',
    tanggal_terbit: '01 Nov 2023',
    kadaluarsa: '01 Nov 2026',
    sisa_hari: 0,
    ukuran_file: '8.4 MB (PDF)',
    tingkat_sensitif: 'Biasa',
  },
  {
    id: '5',
    kode_arsip: 'ARS-2026-0004',
    judul: 'Dokumen Perjanjian Kerahasiaan Data Klien (NDA) Multinasional',
    nomor_surat: 'NDA-099/LGL/2026',
    kategori: 'Kontrak & Legal',
    status: 'aktif',
    pemegang: 'Bambang S. (PIC Arsip)',
    lokasi: 'Ruang Arsip Aktif - Rak A2',
    tanggal_terbit: '12 Feb 2026',
    kadaluarsa: '12 Feb 2029',
    sisa_hari: 1045,
    ukuran_file: '1.9 MB (PDF)',
    tingkat_sensitif: 'Rahasia',
  },
]

// Log aktivitas mutakhir
const recentActivities = [
  {
    id: 'log-1',
    waktu: '12 menit lalu',
    pelaku: 'Bambang S. (PIC Arsip)',
    aksi: 'Verifikasi Tahap 1 Disetujui',
    dokumen: 'ARS-2026-0001',
    status: 'sukses',
  },
  {
    id: 'log-2',
    waktu: '45 menit lalu',
    pelaku: 'Atasan Otorisator',
    aksi: 'Pengesahan Akhir Berkas Kontrak',
    dokumen: 'ARS-2026-0001',
    status: 'sukses',
  },
  {
    id: 'log-3',
    waktu: '2 jam lalu',
    pelaku: 'Sistem Kearsipan (Cron)',
    aksi: 'Otomatisasi Retensi: Pindah ke Gudang Non-Aktif',
    dokumen: 'ARS-2023-0045',
    status: 'peringatan',
  },
  {
    id: 'log-4',
    waktu: 'Kemarin, 16:30',
    pelaku: 'Bagian Keuangan',
    aksi: 'Verifikasi Pembayaran Retensi 1 Tahun',
    dokumen: 'ARS-2025-0812',
    status: 'sukses',
  },
]

function DashboardContent() {
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('demo_role') as UserRole | null

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('semua')
  const [selectedKategori, setSelectedKategori] = useState<string>('semua')
  const [showQrModal, setShowQrModal] = useState<DocumentItem | null>(null)
  const [alertDismissed, setAlertDismissed] = useState(false)

  // Filter dokumen sesuai pencarian dan filter aktif
  const filteredDocuments = useMemo(() => {
    return sampleDocuments.filter((doc) => {
      const matchSearch =
        doc.kode_arsip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.nomor_surat.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.pemegang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.lokasi.toLowerCase().includes(searchQuery.toLowerCase())

      const matchKategori =
        selectedKategori === 'semua' || doc.kategori === selectedKategori

      let matchStatus = true
      if (selectedStatus === 'aktif') matchStatus = doc.status === 'aktif'
      else if (selectedStatus === 'menunggu_persetujuan') matchStatus = doc.status === 'menunggu_persetujuan'
      else if (selectedStatus === 'nonaktif') matchStatus = doc.status === 'nonaktif'
      else if (selectedStatus === 'kritis') matchStatus = doc.status === 'aktif' && doc.sisa_hari !== null && doc.sisa_hari < 90

      return matchSearch && matchKategori && matchStatus
    })
  }, [searchQuery, selectedStatus, selectedKategori])

  const totalAktif = sampleDocuments.filter(d => d.status === 'aktif').length
  const totalMenunggu = sampleDocuments.filter(d => d.status === 'menunggu_persetujuan').length
  const totalKritis = sampleDocuments.filter(d => d.status === 'aktif' && d.sisa_hari !== null && d.sisa_hari < 90).length
  const totalNonaktif = sampleDocuments.filter(d => d.status === 'nonaktif').length

  return (
    <AppLayout currentRole={roleParam || undefined}>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* ======================================================== */}
        {/* 1. HEADER PUSAT KENDALI ARSIP                            */}
        {/* ======================================================== */}
        <div className="border-b border-[#D8D2C4] pb-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 bg-[#1E2429] text-[#F7F3EB] font-bold">
                  SISTEM OTORITAS ARSIP TERPUSAT
                </span>
                <span className="text-xs text-[#5B6166] font-mono flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Jumat, 06 Nov 2026 • Tahun Anggaran 2026/2027
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1D21] tracking-tight">
                Pusat Kendali & Tata Kelola Dokumen
              </h1>
              <p className="text-xs sm:text-sm text-[#5B6166] mt-1 max-w-2xl leading-relaxed">
                Pemantauan siklus 3 tahun, integritas penyimpanan vault, validasi serah terima fisik ber-QR, dan kepatuhan retensi arsip.
              </p>
            </div>

            {/* Quick Actions Header */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/serah-terima"
                className="px-3.5 py-2 bg-white border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] text-xs font-mono font-semibold flex items-center gap-2 transition-all shadow-2xs hover:shadow-xs"
              >
                <QrCode className="w-4 h-4 text-[#1E2429]" />
                <span>Pindai QR Dokumen</span>
              </Link>
              <Link
                href="/dokumen/upload"
                className="px-4 py-2 bg-[#1F5C55] hover:bg-[#184843] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs"
              >
                <span>+ Unggah Berkas Baru</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. BANNER PERINGATAN RETENSI DOKUMEN KRITIS (< 90 HARI) */}
        {/* ======================================================== */}
        {!alertDismissed && (
          <div className="bg-[#FEFBE8] border-2 border-[#9A6700] p-4 sm:p-5 relative transition-all shadow-2xs">
            <button
              onClick={() => setAlertDismissed(true)}
              className="absolute top-3 right-3 text-[#9A6700] hover:text-[#1A1D21] p-1 transition-colors"
              title="Tutup Peringatan"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="p-2.5 bg-[#9A6700] text-white shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 pr-6">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-white bg-[#B42318] px-2 py-0.5 uppercase tracking-wide">
                    PERINGATAN KRITIS
                  </span>
                  <span className="font-mono text-xs font-bold text-[#9A6700]">
                    H-42 Menuju Kedaluwarsa
                  </span>
                </div>
                <h2 className="font-serif font-bold text-sm sm:text-base text-[#1A1D21] mt-1">
                  Surat Keputusan Direksi Tentang Kebijakan Mutasi & Promosi (ARS-2026-0003)
                </h2>
                <p className="text-xs text-[#5B6166] mt-1 leading-relaxed">
                  Masa aktif retensi 3 tahun akan berakhir pada <strong className="text-[#1A1D21]">15 Desember 2026</strong>. Dokumen akan dipindahkan otomatis ke bucket <code className="bg-[#F7F3EB] px-1 py-0.5 border border-[#D8D2C4] text-[#1E2429]">arsip-inaktif</code> oleh sistem cron.
                </p>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <Link
                    href="/pembayaran"
                    className="px-3 py-1.5 bg-[#9A6700] hover:bg-[#7D5300] text-white text-xs font-semibold font-mono flex items-center gap-1.5 transition-colors"
                  >
                    <span>Ajukan Perpanjangan (Rp50.000)</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href="/dokumen/3"
                    className="px-3 py-1.5 bg-white border border-[#9A6700] text-[#9A6700] hover:bg-[#FEFBE8] text-xs font-mono font-semibold transition-colors"
                  >
                    Tinjau Lembar Berkas
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. PAPAN METRIK & INTEGRITAS ARSIP (KERTAS & TINTA)      */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Arsip Aktif */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'aktif' ? 'semua' : 'aktif')}
            className={`p-4 bg-white border cursor-pointer transition-all ${
              selectedStatus === 'aktif' ? 'border-[#1F5C55] ring-2 ring-[#1F5C55]/20 shadow-xs' : 'border-[#D8D2C4] hover:border-[#1F5C55]'
            }`}
          >
            <div className="flex items-center justify-between text-[#5B6166]">
              <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">Arsip Aktif</span>
              <div className="p-1.5 bg-[#E8F5E9] text-[#1F5C55]">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-serif font-bold text-[#1A1D21]">{totalAktif}</span>
              <span className="text-xs text-[#5B6166] font-mono">berkas</span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#F7F3EB] flex items-center justify-between text-[11px]">
              <span className="text-[#1F5C55] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C55]" />
                Ruang Vault Aktif
              </span>
              <span className="text-[#8C9399] font-mono">Retensi 3 Thn</span>
            </div>
          </div>

          {/* Card 2: Menunggu Persetujuan */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'menunggu_persetujuan' ? 'semua' : 'menunggu_persetujuan')}
            className={`p-4 bg-white border cursor-pointer transition-all ${
              selectedStatus === 'menunggu_persetujuan' ? 'border-[#9A6700] ring-2 ring-[#9A6700]/20 shadow-xs' : 'border-[#D8D2C4] hover:border-[#9A6700]'
            }`}
          >
            <div className="flex items-center justify-between text-[#5B6166]">
              <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">Antrean Approval</span>
              <div className="p-1.5 bg-[#FEFBE8] text-[#9A6700]">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-serif font-bold text-[#9A6700]">{totalMenunggu}</span>
              <span className="text-xs text-[#5B6166] font-mono">berkas</span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#F7F3EB] flex items-center justify-between text-[11px]">
              <span className="text-[#9A6700] font-semibold">Verifikasi 2 Tahap</span>
              <span className="text-[#5B6166] font-mono">PIC & Atasan</span>
            </div>
          </div>

          {/* Card 3: Peringatan Kritis */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'kritis' ? 'semua' : 'kritis')}
            className={`p-4 bg-white border cursor-pointer transition-all ${
              selectedStatus === 'kritis' ? 'border-[#B42318] ring-2 ring-[#B42318]/20 shadow-xs' : 'border-[#D8D2C4] hover:border-[#B42318]'
            }`}
          >
            <div className="flex items-center justify-between text-[#5B6166]">
              <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">Kedaluwarsa &lt; 90 Hari</span>
              <div className="p-1.5 bg-[#FEF3F2] text-[#B42318]">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-serif font-bold text-[#B42318]">{totalKritis}</span>
              <span className="text-xs text-[#5B6166] font-mono">perlu atensi</span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#F7F3EB] flex items-center justify-between text-[11px]">
              <span className="text-[#B42318] font-semibold">Batas Tindakan Segera</span>
              <span className="text-[#8C9399] font-mono">Opsi Retensi</span>
            </div>
          </div>

          {/* Card 4: Gudang Non-Aktif */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'nonaktif' ? 'semua' : 'nonaktif')}
            className={`p-4 bg-white border cursor-pointer transition-all ${
              selectedStatus === 'nonaktif' ? 'border-[#5B6166] ring-2 ring-[#5B6166]/20 shadow-xs' : 'border-[#D8D2C4] hover:border-[#5B6166]'
            }`}
          >
            <div className="flex items-center justify-between text-[#5B6166]">
              <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">Gudang Non-Aktif</span>
              <div className="p-1.5 bg-[#F0F2F5] text-[#5B6166]">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-serif font-bold text-[#5B6166]">{totalNonaktif}</span>
              <span className="text-xs text-[#5B6166] font-mono">arsip pasif</span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#F7F3EB] flex items-center justify-between text-[11px]">
              <span className="text-[#5B6166] font-semibold">Bucket Inaktif</span>
              <span className="text-[#8C9399] font-mono">Dapat Direaktivasi</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. BILAH FILTER & PENCARIAN BUKU KENDALI DOKUMEN        */}
        {/* ======================================================== */}
        <div className="bg-white border border-[#D8D2C4] p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Input Pencarian */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C9399]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari berdasarkan kode arsip, nomor surat, judul dokumen, atau nama pemegang..."
                className="w-full pl-9 pr-3 py-2 text-xs font-sans bg-[#F7F3EB]/40 border border-[#D8D2C4] focus:border-[#1A1D21] focus:bg-white focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8C9399] hover:text-[#1A1D21]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Kategori */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#5B6166] shrink-0" />
              <select
                value={selectedKategori}
                onChange={(e) => setSelectedKategori(e.target.value)}
                className="text-xs bg-white border border-[#D8D2C4] px-3 py-2 text-[#1A1D21] focus:border-[#1A1D21] focus:outline-none font-medium cursor-pointer"
              >
                <option value="semua">Semua Kategori Klasifikasi</option>
                <option value="Kontrak & Legal">Kontrak & Legal</option>
                <option value="Keuangan">Keuangan</option>
                <option value="SDM & Kepegawaian">SDM & Kepegawaian</option>
                <option value="Operasional & Logistik">Operasional & Logistik</option>
              </select>
            </div>
          </div>

          {/* Tab Filter Status */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[#F7F3EB] text-xs">
            {[
              { id: 'semua', label: 'Semua Berkas', count: sampleDocuments.length },
              { id: 'aktif', label: 'Arsip Aktif', count: totalAktif },
              { id: 'menunggu_persetujuan', label: 'Menunggu Approval', count: totalMenunggu },
              { id: 'kritis', label: 'Kritis (<90 Hari)', count: totalKritis },
              { id: 'nonaktif', label: 'Non-Aktif', count: totalNonaktif },
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
        {/* 5. TABEL BUKU KENDALI DOKUMEN (RESPONSIVE TABLE)        */}
        {/* ======================================================== */}
        <div className="bg-white border border-[#D8D2C4] shadow-2xs">
          <div className="px-4 py-3.5 border-b border-[#D8D2C4] bg-[#F7F3EB]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-serif font-bold text-base text-[#1A1D21] flex items-center gap-2">
                <span>Daftar Berkas Dokumen Terverifikasi</span>
                <span className="font-mono text-xs font-normal text-[#5B6166]">
                  ({filteredDocuments.length} dari {sampleDocuments.length} berkas)
                </span>
              </h2>
              <p className="text-[11px] text-[#5B6166] mt-0.5 font-sans">
                Setiap dokumen fisik memiliki QR code resmi yang mengunci identitas lokasi dan status kepemilikan.
              </p>
            </div>
            <Link
              href="/dokumen"
              className="text-xs font-semibold text-[#1F5C55] hover:text-[#184843] flex items-center gap-1 font-mono"
            >
              <span>Katalog Lengkap</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Container Scroll Table dengan Standar Aksesibilitas Modern */}
          <div 
            tabIndex={0} 
            role="region" 
            aria-label="Tabel Buku Kendali Arsip Dokumen"
            className="overflow-x-auto max-h-[560px] focus:outline-none focus:ring-1 focus:ring-[#1F5C55]"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-[#F7F3EB] border-b border-[#D8D2C4] shadow-2xs">
                <tr className="text-[#5B6166] font-mono uppercase text-[11px] tracking-wider">
                  <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 whitespace-nowrap">
                    Kode Arsip & Barcode
                  </th>
                  <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 min-w-[260px]">
                    Judul Dokumen & Metadata
                  </th>
                  <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 whitespace-nowrap">
                    Klasifikasi
                  </th>
                  <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 whitespace-nowrap">
                    Status Berkas
                  </th>
                  <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 whitespace-nowrap">
                    Pemegang & Lokasi Fisik
                  </th>
                  <th scope="col" className="py-3 px-3.5 font-bold border-r border-[#D8D2C4]/60 text-right whitespace-nowrap">
                    Retensi 3 Tahun
                  </th>
                  <th scope="col" className="py-3 px-3.5 font-bold text-center whitespace-nowrap">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8D2C4] text-[#1A1D21]">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#5B6166]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FolderArchive className="w-8 h-8 text-[#8C9399]" />
                        <p className="font-semibold text-sm text-[#1A1D21]">Tidak ada dokumen yang sesuai kriteria.</p>
                        <p className="text-xs">Coba sesuaikan kata kunci pencarian atau ubah tab status di atas.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => {
                    const isKritis = doc.sisa_hari !== null && doc.sisa_hari < 90 && doc.status === 'aktif'
                    return (
                      <tr 
                        key={doc.id} 
                        className={`hover:bg-[#F7F3EB]/70 transition-colors ${
                          isKritis ? 'bg-[#FEFBE8]/30' : ''
                        }`}
                      >
                        {/* Kolom 1: Kode Arsip & QR Trigger */}
                        <td className="py-3 px-3.5 font-mono border-r border-[#D8D2C4]/40 align-top whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowQrModal(doc)}
                              className="p-1 bg-[#F7F3EB] border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] transition-colors"
                              title="Tampilkan Label QR Code Fisik"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            <div>
                              <span className="font-bold text-[#1A1D21] block tracking-tight">
                                {doc.kode_arsip}
                              </span>
                              <span className="text-[10px] text-[#8C9399] font-mono">
                                {doc.nomor_surat}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Kolom 2: Judul & Detail */}
                        <td className="py-3 px-3.5 border-r border-[#D8D2C4]/40 align-top">
                          <Link 
                            href={`/dokumen/${doc.id}`}
                            className="font-medium text-[#1A1D21] hover:text-[#1F5C55] hover:underline block leading-snug"
                          >
                            {doc.judul}
                          </Link>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-[#5B6166] font-mono">
                            <span>Terbit: {doc.tanggal_terbit}</span>
                            <span>•</span>
                            <span>{doc.ukuran_file}</span>
                            <span>•</span>
                            <span className={`px-1 py-0.2 border ${
                              doc.tingkat_sensitif === 'Sangat Rahasia' 
                                ? 'bg-red-50 text-red-700 border-red-300' 
                                : doc.tingkat_sensitif === 'Rahasia' 
                                  ? 'bg-amber-50 text-amber-700 border-amber-300' 
                                  : 'bg-stone-50 text-stone-600 border-stone-200'
                            }`}>
                              {doc.tingkat_sensitif}
                            </span>
                          </div>
                        </td>

                        {/* Kolom 3: Kategori */}
                        <td className="py-3 px-3.5 border-r border-[#D8D2C4]/40 align-top whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-[#F7F3EB] border border-[#D8D2C4] text-[11px] font-mono text-[#1E2429]">
                            {doc.kategori}
                          </span>
                        </td>

                        {/* Kolom 4: Status Stempel */}
                        <td className="py-3 px-3.5 border-r border-[#D8D2C4]/40 align-top whitespace-nowrap">
                          <StampBadge status={doc.status} />
                        </td>

                        {/* Kolom 5: Pemegang & Lokasi */}
                        <td className="py-3 px-3.5 border-r border-[#D8D2C4]/40 align-top whitespace-nowrap">
                          <div className="font-medium text-[#1A1D21] text-xs">
                            {doc.pemegang}
                          </div>
                          <div className="text-[10px] text-[#5B6166] font-mono mt-0.5 flex items-center gap-1">
                            <span>📍</span>
                            <span>{doc.lokasi}</span>
                          </div>
                        </td>

                        {/* Kolom 6: Retensi 3 Tahun */}
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
                                s.d. {doc.kadaluarsa}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#8C9399]">-</span>
                          )}
                        </td>

                        {/* Kolom 7: Tombol Aksi */}
                        <td className="py-3 px-3.5 text-center align-top whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              href={`/dokumen/${doc.id}`}
                              className="px-2.5 py-1 bg-white border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] font-mono text-[11px] font-semibold transition-colors shadow-2xs"
                            >
                              Buka
                            </Link>
                            <Link
                              href={`/serah-terima?kode=${doc.kode_arsip}`}
                              className="px-2 py-1 bg-[#F7F3EB] border border-[#D8D2C4] hover:bg-[#1E2429] hover:text-white text-[#1E2429] font-mono text-[11px] transition-colors"
                              title="Serahkan Berkas Fisik"
                            >
                              Serah
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Tabel Informasi Standar Retensi */}
          <div className="px-4 py-2.5 bg-[#F7F3EB] border-t border-[#D8D2C4] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-[#5B6166] font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1F5C55]" />
              <span>Standar Retensi Arsip Aktif: 3 Tahun Sejak Pengesahan</span>
            </div>
            <div>
              <span>Menampilkan {filteredDocuments.length} dari total {sampleDocuments.length} dokumen</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 6. DUA PANEL: BUKU LOG MUTAKHIR & MONITORING RUANG SIMPAN */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Panel Kiri: Buku Log Mutakhir (2 Kolom) */}
          <div className="lg:col-span-2 bg-white border border-[#D8D2C4] p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#D8D2C4]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1F5C55]" />
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#1A1D21]">
                  Buku Catatan Log & Audit Mutasi Terakhir
                </h3>
              </div>
              <Link 
                href="/riwayat" 
                className="text-xs font-mono font-semibold text-[#1F5C55] hover:underline flex items-center gap-1"
              >
                <span>Buku Log Penuh</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {recentActivities.map((act) => (
                <div 
                  key={act.id} 
                  className="p-3 bg-[#F7F3EB]/50 border border-[#D8D2C4] flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#1A1D21] bg-white px-1.5 py-0.2 border border-[#D8D2C4]">
                        {act.dokumen}
                      </span>
                      <span className="font-medium text-[#1A1D21]">{act.aksi}</span>
                    </div>
                    <p className="text-[11px] text-[#5B6166]">
                      Oleh: <span className="font-medium text-[#1A1D21]">{act.pelaku}</span>
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-[#8C9399] shrink-0 whitespace-nowrap">
                    {act.waktu}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel Kanan: Status Ruang Simpan & Ketentuan Arsip (1 Kolom) */}
          <div className="bg-white border border-[#D8D2C4] p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#D8D2C4]">
                <Layers className="w-4 h-4 text-[#1E2429]" />
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#1A1D21]">
                  Integritas Ruang Simpan
                </h3>
              </div>

              <div className="space-y-3.5 text-xs font-mono">
                {/* Bucket arsip-aktif */}
                <div>
                  <div className="flex justify-between text-[#1A1D21] mb-1">
                    <span className="font-bold">Bucket `arsip-aktif`</span>
                    <span>128 File • 1.4 GB</span>
                  </div>
                  <div className="w-full bg-[#E5E7EB] h-2">
                    <div className="bg-[#1F5C55] h-2 w-[42%]" />
                  </div>
                  <span className="text-[10px] text-[#5B6166] mt-0.5 block">Privat • Akses Berdasarkan Role</span>
                </div>

                {/* Bucket arsip-inaktif */}
                <div>
                  <div className="flex justify-between text-[#1A1D21] mb-1">
                    <span className="font-bold">Bucket `arsip-inaktif`</span>
                    <span>312 File • 4.8 GB</span>
                  </div>
                  <div className="w-full bg-[#E5E7EB] h-2">
                    <div className="bg-[#5B6166] h-2 w-[76%]" />
                  </div>
                  <span className="text-[10px] text-[#5B6166] mt-0.5 block">Terkunci • Otomatis via Cron</span>
                </div>

                {/* Bucket bukti-pembayaran */}
                <div>
                  <div className="flex justify-between text-[#1A1D21] mb-1">
                    <span className="font-bold">Bukti Transfer Kas</span>
                    <span>86 Berkas • 120 MB</span>
                  </div>
                  <div className="w-full bg-[#E5E7EB] h-2">
                    <div className="bg-[#276749] h-2 w-[24%]" />
                  </div>
                  <span className="text-[10px] text-[#5B6166] mt-0.5 block">Verifikasi Bagian Keuangan</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#D8D2C4] bg-[#F7F3EB] p-3 text-[11px] text-[#5B6166]">
              <p className="font-bold text-[#1A1D21] font-serif mb-1">Pedoman Retensi Resmi:</p>
              <p className="leading-relaxed font-sans">
                Dokumen yang mencapai usia 3 tahun kalender wajib dialihkan ke arsip inaktif atau diperpanjang masa aktifnya melalui pembayaran retensi yang terverifikasi.
              </p>
            </div>
          </div>
        </div>

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

              {/* Tampilan Visual Label Fisik yang dapat diprint */}
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
                    Lokasi: {showQrModal.lokasi}
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-mono">Memuat Pusat Kendali Arsip...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
