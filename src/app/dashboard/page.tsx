'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { AppLayout, useAppUser } from '@/components/layout/app-layout'
import { UserRole, DokumenStatus } from '@/types'
import { StampBadge } from '@/components/ui/stamp-badge'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  MoreHorizontal,
  ChevronDown,
  SlidersHorizontal,
  FileText,
  Printer,
  Upload,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

type DocStatus = DokumenStatus

interface DocumentItem {
  id: string
  kode_arsip: string
  judul: string
  nomor_surat: string
  kategori: string
  status: DocStatus
  pemegang: string
  waktu: string
  sisa_hari: number | null
  ukuran_file: string
}

// Arsip masuk vs berpindah ke inaktif per bulan (6 bulan terakhir)
const monthlyArchive = [
  { bulan: 'JUN', label: 'Jun 2026', masuk: 102, inaktif: 44 },
  { bulan: 'JUL', label: 'Jul 2026', masuk: 141, inaktif: 62 },
  { bulan: 'AGU', label: 'Agu 2026', masuk: 120, inaktif: 70 },
  { bulan: 'SEP', label: 'Sep 2026', masuk: 168, inaktif: 59 },
  { bulan: 'OKT', label: 'Okt 2026', masuk: 74, inaktif: 41 },
  { bulan: 'NOV', label: 'Nov 2026', masuk: 115, inaktif: 68 },
]

const statusPill: Record<DocStatus, { label: string; className: string }> = {
  aktif: { label: 'Aktif', className: 'bg-[#E7F6EC] text-[#2F9E5B]' },
  menunggu_persetujuan: { label: 'Menunggu', className: 'bg-[#FFF4DE] text-[#C98A1B]' },
  inaktif: { label: 'Inaktif', className: 'bg-[#EEF0F4] text-[#6B7185]' },
  ditolak: { label: 'Ditolak', className: 'bg-[#FDECEC] text-[#D64545]' },
  dibatalkan: { label: 'Dibatalkan', className: 'bg-[#FDECEC] text-[#800000]' },
}

const DONUT_COLORS = ['#3BA4E8', '#86C8F2', '#C4E4FA', '#E6F3FD']

