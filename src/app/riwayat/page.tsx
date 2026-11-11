'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/client'
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  FileText,
  RefreshCw,
  Loader2,
  Clock,
  ArrowUpDown,
  Tag,
  ShieldAlert,
} from 'lucide-react'

interface LogEntry {
  id: string
  dokumen_id?: string
  user_id?: string
  aksi: string
  keterangan: string
  created_at: string
  dokumen?: {
    id: string
    kode_arsip: string
    judul: string
    status: string
  }
  user?: {
    id: string
    nama_lengkap?: string
    email?: string
    role?: string
    jabatan?: string
  }
}

interface DocOption {
  id: string
  kode_arsip: string
  judul: string
}

interface UserOption {
  id: string
  nama_lengkap: string
  email: string
  role: string
}

const aksiLabels: Record<string, { label: string; className: string }> = {
  upload: { label: 'Upload', className: 'bg-[#EEF7FD] text-[#0284C7] border-[#BAE6FD]' },
  verifikasi: { label: 'Verifikasi PIC', className: 'bg-[#FFF4DE] text-[#C98A1B] border-[#FDE68A]' },
  approve: { label: 'Approve Atasan', className: 'bg-[#E7F6EC] text-[#2F9E5B] border-[#BBF7D0]' },
  tolak: { label: 'Ditolak', className: 'bg-[#FDECEC] text-[#D64545] border-[#FECACA]' },
  download: { label: 'Download', className: 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]' },
  pindah_inaktif: { label: 'Pindah Inaktif', className: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]' },
  peminjaman: { label: 'Peminjaman', className: 'bg-[#FDF4FF] text-[#A21CAF] border-[#F5D0FE]' },
  serah_terima: { label: 'Serah Terima', className: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]' },
  pembatalan: { label: 'Pembatalan', className: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]' },
}

