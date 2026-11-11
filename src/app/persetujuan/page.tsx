'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
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
  User,
  MapPin,
  HardDrive,
  ShieldCheck,
  UserCheck,
  ClipboardCheck,
  Check,
  ArrowRight,
  Inbox,
  Loader2,
  Calendar,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'
import { skorPencarian } from '@/lib/pencarian-kode-arsip'

type Tahap = 'tahap_1_pic' | 'tahap_2_atasan'

interface VerificationDoc {
  id: string
  kode_arsip: string
  nomor_dokumen: string | null
  nomor_ppl: string | null
  judul: string
  kategori_nama: string
  pengaju_nama: string
  tanggal_dokumen: string
  created_at: string
  lokasi_saat_ini: string
  tahap: Tahap
  ukuran_file: number | null
  verifikasi_pic_oleh: string | null
}

const inputClass =
  'w-full rounded-lg border border-[#E3E6F0] bg-white px-3.5 py-2.5 text-sm text-[#1F2333] placeholder:text-[#A5ABBC] focus:border-[#3BA4E8] focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]/15'

function StageProgress({ tahap }: { tahap: Tahap }) {
  const steps = [
    { label: 'Pengajuan', done: true, current: false },
    { label: 'Verifikasi PIC', done: tahap === 'tahap_2_atasan', current: tahap === 'tahap_1_pic' },
    { label: 'Pengesahan Atasan', done: false, current: tahap === 'tahap_2_atasan' },
  ]
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              s.done
                ? 'bg-[#3BA4E8] text-white'
                : s.current
                ? 'bg-white text-[#1E86C8] ring-2 ring-[#3BA4E8]'
                : 'bg-[#EEF0F4] text-[#9AA0B2]'
            }`}
          >
            {s.done ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span
            className={`whitespace-nowrap ${
              s.current ? 'font-semibold text-[#1E86C8]' : s.done ? 'text-[#4B5163]' : 'text-[#9AA0B2]'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className={`h-px w-4 sm:w-8 ${s.done ? 'bg-[#3BA4E8]' : 'bg-[#E3E6F0]'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function VerifikasiContent() {
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('demo_role') as UserRole | null

  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('user')
  const [items, setItems] = useState<VerificationDoc[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tahap>('tahap_1_pic')
  const [searchQuery, setSearchQuery] = useState('')
  const [processed, setProcessed] = useState({ disahkan: 0, ditolak: 0 })

  // Modal Aksi
  const [modalAction, setModalAction] = useState<{
    item: VerificationDoc
    type: 'approve' | 'reject'
  } | null>(null)
  const [alasan, setAlasan] = useState('')
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'reject'; text: string } | null>(null)

  const showToast = (type: 'success' | 'reject', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  // Load Dokumen dari Supabase Live
  const fetchPendingDocs = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role) {
          setCurrentUserRole(profile.role as UserRole)
          // Default tab: jika Atasan, buka Tahap 2; selain itu Tahap 1
          if (profile.role === 'atasan') {
            setActiveTab('tahap_2_atasan')
          }
        }
      }

      // Query dokumen status menunggu_persetujuan
      const { data, error } = await supabase
        .from('dokumen')
        .select(`
          id, kode_arsip, nomor_dokumen, nomor_ppl, judul,
          lokasi_saat_ini, ukuran_file, tanggal_dokumen, created_at,
          verifikasi_pic_oleh,
          kategori_dokumen ( nama ),
          pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email )
        `)
        .eq('status', 'menunggu_persetujuan')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetch dokumen antrean:', error)
        return
      }

      const formatted: VerificationDoc[] = (data || []).map((d: any) => ({
        id: d.id,
        kode_arsip: d.kode_arsip,
        nomor_dokumen: d.nomor_dokumen,
        nomor_ppl: d.nomor_ppl,
        judul: d.judul,
        kategori_nama: d.kategori_dokumen?.nama || 'Umum',
        pengaju_nama: d.pemilik?.nama_lengkap || d.pemilik?.email || 'Pengaju',
        tanggal_dokumen: d.tanggal_dokumen,
        created_at: d.created_at,
        lokasi_saat_ini: d.lokasi_saat_ini || 'Ruang Arsip Aktif',
        tahap: d.verifikasi_pic_oleh ? 'tahap_2_atasan' : 'tahap_1_pic',
        ukuran_file: d.ukuran_file,
        verifikasi_pic_oleh: d.verifikasi_pic_oleh,
      }))

      setItems(formatted)
    } catch (err) {
      console.error('Error loading pending verifications:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingDocs()
  }, [fetchPendingDocs])

  // Pencarian pintar kode arsip (sama dengan Daftar Dokumen), ditambah nama pengaju
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim()
    const skor = new Map<string, number>()
    return items
      .filter((item) => {
        if (item.tahap !== activeTab) return false
        if (!q) return true
        const s = Math.max(skorPencarian(q, item), item.pengaju_nama.toLowerCase().includes(q.toLowerCase()) ? 1 : 0)
        skor.set(item.id, s)
        return s > 0
      })
      .sort((a, b) => (q ? (skor.get(b.id) ?? 0) - (skor.get(a.id) ?? 0) : 0))
  }, [items, activeTab, searchQuery])

  const countTahap1 = items.filter((i) => i.tahap === 'tahap_1_pic').length
  const countTahap2 = items.filter((i) => i.tahap === 'tahap_2_atasan').length

  const closeModal = () => {
    if (isSubmittingAction) return
    setModalAction(null)
    setAlasan('')
  }

  // Handler Konfirmasi Aksi (Verifikasi / Approve / Tolak)
  const handleConfirmAction = async () => {
    if (!modalAction) return
    const { item, type } = modalAction

    setIsSubmittingAction(true)

    try {
      if (type === 'reject') {
        if (!alasan.trim()) {
          showToast('reject', 'Alasan penolakan wajib diisi.')
          setIsSubmittingAction(false)
          return
        }

        const res = await fetch(`/api/dokumen/${item.id}/tolak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alasan: alasan.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menolak dokumen.')

        setItems((prev) => prev.filter((i) => i.id !== item.id))
        setProcessed((p) => ({ ...p, ditolak: p.ditolak + 1 }))
        showToast('reject', `Dokumen ${item.kode_arsip} ditolak: "${alasan.trim()}"`)
      } else if (item.tahap === 'tahap_1_pic') {
        // PIC Arsip Verifikasi
        const res = await fetch(`/api/dokumen/${item.id}/verifikasi`, {
          method: 'POST',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal memverifikasi dokumen.')

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, tahap: 'tahap_2_atasan', verifikasi_pic_oleh: 'done' } : i
          )
        )
        showToast('success', `Dokumen ${item.kode_arsip} lolos verifikasi tahap 1 dan diteruskan ke Atasan.`)
      } else {
        // Atasan Persetujuan Akhir
        const res = await fetch(`/api/dokumen/${item.id}/approve`, {
          method: 'POST',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menyetujui dokumen.')

        setItems((prev) => prev.filter((i) => i.id !== item.id))
        setProcessed((p) => ({ ...p, disahkan: p.disahkan + 1 }))
        showToast(
          'success',
          `Dokumen ${item.kode_arsip} disahkan menjadi Arsip Aktif (+3 Tahun s.d. ${data.tanggal_kadaluarsa}).`
        )
      }

      closeModal()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      showToast('reject', msg)
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const isReject = modalAction?.type === 'reject'
  const confirmDisabled = isSubmittingAction || (isReject && !alasan.trim())


  const formatTanggal = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <AppLayout currentRole={roleParam || undefined}>
      <div className="mx-auto max-w-7xl space-y-6 pb-16">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[#1F2333] sm:text-[28px]">Verifikasi Dokumen</h1>
            <p className="mt-1 text-sm text-[#4B5163]">
              Verifikasi kelengkapan format SIG oleh PIC Arsip, lalu pengesahan arsip aktif 3 tahun oleh Atasan.
            </p>
          </div>
          <Link
            href="/dokumen"
            className="flex items-center justify-center gap-2 self-stretch rounded-lg border border-[#E3E6F0] bg-white px-4 py-2 text-sm font-medium text-[#4B5163] transition-colors hover:border-[#3BA4E8] hover:text-[#1E86C8] sm:self-start"
          >
            <FileText className="h-4 w-4" />
            Daftar Dokumen
          </Link>
        </div>

        {/* Kartu ringkasan */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { label: 'Menunggu PIC Arsip', hint: 'Tahap 1', value: countTahap1, icon: ClipboardCheck, color: 'text-[#B06000]', bar: 'bg-[#FBBC04]', iconBox: 'bg-[#FEF7E0] text-[#B06000]' },
            { label: 'Menunggu Atasan', hint: 'Tahap 2', value: countTahap2, icon: UserCheck, color: 'text-[#1E86C8]', bar: 'bg-[#3BA4E8]', iconBox: 'bg-[#EAF5FD] text-[#3BA4E8]' },
            { label: 'Disahkan', hint: 'Sesi ini', value: processed.disahkan, icon: ShieldCheck, color: 'text-[#137333]', bar: 'bg-[#34A853]', iconBox: 'bg-[#E6F4EA] text-[#137333]' },
            { label: 'Ditolak', hint: 'Sesi ini', value: processed.ditolak, icon: XCircle, color: 'text-[#D64545]', bar: 'bg-[#EA4335]', iconBox: 'bg-[#FDECEC] text-[#D64545]' },
          ].map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className="relative flex items-start justify-between gap-2 overflow-hidden rounded-2xl border border-[#ECEEF5] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:shadow-sm sm:p-5"
              >
                <span className={`absolute bottom-0 left-0 top-0 w-1 ${s.bar}`} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[#64748B] sm:text-sm">{s.label}</p>
                  <p className="truncate text-[11px] text-[#9AA0B2]">{s.hint}</p>
                  <p className={`mt-1.5 text-2xl font-bold tracking-tight sm:text-[28px] ${s.color}`}>
                    {isLoading ? '–' : s.value}
                  </p>
                </div>
                <span className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex ${s.iconBox}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
              </div>
            )
          })}
        </div>

        {/* Antrean */}
        <div className="rounded-xl border border-[#ECEEF5] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {/* Tab & pencarian */}
          <div className="flex flex-col gap-3 border-b border-[#ECEEF5] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#3BA4E8] text-white'
                        : 'bg-[#F4F5FA] text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1E86C8]'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-md px-1.5 text-xs ${active ? 'bg-white/25' : 'bg-white text-[#6B7185]'}`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA0B2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode arsip, no. PPL, doc voucher, judul..."
                className={`${inputClass} pl-10 pr-9`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA0B2] hover:text-[#1F2333]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Daftar */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#6B7185]">
              <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
              <p className="text-sm font-medium">Memuat antrean verifikasi...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF5FD] text-[#3BA4E8]">
                <Inbox className="h-6 w-6" />
              </span>
              <p className="mt-1 text-sm font-semibold text-[#1F2333]">Antrean kosong</p>
              <p className="max-w-sm text-xs text-[#8A90A2]">
                {searchQuery ? 'Tidak ada dokumen yang cocok dengan pencarian Anda.' : 'Tidak ada dokumen yang menunggu pada tahap ini.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#ECEEF5]">
              {filteredItems.map((item) => (
                <div key={item.id} className="space-y-4 p-4 transition-colors hover:bg-[#F7FBFE] sm:p-5">
                  {/* Judul & tahapan */}
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FD] text-[#3BA4E8]">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/dokumen/${item.id}`}
                          className="break-words text-base font-semibold leading-snug text-[#1F2333] hover:text-[#1E86C8]"
                        >
                          {item.judul}
                        </Link>
                        <KodeArsip kode={item.kode_arsip} className="block mt-0.5 font-mono text-xs text-[#1E86C8]" />
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full border border-[#ECEEF5] bg-[#F7F8FC] px-2.5 py-0.5 text-xs font-medium text-[#4B5163]">
                            {item.kategori_nama}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#FEEFC3] bg-[#FEF7E0] px-2.5 py-0.5 text-xs font-semibold text-[#B06000]">
                            <Clock className="h-3 w-3" />
                            Menunggu Persetujuan
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto pb-1 xl:pb-0">
                      <StageProgress tahap={item.tahap} />
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#ECEEF5] bg-[#F8FBFE] p-3.5 lg:grid-cols-4">
                    {[
                      { icon: User, label: 'Pengaju', value: item.pengaju_nama },
                      { icon: Calendar, label: 'Tanggal Pengajuan', value: formatTanggal(item.created_at) },
                      { icon: MapPin, label: 'Lokasi Fisik', value: item.lokasi_saat_ini },
                      {
                        icon: HardDrive,
                        label: 'Ukuran Berkas',
                        value: item.ukuran_file ? `${(item.ukuran_file / 1024 / 1024).toFixed(2)} MB` : '-',
                      },
                    ].map((m) => {
                      const Icon = m.icon
                      return (
                        <div key={m.label} className="flex min-w-0 items-start gap-2">
                          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3BA4E8]" />
                          <div className="min-w-0">
                            <p className="text-[11px] text-[#9AA0B2]">{m.label}</p>
                            <p className="truncate text-sm font-medium text-[#1F2333]">{m.value}</p>
                          </div>
                        </div>
                      )
                    })}
                    {(item.nomor_ppl || item.nomor_dokumen) && (
                      <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-[#ECEEF5] pt-3 text-xs lg:col-span-4">
                        {item.nomor_ppl && (
                          <span className="text-[#8A90A2]">
                            No. PPL <span className="ml-1 font-mono font-medium text-[#1F2333]">{item.nomor_ppl}</span>
                          </span>
                        )}
                        {item.nomor_dokumen && (
                          <span className="text-[#8A90A2]">
                            Doc Voucher <span className="ml-1 font-mono font-medium text-[#1F2333]">{item.nomor_dokumen}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Aksi */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      href={`/dokumen/${item.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E86C8] hover:underline"
                    >
                      <Eye className="h-4 w-4" />
                      Periksa berkas & riwayat
                    </Link>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalAction({ item, type: 'reject' })}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#F5C2C2] bg-white px-4 py-2 text-sm font-semibold text-[#D64545] transition-colors hover:bg-[#FDECEC] sm:flex-none"
                      >
                        <XCircle className="h-4 w-4" />
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalAction({ item, type: 'approve' })}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2A92D6] sm:flex-none"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {item.tahap === 'tahap_1_pic' ? 'Verifikasi Lolos' : 'Sahkan (+3 Tahun)'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL KONFIRMASI AKSI ================= */}
      {modalAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg bg-white border-2 border-[#1E2429] shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#D8D2C4] pb-3">
              <div className="flex items-center gap-2">
                {isReject ? (
                  <XCircle className="w-5 h-5 text-red-700" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#1F5C55]" />
                )}
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#1A1D21]">
                    {isReject
                      ? 'Tolak Pengajuan Dokumen'
                      : modalAction.item.tahap === 'tahap_1_pic'
                      ? 'Verifikasi Tahap 1 (PIC Arsip)'
                      : 'Pengesahan Akhir (Atasan)'}
                  </h3>
                  <p className="font-mono text-xs text-[#5B6166]">
                    Kode Arsip: <strong>{modalAction.item.kode_arsip}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-[#5B6166] hover:text-[#1A1D21]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#F7F3EB] p-3 text-xs font-mono space-y-1 border border-[#D8D2C4]">
              <p className="font-bold text-[#1A1D21] font-sans">{modalAction.item.judul}</p>
              <p className="text-[#5B6166]">
                Pengaju: {modalAction.item.pengaju_nama} • Kategori: {modalAction.item.kategori_nama}
              </p>
              {!isReject && (
                <p className="text-[#1F5C55] font-semibold flex items-center gap-1 pt-1">
                  <ArrowRight className="w-3.5 h-3.5" />
                  {modalAction.item.tahap === 'tahap_1_pic'
                    ? 'Dokumen akan diteruskan ke antrean Persetujuan Akhir Atasan.'
                    : 'Dokumen akan berstatus Aktif selama 3 tahun dan diterbitkan label QR resmi.'}
                </p>
              )}
            </div>

            {isReject && (
              <div className="space-y-1">
                <label className="block font-mono text-[11px] font-bold text-[#1A1D21] uppercase">
                  Alasan Penolakan <span className="text-red-700">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Tuliskan alasan penolakan secara jelas agar pembuat dapat memperbaiki dokumen..."
                  className="w-full p-2.5 border border-[#D8D2C4] bg-white font-sans text-xs focus:border-[#1A1D21] focus:outline-none"
                />
                <p className="text-[10px] text-[#5B6166] font-mono">
                  Dokumen akan berstatus Ditolak dan dikembalikan ke Pengaju beserta alasan ini.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-[#D8D2C4] flex items-center justify-end gap-3 font-mono text-xs">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={closeModal}
                className="px-4 py-2 border border-[#D8D2C4] hover:bg-[#F7F3EB] text-[#1A1D21]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={confirmDisabled}
                onClick={handleConfirmAction}
                className={`px-5 py-2 text-white font-semibold transition-colors disabled:opacity-50 ${
                  isReject ? 'bg-red-700 hover:bg-red-800' : 'bg-[#1F5C55] hover:bg-[#184843]'
                }`}
              >
                {isSubmittingAction
                  ? 'Memproses...'
                  : isReject
                  ? 'Konfirmasi Tolak'
                  : modalAction.item.tahap === 'tahap_1_pic'
                  ? 'Loloskan Verifikasi'
                  : 'Sahkan Menjadi Aktif (+3 Tahun)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST NOTIFIKASI ================= */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex max-w-md items-start gap-2.5 p-4 text-xs font-mono text-white shadow-xl ${
            toast.type === 'success' ? 'bg-[#1F5C55]' : 'bg-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 text-red-300" />
          )}
          <span className="flex-1 leading-relaxed">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </AppLayout>
  )
}

export default function VerifikasiPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-[#5B6166]">
          Memuat antrean persetujuan...
        </div>
      }
    >
      <VerifikasiContent />
    </Suspense>
  )
}
