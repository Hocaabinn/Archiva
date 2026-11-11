'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { UserRole, PeminjamanStatus } from '@/types'
import {
  BookOpenCheck,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  User,
  MapPin,
  FileText,
  AlertCircle,
  Loader2,
  Calendar,
  ExternalLink,
  X,
  Info,
  Hourglass,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'

const inputClass =
  'w-full rounded-lg border border-[#E3E6F0] bg-white px-3.5 py-2.5 text-sm text-[#1F2333] placeholder:text-[#A5ABBC] focus:border-[#3BA4E8] focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]/15 disabled:bg-[#F7F8FC] disabled:text-[#8A90A2]'

const STATUS_STYLE: Record<string, { className: string; icon: React.ComponentType<{ className?: string }> }> = {
  Diajukan: { className: 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]', icon: Hourglass },
  Dipinjam: { className: 'bg-[#EAF5FD] text-[#1E86C8] border-[#BCE1F9]', icon: Clock },
  Dikembalikan: { className: 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]', icon: CheckCircle2 },
  Ditolak: { className: 'bg-[#FDECEC] text-[#D64545] border-[#F5C2C2]', icon: XCircle },
}

function initials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

interface PeminjamanRow {
  id: string
  dokumen_id: string
  peminjam_id: string
  pic_inaktif_id?: string
  tanggal_pinjam: string
  tanggal_kembali?: string
  status: PeminjamanStatus
  keperluan: string
  created_at: string
  dokumen?: {
    id: string
    kode_arsip: string
    judul: string
    status: string
    lokasi_saat_ini: string
    bucket: string
    kategori_dokumen?: { nama: string }
  }
  peminjam?: {
    id: string
    nama_lengkap: string
    email: string
    nomor_pegawai?: string
    jabatan?: string
  }
  pic_inaktif?: {
    id: string
    nama_lengkap: string
    email: string
  }
}

interface InactiveDocOption {
  id: string
  kode_arsip: string
  judul: string
  lokasi_saat_ini: string
}

function PeminjamanContent() {
  const searchParams = useSearchParams()
  const preselectedDocId = searchParams.get('dokumen_id')

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('user')
  const [loans, setLoans] = useState<PeminjamanRow[]>([])
  const [inactiveDocs, setInactiveDocs] = useState<InactiveDocOption[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filter & Search State
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modal Ajukan Peminjaman
  const [isAjukanModalOpen, setIsAjukanModalOpen] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string>('')
  const [keperluan, setKeperluan] = useState<string>('')
  const [submittingAjukan, setSubmittingAjukan] = useState(false)

  // Modal Tolak Peminjaman (PIC Arsip)
  const [rejectingLoan, setRejectingLoan] = useState<PeminjamanRow | null>(null)
  const [alasanTolak, setAlasanTolak] = useState('')
  const [submittingReject, setSubmittingReject] = useState(false)

  // Processing state for direct actions
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  // Load User & Data
  const loadData = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setCurrentUserId(user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profile?.role) {
          setCurrentUserRole(profile.role as UserRole)
        }
      }

      // Fetch list peminjaman via API
      const res = await fetch('/api/peminjaman')
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Gagal memuat data peminjaman')
      }
      const json = await res.json()
      setLoans(json.data || [])

      // Fetch dokumen inaktif untuk pilihan modal ajukan
      const { data: docs } = await supabase
        .from('dokumen')
        .select('id, kode_arsip, judul, lokasi_saat_ini')
        .eq('status', 'inaktif')
        .order('kode_arsip', { ascending: true })

      setInactiveDocs(docs || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle URL param preselectedDocId
  useEffect(() => {
    if (preselectedDocId && inactiveDocs.length > 0) {
      const exists = inactiveDocs.some((d) => d.id === preselectedDocId)
      if (exists) {
        setSelectedDocId(preselectedDocId)
        setIsAjukanModalOpen(true)
      }
    }
  }, [preselectedDocId, inactiveDocs])

  // Handle Ajukan Peminjaman
  const handleAjukanSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDocId) {
      showToast('error', 'Silakan pilih dokumen inaktif yang ingin dipinjam.')
      return
    }
    if (!keperluan.trim()) {
      showToast('error', 'Keperluan peminjaman wajib diisi.')
      return
    }

    setSubmittingAjukan(true)
    try {
      const res = await fetch('/api/peminjaman/ajukan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dokumen_id: selectedDocId,
          keperluan: keperluan.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengajukan peminjaman')
      }

      showToast('success', 'Pengajuan peminjaman berhasil dikirim ke PIC Arsip Inaktif.')
      setIsAjukanModalOpen(false)
      setSelectedDocId('')
      setKeperluan('')
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      showToast('error', msg)
    } finally {
      setSubmittingAjukan(false)
    }
  }

  // Handle Verifikasi PIC (Setujui)
  const handleApproveLoan = async (loanId: string) => {
    if (!confirm('Setujui peminjaman dokumen inaktif ini? Status berkas akan beralih menjadi Dipinjam.')) {
      return
    }

    setProcessingId(loanId)
    try {
      const res = await fetch(`/api/peminjaman/${loanId}/verifikasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: 'setujui' }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyetujui peminjaman')
      }

      showToast('success', 'Peminjaman disetujui. Status peminjaman menjadi Dipinjam.')
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      showToast('error', msg)
    } finally {
      setProcessingId(null)
    }
  }

  // Handle Verifikasi PIC (Tolak)
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingLoan) return

    setSubmittingReject(true)
    try {
      const res = await fetch(`/api/peminjaman/${rejectingLoan.id}/verifikasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aksi: 'tolak',
          alasan: alasanTolak.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menolak peminjaman')
      }

      showToast('success', 'Pengajuan peminjaman telah ditolak.')
      setRejectingLoan(null)
      setAlasanTolak('')
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      showToast('error', msg)
    } finally {
      setSubmittingReject(false)
    }
  }

  // Handle Pengembalian Dokumen
  const handleReturnLoan = async (loanId: string) => {
    if (!confirm('Konfirmasi bahwa dokumen inaktif telah dikembalikan ke Gudang Inaktif?')) {
      return
    }

    setProcessingId(loanId)
    try {
      const res = await fetch(`/api/peminjaman/${loanId}/kembali`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pengembalian')
      }

      showToast('success', 'Dokumen berhasil dikembalikan ke Gudang Inaktif.')
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      showToast('error', msg)
    } finally {
      setProcessingId(null)
    }
  }

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return loans.filter((item) => {
      // Filter status tab
      if (filterStatus !== 'semua' && item.status.toLowerCase() !== filterStatus.toLowerCase()) {
        return false
      }

      // Filter search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const kode = item.dokumen?.kode_arsip?.toLowerCase() || ''
        const judul = item.dokumen?.judul?.toLowerCase() || ''
        const peminjam = item.peminjam?.nama_lengkap?.toLowerCase() || ''
        const keperluanStr = item.keperluan.toLowerCase()
        if (!kode.includes(q) && !judul.includes(q) && !peminjam.includes(q) && !keperluanStr.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [loans, filterStatus, searchQuery])

  const isPicArsip = currentUserRole === 'pic_arsip'
  const isPicOrAdmin = currentUserRole === 'pic_arsip' || currentUserRole === 'admin'

  const counts = useMemo(() => {
    const c = { semua: loans.length, diajukan: 0, dipinjam: 0, dikembalikan: 0, ditolak: 0 } as Record<string, number>
    loans.forEach((l) => {
      const key = l.status?.toLowerCase()
      if (key in c) c[key] += 1
    })
    return c
  }, [loans])

  const statusTabs = [
    { id: 'semua', label: 'Semua' },
    { id: 'diajukan', label: 'Diajukan' },
    { id: 'dipinjam', label: 'Dipinjam' },
    { id: 'dikembalikan', label: 'Dikembalikan' },
    { id: 'ditolak', label: 'Ditolak' },
  ]

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : null

  const cardClass = 'bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

  const renderStatusBadge = (status: PeminjamanStatus) => {
    const s = STATUS_STYLE[status] || STATUS_STYLE.Diajukan
    const Icon = s.icon
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${s.className}`}>
        <Icon className="h-3.5 w-3.5" />
        {status}
      </span>
    )
  }

  const renderActions = (loan: PeminjamanRow, fullWidth = false) => {
    const isBorrower = loan.peminjam_id === currentUserId
    const busy = processingId === loan.id
    const w = fullWidth ? 'flex-1 justify-center' : ''

    if (loan.status === 'Diajukan' && isPicArsip) {
      return (
        <div className={`flex items-center gap-2 ${fullWidth ? 'w-full' : ''}`}>
          <button
            type="button"
            onClick={() => handleApproveLoan(loan.id)}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-[#3BA4E8] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#2A92D6] disabled:opacity-50 ${w}`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Setujui
          </button>
          <button
            type="button"
            onClick={() => setRejectingLoan(loan)}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-[#F5C2C2] bg-white px-3 py-1.5 text-xs font-semibold text-[#D64545] transition-colors hover:bg-[#FDECEC] disabled:opacity-50 ${w}`}
          >
            <XCircle className="h-3.5 w-3.5" />
            Tolak
          </button>
        </div>
      )
    }

    if (loan.status === 'Dipinjam' && (isPicOrAdmin || isBorrower)) {
      return (
        <button
          type="button"
          onClick={() => handleReturnLoan(loan.id)}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-[#BCE1F9] bg-[#EAF5FD] px-3 py-1.5 text-xs font-semibold text-[#1E86C8] transition-colors hover:bg-[#D6ECFB] disabled:opacity-50 ${w}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          {isPicOrAdmin ? 'Konfirmasi Kembali' : 'Kembalikan Berkas'}
        </button>
      )
    }

    if (loan.status === 'Dikembalikan' || loan.status === 'Ditolak') {
      return <span className="text-xs text-[#9AA0B2]">Selesai</span>
    }

    return <span className="text-xs text-[#9AA0B2]">Menunggu verifikasi</span>
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6 pb-16">
        {/* Toast Notifikasi */}
        {toast && (
          <div
            className={`fixed left-4 right-4 top-20 z-50 flex items-center gap-3 rounded-xl border p-4 shadow-lg sm:left-auto sm:right-6 sm:max-w-md animate-in fade-in slide-in-from-top-2 duration-200 ${
              toast.type === 'success'
                ? 'border-[#2F9E5B]/30 bg-[#E7F6EC] text-[#1E6B3E]'
                : 'border-[#D64545]/30 bg-[#FDECEC] text-[#A82828]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2F9E5B]" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-[#D64545]" />
            )}
            <p className="flex-1 text-sm font-medium">{toast.text}</p>
            <button type="button" onClick={() => setToast(null)} className="rounded-md p-1 hover:bg-black/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[#1F2333] sm:text-[28px]">
              Peminjaman Dokumen Inaktif
            </h1>
            <p className="mt-1 text-sm text-[#4B5163]">
              Ajukan, verifikasi, dan pantau peminjaman berkas dari Gudang Inaktif.
            </p>
          </div>
          {currentUserRole !== 'viewer' && (
            <button
              type="button"
              onClick={() => setIsAjukanModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2A92D6] active:scale-[0.98] sm:w-auto sm:py-2"
            >
              <Plus className="h-4 w-4" />
              <span>Ajukan Peminjaman</span>
            </button>
          )}
        </div>

        {/* Kartu ringkasan */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { label: 'Total Peminjaman', value: counts.semua, color: 'text-[#1F2333]', bar: 'bg-[#3BA4E8]' },
            { label: 'Menunggu Verifikasi', value: counts.diajukan, color: 'text-[#B06000]', bar: 'bg-[#FBBC04]' },
            { label: 'Sedang Dipinjam', value: counts.dipinjam, color: 'text-[#1E86C8]', bar: 'bg-[#7CC4F2]' },
            { label: 'Sudah Dikembalikan', value: counts.dikembalikan, color: 'text-[#137333]', bar: 'bg-[#34A853]' },
          ].map((s) => (
            <div
              key={s.label}
              className="relative overflow-hidden rounded-2xl border border-[#ECEEF5] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:shadow-sm sm:p-5"
            >
              <span className={`absolute bottom-0 left-0 top-0 w-1 ${s.bar}`} />
              <p className="truncate text-xs font-medium text-[#64748B] sm:text-sm">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-bold tracking-tight sm:mt-2 sm:text-[28px] ${s.color}`}>
                {loading ? '–' : s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Daftar */}
        <div className={cardClass}>
          {/* Toolbar */}
          <div className="space-y-4 border-b border-[#ECEEF5] p-4 sm:p-5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA0B2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode arsip, judul, peminjam, keperluan..."
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

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {statusTabs.map((tab) => {
                const active = filterStatus === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterStatus(tab.id)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#3BA4E8] text-white'
                        : 'bg-[#F4F5FA] text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1E86C8]'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-md px-1.5 text-xs ${active ? 'bg-white/25' : 'bg-white text-[#6B7185]'}`}>
                      {counts[tab.id] ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Konten */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#6B7185]">
              <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
              <p className="text-sm font-medium">Memuat data peminjaman...</p>
            </div>
          ) : errorMsg ? (
            <div className="m-4 flex items-start gap-3 rounded-xl border border-[#FDECEC] bg-[#FFF5F5] px-4 py-3 text-sm text-[#D64545] sm:m-5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF5FD] text-[#3BA4E8]">
                <BookOpenCheck className="h-6 w-6" />
              </span>
              <p className="mt-1 text-sm font-semibold text-[#1F2333]">Tidak ada catatan peminjaman</p>
              <p className="max-w-sm text-xs text-[#8A90A2]">
                {filterStatus !== 'semua' || searchQuery
                  ? 'Tidak ada peminjaman yang cocok dengan filter atau pencarian Anda.'
                  : 'Belum ada pengajuan peminjaman arsip inaktif yang tercatat.'}
              </p>
            </div>
          ) : (
            <>
              {/* Tabel (desktop) */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#ECEEF5] bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                      <th className="px-5 py-3">Dokumen Inaktif</th>
                      <th className="px-5 py-3">Peminjam</th>
                      <th className="px-5 py-3">Keperluan</th>
                      <th className="px-5 py-3">Tanggal</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEEF5]">
                    {filteredLoans.map((loan) => {
                      const doc = loan.dokumen
                      return (
                        <tr key={loan.id} className="align-top transition-colors hover:bg-[#F7FBFE]">
                          <td className="max-w-xs px-5 py-4">
                            {doc ? (
                              <div className="min-w-0">
                                <Link
                                  href={`/dokumen/${doc.id}`}
                                  className="group inline-flex items-start gap-1 font-semibold leading-snug text-[#1F2333] hover:text-[#1E86C8]"
                                >
                                  <span className="line-clamp-2">{doc.judul}</span>
                                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9AA0B2] group-hover:text-[#1E86C8]" />
                                </Link>
                                <KodeArsip kode={doc.kode_arsip} className="block mt-1 font-mono text-xs text-[#1E86C8]" />
                                <p className="mt-1 flex items-center gap-1 text-xs text-[#8A90A2]">
                                  <MapPin className="h-3 w-3 text-[#3BA4E8]" />
                                  {doc.lokasi_saat_ini || 'Gudang Inaktif'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs italic text-[#D64545]">Dokumen telah dihapus</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-start gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF5FD] text-xs font-semibold text-[#1E86C8]">
                                {initials(loan.peminjam?.nama_lengkap || loan.peminjam?.email || 'P')}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-[#1F2333]">
                                  {loan.peminjam?.nama_lengkap || loan.peminjam?.email || 'Pengguna'}
                                </p>
                                {(loan.peminjam?.jabatan || loan.peminjam?.nomor_pegawai) && (
                                  <p className="text-xs text-[#6B7185]">
                                    {loan.peminjam?.jabatan}
                                    {loan.peminjam?.jabatan && loan.peminjam?.nomor_pegawai ? ' • ' : ''}
                                    {loan.peminjam?.nomor_pegawai ? `NIP ${loan.peminjam.nomor_pegawai}` : ''}
                                  </p>
                                )}
                                <p className="truncate text-xs text-[#9AA0B2]">{loan.peminjam?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-xs px-5 py-4 text-[#4B5163]">
                            <p className="line-clamp-3 leading-relaxed">{loan.keperluan}</p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-xs">
                            <p className="flex items-center gap-1.5 text-[#4B5163]">
                              <Calendar className="h-3.5 w-3.5 text-[#3BA4E8]" />
                              <span className="font-medium text-[#1F2333]">{formatDate(loan.tanggal_pinjam) || '-'}</span>
                            </p>
                            <p className="mt-1.5 flex items-center gap-1.5">
                              <RotateCcw className="h-3.5 w-3.5 text-[#9AA0B2]" />
                              <span className={loan.tanggal_kembali ? 'font-medium text-[#137333]' : 'text-[#9AA0B2]'}>
                                {formatDate(loan.tanggal_kembali) || 'Belum kembali'}
                              </span>
                            </p>
                            {loan.pic_inaktif && (
                              <p className="mt-1.5 flex items-center gap-1.5 text-[#8A90A2]">
                                <User className="h-3.5 w-3.5" />
                                PIC: {loan.pic_inaktif.nama_lengkap || loan.pic_inaktif.email}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4">{renderStatusBadge(loan.status)}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end">{renderActions(loan)}</div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Kartu (mobile & tablet) */}
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:hidden">
                {filteredLoans.map((loan) => {
                  const doc = loan.dokumen
                  return (
                    <div key={loan.id} className="flex flex-col rounded-xl border border-[#ECEEF5] bg-white p-4 transition-shadow hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {doc ? (
                            <>
                              <KodeArsip kode={doc.kode_arsip} className="block font-mono text-[11px] text-[#1E86C8]" />
                              <Link
                                href={`/dokumen/${doc.id}`}
                                className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-[#1F2333] hover:text-[#1E86C8]"
                              >
                                {doc.judul}
                              </Link>
                            </>
                          ) : (
                            <span className="text-xs italic text-[#D64545]">Dokumen telah dihapus</span>
                          )}
                        </div>
                        {renderStatusBadge(loan.status)}
                      </div>

                      <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-[#F8FAFC] p-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF5FD] text-xs font-semibold text-[#1E86C8]">
                          {initials(loan.peminjam?.nama_lengkap || loan.peminjam?.email || 'P')}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#1F2333]">
                            {loan.peminjam?.nama_lengkap || loan.peminjam?.email || 'Pengguna'}
                          </p>
                          <p className="truncate text-xs text-[#8A90A2]">
                            {loan.peminjam?.jabatan || loan.peminjam?.email}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#4B5163]">
                        <FileText className="mr-1 inline h-3.5 w-3.5 text-[#9AA0B2]" />
                        {loan.keperluan}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[#9AA0B2]">Tgl Pinjam</p>
                          <p className="font-medium text-[#1F2333]">{formatDate(loan.tanggal_pinjam) || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[#9AA0B2]">Tgl Kembali</p>
                          <p className={loan.tanggal_kembali ? 'font-medium text-[#137333]' : 'text-[#9AA0B2]'}>
                            {formatDate(loan.tanggal_kembali) || 'Belum kembali'}
                          </p>
                        </div>
                        {doc && (
                          <div className="col-span-2 flex items-center gap-1 text-[#8A90A2]">
                            <MapPin className="h-3 w-3 text-[#3BA4E8]" />
                            {doc.lokasi_saat_ini || 'Gudang Inaktif'}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center border-t border-[#ECEEF5] pt-3">
                        {renderActions(loan, true)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= MODAL AJUKAN PEMINJAMAN ================= */}
      {isAjukanModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => !submittingAjukan && setIsAjukanModalOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#ECEEF5] p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FD] text-[#3BA4E8]">
                  <BookOpenCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[#1F2333]">Ajukan Peminjaman</h3>
                  <p className="mt-0.5 text-xs text-[#6B7185]">
                    Dokumen tetap berstatus Inaktif dan berada di Gudang Inaktif.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submittingAjukan && setIsAjukanModalOpen(false)}
                className="rounded-lg p-1.5 text-[#6B7185] hover:bg-[#F4F5FA] hover:text-[#1F2333]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAjukanSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">
                  Dokumen Inaktif <span className="text-[#D64545]">*</span>
                </label>
                {inactiveDocs.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[#ECEEF5] bg-[#F8FAFC] p-3 text-xs text-[#6B7185]">
                    <Info className="h-4 w-4 shrink-0 text-[#3BA4E8]" />
                    Tidak ada dokumen berstatus Inaktif yang tersedia saat ini.
                  </div>
                ) : (
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    required
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="">Pilih dokumen inaktif...</option>
                    {inactiveDocs.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.kode_arsip} — {doc.judul} ({doc.lokasi_saat_ini || 'Gudang Inaktif'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">
                  Keperluan Peminjaman <span className="text-[#D64545]">*</span>
                </label>
                <textarea
                  value={keperluan}
                  onChange={(e) => setKeperluan(e.target.value)}
                  required
                  rows={4}
                  placeholder="Jelaskan kebutuhan operasional peminjaman dokumen ini..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[#ECEEF5] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={submittingAjukan}
                  onClick={() => setIsAjukanModalOpen(false)}
                  className="rounded-lg border border-[#E3E6F0] bg-white px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F7F8FC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAjukan || inactiveDocs.length === 0}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2A92D6] disabled:opacity-50"
                >
                  {submittingAjukan ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL TOLAK PEMINJAMAN ================= */}
      {rejectingLoan && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => !submittingReject && setRejectingLoan(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-[#ECEEF5] p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FDECEC] text-[#D64545]">
                <XCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#1F2333]">Tolak Pengajuan Peminjaman</h3>
                <p className="mt-0.5 break-all text-xs text-[#6B7185]">
                  Dokumen: <span className="font-mono font-medium text-[#1F2333]">{rejectingLoan.dokumen?.kode_arsip}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">Alasan Penolakan</label>
                <textarea
                  value={alasanTolak}
                  onChange={(e) => setAlasanTolak(e.target.value)}
                  rows={3}
                  placeholder="Tuliskan alasan penolakan pengajuan ini..."
                  className={`${inputClass} resize-none focus:border-[#D64545] focus:ring-[#D64545]/15`}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[#ECEEF5] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={submittingReject}
                  onClick={() => setRejectingLoan(null)}
                  className="rounded-lg border border-[#E3E6F0] bg-white px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F7F8FC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReject}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#D64545] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#C03A3A] disabled:opacity-50"
                >
                  {submittingReject ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Tolak Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default function PeminjamanPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-[#6B7185]">
            <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
            <p className="text-sm font-medium">Memuat modul peminjaman...</p>
          </div>
        </AppLayout>
      }
    >
      <PeminjamanContent />
    </Suspense>
  )
}
