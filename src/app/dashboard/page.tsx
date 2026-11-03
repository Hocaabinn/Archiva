'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { StampBadge } from '@/components/ui/stamp-badge'
import { UserRole } from '@/types'
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  ArrowUpRight, 
  QrCode, 
  CheckCircle,
  Archive
} from 'lucide-react'

// Dummy arsip sesuai PRD & DESIGN.md
const sampleDocuments = [
  {
    id: '1',
    kode_arsip: 'ARS-2026-0001',
    judul: 'Kontrak Kerja Sama Vendor PT Prima Logistik 2026',
    kategori: 'Kontrak & Legal',
    status: 'aktif' as const,
    pemegang: 'Bambang S. (PIC Arsip)',
    lokasi: 'Ruang Arsip Aktif - Rak A1',
    kadaluarsa: '03 Nov 2029',
    sisa_hari: 1095,
  },
  {
    id: '2',
    kode_arsip: 'ARS-2026-0002',
    judul: 'Laporan Keuangan Triwulan III 2026',
    kategori: 'Keuangan',
    status: 'menunggu_persetujuan' as const,
    pemegang: 'Siti Aminah (Pengaju)',
    lokasi: 'Meja Verifikasi PIC',
    kadaluarsa: '-',
    sisa_hari: null,
  },
  {
    id: '3',
    kode_arsip: 'ARS-2026-0003',
    judul: 'Surat Keputusan Direksi Tentang Kebijakan Mutasi 2026',
    kategori: 'SDM & Kepegawaian',
    status: 'aktif' as const,
    pemegang: 'Drs. Hendra M.',
    lokasi: 'Ruang Direksi Lt. 3',
    kadaluarsa: '15 Des 2026',
    sisa_hari: 42, // Peringatan < 90 hari
  },
  {
    id: '4',
    kode_arsip: 'ARS-2023-0045',
    judul: 'Berita Acara Pengadaan Server Basis Data 2023',
    kategori: 'Operasional & Logistik',
    status: 'nonaktif' as const,
    pemegang: 'Sistem (Gudang)',
    lokasi: 'Gudang Non-Aktif - Kotak B-12',
    kadaluarsa: '01 Nov 2026',
    sisa_hari: 0,
  },
]