// ============================================================
// KOMPONEN KECIL
// ============================================================
function StatCard({
  title,
  value,
  trend,
  trendUp,
  note,
  href,
}: {
  title: string
  value: string
  trend: string
  trendUp: boolean
  note: string
  href: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#4B5163]">{title}</span>
          <button type="button" className="text-[#8A90A2] hover:text-[#1F2333]" aria-label="Opsi">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-3 text-[26px] font-bold text-[#1F2333] tracking-tight">{value}</p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className={`flex items-center gap-0.5 font-medium ${trendUp ? 'text-[#2F9E5B]' : 'text-[#D64545]'}`}>
            {trendUp ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            {trend}
          </span>
          <span className="text-[#6B7185]">{note}</span>
        </div>
      </div>
      <Link
        href={href}
        className="px-5 py-3 bg-[#F7F8FC] border-t border-[#ECEEF5] flex items-center justify-between text-sm text-[#4B5163] hover:text-[#1E86C8] transition-colors"
      >
        <span>Lihat Laporan</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

function ArchiveBarChart() {
  const [hovered, setHovered] = useState<number | null>(3)
  const max = 200
  const ticks = [200, 150, 100, 50, 0]
  const totalMasuk = monthlyArchive.reduce((s, m) => s + m.masuk, 0)

  return (
    <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1F2333]">Arsip Masuk</h2>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md bg-[#F4F5FA] px-3 py-1.5 text-xs text-[#4B5163]"
        >
          6 Bulan <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-bold text-[#1F2333]">{totalMasuk.toLocaleString('id-ID')} berkas</span>
          <span className="ml-2 inline-flex items-center text-xs text-[#2F9E5B]">
            <ArrowUp className="w-3 h-3" />
            +10%
          </span>
        </p>
        <div className="flex items-center gap-4 text-xs text-[#6B7185]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3BA4E8]" /> Masuk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#BFE2F8]" /> Non-Aktif
          </span>
        </div>
      </div>

      <div className="mt-4 flex-1 flex gap-3 min-h-[220px]">
        {/* Sumbu Y */}
        <div className="flex flex-col justify-between text-[11px] text-[#6B7185] pb-6 w-7 text-right">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        {/* Area grafik */}
        <div className="relative flex-1">
          <div className="absolute inset-0 bottom-6 flex flex-col justify-between pointer-events-none">
            {ticks.map((t) => (
              <div key={t} className="border-t border-dashed border-[#E6E8F0]" />
            ))}
          </div>

          <div className="absolute inset-0 flex items-stretch justify-around">
            {monthlyArchive.map((m, i) => (
              <div
                key={m.bulan}
                className="relative flex flex-col items-center flex-1"
                onMouseEnter={() => setHovered(i)}
              >
                <div className="relative flex-1 w-full flex items-end justify-center gap-1.5 pb-0">
                  {hovered === i && (
                    <div
                      className="absolute z-10 -translate-x-1/2 left-1/2 rounded-md border border-[#ECEEF5] bg-white px-2.5 py-1.5 shadow-md whitespace-nowrap"
                      style={{ bottom: `calc(${(m.masuk / max) * 100}% + 8px)` }}
                    >
                      <p className="text-[10px] text-[#8A90A2]">{m.label}</p>
                      <p className="text-xs font-bold text-[#1F2333]">{m.masuk} berkas</p>
                    </div>
                  )}
                  <div
                    className="w-3 sm:w-4 rounded-t-[4px] bg-[#3BA4E8] transition-opacity"
                    style={{ height: `${(m.masuk / max) * 100}%`, opacity: hovered === null || hovered === i ? 1 : 0.85 }}
                  />
                  <div
                    className="w-3 sm:w-4 rounded-t-[4px] bg-[#BFE2F8]"
                    style={{ height: `${(m.inaktif / max) * 100}%` }}
                  />
                </div>
                <span className="h-6 flex items-end text-[11px] text-[#6B7185]">{m.bulan}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoryDonut({ documents }: { documents: DocumentItem[] }) {
  const data = useMemo(() => {
    if (documents.length === 0) return []
    const counts = new Map<string, number>()
    documents.forEach((d) => counts.set(d.kategori, (counts.get(d.kategori) || 0) + 1))
    const total = documents.length
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count], i) => ({ label, count, pct: Math.round((count / total) * 100), color: DONUT_COLORS[i % DONUT_COLORS.length] }))
  }, [documents])

  const size = 200
  const cx = size / 2
  const r = 70
  const stroke = 34
  const circumference = 2 * Math.PI * r
  const segments = data.map((d, i) => {
    const before = data.slice(0, i).reduce((s, x) => s + x.pct / 100, 0)
    return { ...d, dash: (d.pct / 100) * circumference, offset: before * circumference, start: before }
  })

  return (
    <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1F2333]">Kategori Arsip</h2>
        <span className="text-xs text-[#8A90A2]">{documents.length} Dokumen</span>
      </div>

      <div className="flex-1 flex items-center justify-center py-4">
        {data.length === 0 ? (
          <p className="text-xs text-[#8A90A2]">Belum ada arsip untuk ditampilkan</p>
        ) : (
          <svg viewBox={`-40 -10 ${size + 80} ${size + 20}`} className="w-full max-w-[280px]">
            <g transform={`rotate(-90 ${cx} ${cx})`}>
              {segments.map((s) => (
                <circle
                  key={s.label}
                  cx={cx}
                  cy={cx}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                  strokeDashoffset={-s.offset}
                />
              ))}
            </g>
            {segments.map((s) => {
              const mid = (s.start + s.pct / 200) * 2 * Math.PI - Math.PI / 2
              const x1 = cx + Math.cos(mid) * (r + stroke / 2)
              const y1 = cx + Math.sin(mid) * (r + stroke / 2)
              const x2 = cx + Math.cos(mid) * (r + stroke / 2 + 14)
              const y2 = cx + Math.sin(mid) * (r + stroke / 2 + 14)
              const right = Math.cos(mid) >= 0
              const x3 = x2 + (right ? 10 : -10)
              return (
                <g key={`label-${s.label}`}>
                  <polyline points={`${x1},${y1} ${x2},${y2} ${x3},${y2}`} fill="none" stroke="#9AA0B2" strokeWidth={0.8} />
                  <text
                    x={x3 + (right ? 3 : -3)}
                    y={y2 + 4}
                    textAnchor={right ? 'start' : 'end'}
                    className="fill-[#4B5163]"
                    fontSize={11}
                  >
                    {s.pct}%
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-[#4B5163]">
        {data.map((d) => (
          <span key={d.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.label} ({d.count})
          </span>
        ))}
      </div>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .replace(/\(.*\)/, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

// ============================================================
// HALAMAN DASHBOARD
// ============================================================
function DashboardBody() {
  const { name } = useAppUser()
  const firstName = name.split(' ')[0] || name

  const [supabase] = useState(() => createClient())
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'semua' | DocStatus>('semua')
  const [filterOpen, setFilterOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
          setErrorMsg('Anda belum masuk. Silakan masuk terlebih dahulu untuk melihat dasbor.')
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('dokumen')
          .select(`
            id,
            kode_arsip,
            nomor_dokumen,
            judul,
            status,
            ukuran_file,
            created_at,
            tanggal_kadaluarsa,
            kategori_dokumen ( nama ),
            pemegang:profiles!dokumen_pemegang_saat_ini_fkey ( nama_lengkap, email ),
            pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email )
          `)
          .order('created_at', { ascending: false })

        if (error) throw error

        const mapped: DocumentItem[] = (data || []).map((d: any) => {
          const diff = d.tanggal_kadaluarsa
            ? Math.max(0, Math.ceil((new Date(d.tanggal_kadaluarsa).getTime() - Date.now()) / 86_400_000))
            : null
          const bytes = d.ukuran_file
          let sizeStr = '-'
          if (bytes) {
            sizeStr = bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
          }

          let waktuStr = 'Baru saja'
          if (d.created_at) {
            const msDiff = Date.now() - new Date(d.created_at).getTime()
            const mins = Math.floor(msDiff / 60000)
            const hours = Math.floor(mins / 60)
            const days = Math.floor(hours / 24)
            if (mins < 60) waktuStr = `${Math.max(1, mins)} mnt lalu`
            else if (hours < 24) waktuStr = `${hours} jam lalu`
            else if (days === 1) waktuStr = 'Kemarin'
            else waktuStr = `${days} hari lalu`
          }

          const pemegangNama =
            d.pemegang?.nama_lengkap || d.pemegang?.email || d.pemilik?.nama_lengkap || d.pemilik?.email || 'Pengaju'

          return {
            id: d.id,
            kode_arsip: d.kode_arsip,
            judul: d.judul,
            nomor_surat: d.nomor_dokumen || '-',
            kategori: d.kategori_dokumen?.nama || 'Keuangan',
            status: d.status as DocStatus,
            pemegang: pemegangNama,
            waktu: waktuStr,
            sisa_hari: diff,
            ukuran_file: sizeStr,
          }
        })

        setDocuments(mapped)
      } catch (err) {
        console.error('Gagal memuat dashboard:', err)
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data dari Supabase live.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  const totalAktif = documents.filter((d) => d.status === 'aktif').length
  const totalMenunggu = documents.filter((d) => d.status === 'menunggu_persetujuan').length
  const totalKritis = documents.filter((d) => d.status === 'aktif' && d.sisa_hari !== null && d.sisa_hari < 90).length
  const totalInaktif = documents.filter((d) => d.status === 'inaktif').length

  const activities = useMemo(
    () => documents.filter((d) => statusFilter === 'semua' || d.status === statusFilter),
    [documents, statusFilter]
  )

  const filterOptions: { id: 'semua' | DocStatus; label: string }[] = [
    { id: 'semua', label: 'Semua Status' },
    { id: 'aktif', label: 'Aktif' },
    { id: 'menunggu_persetujuan', label: 'Menunggu Persetujuan' },
    { id: 'inaktif', label: 'Inaktif' },
    { id: 'ditolak', label: 'Ditolak' },
    { id: 'dibatalkan', label: 'Dibatalkan' },
  ]

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-16 flex flex-col items-center justify-center gap-3 text-[#6B7185]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3BA4E8]" />
        <p className="text-sm font-medium">Memuat ringkasan arsip dokumen...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-[#FDECEC] bg-[#FFF5F5] px-4 py-3 text-sm text-[#D64545]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Koneksi Supabase Gagal / Belum Masuk</p>
            <p className="mt-0.5">{errorMsg}</p>
            <Link href="/login" className="mt-2 inline-flex items-center text-xs font-semibold text-[#1E86C8] hover:underline">
              Masuk ke Akun Anda &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Header sapaan */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#1F2333] tracking-tight">Halo, {firstName}!</h1>
          <p className="mt-1 text-sm text-[#4B5163]">Berikut ringkasan arsip dokumen Anda</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setFilterOpen((v) => !v)
                setExportOpen(false)
              }}
              className="flex items-center gap-2 rounded-lg border border-[#1F2333] bg-white px-4 py-2 text-sm font-medium text-[#1F2333] hover:bg-[#F7F8FC] transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filter
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[#ECEEF5] bg-white p-1.5 shadow-lg z-30">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(opt.id)
                      setFilterOpen(false)
                    }}
                    className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm text-[#4B5163] hover:bg-[#EEF7FD]"
                  >
                    {opt.label}
                    {statusFilter === opt.id && <Check className="w-4 h-4 text-[#3BA4E8]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ekspor */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setExportOpen((v) => !v)
                setFilterOpen(false)
              }}
              className="flex items-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-medium text-white shadow-sm shadow-[#3BA4E8]/30 hover:bg-[#2A92D6] transition-colors"
            >
              <FileText className="w-4 h-4" />
              Ekspor
              <ChevronDown className="w-4 h-4" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[#ECEEF5] bg-white p-1.5 shadow-lg z-30">
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false)
                    window.print()
                  }}
                  className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#4B5163] hover:bg-[#EEF7FD]"
                >
                  <Printer className="w-4 h-4" /> Cetak Ringkasan
                </button>
                <Link
                  href="/dokumen/upload"
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#4B5163] hover:bg-[#EEF7FD]"
                >
                  <Upload className="w-4 h-4" /> Unggah Berkas Baru
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kartu statistik + grafik batang */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <StatCard title="Arsip Aktif" value={`${totalAktif} berkas`} trend="+20,1%" trendUp note="+2 bulan ini" href="/dokumen" />
          <StatCard title="Antrean Persetujuan" value={`${totalMenunggu} berkas`} trend="+10,6%" trendUp note="+1 hari ini" href="/persetujuan" />
          <StatCard title="Kedaluwarsa < 90 Hari" value={`${totalKritis} berkas`} trend="-10%" trendUp={false} note="H-42 terdekat" href="/dokumen" />
          <StatCard title="Gudang Inaktif" value={`${totalInaktif} berkas`} trend="+12%" trendUp note="dapat dipinjam" href="/dokumen" />
        </div>
        <div className="xl:col-span-6">
          <ArchiveBarChart />
        </div>
      </div>

      {/* Aktivitas terbaru + donut kategori */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1F2333]">Aktivitas Terbaru</h2>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md bg-[#F4F5FA] px-3 py-1.5 text-xs text-[#4B5163]"
            >
              24 Jam Terakhir <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-[#4B5163]">
                  <th className="pb-3 font-normal">Dokumen</th>
                  <th className="pb-3 font-normal">Status</th>
                  <th className="pb-3 font-normal">Kode Arsip</th>
                  <th className="pb-3 font-normal">Waktu</th>
                  <th className="pb-3 font-normal text-right">Ukuran</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-[#8A90A2]">
                      Tidak ada aktivitas untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  activities.map((doc) => (
                    <tr key={doc.id} className="align-middle">
                      <td className="py-2.5 pr-4">
                        <Link href={`/dokumen/${doc.id}`} className="flex items-center gap-3 group">
                          <span className="w-9 h-9 shrink-0 rounded-full bg-[#EAF5FD] text-[#1E86C8] text-xs font-semibold flex items-center justify-center">
                            {getInitials(doc.pemegang)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-[#1F2333] group-hover:text-[#1E86C8] truncate max-w-[260px]">
                              {doc.judul}
                            </span>
                            <span className="block text-xs text-[#8A90A2] truncate max-w-[260px]">
                              {doc.pemegang} • {doc.kategori}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${statusPill[doc.status].className}`}>
                          {statusPill[doc.status].label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 min-w-[120px] max-w-[180px] text-[#4B5163]"><KodeArsip kode={doc.kode_arsip} prefix="#" className="block" /></td>
                      <td className="py-2.5 pr-4 whitespace-nowrap text-[#4B5163]">{doc.waktu}</td>
                      <td className="py-2.5 whitespace-nowrap text-right text-[#4B5163]">{doc.ukuran_file}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-4">
          <CategoryDonut documents={documents} />
        </div>
      </div>
    </div>
  )
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('demo_role') as UserRole | null

  return (
    <AppLayout currentRole={roleParam || undefined}>
      <DashboardBody />
    </AppLayout>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#6B7185]">Memuat dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
