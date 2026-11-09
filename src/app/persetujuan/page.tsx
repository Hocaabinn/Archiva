'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { UserRole } from '@/types'
import {
  Search,
  X,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  Clock,
  User,
  MapPin,
  HardDrive,
  ShieldCheck,
  UserCheck,
  MessageSquareText,
  ClipboardCheck,
  Check,
  ArrowRight,
  Inbox,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Tahap = 'tahap_1_pic' | 'tahap_2_atasan'

interface VerificationItem {
  id: string
  kode_arsip: string
  nomor_dokumen: string
  judul: string
  kategori: string
  pengaju: string
  tanggal_pengajuan: string
  lokasi: string
  tahap: Tahap
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
    pengaju: 'Siti Aminah',
    tanggal_pengajuan: '18 Okt 2026, 10:20 WIB',
    lokasi: 'Meja Verifikasi PIC',
    tahap: 'tahap_1_pic',
    status: 'menunggu_persetujuan',
    file_size: '12.3 MB',
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
    file_size: '3.6 MB',
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
    file_size: '7.1 MB',
    tingkat_sensitif: 'Rahasia',
    catatan_pic: 'Berkas fisik asli telah diperiksa kelengkapannya dan sesuai standar retensi 3 tahun. Disarankan untuk disetujui.',
  },
]

const sensitifPill: Record<VerificationItem['tingkat_sensitif'], string> = {
  Biasa: 'bg-[#EEF0F4] text-[#6B7185]',
  Rahasia: 'bg-[#FFF4DE] text-[#C98A1B]',
  'Sangat Rahasia': 'bg-[#FDECEC] text-[#D64545]',
}

const cardClass = 'bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