function DashboardContent() {
  const searchParams = useSearchParams()
  const roleParam = (searchParams.get('demo_role') as UserRole) || 'pic_arsip'

  return (
    <AppLayout currentRole={roleParam}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Meja Kerja */}
        <div className="border-b border-[#D8D2C4] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#1A1D21] tracking-tight">
              Meja Kerja & Buku Kendali Arsip
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6166] mt-0.5">
              Pantau status siklus 3 tahun, antrean verifikasi, dan serah terima dokumen fisik.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/serah-terima"
              className="px-3 py-1.5 bg-white border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan Dokumen Fisik</span>
            </Link>
          </div>
        </div>

        {/* Banner Peringatan H-90 Kadaluarsa Sesuai PRD */}
        <div className="bg-[#FEFBE8] border border-[#9A6700] p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#9A6700] shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm text-[#1A1D21]">
            <p className="font-bold text-[#9A6700]">Peringatan Retensi Kadaluarsa (1 Dokumen Kritis)</p>
            <p className="text-[#5B6166] mt-0.5">
              Dokumen <span className="font-mono font-semibold text-[#1A1D21]">ARS-2026-0003</span> tersisa 42 hari lagi sebelum otomatis dialihkan ke bucket gudang Non-Aktif. Segera ajukan perpanjangan jika masih dibutuhkan.
            </p>
          </div>
          <Link
            href="/dokumen/3"
            className="px-2.5 py-1 bg-white border border-[#9A6700] text-[#9A6700] hover:bg-[#9A6700] hover:text-white text-xs font-medium font-mono shrink-0 transition-colors"
          >
            Periksa
          </Link>
        </div>

        {/* Ringkasan Angka Padat (Bukan Hero SaaS) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
          <div className="p-3 bg-white border border-[#D8D2C4]">
            <span className="text-[11px] text-[#5B6166] uppercase block">Total Arsip Aktif</span>
            <div className="text-2xl font-bold text-[#1A1D21] mt-1">128</div>
            <span className="text-[10px] text-[#1F5C55] font-semibold">Tersimpan di Vault</span>
          </div>
          <div className="p-3 bg-white border border-[#D8D2C4]">
            <span className="text-[11px] text-[#5B6166] uppercase block">Menunggu Approval</span>
            <div className="text-2xl font-bold text-[#9A6700] mt-1">4</div>
            <span className="text-[10px] text-[#9A6700] font-semibold">2 PIC • 2 Atasan</span>
          </div>
          <div className="p-3 bg-white border border-[#D8D2C4]">
            <span className="text-[11px] text-[#5B6166] uppercase block">Kadaluarsa &lt; 90 Hari</span>
            <div className="text-2xl font-bold text-[#B42318] mt-1">3</div>
            <span className="text-[10px] text-[#B42318] font-semibold">Perlu Perpanjangan</span>
          </div>
          <div className="p-3 bg-white border border-[#D8D2C4]">
            <span className="text-[11px] text-[#5B6166] uppercase block">Gudang Non-Aktif</span>
            <div className="text-2xl font-bold text-[#5B6166] mt-1">312</div>
            <span className="text-[10px] text-[#5B6166]">Bisa Direaktivasi</span>
          </div>
        </div>

        {/* Tabel Dokumen Kerja Padat (Anti-Slop Guideline) */}
        <div className="bg-white border border-[#D8D2C4]">
          <div className="px-4 py-3 border-b border-[#D8D2C4] flex items-center justify-between">
            <h2 className="font-serif font-bold text-base text-[#1A1D21]">
              Daftar Dokumen Terbaru
            </h2>
            <Link href="/dokumen" className="text-xs font-semibold text-[#1A1D21] hover:underline flex items-center gap-1">
              <span>Buka Semua Berkas</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8D2C4] bg-[#F7F3EB] text-[#5B6166] font-mono uppercase text-[11px]">
                  <th className="py-2.5 px-3 font-semibold">Kode Arsip</th>
                  <th className="py-2.5 px-3 font-semibold">Judul Dokumen</th>
                  <th className="py-2.5 px-3 font-semibold">Kategori</th>
                  <th className="py-2.5 px-3 font-semibold">Status Cap</th>
                  <th className="py-2.5 px-3 font-semibold">Pemegang Saat Ini</th>
                  <th className="py-2.5 px-3 font-semibold">Lokasi Berkas</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Masa Retensi</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8D2C4] text-[#1A1D21]">
                {sampleDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#F7F3EB]/60 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                      {doc.kode_arsip}
                    </td>
                    <td className="py-2.5 px-3 font-medium max-w-xs truncate">
                      {doc.judul}
                    </td>
                    <td className="py-2.5 px-3 text-[#5B6166] whitespace-nowrap">
                      {doc.kategori}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StampBadge status={doc.status} />
                    </td>
                    <td className="py-2.5 px-3 text-[#1A1D21] whitespace-nowrap">
                      {doc.pemegang}
                    </td>
                    <td className="py-2.5 px-3 text-[#5B6166] whitespace-nowrap font-mono text-[11px]">
                      {doc.lokasi}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono">
                      {doc.sisa_hari !== null ? (
                        doc.sisa_hari < 90 ? (
                          <span className="text-[#B42318] font-bold">{doc.sisa_hari} hari lagi</span>
                        ) : (
                          <span>{doc.sisa_hari} hari</span>
                        )
                      ) : (
                        <span className="text-[#8C9399]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <Link
                        href={`/dokumen/${doc.id}`}
                        className="px-2 py-1 bg-white border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] font-mono text-[11px] font-medium"
                      >
                        Buka
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-mono">Memuat Meja Kerja...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
