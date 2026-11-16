'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useMemo, useEffect, useCallback, useRef } from 'react'
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
  Package,
  Layers,
  Building,
  BarChart3,
  Calendar,
  Warehouse,
  AlarmClock,
  CheckCircle2,
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
  created_at: string | null
  tanggal_kadaluarsa: string | null
  boks_id: string | null
  boks_ids?: string[]
  jumlah_halaman: number
}

interface BoksItem {
  id: string
  nomor_boks: string
  status: string
  jumlah_lembar_terisi: number
  kapasitas_maks_lembar: number
  rak_id: string
}

interface LokasiItem {
  id: string
  nama: string
  tingkat: 'Gedung' | 'Ruangan' | 'Rak'
  parent_id: string | null
}

interface RakOccupancy {
  rakId: string
  rakNama: string
  ruanganNama: string
  gedungNama: string
  totalBoks: number
  totalLembar: number
  kapasitasMaksLembar: number
  persenTerpakai: number
}

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
  subtitle,
  value,
  trend,
  trendUp,
  note,
  href,
  unitLabel,
}: {
  title: string
  subtitle?: string
  value: string
  trend: string
  trendUp: boolean
  note: string
  href: string
  unitLabel?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <span className="block text-sm text-[#4B5163] font-medium">{title}</span>
            {subtitle && <span className="block text-[11px] text-[#9AA0B2]">{subtitle}</span>}
          </div>
          {unitLabel && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#F4F5FA] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#6B7185]">
              {unitLabel}
            </span>
          )}
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
        <span>Lihat Rincian</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
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
    const dash = (d.pct / 100) * circumference
    const offset = -before * circumference
    return { ...d, dash, offset }
  })

  return (
    <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 flex flex-col items-center">
      <h3 className="text-sm font-semibold text-[#1F2333] self-start">Distribusi Kategori Dokumen</h3>
      <div className="relative mt-4 flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          <circle cx={cx} cy={cx} r={r} fill="transparent" stroke="#F4F5FA" strokeWidth={stroke} />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={cx}
              cy={cx}
              r={r}
              fill="transparent"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={s.offset}
            />
          ))}
        </svg>
        <div className="absolute text-center">
          <span className="text-2xl font-bold text-[#1F2333]">{documents.length}</span>
          <span className="block text-[11px] text-[#8A90A2]">Berkas</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-[#4B5163]">
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
  const { name, role: userRole } = useAppUser()
  const firstName = name.split(' ')[0] || name

  const [supabase] = useState(() => createClient())
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [boksList, setBoksList] = useState<BoksItem[]>([])
  const [lokasiList, setLokasiList] = useState<LokasiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Toggle satuan metrik: berkas vs boks
  const [unitMode, setUnitMode] = useState<'berkas' | 'boks'>('berkas')

  // Filter status dokumen menyesuaikan role pengguna (M8)
  // PIC/Atasan Aktif default 'aktif', PIC/Atasan Inaktif default 'inaktif'
  const defaultStatusFilter = useMemo<'semua' | DocStatus>(() => {
    if (userRole === 'pic_inaktif' || userRole === 'atasan_inaktif') return 'inaktif'
    if (userRole === 'pic_aktif' || userRole === 'atasan_aktif') return 'aktif'
    return 'semua'
  }, [userRole])

  const [statusFilter, setStatusFilter] = useState<'semua' | DocStatus>(defaultStatusFilter)
  const [filterOpen, setFilterOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [isLive, setIsLive] = useState(false)

  // Rentang Tren Tahunan
  const [trendTahun, setTrendTahun] = useState<number>(new Date().getFullYear())

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser()
      if (authErr || !user) {
        setErrorMsg('Anda belum masuk. Silakan masuk terlebih dahulu untuk melihat dasbor.')
        setLoading(false)
        return
      }

      // Ambil dokumen
      const { data: docData, error: docError } = await supabase
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
          boks_id,
          jumlah_halaman,
          kategori_dokumen ( nama ),
          dokumen_boks ( boks_id ),
          pemegang:profiles!dokumen_pemegang_saat_ini_fkey ( nama_lengkap, email ),
          pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email )
        `)
        .order('created_at', { ascending: false })

      if (docError) throw docError

      // Ambil boks
      const { data: boksData, error: boksError } = await supabase
        .from('boks')
        .select('id, nomor_boks, status, jumlah_lembar_terisi, kapasitas_maks_lembar, rak_id')

      if (boksError) console.error('Error boks:', boksError)

      // Ambil lokasi
      const { data: lokData, error: lokError } = await supabase
        .from('lokasi')
        .select('id, nama, tingkat, parent_id')

      if (lokError) console.error('Error lokasi:', lokError)

      setBoksList(boksData || [])
      setLokasiList(lokData || [])

      const mapped: DocumentItem[] = (docData || []).map((d: any) => {
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
          d.pemegang?.nama_lengkap || d.pemegang?.email || d.pemilik?.nama_lengkap || d.pemilik?.email || 'PIC Unit'

        const boksIds: string[] = []
        if (Array.isArray(d.dokumen_boks) && d.dokumen_boks.length > 0) {
          d.dokumen_boks.forEach((item: any) => {
            if (item.boks_id) boksIds.push(item.boks_id)
          })
        }
        if (boksIds.length === 0 && d.boks_id) {
          boksIds.push(d.boks_id)
        }

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
          created_at: d.created_at || null,
          tanggal_kadaluarsa: d.tanggal_kadaluarsa || null,
          boks_id: d.boks_id || (boksIds[0] || null),
          boks_ids: boksIds,
          jumlah_halaman: d.jumlah_halaman || 1,
        }
      })

      setDocuments(mapped)
      setErrorMsg(null)
    } catch (err) {
      console.error('Gagal memuat dashboard:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data dari Supabase live.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()

    let debounce: ReturnType<typeof setTimeout> | undefined
    const reloadSoon = () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => loadData(), 400)
    }

    const channel = supabase
      .channel('dashboard-dokumen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dokumen' }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boks' }, reloadSoon)
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'))

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadData()
    }, 30_000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') loadData()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(debounce)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [supabase, loadData])

  // Hitung jumlah boks unik yang diasosiasikan dengan dokumen tertentu (M9 multi-boks support)
  const countBoxesForDocs = useCallback(
    (docList: DocumentItem[]) => {
      const boksIds = new Set<string>()
      docList.forEach((d) => {
        if (d.boks_ids && d.boks_ids.length > 0) {
          d.boks_ids.forEach((bid) => boksIds.add(bid))
        } else if (d.boks_id) {
          boksIds.add(d.boks_id)
        }
      })
      return boksIds.size
    },
    []
  )

  // Metrik Berkas & Boks
  const docsAktif = useMemo(() => documents.filter((d) => d.status === 'aktif'), [documents])
  const docsMenunggu = useMemo(() => documents.filter((d) => d.status === 'menunggu_persetujuan'), [documents])
  const docsAkanKadaluarsa = useMemo(
    () => documents.filter((d) => d.status === 'aktif' && d.sisa_hari !== null && d.sisa_hari < 90),
    [documents]
  )
  const docsInaktif = useMemo(() => documents.filter((d) => d.status === 'inaktif'), [documents])

  const totalAktif = docsAktif.length
  const totalAktifBoks = countBoxesForDocs(docsAktif)

  const totalMenunggu = docsMenunggu.length
  const totalMenungguBoks = countBoxesForDocs(docsMenunggu)

  const totalAkanKadaluarsa = docsAkanKadaluarsa.length
  const totalAkanKadaluarsaBoks = countBoxesForDocs(docsAkanKadaluarsa)

  const totalInaktif = docsInaktif.length
  const totalInaktifBoks = countBoxesForDocs(docsInaktif)

  // Hitung Okupansi / Kapasitas per Ruangan & Rak
  const rakOccupancyList: RakOccupancy[] = useMemo(() => {
    if (lokasiList.length === 0) return []

    const lokasiMap = new Map<string, LokasiItem>(lokasiList.map((l) => [l.id, l]))
    const raks = lokasiList.filter((l) => l.tingkat === 'Rak')

    return raks.map((rak) => {
      const ruangan = rak.parent_id ? lokasiMap.get(rak.parent_id) : undefined
      const gedung = ruangan?.parent_id ? lokasiMap.get(ruangan.parent_id) : undefined

      const boksDiRak = boksList.filter((b) => b.rak_id === rak.id)
      const totalLembar = boksDiRak.reduce((sum, b) => sum + (b.jumlah_lembar_terisi || 0), 0)
      const kapasitasMaks = boksDiRak.reduce((sum, b) => sum + (Number(b.kapasitas_maks_lembar) || 0), 0)
      const persen = kapasitasMaks > 0 ? Math.min(100, Math.round((totalLembar / kapasitasMaks) * 100)) : 0

      return {
        rakId: rak.id,
        rakNama: rak.nama,
        ruanganNama: ruangan?.nama || 'Ruangan Arsip',
        gedungNama: gedung?.nama || 'Gedung Utama',
        totalBoks: boksDiRak.length,
        totalLembar,
        kapasitasMaksLembar: kapasitasMaks,
        persenTerpakai: persen,
      }
    })
  }, [lokasiList, boksList])

  // Tren Arsip Tahunan (M8: Per tahun berkas dan boks yang masuk)
  const trenTahunanData = useMemo(() => {
    const yearsMap = new Map<number, { berkasMasuk: number; boksMasuk: Set<string>; inaktifBerkas: number }>()
    const currentYr = new Date().getFullYear()
    for (let yr = currentYr - 3; yr <= currentYr; yr++) {
      yearsMap.set(yr, { berkasMasuk: 0, boksMasuk: new Set(), inaktifBerkas: 0 })
    }

    documents.forEach((d) => {
      if (d.created_at) {
        const y = new Date(d.created_at).getFullYear()
        if (yearsMap.has(y)) {
          const entry = yearsMap.get(y)!
          entry.berkasMasuk += 1
          if (d.boks_ids && d.boks_ids.length > 0) {
            d.boks_ids.forEach((bid) => entry.boksMasuk.add(bid))
          } else if (d.boks_id) {
            entry.boksMasuk.add(d.boks_id)
          }
        }
      }
      if (d.status === 'inaktif' && d.tanggal_kadaluarsa) {
        const y = new Date(d.tanggal_kadaluarsa).getFullYear()
        if (yearsMap.has(y)) {
          yearsMap.get(y)!.inaktifBerkas += 1
        }
      }
    })

    return Array.from(yearsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([tahun, val]) => ({
        tahun: tahun.toString(),
        berkas: val.berkasMasuk,
        boks: val.boksMasuk.size,
        inaktif: val.inaktifBerkas,
      }))
  }, [documents])

  const maxTren = useMemo(() => {
    const vals = trenTahunanData.map((t) => (unitMode === 'berkas' ? t.berkas : t.boks))
    const highest = Math.max(...vals, 1)
    return Math.ceil(highest * 1.25)
  }, [trenTahunanData, unitMode])

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
        <p className="text-sm font-medium">Memuat ringkasan dasbor kearsipan...</p>
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

      {/* Alert Kedaluwarsa Gabungan Berkas & Boks (M8) */}
      {totalAkanKadaluarsa > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#FEEFC3] bg-[#FEF7E0] p-4 text-[#B06000] shadow-xs">
          <div className="flex items-start gap-3">
            <AlarmClock className="h-5 w-5 shrink-0 mt-0.5 text-[#E37400]" />
            <div>
              <p className="font-bold text-sm text-[#8C4600]">
                Peringatan Siklus Retensi: {totalAkanKadaluarsa} Berkas ({totalAkanKadaluarsaBoks} Boks) Mendekati / Lewat Masa Aktif
              </p>
              <p className="text-xs text-[#B06000] mt-0.5">
                Dokumen telah melewati atau mendekati ambang batas retensi (H-90, H-30, H-7). Lakukan transfer manual ke Gudang Inaktif atau tunggu pemindahan berkas otomatis via cron harian.
              </p>
            </div>
          </div>
          {(userRole === 'pic_aktif' || userRole === 'superadmin') && (
            <Link
              href="/transfer-arsip"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E37400] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#C96400] transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              <span>Transfer Dokumen</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Header sapaan + Toggle Satuan (Berkas / Boks) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#1F2333] tracking-tight">Halo, {firstName}!</h1>
          <p className="mt-1 text-sm text-[#4B5163]">
            Ringkasan dasbor kearsipan instansi • Mode peran:{' '}
            <span className="font-semibold text-[#1E86C8] capitalize">{userRole.replace('_', ' ')}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle Satuan Boks vs Berkas (M8) */}
          <div className="flex items-center rounded-lg border border-[#D5D9E2] bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setUnitMode('berkas')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                unitMode === 'berkas'
                  ? 'bg-[#3BA4E8] text-white shadow-xs'
                  : 'text-[#6B7185] hover:text-[#1F2333]'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Berkas / Lembar</span>
            </button>
            <button
              type="button"
              onClick={() => setUnitMode('boks')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                unitMode === 'boks'
                  ? 'bg-[#3BA4E8] text-white shadow-xs'
                  : 'text-[#6B7185] hover:text-[#1F2333]'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Satuan Boks Fisik</span>
            </button>
          </div>

          {/* Filter Status */}
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
              Status: <span className="capitalize">{statusFilter}</span>
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
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      statusFilter === opt.id ? 'bg-[#EEF7FD] text-[#1E86C8] font-semibold' : 'text-[#4B5163] hover:bg-[#F7F8FC]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export / Aksi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setExportOpen((v) => !v)
                setFilterOpen(false)
              }}
              className="flex items-center gap-2 rounded-lg border border-[#1F2333] bg-white px-4 py-2 text-sm font-medium text-[#1F2333] hover:bg-[#F7F8FC] transition-colors"
            >
              <span>Ekspor</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-lg border border-[#ECEEF5] bg-white p-1.5 shadow-lg z-30">
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

      {/* Kartu statistik 4 kuadran */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <StatCard
            title="Arsip Aktif"
            unitLabel={unitMode === 'berkas' ? 'Berkas' : 'Boks'}
            value={unitMode === 'berkas' ? `${totalAktif} berkas` : `${totalAktifBoks} boks`}
            trend="+20,1%"
            trendUp
            note="unit pengolah aktif"
            href="/dokumen"
          />
          <StatCard
            title="Antrean Persetujuan"
            unitLabel={unitMode === 'berkas' ? 'Berkas' : 'Boks'}
            value={unitMode === 'berkas' ? `${totalMenunggu} berkas` : `${totalMenungguBoks} boks`}
            trend="+10,6%"
            trendUp
            note="perlu verifikasi"
            href="/persetujuan"
          />
          <StatCard
            title="Akan Kedaluwarsa"
            subtitle="< 90 hari retensi"
            unitLabel={unitMode === 'berkas' ? 'Berkas' : 'Boks'}
            value={unitMode === 'berkas' ? `${totalAkanKadaluarsa} berkas` : `${totalAkanKadaluarsaBoks} boks`}
            trend="-10%"
            trendUp={false}
            note="siap transfer inaktif"
            href="/transfer-arsip"
          />
          <StatCard
            title="Gudang Inaktif"
            unitLabel={unitMode === 'berkas' ? 'Berkas' : 'Boks'}
            value={unitMode === 'berkas' ? `${totalInaktif} berkas` : `${totalInaktifBoks} boks`}
            trend="+12%"
            trendUp
            note="dapat dipinjam"
            href="/peminjaman"
          />
        </div>

        {/* Grafik Tren Arsip Tahunan (M8) */}
        <div className="xl:col-span-6 bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1F2333]">
                Tren Arsip Tahunan ({unitMode === 'berkas' ? 'Jumlah Berkas' : 'Alokasi Boks'})
              </h2>
              <p className="text-[11px] text-[#8A90A2]">
                Pertumbuhan volume arsip masuk vs berpindah inaktif per tahun
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E86C8] bg-[#EEF7FD] px-2.5 py-1 rounded-md">
              <BarChart3 className="h-3.5 w-3.5" />
              Satuan: {unitMode === 'berkas' ? 'Berkas' : 'Boks'}
            </span>
          </div>

          <div className="mt-6 flex-1 flex flex-col justify-end min-h-[190px]">
            <div className="flex items-end justify-around gap-4 h-40 border-b border-[#ECEEF5] pb-2">
              {trenTahunanData.map((item) => {
                const val = unitMode === 'berkas' ? item.berkas : item.boks
                const heightPct = Math.min(100, Math.max(10, Math.round((val / maxTren) * 100)))

                return (
                  <div key={item.tahun} className="flex flex-col items-center gap-2 flex-1 max-w-[80px]">
                    <div className="w-full flex items-end justify-center gap-1.5 h-32">
                      {/* Bar Arsip Masuk */}
                      <div
                        className="w-5 sm:w-6 rounded-t-md bg-[#3BA4E8] transition-all duration-300 relative group flex items-start justify-center"
                        style={{ height: `${heightPct}%` }}
                      >
                        <span className="absolute -top-6 text-[10px] font-bold text-[#1F2333] opacity-0 group-hover:opacity-100 transition-opacity">
                          {val}
                        </span>
                      </div>
                      {/* Bar Inaktif */}
                      <div
                        className="w-3 sm:w-4 rounded-t-md bg-[#BFE2F8] transition-all duration-300 relative group flex items-start justify-center"
                        style={{ height: `${Math.min(100, Math.max(6, Math.round((item.inaktif / maxTren) * 100)))}%` }}
                      >
                        <span className="absolute -top-6 text-[9px] font-medium text-[#6B7185] opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.inaktif}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#4B5163]">{item.tahun}</span>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 flex items-center justify-center gap-5 text-xs text-[#6B7185]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#3BA4E8]" /> Arsip Masuk ({unitMode === 'berkas' ? 'Berkas' : 'Boks'})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#BFE2F8]" /> Beralih ke Inaktif
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Okupansi & Kapasitas per Ruangan & Rak (M8) */}
      <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ECEEF5] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#1F2333] flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-[#3BA4E8]" />
              Okupansi &amp; Kapasitas Ruangan &amp; Rak Arsip
            </h2>
            <p className="text-xs text-[#6B7185] mt-0.5">
              Pemantauan keterisian fisik lembar dan boks per rak penyimpanan sesuai kapasitas maksimal standar 500 lembar per boks.
            </p>
          </div>
          <span className="text-xs text-[#8A90A2]">
            Total Rak Aktif: <strong>{rakOccupancyList.length} rak</strong>
          </span>
        </div>

        {rakOccupancyList.length === 0 ? (
          <p className="text-xs text-[#8A90A2] py-4 text-center">Belum ada master rak terdaftar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rakOccupancyList.map((rak) => {
              // Styling status kapasitas
              let progressColor = 'bg-[#3BA4E8]'
              let badgeColor = 'text-[#1E86C8] bg-[#EEF7FD]'
              if (rak.persenTerpakai >= 90) {
                progressColor = 'bg-[#D64545]'
                badgeColor = 'text-[#D64545] bg-[#FFF5F5]'
              } else if (rak.persenTerpakai >= 70) {
                progressColor = 'bg-[#F29900]'
                badgeColor = 'text-[#B06000] bg-[#FEF7E0]'
              }

              return (
                <div
                  key={rak.rakId}
                  className="rounded-xl border border-[#ECEEF5] bg-[#F7F8FC] p-4 flex flex-col justify-between gap-3 hover:border-[#3BA4E8]/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1F2333]">{rak.rakNama}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${badgeColor}`}>
                        {rak.persenTerpakai}% Penuh
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B7185]">
                      {rak.gedungNama} &bull; {rak.ruanganNama}
                    </p>
                  </div>

                  {/* Progress Bar Okupansi */}
                  <div className="space-y-1.5">
                    <div className="h-2 w-full rounded-full bg-[#E5E7EB] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${progressColor} transition-all duration-500`}
                        style={{ width: `${rak.persenTerpakai}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#6B7185]">
                      <span>{rak.totalBoks} Boks Terisi</span>
                      <span>
                        {rak.totalLembar} / {rak.kapasitasMaksLembar} lbr
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Aktivitas terbaru + donut kategori */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1F2333]">Daftar Dokumen Sesuai Peran</h2>
            <span className="text-xs text-[#8A90A2]">
              Filter: <strong className="text-[#1F2333] capitalize">{statusFilter}</strong>
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-[#4B5163] border-b border-[#ECEEF5]">
                  <th className="pb-3 font-semibold">Dokumen</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Kode Arsip SIG</th>
                  <th className="pb-3 font-semibold">Waktu</th>
                  <th className="pb-3 font-semibold text-right">Ukuran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-[#8A90A2]">
                      Tidak ada dokumen untuk filter status ini.
                    </td>
                  </tr>
                ) : (
                  activities.slice(0, 8).map((doc) => (
                    <tr key={doc.id} className="align-middle hover:bg-[#F7F8FC] transition-colors">
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
                      <td className="py-2.5 pr-4 min-w-[120px] max-w-[180px] text-[#4B5163]">
                        <KodeArsip kode={doc.kode_arsip} prefix="#" className="block font-mono text-xs" />
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap text-xs text-[#4B5163]">{doc.waktu}</td>
                      <td className="py-2.5 whitespace-nowrap text-right text-xs text-[#4B5163]">{doc.ukuran_file}</td>
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

/** Dasbor statistik kearsipan padat informasi: antrean, retensi aktif, boks, dan okupansi ruangan/rak */
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#6B7185]">Memuat dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
