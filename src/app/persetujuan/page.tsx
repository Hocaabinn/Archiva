'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { StampBadge } from '@/components/ui/stamp-badge'
import { UserRole } from '@/types'
import { 
  CheckSquare, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  QrCode, 
  Eye, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  User, 
  FolderArchive,
  ArrowUpRight,
  X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface VerificationItem {
  id: string
  kode_arsip: string
  nomor_dokumen: string
  judul: string
  kategori: string
  pengaju: string
  tanggal_pengajuan: string
  lokasi: string
  tahap: 'tahap_1_pic' | 'tahap_2_atasan'
  status: 'menunggu_persetujuan'
  file_size: string
  tingkat_sensitif: 'Biasa' | 'Rahasia' | 'Sangat Rahasia'
  catatan_pic?: string
}

const mockVerifications: VerificationItem[] = [
  {
    id: '2',
    kode_arsip: 'ARS-2026-0002',
    nomor_dokumen: '118/KEU-AUD/X/2026',
    judul: 'Laporan Keuangan & Audit Neraca Kas Triwulan III 2026',
    kategori: 'Keuangan',
    pengaju: 'Siti Aminah (Pengaju)',
    tanggal_pengajuan: '18 Okt 2026, 10:20 WIB',
    lokasi: 'Meja Verifikasi PIC',
    tahap: 'tahap_1_pic',
    status: 'menunggu_persetujuan',
    file_size: '12.3 MB (PDF)',
    tingkat_sensitif: 'Rahasia',
  },
  {
    id: '6',
    kode_arsip: 'ARS-2026-0005',
    nomor_dokumen: '055/SDM-KP/XI/2026',
    judul: 'Penetapan Standar Kompetensi Pegawai & Struktur Jabatan Fungsional',
    kategori: 'SDM & Kepegawaian',
    pengaju: 'Drs. Hendra M.',
    tanggal_pengajuan: '02 Nov 2026, 14:10 WIB',
    lokasi: 'Meja Verifikasi PIC',
    tahap: 'tahap_1_pic',
    status: 'menunggu_persetujuan',
    file_size: '3.6 MB (PDF)',
    tingkat_sensitif: 'Biasa',
  },
  {
    id: '7',
    kode_arsip: 'ARS-2026-0006',
    nomor_dokumen: 'KTR-990/LEG-LOG/2026',
    judul: 'Perjanjian Kerja Sama Logistik & Transportasi Berkas Antar-Cabang',
    kategori: 'Kontrak & Legal',
    pengaju: 'Bambang S.',
    tanggal_pengajuan: '04 Nov 2026, 16:45 WIB',
    lokasi: 'Ruang Otorisasi Atasan',
    tahap: 'tahap_2_atasan',
    status: 'menunggu_persetujuan',
    file_size: '7.1 MB (PDF)',
    tingkat_sensitif: 'Rahasia',
    catatan_pic: 'Berkas fisik asli telah diperiksa kelengkapannya dan sesuai standar retensi 3 tahun. Disarankan untuk disetujui.',
  },
]

function VerifikasiContent() {
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('demo_role') as UserRole | null

  const [items, setItems] = useState<VerificationItem[]>(mockVerifications)
  const [activeTab, setActiveTab] = useState<'tahap_1_pic' | 'tahap_2_atasan'>('tahap_1_pic')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('pic_arsip')
  
  // Modal aksi verifikasi/tolak
  const [modalAction, setModalAction] = useState<{
    item: VerificationItem
    type: 'approve' | 'reject'
  } | null>(null)
  const [alasan, setAlasan] = useState('')
  const [successToast, setSuccessToast] = useState<string | null>(null)

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
          // Jika login sebagai Atasan, otomatis buka tab Tahap 2 Atasan
          if (profile.role === 'atasan') {
            setActiveTab('tahap_2_atasan')
          }
        }
      }
    }
    loadRole()
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchTab = item.tahap === activeTab
      const matchSearch =
        item.kode_arsip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nomor_dokumen.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.pengaju.toLowerCase().includes(searchQuery.toLowerCase())
      return matchTab && matchSearch
    })
  }, [items, activeTab, searchQuery])

  const countTahap1 = items.filter(i => i.tahap === 'tahap_1_pic').length
  const countTahap2 = items.filter(i => i.tahap === 'tahap_2_atasan').length

  const handleConfirmAction = () => {
    if (!modalAction) return

    const { item, type } = modalAction

    if (type === 'approve') {
      if (item.tahap === 'tahap_1_pic') {
        // Pindah dari PIC ke Atasan
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, tahap: 'tahap_2_atasan', catatan_pic: alasan || 'Terverifikasi PIC' } : i))
        setSuccessToast(`Dokumen ${item.kode_arsip} berhasil diverifikasi dan diteruskan ke Atasan untuk persetujuan akhir.`)
      } else {
        // Atasan menyetujui -> dokumen berstatus Aktif
        setItems(prev => prev.filter(i => i.id !== item.id))
        setSuccessToast(`Dokumen ${item.kode_arsip} resmi disahkan menjadi status AKTIF dengan masa retensi 3 tahun!`)
      }
    } else {
      // Ditolak
      setItems(prev => prev.filter(i => i.id !== item.id))
      setSuccessToast(`Dokumen ${item.kode_arsip} telah DITOLAK dengan catatan: "${alasan || 'Tidak memenuhi syarat'}"`)
    }

    setModalAction(null)
    setAlasan('')
  }

  return (
    <AppLayout currentRole={roleParam || undefined}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        
        {/* Header Verifikasi Dokumen */}
        <div className="border-b border-[#D8D2C4] pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 bg-[#9A6700] text-white font-bold">
                  OTORISASI & VERIFIKASI BERJENJANG
                </span>
                <span className="text-xs text-[#5B6166] font-mono">
                  Alur 2 Tahap: Verifikasi PIC Arsip → Pengesahan Akhir Atasan
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1D21] tracking-tight">
                Verifikasi & Pengesahan Dokumen
              </h1>
              <p className="text-xs sm:text-sm text-[#5B6166] mt-1 max-w-2xl leading-relaxed">
                Tinjau kelengkapan berkas fisik dan digital sebelum diterbitkan stempel pengesahan aktif dan nomor kode barcode resmi.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dokumen"
                className="px-3.5 py-2 bg-white border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] text-xs font-mono font-semibold transition-colors shadow-2xs"
              >
                Lihat Semua Katalog
              </Link>
            </div>
          </div>
        </div>

        {/* Notifikasi Tindakan Sukses */}
        {successToast && (
          <div className="p-4 bg-emerald-50 border-l-4 border-emerald-700 text-emerald-900 text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span className="font-medium">{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="font-bold text-emerald-800 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Jenjang Verifikasi */}
        <div className="border-b border-[#D8D2C4] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('tahap_1_pic')}
              className={`px-4 py-3 font-mono text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'tahap_1_pic'
                  ? 'border-[#1F5C55] text-[#1F5C55] bg-white'
                  : 'border-transparent text-[#5B6166] hover:text-[#1A1D21] hover:bg-[#F7F3EB]'
              }`}
            >
              <span>Tahap 1: Verifikasi PIC Arsip</span>
              <span className={`px-1.5 py-0.5 text-[10px] ${activeTab === 'tahap_1_pic' ? 'bg-[#1F5C55] text-white' : 'bg-[#D8D2C4] text-[#1A1D21]'}`}>
                {countTahap1}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('tahap_2_atasan')}
              className={`px-4 py-3 font-mono text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'tahap_2_atasan'
                  ? 'border-[#9A6700] text-[#9A6700] bg-white'
                  : 'border-transparent text-[#5B6166] hover:text-[#1A1D21] hover:bg-[#F7F3EB]'
              }`}
            >
              <span>Tahap 2: Pengesahan Akhir Atasan</span>
              <span className={`px-1.5 py-0.5 text-[10px] ${activeTab === 'tahap_2_atasan' ? 'bg-[#9A6700] text-white' : 'bg-[#D8D2C4] text-[#1A1D21]'}`}>
                {countTahap2}
              </span>
            </button>
          </div>

          {/* Pencarian Antrean */}
          <div className="relative pb-2 sm:pb-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C9399]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari dalam antrean..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D8D2C4] focus:border-[#1A1D21] focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Daftar Kartu Antrean Verifikasi */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="bg-white border border-[#D8D2C4] p-12 text-center text-[#5B6166] shadow-2xs">
              <CheckCircle2 className="w-10 h-10 text-[#1F5C55] mx-auto mb-2" />
              <p className="font-bold text-base text-[#1A1D21]">Semua Antrean Bersih</p>
              <p className="text-xs mt-1">Tidak ada dokumen yang sedang menunggu verifikasi pada tahap ini.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div 
                key={item.id}
                className="bg-white border-2 border-[#D8D2C4] hover:border-[#1A1D21] p-5 transition-all shadow-2xs space-y-4"
              >
                {/* Header Kartu */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-[#F7F3EB] pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-xs bg-[#1E2429] text-white px-2 py-0.5">
                        {item.kode_arsip}
                      </span>
                      <span className="text-[11px] font-mono text-[#5B6166]">
                        No: <strong className="text-[#1A1D21]">{item.nomor_dokumen}</strong>
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-[#F7F3EB] border border-[#D8D2C4]">
                        {item.kategori}
                      </span>
                    </div>
                    <h3 className="font-serif font-bold text-base text-[#1A1D21] mt-1">
                      {item.judul}
                    </h3>
                  </div>

                  <StampBadge status={item.status} />
                </div>

                {/* Metadata & Catatan */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono bg-[#F7F3EB]/40 p-3 border border-[#D8D2C4]/70">
                  <div>
                    <span className="text-[#5B6166] block text-[10px] uppercase">Pengaju Berkas:</span>
                    <span className="font-semibold text-[#1A1D21]">{item.pengaju}</span>
                  </div>
                  <div>
                    <span className="text-[#5B6166] block text-[10px] uppercase">Waktu Pengajuan:</span>
                    <span className="text-[#1A1D21]">{item.tanggal_pengajuan}</span>
                  </div>
                  <div>
                    <span className="text-[#5B6166] block text-[10px] uppercase">Lokasi Fisik:</span>
                    <span className="text-[#1A1D21] font-semibold">{item.lokasi}</span>
                  </div>
                </div>

                {/* Catatan PIC (Jika di Tahap 2 Atasan) */}
                {item.catatan_pic && (
                  <div className="p-3 bg-[#FEFBE8] border border-[#9A6700]/50 text-xs">
                    <span className="font-bold text-[#9A6700] block mb-0.5 font-mono">
                      Catatan Verifikasi PIC Arsip:
                    </span>
                    <p className="text-[#1A1D21] italic leading-relaxed">
                      "{item.catatan_pic}"
                    </p>
                  </div>
                )}

                {/* Aksi Verifikasi / Tolak */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dokumen/${item.id}`}
                      className="px-3 py-1.5 bg-white border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Periksa Berkas Fisik & Lampiran</span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModalAction({ item, type: 'reject' })}
                      className="px-3.5 py-1.5 bg-white border border-red-700 text-red-700 hover:bg-red-50 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Tolak Berkas</span>
                    </button>
                    <button
                      onClick={() => setModalAction({ item, type: 'approve' })}
                      className="px-4 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white text-xs font-mono font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {item.tahap === 'tahap_1_pic' ? 'Verifikasi & Teruskan ke Atasan' : 'Sahkan Menjadi Arsip Aktif'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ======================================================== */}
        {/* MODAL AKSI PERSETUJUAN / PENOLAKAN                      */}
        {/* ======================================================== */}
        {modalAction && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs">
            <div className="bg-white max-w-lg w-full border-2 border-[#1E2429] p-6 space-y-4 shadow-xl">
              <div className="border-b border-[#D8D2C4] pb-3 flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] text-[#8C9399] uppercase tracking-wider block">
                    KONFIRMASI TINDAKAN ARSIP
                  </span>
                  <h3 className="font-serif font-bold text-lg text-[#1A1D21]">
                    {modalAction.type === 'approve' ? 'Konfirmasi Verifikasi / Pengesahan' : 'Konfirmasi Penolakan Berkas'}
                  </h3>
                </div>
                <button
                  onClick={() => setModalAction(null)}
                  className="p-1 text-[#5B6166] hover:text-[#1A1D21]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-[#F7F3EB] border border-[#D8D2C4] text-xs font-mono space-y-1">
                <div>Kode Arsip: <strong className="text-[#1A1D21]">{modalAction.item.kode_arsip}</strong></div>
                <div className="truncate">Judul: {modalAction.item.judul}</div>
                <div>Pengaju: {modalAction.item.pengaju}</div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-[#1A1D21] mb-1">
                  {modalAction.type === 'approve' ? 'Catatan Verifikasi (Opsional):' : 'Alasan Penolakan Berkas (Wajib):'}
                </label>
                <textarea
                  rows={3}
                  required={modalAction.type === 'reject'}
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder={modalAction.type === 'approve' ? 'Tuliskan catatan kelayakan fisik berkas jika diperlukan...' : 'Jelaskan alasan mengapa berkas ditolak (misal: tanda tangan tidak lengkap, lampiran kurang)...'}
                  className="w-full p-2.5 text-xs border border-[#D8D2C4] bg-white focus:border-[#1A1D21] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D8D2C4] font-mono text-xs">
                <button
                  onClick={() => setModalAction(null)}
                  className="px-3.5 py-1.5 border border-[#D8D2C4] hover:bg-[#F7F3EB]"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmAction}
                  className={`px-4 py-1.5 text-white font-bold transition-colors ${
                    modalAction.type === 'approve' ? 'bg-[#1F5C55] hover:bg-[#184843]' : 'bg-red-700 hover:bg-red-800'
                  }`}
                >
                  {modalAction.type === 'approve' ? 'Ya, Setujui & Lanjutkan' : 'Tolak Berkas Ini'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}

export default function VerifikasiPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-mono">Memuat Antrean Verifikasi...</div>}>
      <VerifikasiContent />
    </Suspense>
  )
}

