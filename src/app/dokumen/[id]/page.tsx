'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { StampBadge } from '@/components/ui/stamp-badge'
import { UserRole } from '@/types'
import { 
  ArrowLeft, 
  QrCode, 
  Download, 
  Clock, 
  FileText, 
  Calendar, 
  MapPin, 
  User, 
  ShieldCheck, 
  AlertTriangle, 
  FileDown, 
  CheckCircle2, 
  History,
  Lock,
  ExternalLink,
  Printer
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function DetailDokumenPage({ params }: PageProps) {
  const { id } = use(params)
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('user')
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null)

  useEffect(() => {
    async function loadRole() {
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
    }
    loadRole()
  }, [])

  // Mock data dokumen berdasarkan ID
  const doc = {
    id,
    kode_arsip: id === '3' ? 'ARS-2026-0003' : id === '2' ? 'ARS-2026-0002' : id === '4' ? 'ARS-2023-0045' : 'ARS-2026-0001',
    nomor_dokumen: id === '3' ? '007/SK-DIR/SDM/2026' : id === '2' ? '118/KEU-AUD/X/2026' : id === '4' ? 'BA-240/TIK-LOG/XI/2023' : '042/LEG-KTR/PL/I/2026',
    judul: id === '3' 
      ? 'Surat Keputusan Direksi Tentang Kebijakan Mutasi & Promosi 2026' 
      : id === '2' 
        ? 'Laporan Keuangan & Audit Neraca Kas Triwulan III 2026' 
        : id === '4' 
          ? 'Berita Acara Pengadaan Server & Komponen Basis Data Utama 2023' 
          : 'Kontrak Kerja Sama Vendor PT Prima Logistik 2026',
    kategori: id === '3' ? 'SDM & Kepegawaian' : id === '2' ? 'Keuangan' : id === '4' ? 'Operasional & Logistik' : 'Kontrak & Legal',
    status: (id === '2' ? 'menunggu_persetujuan' : id === '4' ? 'inaktif' : 'aktif') as 'aktif' | 'menunggu_persetujuan' | 'inaktif',
    deskripsi: 'Dokumen legalitas kearsipan resmi yang telah diverifikasi kelengkapannya dan dicatatkan ke dalam buku induk registrasi arsip nasional.',
    pemilik: 'Siti Aminah (Bagian Umum)',
    pemegang: id === '3' ? 'Drs. Hendra M.' : id === '4' ? 'Sistem (Gudang)' : 'Bambang S. (PIC Arsip)',
    lokasi_saat_ini: id === '3' ? 'Ruang Direksi Lt. 3' : id === '4' ? 'Gudang Inaktif - Kotak B-12' : 'Ruang Arsip Aktif - Rak A1',
    tanggal_dokumen: '03 Januari 2026',
    tanggal_diajukan: '03 Januari 2026, 09:15 WIB',
    tanggal_disetujui: id === '2' ? '-' : '04 Januari 2026, 14:30 WIB',
    tanggal_kadaluarsa: id === '2' ? '-' : id === '3' ? '15 Desember 2026' : '03 November 2029',
    sisa_hari: id === '2' ? null : id === '3' ? 42 : id === '4' ? 0 : 1095,
    bucket: id === '4' ? 'arsip-inaktif' : 'arsip-aktif',
    file_name: 'berkas_kontrak_resmi_terpindai.pdf',
    file_size: '4.8 MB',
    tingkat_sensitif: id === '3' ? 'Sangat Rahasia' : id === '2' ? 'Rahasia' : 'Biasa',
  }

  const handleDownload = () => {
    if (currentUserRole === 'viewer') {
      setDownloadNotice('Akses Ditolak: Peran Viewer hanya berhak melihat pratinjau dan dilarang mengunduh berkas fisik.')
      return
    }
    // Simulasi download berkas
    window.open(`/api/dokumen/${doc.id}/download`, '_blank')
  }

  const isKritis = doc.sisa_hari !== null && doc.sisa_hari < 90 && doc.status === 'aktif'

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        
        {/* Tombol Kembali & Bar Navigasi Atas */}
        <div className="flex items-center justify-between border-b border-[#D8D2C4] pb-4">
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#5B6166] hover:text-[#1A1D21] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Katalog Dokumen</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-white border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Lembar Arsip</span>
            </button>
            <Link
              href={`/serah-terima?kode=${doc.kode_arsip}`}
              className="px-3 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Serah Terima Berkas</span>
            </Link>
          </div>
        </div>

        {/* Banner Peringatan Kritis (Jika Ada) */}
        {isKritis && (
          <div className="bg-[#FEFBE8] border-2 border-[#9A6700] p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#9A6700] shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-[#1A1D21] flex-1">
              <span className="font-bold text-[#9A6700] block">PERINGATAN SIKLUS RETENSI:</span>
              <p className="mt-0.5 text-[#5B6166]">
                Masa berlaku aktif dokumen ini tersisa <strong>{doc.sisa_hari} hari lagi</strong>. Lakukan perpanjangan retensi 1 tahun sebelum dialihkan otomatis ke bucket inaktif.
              </p>
            </div>
            <Link
              href="/pembayaran"
              className="px-3 py-1.5 bg-[#9A6700] hover:bg-[#7D5300] text-white text-xs font-mono font-bold shrink-0 transition-colors"
            >
              Perpanjang Retensi
            </Link>
          </div>
        )}

        {/* Notifikasi Akses Download */}
        {downloadNotice && (
          <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs flex items-center justify-between">
            <span>{downloadNotice}</span>
            <button onClick={() => setDownloadNotice(null)} className="font-bold">×</button>
          </div>
        )}

        {/* ======================================================== */}
        {/* LEMBAR BERKAS FISIK RESMI                                */}
        {/* ======================================================== */}
        <div className="bg-white border-2 border-[#1E2429] p-6 sm:p-8 space-y-6 shadow-sm">
          
          {/* Kepala Lembar Dokumen */}
          <div className="border-b-2 border-[#1E2429] pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs px-2 py-0.5 bg-[#1E2429] text-white font-bold">
                  LEMBAR REGISTER RESMI
                </span>
                <span className="text-xs text-[#5B6166] font-mono">
                  Sistem Kearsipan Elektronik v1.0
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1D21] mt-2 leading-tight">
                {doc.judul}
              </h1>
              <p className="font-mono text-xs text-[#5B6166] mt-1">
                No. Registrasi / Surat: <strong className="text-[#1A1D21]">{doc.nomor_dokumen}</strong>
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <StampBadge status={doc.status} className="scale-110 origin-right" />
              <span className="font-mono text-[11px] text-[#5B6166]">
                Klasifikasi: <strong className="text-[#1A1D21]">{doc.kategori}</strong>
              </span>
            </div>
          </div>

          {/* Grid Informasi Metadata & Barcode */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Kolom 1 & 2: Rincian Metadata Berkas */}
            <div className="md:col-span-2 space-y-4">
              <div className="border border-[#D8D2C4] divide-y divide-[#D8D2C4] text-xs font-mono">
                <div className="grid grid-cols-3 p-3 bg-[#F7F3EB]/40">
                  <span className="text-[#5B6166]">Kode Arsip Unik</span>
                  <span className="col-span-2 font-bold text-[#1A1D21]">{doc.kode_arsip}</span>
                </div>
                <div className="grid grid-cols-3 p-3">
                  <span className="text-[#5B6166]">Pemilik Asli</span>
                  <span className="col-span-2 text-[#1A1D21]">{doc.pemilik}</span>
                </div>
                <div className="grid grid-cols-3 p-3 bg-[#F7F3EB]/40">
                  <span className="text-[#5B6166]">Pemegang Saat Ini</span>
                  <span className="col-span-2 font-semibold text-[#1A1D21]">{doc.pemegang}</span>
                </div>
                <div className="grid grid-cols-3 p-3">
                  <span className="text-[#5B6166]">Lokasi Fisik Berkas</span>
                  <span className="col-span-2 text-[#1A1D21] font-semibold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#1F5C55]" />
                    <span>{doc.lokasi_saat_ini}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3 bg-[#F7F3EB]/40">
                  <span className="text-[#5B6166]">Tanggal Dokumen</span>
                  <span className="col-span-2 text-[#1A1D21]">{doc.tanggal_dokumen}</span>
                </div>
                <div className="grid grid-cols-3 p-3">
                  <span className="text-[#5B6166]">Masa Retensi Aktif</span>
                  <span className="col-span-2 text-[#1A1D21]">
                    {doc.sisa_hari !== null ? (
                      <span className={isKritis ? 'font-bold text-[#B42318]' : 'text-[#1F5C55] font-bold'}>
                        {doc.sisa_hari} Hari Lagi (s.d. {doc.tanggal_kadaluarsa})
                      </span>
                    ) : (
                      <span className="text-[#8C9399]">Menunggu Pengesahan</span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3 bg-[#F7F3EB]/40">
                  <span className="text-[#5B6166]">Bucket Storage</span>
                  <span className="col-span-2 text-[#1A1D21]">
                    <code className="px-1 py-0.5 bg-white border border-[#D8D2C4]">{doc.bucket}</code>
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3">
                  <span className="text-[#5B6166]">Sensitivitas Akses</span>
                  <span className="col-span-2 font-semibold text-[#1A1D21]">{doc.tingkat_sensitif}</span>
                </div>
              </div>

              {/* Rangkuman Berkas Digital */}
              <div className="p-4 bg-[#F7F3EB] border border-[#D8D2C4] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white border border-[#D8D2C4]">
                    <FileText className="w-6 h-6 text-[#1F5C55]" />
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-[#1A1D21] block">
                      {doc.file_name}
                    </span>
                    <span className="font-mono text-[11px] text-[#5B6166]">
                      {doc.file_size} • PDF Terenkripsi Server
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={currentUserRole === 'viewer'}
                  className="px-4 py-2 bg-[#1E2429] hover:bg-black text-white text-xs font-mono font-semibold flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  <span>{currentUserRole === 'viewer' ? 'Unduh Dikunci' : 'Unduh Berkas'}</span>
                </button>
              </div>
            </div>

            {/* Kolom 3: Label QR Code Fisik Berstempel */}
            <div className="border-2 border-dashed border-[#1E2429] p-5 bg-[#F7F3EB]/70 flex flex-col items-center justify-between text-center space-y-4">
              <div>
                <span className="font-mono text-[10px] text-[#5B6166] uppercase tracking-wider block font-bold">
                  LABEL BARCODE FISIK
                </span>
                <span className="font-mono text-xs text-[#8C9399]">
                  Tempelkan pada Map Dokumen
                </span>
              </div>

              <div className="p-3 bg-white border-2 border-[#1E2429] shadow-xs">
                <QrCode className="w-36 h-36 text-[#1A1D21]" />
                <span className="font-mono font-bold text-xs text-[#1A1D21] block mt-1 tracking-wider">
                  {doc.kode_arsip}
                </span>
              </div>

              <div className="text-[10px] font-mono text-[#5B6166] leading-tight">
                <span>Dapat dipindai dengan kamera HP atau pemindai USB saat proses serah terima.</span>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full py-1.5 bg-white border border-[#1E2429] hover:bg-[#1E2429] hover:text-white text-[#1E2429] font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Cetak Label Stiker</span>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* TIMELINE RIWAYAT MUTASI DOKUMEN                         */}
          {/* ======================================================== */}
          <div className="border-t-2 border-[#1E2429] pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#1F5C55]" />
              <h3 className="font-serif font-bold text-base text-[#1A1D21]">
                Buku Log Mutasi & Riwayat Pengesahan
              </h3>
            </div>

            <div className="border border-[#D8D2C4] divide-y divide-[#D8D2C4] bg-white text-xs">
              <div className="p-3.5 flex items-start justify-between gap-3 bg-[#F7F3EB]/30">
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#1F5C55] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-bold text-[#1A1D21] block">Persetujuan Akhir Atasan</span>
                    <span className="text-[#5B6166]">Otorisasi pengesahan berkas resmi diterbitkan ke status Aktif.</span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[#8C9399] shrink-0">04 Jan 2026, 14:30 WIB</span>
              </div>

              <div className="p-3.5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#1F5C55] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-bold text-[#1A1D21] block">Verifikasi Tahap 1 oleh PIC Arsip</span>
                    <span className="text-[#5B6166]">Pemeriksaan kelengkapan fisik, penetapan nomor kode arsip, dan klasifikasi.</span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[#8C9399] shrink-0">03 Jan 2026, 11:20 WIB</span>
              </div>

              <div className="p-3.5 flex items-start justify-between gap-3 bg-[#F7F3EB]/30">
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#5B6166] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-bold text-[#1A1D21] block">Pengajuan Dokumen Awal</span>
                    <span className="text-[#5B6166]">Dokumen diunggah oleh Siti Aminah ke ruang antrean verifikasi.</span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[#8C9399] shrink-0">03 Jan 2026, 09:15 WIB</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AppLayout>
  )
}