export default function RiwayatPage() {
  const [supabase] = useState(() => createClient())

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [docOptions, setDocOptions] = useState<DocOption[]>([])
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filter State
  const [selectedDokumenId, setSelectedDokumenId] = useState<string>('semua')
  const [selectedUserId, setSelectedUserId] = useState<string>('semua')
  const [selectedAksi, setSelectedAksi] = useState<string>('semua')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Load Data Dokumen & User untuk Pilihan Filter
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [{ data: docs }, { data: users }] = await Promise.all([
          supabase.from('dokumen').select('id, kode_arsip, judul').order('kode_arsip', { ascending: false }),
          supabase.from('profiles').select('id, nama_lengkap, email, role').order('nama_lengkap', { ascending: true }),
        ])
        if (docs) setDocOptions(docs)
        if (users) setUserOptions(users)
      } catch (err) {
        console.error('Error loading filter options:', err)
      }
    }
    loadFilterOptions()
  }, [supabase])

  // Load Logs dari API
  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedDokumenId !== 'semua') params.set('dokumen_id', selectedDokumenId)
      if (selectedUserId !== 'semua') params.set('user_id', selectedUserId)
      if (selectedAksi !== 'semua') params.set('aksi', selectedAksi)
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
      if (searchQuery.trim()) params.set('q', searchQuery.trim())

      const res = await fetch(`/api/riwayat?${params.toString()}`)
      const data = await res.json()
      if (data.data) {
        setLogs(data.data)
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedDokumenId, selectedUserId, selectedAksi, startDate, endDate, searchQuery])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Format Tanggal Indonesia
  const formatTanggalWIB = (iso: string) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' WIB'
  }

  // Ekspor Log ke CSV
  const handleExportCsv = () => {
    const headers = ['Waktu (WIB)', 'Aksi', 'Kode Arsip', 'Judul Dokumen', 'Pelaku', 'Role Pelaku', 'Keterangan']
    const rows = logs.map((l) => [
      formatTanggalWIB(l.created_at),
      l.aksi,
      l.dokumen?.kode_arsip || '-',
      l.dokumen?.judul || '-',
      l.user?.nama_lengkap || l.user?.email || 'Sistem',
      l.user?.role || '-',
      l.keterangan || '-',
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buku-log-riwayat-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Reset Semua Filter
  const handleResetFilter = () => {
    setSelectedDokumenId('semua')
    setSelectedUserId('semua')
    setSelectedAksi('semua')
    setStartDate('')
    setEndDate('')
    setSearchQuery('')
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Header Halaman */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <History className="h-6 w-6 text-[#1E3A5F]" />
              <h1 className="text-2xl font-serif font-bold tracking-tight text-[#111827] sm:text-3xl">
                Buku Log Riwayat & Jejak Audit
              </h1>
            </div>
            <p className="text-sm text-[#4B5E76]">
              Seluruh peristiwa dan aktivitas kearsipan tercatat secara permanen, terenkripsi, dan tidak dapat dimanipulasi sesuai standar kearsipan instansi.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-[#1E3A5F] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E3A5F] hover:bg-[#EEF7FD] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Ekspor Log (CSV)</span>
            </button>
            <button
              type="button"
              onClick={fetchLogs}
              className="flex items-center gap-1.5 rounded-lg border border-[#CBD7E3] bg-white px-3.5 py-2 text-xs font-medium text-[#1E3A5F] hover:bg-[#F8FAFC] transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Panel Filter Terpadu */}
        <div className="rounded-xl border border-[#CBD7E3] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#CBD7E3] pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#1E3A5F]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#1E3A5F]">
                Filter & Penelusuran Riwayat
              </h2>
            </div>
            {(selectedDokumenId !== 'semua' || selectedUserId !== 'semua' || selectedAksi !== 'semua' || startDate || endDate || searchQuery) && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="text-xs text-[#1E3A5F] hover:underline"
              >
                Reset Semua Filter
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Filter Per Dokumen */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#64748B] mb-1" htmlFor="filterDokumen">
                Riwayat Per Dokumen
              </label>
              <select
                id="filterDokumen"
                value={selectedDokumenId}
                onChange={(e) => setSelectedDokumenId(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#111827]"
              >
                <option value="semua">Semua Dokumen</option>
                {docOptions.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.kode_arsip} — {doc.judul.slice(0, 30)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Per Pengguna */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#64748B] mb-1" htmlFor="filterUser">
                Riwayat Per Pengguna
              </label>
              <select
                id="filterUser"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#111827]"
              >
                <option value="semua">Semua Pengguna</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama_lengkap} ({u.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Jenis Aksi */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#64748B] mb-1" htmlFor="filterAksi">
                Jenis Aksi / Peristiwa
              </label>
              <select
                id="filterAksi"
                value={selectedAksi}
                onChange={(e) => setSelectedAksi(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#111827]"
              >
                <option value="semua">Semua Jenis Aksi</option>
                <option value="upload">Upload (Pengajuan Baru)</option>
                <option value="verifikasi">Verifikasi Tahap 1 (PIC Arsip)</option>
                <option value="approve">Approve Akhir (Atasan)</option>
                <option value="tolak">Ditolak (PIC / Atasan)</option>
                <option value="download">Download Berkas</option>
                <option value="pindah_inaktif">Pindah ke Inaktif (Cron)</option>
                <option value="peminjaman">Peminjaman Inaktif</option>
                <option value="serah_terima">Serah Terima Fisik</option>
                <option value="pembatalan">Pembatalan Dokumen Aktif</option>
              </select>
            </div>

            {/* Pencarian Kata Kunci */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#64748B] mb-1" htmlFor="searchQ">
                Cari di Keterangan
              </label>
              <div className="relative">
                <input
                  id="searchQ"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik kata kunci..."
                  className="w-full h-10 pl-3 pr-8 text-xs bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#111827]"
                />
                <Search className="h-3.5 w-3.5 text-[#94A3B8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Rentang Waktu */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <span className="text-[#64748B] font-medium">Rentang Tanggal:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 px-2.5 bg-[#F8FAFC] border border-[#CBD7E3] rounded-md text-xs text-[#111827]"
              />
              <span className="text-[#94A3B8]">s.d.</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 px-2.5 bg-[#F8FAFC] border border-[#CBD7E3] rounded-md text-xs text-[#111827]"
              />
            </div>
            <span className="ml-auto text-xs text-[#64748B]">
              Ditemukan <strong>{logs.length}</strong> catatan riwayat
            </span>
          </div>
        </div>

        {/* Tabel Rekaman Buku Log */}
        <div className="rounded-xl border border-[#CBD7E3] bg-white shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-[#64748B] flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
              <span>Memuat buku log riwayat...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#64748B]">
              <History className="mx-auto h-10 w-10 text-[#CBD7E3] mb-2" />
              <p className="font-semibold text-sm text-[#111827]">Tidak Ada Catatan Riwayat</p>
              <p className="mt-0.5">Tidak ada peristiwa yang cocok dengan kriteria filter yang Anda pilih.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#CBD7E3] bg-[#F8FAFC] text-[#1E3A5F] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 whitespace-nowrap">Waktu</th>
                    <th className="py-3 px-4">Dokumen Terkait</th>
                    <th className="py-3 px-4">Jenis Aksi</th>
                    <th className="py-3 px-4">Pelaku / Pengguna</th>
                    <th className="py-3 px-4 min-w-[280px]">Keterangan Aktivitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {logs.map((log) => {
                    const badge = aksiLabels[log.aksi] || {
                      label: log.aksi,
                      className: 'bg-[#F8FAFC] text-[#1E3A5F] border-[#CBD7E3]',
                    }
                    return (
                      <tr key={log.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-[#64748B]">
                          {formatTanggalWIB(log.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          {log.dokumen ? (
                            <div>
                              <Link
                                href={`/dokumen/${log.dokumen.id}`}
                                className="font-mono font-bold text-[#1E3A5F] hover:underline block"
                              >
                                {log.dokumen.kode_arsip}
                              </Link>
                              <span className="text-[11px] text-[#4B5E76] line-clamp-1">
                                {log.dokumen.judul}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#94A3B8] italic">Aktivitas Sistem / Master</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.user ? (
                            <div>
                              <span className="font-medium text-[#111827] block">
                                {log.user.nama_lengkap || log.user.email}
                              </span>
                              <span className="text-[10px] text-[#64748B]">
                                {log.user.jabatan || log.user.role?.toUpperCase()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#64748B] italic">Sistem Otomatis (Cron)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#334155] leading-relaxed">
                          {log.keterangan}
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
    </AppLayout>
  )
}