/** Indikator alur: Diajukan → Verifikasi PIC → Pengesahan Atasan */
function StageProgress({ tahap }: { tahap: Tahap }) {
  const steps = [
    { label: 'Diajukan', done: true, current: false },
    { label: 'Verifikasi PIC', done: tahap === 'tahap_2_atasan', current: tahap === 'tahap_1_pic' },
    { label: 'Pengesahan Atasan', done: false, current: tahap === 'tahap_2_atasan' },
  ]
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
              s.done
                ? 'bg-[#3BA4E8] text-white'
                : s.current
                  ? 'bg-[#EAF5FD] text-[#1E86C8] ring-2 ring-[#3BA4E8]'
                  : 'bg-[#F1F2F7] text-[#9AA0B2]'
            }`}
          >
            {s.done ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span className={s.current ? 'font-semibold text-[#1F2333]' : s.done ? 'text-[#4B5163]' : 'text-[#9AA0B2]'}>{s.label}</span>
          {i < steps.length - 1 && <span className={`h-px w-6 sm:w-10 ${s.done ? 'bg-[#3BA4E8]' : 'bg-[#E3E6F0]'}`} />}
        </div>
      ))}
    </div>
  )
}

function VerifikasiContent() {
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('demo_role') as UserRole | null

  const [items, setItems] = useState<VerificationItem[]>(mockVerifications)
  const [activeTab, setActiveTab] = useState<Tahap>(roleParam === 'atasan' ? 'tahap_2_atasan' : 'tahap_1_pic')
  const [searchQuery, setSearchQuery] = useState('')
  const [processed, setProcessed] = useState({ disahkan: 0, ditolak: 0 })

  const [modalAction, setModalAction] = useState<{ item: VerificationItem; type: 'approve' | 'reject' } | null>(null)
  const [alasan, setAlasan] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'reject'; text: string } | null>(null)

  useEffect(() => {
    async function loadRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || roleParam) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      // Atasan langsung diarahkan ke antrean Tahap 2
      if (profile?.role === 'atasan') setActiveTab('tahap_2_atasan')
    }
    loadRole()
  }, [roleParam])

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return items.filter(
      (item) =>
        item.tahap === activeTab &&
        (!q ||
          item.kode_arsip.toLowerCase().includes(q) ||
          item.judul.toLowerCase().includes(q) ||
          item.nomor_dokumen.toLowerCase().includes(q) ||
          item.pengaju.toLowerCase().includes(q))
    )
  }, [items, activeTab, searchQuery])

  const countTahap1 = items.filter((i) => i.tahap === 'tahap_1_pic').length
  const countTahap2 = items.filter((i) => i.tahap === 'tahap_2_atasan').length

  const showToast = (type: 'success' | 'reject', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  const closeModal = () => {
    setModalAction(null)
    setAlasan('')
  }

  const handleConfirmAction = () => {
    if (!modalAction) return
    const { item, type } = modalAction

    if (type === 'reject') {
      if (!alasan.trim()) return
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setProcessed((p) => ({ ...p, ditolak: p.ditolak + 1 }))
      showToast('reject', `Dokumen ${item.kode_arsip} ditolak: "${alasan.trim()}"`)
    } else if (item.tahap === 'tahap_1_pic') {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, tahap: 'tahap_2_atasan', lokasi: 'Ruang Otorisasi Atasan', catatan_pic: alasan.trim() || 'Terverifikasi PIC Arsip' }
            : i
        )
      )
      showToast('success', `Dokumen ${item.kode_arsip} diverifikasi dan diteruskan ke Atasan.`)
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setProcessed((p) => ({ ...p, disahkan: p.disahkan + 1 }))
      showToast('success', `Dokumen ${item.kode_arsip} disahkan menjadi Arsip Aktif (retensi 3 tahun).`)
    }
    closeModal()
  }

  const isReject = modalAction?.type === 'reject'
  const confirmDisabled = isReject && !alasan.trim()

  return (
    <AppLayout currentRole={roleParam || undefined}>
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#1F2333]">Verifikasi Dokumen</h1>
            <p className="mt-1 text-sm text-[#4B5163]">Tinjau dan sahkan dokumen melalui alur 2 tahap: PIC Arsip → Atasan</p>
          </div>
          <Link
            href="/dokumen"
            className="flex items-center gap-2 self-start rounded-lg border border-[#1F2333] bg-white px-4 py-2 text-sm font-medium text-[#1F2333] transition-colors hover:bg-[#F7F8FC]"
          >
            <FileText className="h-4 w-4" />
            Daftar Dokumen
          </Link>
        </div>

        {/* Kartu ringkasan */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Menunggu PIC Arsip', value: countTahap1, icon: ClipboardCheck, tone: 'bg-[#EAF5FD] text-[#1E86C8]' },
            { label: 'Menunggu Atasan', value: countTahap2, icon: UserCheck, tone: 'bg-[#FFF4DE] text-[#C98A1B]' },
            { label: 'Disahkan (sesi ini)', value: processed.disahkan, icon: ShieldCheck, tone: 'bg-[#E7F6EC] text-[#2F9E5B]' },
            { label: 'Ditolak (sesi ini)', value: processed.ditolak, icon: XCircle, tone: 'bg-[#FDECEC] text-[#D64545]' },
          ].map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className={`${cardClass} flex items-center justify-between p-5`}>
                <div>
                  <p className="text-sm text-[#4B5163]">{s.label}</p>
                  <p className="mt-2 text-[26px] font-bold tracking-tight text-[#1F2333]">{s.value}</p>
                </div>
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            )
          })}
        </div>

        {/* Antrean */}
        <div className={cardClass}>
          <div className="flex flex-col gap-3 border-b border-[#ECEEF5] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex rounded-lg bg-[#F4F5FA] p-1">
              {(
                [
                  { id: 'tahap_1_pic', label: 'Tahap 1 · Verifikasi PIC', count: countTahap1 },
                  { id: 'tahap_2_atasan', label: 'Tahap 2 · Pengesahan Atasan', count: countTahap2 },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                      active ? 'bg-white text-[#1E86C8] shadow-sm' : 'text-[#4B5163] hover:text-[#1F2333]'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-md px-1.5 text-xs ${active ? 'bg-[#3BA4E8] text-white' : 'bg-white text-[#6B7185]'}`}>{tab.count}</span>
                  </button>
                )
              })}
            </div>

            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA0B2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode, judul, atau pengaju..."
                className="w-full rounded-lg border border-[#E3E6F0] bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-[#A5ABBC] focus:border-[#3BA4E8] focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]/15"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E7F6EC] text-[#2F9E5B]">
                <Inbox className="h-6 w-6" />
              </span>
              <p className="mt-1 font-semibold text-[#1F2333]">Antrean kosong</p>
              <p className="text-sm text-[#6B7185]">Tidak ada dokumen yang menunggu pada tahap ini.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F2F7]">
              {filteredItems.map((item) => (
                <div key={item.id} className="space-y-4 p-5 transition-colors hover:bg-[#F9FBFE]">
                  {/* Judul */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FD] text-[#3BA4E8]">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug text-[#1F2333]">{item.judul}</h3>
                        <p className="mt-0.5 text-xs text-[#8A90A2]">
                          #{item.kode_arsip} • {item.nomor_dokumen}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-[#F4F5FA] px-2.5 py-1 text-xs text-[#4B5163]">{item.kategori}</span>
                          <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${sensitifPill[item.tingkat_sensitif]}`}>{item.tingkat_sensitif}</span>
                          <span className="rounded-md bg-[#FFF4DE] px-2.5 py-1 text-xs font-medium text-[#C98A1B]">Menunggu</span>
                        </div>
                      </div>
                    </div>
                    <StageProgress tahap={item.tahap} />
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-1 gap-3 rounded-xl bg-[#F7F8FC] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { icon: User, label: 'Pengaju', value: item.pengaju },
                      { icon: Clock, label: 'Diajukan', value: item.tanggal_pengajuan },
                      { icon: MapPin, label: 'Lokasi Fisik', value: item.lokasi },
                      { icon: HardDrive, label: 'Ukuran Berkas', value: item.file_size },
                    ].map((m) => {
                      const Icon = m.icon
                      return (
                        <div key={m.label} className="flex items-start gap-2.5">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#9AA0B2]" />
                          <div className="min-w-0">
                            <p className="text-xs text-[#8A90A2]">{m.label}</p>
                            <p className="truncate font-medium text-[#1F2333]">{m.value}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Catatan PIC */}
                  {item.catatan_pic && (
                    <div className="flex items-start gap-3 rounded-xl border border-[#BFE2F8] bg-[#EAF5FD] p-4 text-sm">
                      <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-[#1E86C8]" />
                      <div>
                        <p className="font-semibold text-[#1E86C8]">Catatan PIC Arsip</p>
                        <p className="mt-0.5 leading-relaxed text-[#4B5163]">{item.catatan_pic}</p>
                      </div>
                    </div>
                  )}

                  {/* Aksi */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      href={`/dokumen/${item.id}`}
                      className="flex items-center gap-2 self-start text-sm font-medium text-[#1E86C8] hover:text-[#2A92D6]"
                    >
                      <Eye className="h-4 w-4" />
                      Periksa berkas & lampiran
                    </Link>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalAction({ item, type: 'reject' })}
                        className="flex items-center gap-2 rounded-lg border border-[#F5C2C2] bg-white px-4 py-2 text-sm font-medium text-[#D64545] transition-colors hover:bg-[#FDECEC]"
                      >
                        <XCircle className="h-4 w-4" />
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalAction({ item, type: 'approve' })}
                        className="flex items-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-medium text-white shadow-sm shadow-[#3BA4E8]/30 transition-colors hover:bg-[#2A92D6]"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {item.tahap === 'tahap_1_pic' ? 'Verifikasi & Teruskan' : 'Sahkan Arsip'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL KONFIRMASI ================= */}
      {modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2333]/40 p-4 backdrop-blur-[2px]" onClick={closeModal}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[#ECEEF5] px-6 py-4">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    isReject ? 'bg-[#FDECEC] text-[#D64545]' : 'bg-[#EAF5FD] text-[#3BA4E8]'
                  }`}
                >
                  {isReject ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[#1F2333]">
                    {isReject ? 'Tolak Dokumen' : modalAction.item.tahap === 'tahap_1_pic' ? 'Verifikasi & Teruskan ke Atasan' : 'Sahkan Menjadi Arsip Aktif'}
                  </h3>
                  <p className="mt-0.5 text-sm text-[#6B7185]">#{modalAction.item.kode_arsip}</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-md p-1 text-[#8A90A2] hover:bg-[#F4F5FA] hover:text-[#1F2333]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl bg-[#F7F8FC] p-4 text-sm">
                <p className="font-semibold text-[#1F2333]">{modalAction.item.judul}</p>
                <p className="mt-1 text-[#6B7185]">
                  Diajukan oleh {modalAction.item.pengaju} • {modalAction.item.kategori}
                </p>
                {!isReject && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[#1E86C8]">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {modalAction.item.tahap === 'tahap_1_pic'
                      ? 'Dokumen akan diteruskan ke antrean Pengesahan Atasan'
                      : 'Dokumen akan berstatus Aktif dengan masa retensi 3 tahun'}
                  </p>
                )}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#1F2333]">
                  {isReject ? (
                    <>
                      Alasan Penolakan <span className="text-[#D64545]">*</span>
                    </>
                  ) : (
                    'Catatan Verifikasi (opsional)'
                  )}
                </span>
                <textarea
                  rows={3}
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  autoFocus
                  placeholder={
                    isReject
                      ? 'Contoh: tanda tangan belum lengkap, lampiran kurang...'
                      : 'Tuliskan catatan kelayakan berkas jika diperlukan...'
                  }
                  className="w-full resize-none rounded-lg border border-[#E3E6F0] px-3.5 py-2.5 text-sm placeholder:text-[#A5ABBC] focus:border-[#3BA4E8] focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]/15"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#ECEEF5] px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-[#E3E6F0] px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F4F5FA]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={confirmDisabled}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isReject ? 'bg-[#D64545] hover:bg-[#C03535]' : 'bg-[#3BA4E8] hover:bg-[#2A92D6]'
                }`}
              >
                {isReject ? 'Tolak Dokumen' : modalAction.item.tahap === 'tahap_1_pic' ? 'Verifikasi & Teruskan' : 'Sahkan Arsip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST ================= */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-sm text-white shadow-lg ${
            toast.type === 'success' ? 'bg-[#1F2333]' : 'bg-[#D64545]'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6FD39A]" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="flex-1">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="text-white/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </AppLayout>
  )
}

export default function VerifikasiPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#6B7185]">Memuat antrean verifikasi...</div>}>
      <VerifikasiContent />
    </Suspense>
  )
}
