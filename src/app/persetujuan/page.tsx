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

  return (
    <AppLayout currentRole={roleParam || undefined}>
      <div className="mx-auto max-w-7xl space-y-6 pb-16">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-[#D8D2C4] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs px-2 py-0.5 bg-[#1F5C55] text-white font-bold">
                ALUR BERJENJANG
              </span>
              <span className="font-mono text-xs text-[#5B6166]">
                Blueprint Tabel 14: PIC Arsip → Atasan
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1D21]">
              Antrean Verifikasi & Persetujuan Dokumen
            </h1>
            <p className="mt-1 text-xs text-[#5B6166] leading-relaxed">
              Memverifikasi kelengkapan format SIG oleh PIC Arsip, dilanjutkan dengan pengesahan
              arsip aktif 3 tahun oleh Atasan.
            </p>
          </div>
          <Link
            href="/dokumen"
            className="flex items-center gap-2 self-start border border-[#1E2429] bg-white px-3.5 py-1.5 text-xs font-mono font-semibold text-[#1A1D21] transition-colors hover:bg-[#F7F3EB]"
          >
            <FileText className="h-4 w-4" />
            <span>Katalog Dokumen</span>
          </Link>
        </div>

        {/* Kartu Ringkasan Statistik */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 font-mono text-xs">
          {[
            {
              label: 'Menunggu PIC Arsip (Tahap 1)',
              value: countTahap1,
              icon: ClipboardCheck,
              tone: 'border-l-4 border-amber-600 bg-white text-amber-900',
            },
            {
              label: 'Menunggu Atasan (Tahap 2)',
              value: countTahap2,
              icon: UserCheck,
              tone: 'border-l-4 border-blue-600 bg-white text-blue-900',
            },
            {
              label: 'Disahkan (Sesi Ini)',
              value: processed.disahkan,
              icon: ShieldCheck,
              tone: 'border-l-4 border-emerald-600 bg-white text-emerald-900',
            },
            {
              label: 'Ditolak (Sesi Ini)',
              value: processed.ditolak,
              icon: XCircle,
              tone: 'border-l-4 border-red-600 bg-white text-red-900',
            },
          ].map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className={`border border-[#D8D2C4] p-4 flex items-center justify-between shadow-xs ${s.tone}`}
              >
                <div>
                  <p className="text-[11px] text-[#5B6166]">{s.label}</p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-[#1A1D21]">
                    {s.value}
                  </p>
                </div>
                <Icon className="h-6 w-6 text-[#1A1D21]/60" />
              </div>
            )
          })}
        </div>

        {/* Antrean Verifikasi */}
        <div className="bg-white border-2 border-[#1E2429] shadow-sm">
          {/* Tab & Pencarian */}
          <div className="flex flex-col gap-3 border-b border-[#D8D2C4] p-4 lg:flex-row lg:items-center lg:justify-between bg-[#F7F3EB]/40">
            <div className="flex font-mono text-xs border border-[#D8D2C4] bg-white">
              {(
                [
                  { id: 'tahap_1_pic', label: 'Tahap 1 · Verifikasi PIC Arsip', count: countTahap1 },
                  { id: 'tahap_2_atasan', label: 'Tahap 2 · Pengesahan Atasan', count: countTahap2 },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors ${
                      active
                        ? 'bg-[#1E2429] text-white'
                        : 'text-[#5B6166] hover:bg-[#F7F3EB] hover:text-[#1A1D21]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] ${
                        active ? 'bg-white text-[#1E2429]' : 'bg-[#F7F3EB] text-[#5B6166]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="relative w-full lg:max-w-xs font-mono text-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5B6166]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode, judul, no. PPL..."
                className="w-full border border-[#D8D2C4] bg-white py-1.5 pl-8 pr-3 text-xs placeholder:text-[#8C9399] focus:border-[#1A1D21] focus:outline-none"
              />
            </div>
          </div>

          {/* Daftar Dokumen */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 font-mono text-xs text-[#5B6166]">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat antrean verifikasi...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center font-mono">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F3EB] text-[#1F5C55] border border-[#D8D2C4]">
                <Inbox className="h-6 w-6" />
              </span>
              <p className="mt-2 font-bold text-sm text-[#1A1D21]">Antrean Kosong</p>
              <p className="text-xs text-[#5B6166]">
                Tidak ada berkas yang menunggu pada tahap ini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#D8D2C4]">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="space-y-4 p-5 transition-colors hover:bg-[#F7F3EB]/30 font-sans"
                >
                  {/* Judul & Indikator */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#1E2429] bg-[#F7F3EB] text-[#1E2429]">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-serif font-bold text-base text-[#1A1D21] leading-snug">
                          {item.judul}
                        </h3>
                        <p className="font-mono text-xs text-[#5B6166] mt-0.5">
                          <strong className="text-[#1A1D21]">{item.kode_arsip}</strong>
                          {item.nomor_ppl ? ` • No. PPL: ${item.nomor_ppl}` : ''}
                          {item.nomor_dokumen ? ` • Doc Voucher: ${item.nomor_dokumen}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                          <span className="px-2 py-0.5 bg-[#F7F3EB] border border-[#D8D2C4] text-[#1E2429]">
                            {item.kategori_nama}
                          </span>
                          <StampBadge status="menunggu_persetujuan" />
                        </div>
                      </div>
                    </div>
                    <StageProgress tahap={item.tahap} />
                  </div>

                  {/* Metadata Rinci */}
                  <div className="grid grid-cols-1 gap-2.5 bg-[#F7F3EB]/40 border border-[#D8D2C4] p-3 text-xs font-mono sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-start gap-2">
                      <User className="w-3.5 h-3.5 text-[#5B6166] mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[#8C9399] block text-[10px]">PENGAJU</span>
                        <span className="font-semibold text-[#1A1D21]">{item.pengaju_nama}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#5B6166] mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[#8C9399] block text-[10px]">TANGGAL PENGAJUAN</span>
                        <span className="text-[#1A1D21]">
                          {new Date(item.created_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#5B6166] mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[#8C9399] block text-[10px]">LOKASI FISIK</span>
                        <span className="text-[#1A1D21]">{item.lokasi_saat_ini}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <HardDrive className="w-3.5 h-3.5 text-[#5B6166] mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[#8C9399] block text-[10px]">UKURAN BERKAS</span>
                        <span className="text-[#1A1D21]">
                          {item.ukuran_file
                            ? `${(item.ukuran_file / 1024 / 1024).toFixed(2)} MB`
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Aksi Persetujuan / Penolakan */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1 font-mono text-xs">
                    <Link
                      href={`/dokumen/${item.id}`}
                      className="inline-flex items-center gap-1.5 text-[#1F5C55] hover:underline font-semibold"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Periksa berkas & riwayat lengkap</span>
                    </Link>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalAction({ item, type: 'reject' })}
                        className="px-3.5 py-1.5 border border-red-700 bg-white hover:bg-red-50 text-red-800 font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalAction({ item, type: 'approve' })}
                        className="px-4 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {item.tahap === 'tahap_1_pic'
                            ? 'Verifikasi Lolos'
                            : 'Setujui Akhir (+3 Tahun)'}
                        </span>
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
