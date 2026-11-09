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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

  const isPicOrAdmin = currentUserRole === 'pic_arsip' || currentUserRole === 'admin'

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
        {/* Toast Notifikasi */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 p-4 border-2 font-mono text-xs flex items-center gap-3 shadow-lg ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
                : 'bg-red-50 border-red-700 text-red-900'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Header Lembar Registrasi Peminjaman */}
        <div className="border-b-2 border-[#1E2429] pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs px-2 py-0.5 bg-[#1E2429] text-white font-bold">
                BUKU REGISTER RESMI
              </span>
              <span className="text-xs text-[#5B6166] font-mono">
                Blueprint Bab 3.6 — Layanan Peminjaman Arsip Inaktif
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1D21] mt-1">
              Peminjaman Dokumen Inaktif
            </h1>
            <p className="text-xs font-mono text-[#5B6166] mt-1">
              Layanan peminjaman dokumen dari Gudang Inaktif. Status dokumen dan berkas penyimpanan tetap berada pada bucket arsip-inaktif.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {currentUserRole !== 'viewer' && (
              <button
                type="button"
                onClick={() => setIsAjukanModalOpen(true)}
                className="px-4 py-2 bg-[#1F5C55] hover:bg-[#184843] text-white text-xs font-mono font-bold flex items-center gap-2 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Ajukan Peminjaman</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Tab Status & Search Bar */}
        <div className="bg-white border-2 border-[#1E2429] p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
              {[
                { id: 'semua', label: 'Semua Status' },
                { id: 'diajukan', label: 'Diajukan' },
                { id: 'dipinjam', label: 'Dipinjam' },
                { id: 'dikembalikan', label: 'Dikembalikan' },
                { id: 'ditolak', label: 'Ditolak' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${
                    filterStatus === tab.id
                      ? 'bg-[#1E2429] text-white'
                      : 'bg-[#F7F3EB] hover:bg-[#EAE4D5] text-[#1A1D21] border border-[#D8D2C4]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6166]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode arsip, judul, peminjam..."
                className="w-full pl-9 pr-3 py-1.5 border border-[#D8D2C4] text-xs font-mono text-[#1A1D21] placeholder:text-[#8C9399] focus:outline-hidden focus:border-[#1E2429]"
              />
            </div>
          </div>
        </div>

        {/* Tabel Kerja Peminjaman */}
        <div className="bg-white border-2 border-[#1E2429] shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs font-mono text-[#5B6166] flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#1F5C55]" />
              <span>Memuat buku register peminjaman arsip...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-8 text-center text-xs font-mono text-red-700 bg-red-50">
              <AlertCircle className="w-5 h-5 mx-auto mb-2 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-[#5B6166] bg-[#F7F3EB]/30">
              <BookOpenCheck className="w-8 h-8 mx-auto mb-2 text-[#8C9399]" />
              <p className="font-bold text-[#1A1D21]">Tidak ada catatan peminjaman ditemukan</p>
              <p className="text-[11px] text-[#8C9399] mt-1">
                {filterStatus !== 'semua'
                  ? `Tidak ada peminjaman dengan status '${filterStatus}'.`
                  : 'Belum ada pengajuan peminjaman arsip inaktif yang tercatat dalam sistem.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1E2429] text-white font-mono text-[11px] uppercase tracking-wider">
                    <th className="p-3 border-r border-white/20">Dokumen Inaktif</th>
                    <th className="p-3 border-r border-white/20">Peminjam</th>
                    <th className="p-3 border-r border-white/20">Keperluan</th>
                    <th className="p-3 border-r border-white/20">Tgl Pinjam / Pengembalian</th>
                    <th className="p-3 border-r border-white/20 text-center">Status</th>
                    <th className="p-3 text-center">Aksi Operasional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8D2C4] font-sans">
                  {filteredLoans.map((loan) => {
                    const isBorrower = loan.peminjam_id === currentUserId
                    const doc = loan.dokumen

                    return (
                      <tr key={loan.id} className="hover:bg-[#F7F3EB]/40 transition-colors">
                        {/* Kolom Dokumen */}
                        <td className="p-3 align-top max-w-xs">
                          {doc ? (
                            <div>
                              <Link
                                href={`/dokumen/${doc.id}`}
                                className="font-bold font-serif text-sm text-[#1A1D21] hover:text-[#1F5C55] flex items-center gap-1 leading-snug"
                              >
                                <span>{doc.judul}</span>
                                <ExternalLink className="w-3 h-3 text-[#5B6166] shrink-0" />
                              </Link>
                              <div className="font-mono text-[11px] text-[#5B6166] mt-0.5 break-all">
                                {doc.kode_arsip}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#8C9399] mt-1">
                                <MapPin className="w-3 h-3 text-[#1F5C55]" />
                                <span>{doc.lokasi_saat_ini || 'Gudang Inaktif'}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-red-700 italic font-mono text-xs">
                              Dokumen ID: {loan.dokumen_id} (Data Terhapus)
                            </span>
                          )}
                        </td>

                        {/* Kolom Peminjam */}
                        <td className="p-3 align-top font-mono text-[11px]">
                          <div className="font-bold text-[#1A1D21]">
                            {loan.peminjam?.nama_lengkap || loan.peminjam?.email || 'Pengguna'}
                          </div>
                          <div className="text-[#5B6166]">
                            {loan.peminjam?.jabatan ? `${loan.peminjam.jabatan}` : ''}
                            {loan.peminjam?.nomor_pegawai ? ` • NIP: ${loan.peminjam.nomor_pegawai}` : ''}
                          </div>
                          <div className="text-[10px] text-[#8C9399]">
                            {loan.peminjam?.email}
                          </div>
                        </td>

                        {/* Kolom Keperluan */}
                        <td className="p-3 align-top text-xs text-[#1A1D21] max-w-xs">
                          <p className="line-clamp-3 leading-relaxed">{loan.keperluan}</p>
                        </td>

                        {/* Kolom Tanggal Pinjam & Kembali */}
                        <td className="p-3 align-top font-mono text-[11px] text-[#5B6166] space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#8C9399] uppercase w-12">Pinjam:</span>
                            <span className="font-semibold text-[#1A1D21]">
                              {loan.tanggal_pinjam
                                ? new Date(loan.tanggal_pinjam).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#8C9399] uppercase w-12">Kembali:</span>
                            <span className={loan.tanggal_kembali ? 'font-semibold text-emerald-700' : 'text-[#8C9399]'}>
                              {loan.tanggal_kembali
                                ? new Date(loan.tanggal_kembali).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'Belum kembali'}
                            </span>
                          </div>
                          {loan.pic_inaktif && (
                            <div className="text-[10px] text-[#8C9399] pt-1">
                              PIC: {loan.pic_inaktif.nama_lengkap || loan.pic_inaktif.email}
                            </div>
                          )}
                        </td>

                        {/* Kolom Status Badge */}
                        <td className="p-3 align-top text-center">
                          {loan.status === 'Diajukan' && (
                            <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-600 font-mono font-bold text-[10px]">
                              DIAJUKAN
                            </span>
                          )}
                          {loan.status === 'Dipinjam' && (
                            <span className="inline-block px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-600 font-mono font-bold text-[10px]">
                              DIPINJAM
                            </span>
                          )}
                          {loan.status === 'Dikembalikan' && (
                            <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-600 font-mono font-bold text-[10px]">
                              DIKEMBALIKAN
                            </span>
                          )}
                          {loan.status === 'Ditolak' && (
                            <span className="inline-block px-2.5 py-1 bg-red-50 text-red-800 border border-red-600 font-mono font-bold text-[10px]">
                              DITOLAK
                            </span>
                          )}
                        </td>

                        {/* Kolom Aksi */}
                        <td className="p-3 align-top text-center font-mono text-xs">
                          <div className="flex flex-col items-center gap-1.5">
                            {/* Tindakan PIC: Setujui / Tolak saat Diajukan */}
                            {loan.status === 'Diajukan' && isPicOrAdmin && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleApproveLoan(loan.id)}
                                  disabled={processingId === loan.id}
                                  className="px-2.5 py-1 bg-[#1F5C55] hover:bg-[#184843] text-white font-semibold text-[11px] flex items-center gap-1 disabled:opacity-50"
                                >
                                  {processingId === loan.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  <span>Setujui</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectingLoan(loan)}
                                  disabled={processingId === loan.id}
                                  className="px-2.5 py-1 bg-white border border-red-700 hover:bg-red-50 text-red-700 font-semibold text-[11px] disabled:opacity-50"
                                >
                                  Tolak
                                </button>
                              </div>
                            )}

                            {/* Tindakan Pengembalian saat status Dipinjam */}
                            {loan.status === 'Dipinjam' && (isPicOrAdmin || isBorrower) && (
                              <button
                                type="button"
                                onClick={() => handleReturnLoan(loan.id)}
                                disabled={processingId === loan.id}
                                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] flex items-center gap-1 disabled:opacity-50"
                              >
                                {processingId === loan.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                <span>{isPicOrAdmin ? 'Konfirmasi Kembali' : 'Kembalikan Berkas'}</span>
                              </button>
                            )}

                            {/* Status Selesai / Ditolak */}
                            {(loan.status === 'Dikembalikan' || loan.status === 'Ditolak') && (
                              <span className="text-[#8C9399] text-[11px] italic">
                                Selesai
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL AJUKAN PEMINJAMAN ================= */}
      {isAjukanModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => !submittingAjukan && setIsAjukanModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white border-2 border-[#1E2429] shadow-2xl p-6 space-y-4 font-sans text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#D8D2C4] pb-3">
              <h3 className="font-serif font-bold text-lg text-[#1A1D21]">
                Formulir Pengajuan Peminjaman Dokumen Inaktif
              </h3>
              <p className="font-mono text-xs text-[#5B6166] mt-0.5">
                Sesuai ketentuan Blueprint 3.6: Dokumen tetap berstatus Inaktif dan berada di Gudang Inaktif.
              </p>
            </div>

            <form onSubmit={handleAjukanSubmit} className="space-y-4">
              <div>
                <label className="block font-mono font-bold text-[#1A1D21] mb-1">
                  PILIH DOKUMEN INAKTIF <span className="text-red-600">*</span>
                </label>
                {inactiveDocs.length === 0 ? (
                  <p className="p-3 bg-[#F7F3EB] border border-[#D8D2C4] font-mono text-xs text-[#5B6166]">
                    Tidak ada dokumen dengan status Inaktif yang tersedia saat ini.
                  </p>
                ) : (
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    required
                    className="w-full p-2 border border-[#D8D2C4] font-mono text-xs text-[#1A1D21] bg-white focus:outline-hidden focus:border-[#1E2429]"
                  >
                    <option value="">-- Pilih Dokumen Inaktif --</option>
                    {inactiveDocs.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.kode_arsip} — {doc.judul} ({doc.lokasi_saat_ini || 'Gudang Inaktif'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-mono font-bold text-[#1A1D21] mb-1">
                  KEPERLUAN PEMINJAMAN <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={keperluan}
                  onChange={(e) => setKeperluan(e.target.value)}
                  required
                  rows={4}
                  placeholder="Jelaskan kebutuhan operasional peminjaman dokumen inaktif ini..."
                  className="w-full p-2.5 border border-[#D8D2C4] font-sans text-xs text-[#1A1D21] focus:outline-hidden focus:border-[#1E2429]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8D2C4]">
                <button
                  type="button"
                  disabled={submittingAjukan}
                  onClick={() => setIsAjukanModalOpen(false)}
                  className="px-4 py-2 border border-[#D8D2C4] text-[#1A1D21] hover:bg-[#F7F3EB] font-mono font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAjukan || inactiveDocs.length === 0}
                  className="px-5 py-2 bg-[#1F5C55] hover:bg-[#184843] text-white font-mono font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingAjukan ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BookOpenCheck className="w-4 h-4" />
                  )}
                  <span>Kirim Pengajuan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL TOLAK PEMINJAMAN ================= */}
      {rejectingLoan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => !submittingReject && setRejectingLoan(null)}
        >
          <div
            className="w-full max-w-md bg-white border-2 border-red-700 shadow-2xl p-6 space-y-4 font-sans text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#D8D2C4] pb-3">
              <h3 className="font-serif font-bold text-lg text-red-900">
                Tolak Pengajuan Peminjaman
              </h3>
              <p className="font-mono text-xs text-[#5B6166] mt-0.5">
                Dokumen: <strong>{rejectingLoan.dokumen?.kode_arsip}</strong>
              </p>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block font-mono font-bold text-[#1A1D21] mb-1">
                  ALASAN PENOLAKAN
                </label>
                <textarea
                  value={alasanTolak}
                  onChange={(e) => setAlasanTolak(e.target.value)}
                  rows={3}
                  placeholder="Tuliskan alasan penolakan pengajuan peminjaman ini..."
                  className="w-full p-2.5 border border-[#D8D2C4] font-sans text-xs text-[#1A1D21] focus:outline-hidden focus:border-red-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8D2C4]">
                <button
                  type="button"
                  disabled={submittingReject}
                  onClick={() => setRejectingLoan(null)}
                  className="px-4 py-2 border border-[#D8D2C4] text-[#1A1D21] hover:bg-[#F7F3EB] font-mono font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReject}
                  className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white font-mono font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingReject ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  <span>Tolak Pengajuan</span>
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
          <div className="p-12 text-center font-mono text-xs text-[#5B6166]">
            Memuat modul peminjaman arsip...
          </div>
        </AppLayout>
      }
    >
      <PeminjamanContent />
    </Suspense>
  )
}

