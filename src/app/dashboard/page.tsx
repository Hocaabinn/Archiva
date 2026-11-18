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
  Plus,
  Send,
  RotateCcw,
  Clock,
  AlertCircle,
  FileEdit,
  ExternalLink,
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
  tanggal_dokumen: string | null
  tanggal_kadaluarsa: string | null
  lokasi_saat_ini: string
  alasan_penolakan: string | null
  unit_id: string | null
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
  const [inaktifDocuments, setInaktifDocuments] = useState<DocumentItem[]>([])
  const [boksList, setBoksList] = useState<BoksItem[]>([])
  const [lokasiList, setLokasiList] = useState<LokasiItem[]>([])
  const [userUnitName, setUserUnitName] = useState<string>('Departemen Keuangan')
  const [userFullName, setUserFullName] = useState<string>(name || 'PIC Arsip')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Toggle satuan metrik: berkas/lembar vs boks
  const [unitMode, setUnitMode] = useState<'berkas' | 'boks'>('berkas')

  // Tab Tindakan Prioritas (Priority Action Table)
  const [priorityTab, setPriorityTab] = useState<'ditolak' | 'siap_transfer'>('ditolak')

  // Filter status dokumen untuk tabel umum
  const defaultStatusFilter = useMemo<'semua' | DocStatus>(() => {
    if (userRole === 'pic_inaktif' || userRole === 'atasan_inaktif') return 'inaktif'
    if (userRole === 'pic_aktif' || userRole === 'atasan_aktif') return 'aktif'
    return 'semua'
  }, [userRole])

  const [statusFilter, setStatusFilter] = useState<'semua' | DocStatus>(defaultStatusFilter)
  const [filterOpen, setFilterOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [isLive, setIsLive] = useState(false)

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

      // Ambil profil pengguna & unit organisasi
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          id,
          nama_lengkap,
          email,
          role,
          unit_id,
          unit_organisasi:unit_id ( id, nama, kode_perusahaan )
        `)
        .eq('id', user.id)
        .single()

      const unitNama = (profile?.unit_organisasi as any)?.nama || 'Departemen Keuangan'
      setUserUnitName(unitNama)
      setUserFullName(profile?.nama_lengkap || profile?.email || name || 'PIC Arsip Aktif')

      // 1. Ambil dokumen milik unit PIC (atau semua jika superadmin)
      let docQuery = supabase
        .from('dokumen')
        .select(`
          id,
          kode_arsip,
          nomor_dokumen,
          judul,
          status,
          ukuran_file,
          created_at,
          tanggal_dokumen,
          tanggal_kadaluarsa,
          boks_id,
          unit_id,
          lokasi_saat_ini,
          alasan_penolakan,
          jumlah_halaman,
          kategori_dokumen ( nama ),
          dokumen_boks ( boks_id ),
          pemegang:profiles!dokumen_pemegang_saat_ini_fkey ( nama_lengkap, email ),
          pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email )
        `)
        .order('created_at', { ascending: false })

      // RLS per unit organisasi PIC Aktif
      if (profile?.role === 'pic_aktif' || profile?.role === 'atasan_aktif') {
        if (profile?.unit_id) {
          docQuery = docQuery.or(`unit_id.eq.${profile.unit_id},pemilik_id.eq.${user.id}`)
        } else {
          docQuery = docQuery.eq('pemilik_id', user.id)
        }
      }

      const { data: docData, error: docError } = await docQuery
      if (docError) throw docError

      // 2. Ambil dokumen Inaktif untuk Card 4 ("Gudang Inaktif") sebagai referensi peminjaman
      const { data: inaktifData } = await supabase
        .from('dokumen')
        .select(`
          id,
          kode_arsip,
          nomor_dokumen,
          judul,
          status,
          boks_id,
          jumlah_halaman,
          dokumen_boks ( boks_id )
        `)
        .eq('status', 'inaktif')

      // 3. Ambil boks
      const { data: boksData, error: boksError } = await supabase
        .from('boks')
        .select('id, nomor_boks, status, jumlah_lembar_terisi, kapasitas_maks_lembar, rak_id')

      if (boksError) console.error('Error boks:', boksError)

      // 4. Ambil lokasi
      const { data: lokData, error: lokError } = await supabase
        .from('lokasi')
        .select('id, nama, tingkat, parent_id')

      if (lokError) console.error('Error lokasi:', lokError)

      setBoksList(boksData || [])
      setLokasiList(lokData || [])

      const mapDocItem = (d: any): DocumentItem => {
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
          tanggal_dokumen: d.tanggal_dokumen || null,
          tanggal_kadaluarsa: d.tanggal_kadaluarsa || null,
          lokasi_saat_ini: d.lokasi_saat_ini || 'Ruang Arsip Aktif',
          alasan_penolakan: d.alasan_penolakan || null,
          unit_id: d.unit_id || null,
          boks_id: d.boks_id || (boksIds[0] || null),
          boks_ids: boksIds,
          jumlah_halaman: d.jumlah_halaman || 1,
        }
      }

      setDocuments((docData || []).map(mapDocItem))
      setInaktifDocuments((inaktifData || []).map(mapDocItem))
      setErrorMsg(null)
    } catch (err) {
      console.error('Gagal memuat dashboard:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data dari Supabase live.')
    } finally {
      setLoading(false)
    }
  }, [supabase, name])

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

  // Helper boks unik
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

  // Metrik 4 Kartu Ringkasan
  const docsAktif = useMemo(() => documents.filter((d) => d.status === 'aktif'), [documents])
  const docsMenunggu = useMemo(() => documents.filter((d) => d.status === 'menunggu_persetujuan'), [documents])
  const docsAkanKadaluarsa = useMemo(
    () => documents.filter((d) => d.status === 'aktif' && d.sisa_hari !== null && d.sisa_hari <= 90),
    [documents]
  )
  const docsDitolak = useMemo(() => documents.filter((d) => d.status === 'ditolak'), [documents])

  const totalAktif = docsAktif.length
  const totalAktifBoks = countBoxesForDocs(docsAktif)

  const totalMenunggu = docsMenunggu.length
  const totalMenungguBoks = countBoxesForDocs(docsMenunggu)

  const totalAkanKadaluarsa = docsAkanKadaluarsa.length
  const totalAkanKadaluarsaBoks = countBoxesForDocs(docsAkanKadaluarsa)

  // Card 4: Dokumen Inaktif dari Record Center
  const totalInaktif = inaktifDocuments.length
  const totalInaktifBoks = countBoxesForDocs(inaktifDocuments)

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
      const kapasitasMaks = boksDiRak.reduce((sum, b) => sum + (Number(b.kapasitas_maks_lembar) || 500), 0)
      const persen = kapasitasMaks > 0 ? Math.min(100, Math.round((totalLembar / kapasitasMaks) * 100)) : 0

      return {
        rakId: rak.id,
        rakNama: rak.nama,
        ruanganNama: ruangan?.nama || 'Ruang Arsip Aktif',
        gedungNama: gedung?.nama || 'Gedung Utama',
        totalBoks: boksDiRak.length,
        totalLembar,
        kapasitasMaksLembar: kapasitasMaks,
        persenTerpakai: persen,
      }
    })
  }, [lokasiList, boksList])

  // Tren Arsip Tahunan
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
    return Math.ceil(highest * 1.3)
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

      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-[#ECEEF5] shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#3BA4E8]/30 bg-[#F0F8FF] px-3 py-1 text-xs font-semibold text-[#1E86C8] mb-2">
            <Layers className="h-3.5 w-3.5" />
            Dashboard Arsip Aktif
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2333]">
            Halo, {userFullName}!
          </h1>
          <p className="text-sm text-[#4B5163] mt-0.5 flex items-center gap-2">
            <span>Unit Pengolah: <strong>{userUnitName}</strong></span>
            <span className="text-[#8A90A2]">•</span>
            <span className="capitalize text-[#1E86C8] font-medium">{userRole.replace('_', ' ')}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Switcher Satuan: Berkas/Lembar vs Boks */}
          <div className="flex items-center rounded-xl border border-[#D5D9E2] bg-[#F7F8FC] p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setUnitMode('berkas')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                unitMode === 'berkas'
                  ? 'bg-[#3BA4E8] text-white shadow-xs'
                  : 'text-[#6B7185] hover:text-[#1F2333]'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Tampilkan Berkas / Lembar</span>
            </button>
            <button
              type="button"
              onClick={() => setUnitMode('boks')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                unitMode === 'boks'
                  ? 'bg-[#3BA4E8] text-white shadow-xs'
                  : 'text-[#6B7185] hover:text-[#1F2333]'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Tampilkan Satuan Boks</span>
            </button>
          </div>

          {/* Tombol Sekunder: Transfer Dokumen */}
          <Link
            href="/transfer-dokumen"
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5D9E2] bg-white px-4 py-2 text-xs font-semibold text-[#1F2333] shadow-2xs hover:bg-[#F7F8FC] transition-colors"
          >
            <Send className="h-3.5 w-3.5 text-[#3BA4E8]" />
            <span>Transfer Dokumen</span>
          </Link>

          {/* Tombol Primer: + Entri Dokumen Baru */}
          <Link
            href="/dokumen/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-[#3BA4E8] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#2A93D7] transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>+ Entri Dokumen Baru</span>
          </Link>
        </div>
      </div>

      {/* Alert Kedaluwarsa Gabungan */}
      {totalAkanKadaluarsa > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#FEEFC3] bg-[#FEF7E0] p-4 text-[#B06000] shadow-xs">
          <div className="flex items-start gap-3">
            <AlarmClock className="h-5 w-5 shrink-0 mt-0.5 text-[#E37400]" />
            <div>
              <p className="font-bold text-sm text-[#8C4600]">
                Peringatan Siklus Retensi: {totalAkanKadaluarsa} Berkas ({totalAkanKadaluarsaBoks} Boks) Mendekati / Lewat Masa Aktif 3 Tahun
              </p>
              <p className="text-xs text-[#B06000] mt-0.5">
                Segera terbitkan Berita Acara Penyerahan Arsip (BAST) untuk diserahkan ke Gudang Inaktif.
              </p>
            </div>
          </div>
          <Link
            href="/transfer-dokumen"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#E37400] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#C96400] transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <span>Transfer Dokumen Sekarang</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* 2. Kartu Ringkasan (Metric Cards) 4 Kuadran */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Arsip Aktif */}
        <StatCard
          title="Arsip Aktif"
          subtitle={`Unit ${userUnitName}`}
          unitLabel={unitMode === 'berkas' ? 'Berkas' : 'Boks'}
          value={unitMode === 'berkas' ? `${totalAktif} berkas` : `${totalAktifBoks} boks`}
          trend="+18%"
          trendUp
          note="tersimpan di unit"
          href="/dokumen?status=aktif"
        />

        {/* Card 2: Menunggu Persetujuan */}
        <StatCard
          title="Menunggu Persetujuan"
          subtitle="Ditinjau Atasan Aktif"
          unitLabel={unitMode === 'berkas' ? 'Berkas' : 'Boks'}
          value={unitMode === 'berkas' ? `${totalMenunggu} berkas` : `${totalMenungguBoks} boks`}
          trend="+5%"
          trendUp
          note="antrean verifikasi"
          href="/dokumen?status=menunggu_persetujuan"
        />

        {/* Card 3: Akan Kedaluwarsa (< 90 Hari) */}
        <StatCard
          title="Akan Kedaluwarsa (< 90 Hari)"
          subtitle="Batas Retensi Aktif 3 Thn"
          unitLabel={unitMode === 'berkas' ? 'Berkas' : 'Boks'}
          value={unitMode === 'berkas' ? `${totalAkanKadaluarsa} berkas` : `${totalAkanKadaluarsaBoks} boks`}
          trend={totalAkanKadaluarsa > 0 ? "Perlu Transfer" : "Aman"}
          trendUp={totalAkanKadaluarsa === 0}
          note="siap transfer inaktif"
          href="/transfer-dokumen"
        />

        {/* Card 4: Gudang Inaktif */}
        <StatCard
          title="Gudang Inaktif"
          subtitle="Record Center"
          unitLabel={unitMode === 'berkas' ? 'Berkas' : 'Boks'}
          value={unitMode === 'berkas' ? `${totalInaktif} berkas` : `${totalInaktifBoks} boks`}
          trend="Tersedia"
          trendUp
          note="referensi peminjaman"
          href="/peminjaman"
        />
      </div>

      {/* 3. Grafik Tren Arsip Tahunan + Donut Kategori */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Grafik Tren Tahunan */}
        <div className="xl:col-span-8 bg-white rounded-xl border border-[#ECEEF5] shadow-xs p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ECEEF5] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1F2333] flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#3BA4E8]" />
                Grafik Tren Arsip Tahunan
              </h2>
              <p className="text-xs text-[#6B7185] mt-0.5">
                Perkembangan arsip masuk unit {userUnitName} dari tahun ke tahun ({unitMode === 'berkas' ? 'Satuan Berkas/Lembar' : 'Satuan Boks'}).
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E86C8] bg-[#EEF7FD] px-3 py-1 rounded-lg">
              Satuan: {unitMode === 'berkas' ? 'Berkas' : 'Boks'}
            </span>
          </div>

          <div className="mt-6 flex-1 flex flex-col justify-end min-h-[220px]">
            <div className="flex items-end justify-around gap-4 h-48 border-b border-[#ECEEF5] pb-3">
              {trenTahunanData.map((item) => {
                const val = unitMode === 'berkas' ? item.berkas : item.boks
                const heightPct = Math.min(100, Math.max(12, Math.round((val / maxTren) * 100)))

                return (
                  <div key={item.tahun} className="flex flex-col items-center gap-2 flex-1 max-w-[100px]">
                    <div className="w-full flex items-end justify-center gap-2 h-40">
                      {/* Bar Arsip Masuk Unit */}
                      <div
                        className="w-7 sm:w-8 rounded-t-md bg-[#3BA4E8] transition-all duration-300 relative group flex items-start justify-center cursor-pointer shadow-2xs hover:bg-[#2A93D7]"
                        style={{ height: `${heightPct}%` }}
                      >
                        <span className="absolute -top-7 text-xs font-bold text-[#1F2333] bg-white border border-[#D5D9E2] px-1.5 py-0.5 rounded shadow-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {val} {unitMode === 'berkas' ? 'berkas' : 'boks'}
                        </span>
                      </div>
                      {/* Bar Inaktif */}
                      <div
                        className="w-4 sm:w-5 rounded-t-md bg-[#BFE2F8] transition-all duration-300 relative group flex items-start justify-center cursor-pointer"
                        style={{ height: `${Math.min(100, Math.max(8, Math.round((item.inaktif / maxTren) * 100)))}%` }}
                      >
                        <span className="absolute -top-7 text-[10px] font-semibold text-[#6B7185] bg-white border border-[#D5D9E2] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          {item.inaktif}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#4B5163]">{item.tahun}</span>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-[#6B7185]">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-sm bg-[#3BA4E8]" /> Arsip Masuk ({unitMode === 'berkas' ? 'Berkas' : 'Boks'})
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-sm bg-[#BFE2F8]" /> Beralih ke Inaktif
              </span>
            </div>
          </div>
        </div>

        {/* Donut Kategori */}
        <div className="xl:col-span-4">
          <CategoryDonut documents={documents} />
        </div>
      </div>

      {/* 4. Widget Okupansi Rak Fisik Aktif */}
      <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ECEEF5] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#1F2333] flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-[#3BA4E8]" />
              Okupansi Rak Fisik Aktif (Ruang Arsip Aktif)
            </h2>
            <p className="text-xs text-[#6B7185] mt-0.5">
              Keterisian fisik rak di Ruang Arsip Aktif unit. Standar kapasitas maksimal 500 lembar per boks.
            </p>
          </div>
          <span className="text-xs text-[#8A90A2]">
            Total: <strong>{rakOccupancyList.length} rak</strong>
          </span>
        </div>

        {/* Peringatan Kapasitas Melebihi 80% */}
        {(() => {
          const raksOver80 = rakOccupancyList.filter((r) => r.persenTerpakai >= 80)
          if (raksOver80.length === 0) return null
          return (
            <div className="flex items-start gap-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-xs text-[#991B1B] shadow-2xs">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-[#DC2626]" />
              <div className="space-y-0.5">
                <p className="font-bold text-[#B91C1C]">
                  Peringatan Kapasitas (Keterisian &ge; 80%): Terdapat {raksOver80.length} rak yang hampir penuh!
                </p>
                <p className="text-[11px] text-[#7F1D1D]">
                  Lokasi:{' '}
                  <strong>
                    {raksOver80
                      .map((r) => `${r.rakNama} (${r.ruanganNama} — ${r.persenTerpakai}%)`)
                      .join(', ')}
                  </strong>
                  . Segera persiapkan penambahan boks baru atau alokasikan dokumen ke rak yang masih kosong.
                </p>
              </div>
            </div>
          )
        })()}

        {rakOccupancyList.length === 0 ? (
          <p className="text-xs text-[#8A90A2] py-4 text-center">Belum ada master rak terdaftar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rakOccupancyList.map((rak) => {
              // Indikator visual sesuai spesifikasi:
              // hijau jika < 75%, kuning jika 75-89%, merah/alert jika >= 90%
              let progressColor = 'bg-[#2F9E5B]' // hijau < 75%
              let badgeColor = 'text-[#2F9E5B] bg-[#E7F6EC]'
              const isAlert90 = rak.persenTerpakai >= 90
              const isWarn75 = rak.persenTerpakai >= 75 && rak.persenTerpakai < 90

              if (isAlert90) {
                progressColor = 'bg-[#D64545]' // merah >= 90%
                badgeColor = 'text-[#D64545] bg-[#FDECEC] border border-[#FECACA]'
              } else if (isWarn75) {
                progressColor = 'bg-[#E37400]' // kuning/oranye 75-89%
                badgeColor = 'text-[#B06000] bg-[#FEF7E0] border border-[#FEEFC3]'
              }

              return (
                <div
                  key={rak.rakId}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                    isAlert90
                      ? 'border-[#FCA5A5] bg-[#FFF8F8] hover:border-[#F87171]'
                      : isWarn75
                      ? 'border-[#FEEFC3] bg-[#FFFCF5] hover:border-[#F29900]/40'
                      : 'border-[#ECEEF5] bg-[#F7F8FC] hover:border-[#3BA4E8]/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {isAlert90 && <AlertTriangle className="h-3.5 w-3.5 text-[#DC2626] shrink-0" />}
                        <span className={`text-xs font-bold ${isAlert90 ? 'text-[#991B1B]' : 'text-[#1F2333]'}`}>
                          {rak.rakNama}
                        </span>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${badgeColor}`}>
                        {rak.persenTerpakai}% Kapasitas
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
                      <span>{rak.totalBoks} Boks Aktif</span>
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

      {/* 5. Tabel Tindakan Prioritas (Priority Action Table) */}
      <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ECEEF5] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#1F2333] flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[#E37400]" />
              Tabel Tindakan Prioritas
            </h2>
            <p className="text-xs text-[#6B7185] mt-0.5">
              Daftar dokumen yang memerlukan perhatian segera oleh PIC Arsip Aktif: perbaikan berkas ditolak &amp; berkas siap transfer.
            </p>
          </div>

          {/* Tab Switcher: Perlu Perbaikan (Ditolak) vs Siap Transfer (Expired) */}
          <div className="inline-flex rounded-xl bg-[#F0F2F7] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPriorityTab('ditolak')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all ${
                priorityTab === 'ditolak'
                  ? 'bg-white text-[#D64545] shadow-xs'
                  : 'text-[#6B7185] hover:text-[#1F2333]'
              }`}
            >
              <span>Perlu Perbaikan (Ditolak)</span>
              {docsDitolak.length > 0 && (
                <span className="rounded-full bg-[#FDECEC] text-[#D64545] px-1.5 py-0.2 text-[10px] font-bold">
                  {docsDitolak.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPriorityTab('siap_transfer')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all ${
                priorityTab === 'siap_transfer'
                  ? 'bg-white text-[#E37400] shadow-xs'
                  : 'text-[#6B7185] hover:text-[#1F2333]'
              }`}
            >
              <span>Siap Transfer (Expired)</span>
              {docsAkanKadaluarsa.length > 0 && (
                <span className="rounded-full bg-[#FEF7E0] text-[#B06000] px-1.5 py-0.2 text-[10px] font-bold">
                  {docsAkanKadaluarsa.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Isi Tab 1: Perlu Perbaikan (Ditolak) */}
        {priorityTab === 'ditolak' && (
          <div className="overflow-x-auto">
            {docsDitolak.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8A90A2] space-y-1">
                <CheckCircle2 className="h-8 w-8 mx-auto text-[#2F9E5B] stroke-[1.5]" />
                <p className="font-semibold text-[#1F2333]">Tidak Ada Berkas Ditolak</p>
                <p>Seluruh berkas yang diajukan dalam kondisi baik atau telah disetujui Atasan Aktif.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-[#4B5163] border-b border-[#ECEEF5] bg-[#F7F8FC]">
                    <th className="py-2.5 px-3 font-semibold">Kode Arsip &amp; Judul</th>
                    <th className="py-2.5 px-3 font-semibold">Kategori &amp; Lembar</th>
                    <th className="py-2.5 px-3 font-semibold">Waktu Penolakan</th>
                    <th className="py-2.5 px-3 font-semibold">Alasan Penolakan</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEEF5]">
                  {docsDitolak.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#F7F8FC] transition-colors">
                      <td className="py-3 px-3">
                        <KodeArsip kode={doc.kode_arsip} className="text-xs" />
                        <p className="font-semibold text-[#1F2333] line-clamp-1 mt-0.5">{doc.judul}</p>
                        <p className="text-xs text-[#6B7185]">No. Dok: <span className="font-mono">{doc.nomor_surat}</span></p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block rounded bg-[#EEF0F4] px-2 py-0.5 text-xs text-[#4B5163]">
                          {doc.kategori}
                        </span>
                        <p className="text-xs text-[#8A90A2] mt-0.5">{doc.jumlah_halaman} lembar</p>
                      </td>
                      <td className="py-3 px-3 text-xs text-[#4B5163]">
                        {doc.waktu}
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="rounded-lg border border-[#FAD2CF] bg-[#FDECEC] p-2 text-xs text-[#D64545]">
                          <strong className="block text-[11px] uppercase tracking-wider">Catatan Atasan:</strong>
                          <p className="line-clamp-2 mt-0.5">{doc.alasan_penolakan || 'Perlu perbaikan metadata / lampiran berkas.'}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href={`/dokumen/${doc.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#3BA4E8] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2A93D7] transition-all shadow-2xs"
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                          <span>Revisi &amp; Ajukan Ulang</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Isi Tab 2: Siap Transfer (Expired) */}
        {priorityTab === 'siap_transfer' && (
          <div className="overflow-x-auto">
            {docsAkanKadaluarsa.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8A90A2] space-y-1">
                <CheckCircle2 className="h-8 w-8 mx-auto text-[#2F9E5B] stroke-[1.5]" />
                <p className="font-semibold text-[#1F2333]">Masa Retensi Aman</p>
                <p>Tidak ada berkas aktif yang mendekati atau telah melampaui batas retensi 3 tahun.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-[#4B5163] border-b border-[#ECEEF5] bg-[#F7F8FC]">
                    <th className="py-2.5 px-3 font-semibold">Kode Arsip &amp; Judul</th>
                    <th className="py-2.5 px-3 font-semibold">Kategori &amp; Lembar</th>
                    <th className="py-2.5 px-3 font-semibold">Lokasi Saat Ini</th>
                    <th className="py-2.5 px-3 font-semibold">Sisa Retensi</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEEF5]">
                  {docsAkanKadaluarsa.map((doc) => {
                    const sisa = doc.sisa_hari ?? 0
                    let badgeClass = 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]'
                    if (sisa <= 7) badgeClass = 'bg-[#FDECEC] text-[#D64545] border-[#FAD2CF]'
                    else if (sisa <= 30) badgeClass = 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]'

                    return (
                      <tr key={doc.id} className="hover:bg-[#F7F8FC] transition-colors">
                        <td className="py-3 px-3">
                          <KodeArsip kode={doc.kode_arsip} className="text-xs" />
                          <p className="font-semibold text-[#1F2333] line-clamp-1 mt-0.5">{doc.judul}</p>
                          <p className="text-xs text-[#6B7185]">No. Dok: <span className="font-mono">{doc.nomor_surat}</span></p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block rounded bg-[#EEF0F4] px-2 py-0.5 text-xs text-[#4B5163]">
                            {doc.kategori}
                          </span>
                          <p className="text-xs text-[#8A90A2] mt-0.5">{doc.jumlah_halaman} lembar</p>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#4B5163]">
                          {doc.lokasi_saat_ini}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                            <Clock className="h-3 w-3" />
                            {sisa <= 0 ? 'Kedaluwarsa' : `${sisa} hari (H-${sisa <= 7 ? 7 : sisa <= 30 ? 30 : 90})`}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href="/transfer-dokumen"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#E37400] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#C96400] transition-all shadow-2xs"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Pindahkan ke Inaktif</span>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* 6. Daftar Dokumen Unit & Status Umum */}
      <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ECEEF5] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#1F2333]">Daftar Seluruh Dokumen Unit</h2>
            <p className="text-xs text-[#6B7185] mt-0.5">
              Semua berkas arsip yang terdaftar pada unit pengolah <strong>{userUnitName}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Status */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setFilterOpen((v) => !v)
                  setExportOpen(false)
                }}
                className="flex items-center gap-2 rounded-lg border border-[#D5D9E2] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1F2333] hover:bg-[#F7F8FC] transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#8A90A2]" />
                <span>Status: <strong className="capitalize">{statusFilter}</strong></span>
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
                      className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors ${
                        statusFilter === opt.id ? 'bg-[#EEF7FD] text-[#1E86C8] font-semibold' : 'text-[#4B5163] hover:bg-[#F7F8FC]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cetak Ringkasan */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5D9E2] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#4B5163] hover:bg-[#F7F8FC] transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-[#8A90A2]" />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[#4B5163] border-b border-[#ECEEF5] bg-[#F7F8FC]">
                <th className="py-2.5 px-3 font-semibold">Dokumen</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Kode Arsip SIG</th>
                <th className="py-2.5 px-3 font-semibold">Waktu</th>
                <th className="py-2.5 px-3 text-right font-semibold">Ukuran</th>
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
                activities.slice(0, 10).map((doc) => (
                  <tr key={doc.id} className="align-middle hover:bg-[#F7F8FC] transition-colors">
                    <td className="py-2.5 px-3">
                      <Link href={`/dokumen/${doc.id}`} className="flex items-center gap-3 group">
                        <span className="w-9 h-9 shrink-0 rounded-full bg-[#EAF5FD] text-[#1E86C8] text-xs font-semibold flex items-center justify-center">
                          {getInitials(doc.pemegang)}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-[#1F2333] group-hover:text-[#1E86C8] truncate max-w-[280px]">
                            {doc.judul}
                          </span>
                          <span className="block text-xs text-[#8A90A2] truncate max-w-[280px]">
                            {doc.pemegang} • {doc.kategori}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${statusPill[doc.status].className}`}>
                        {statusPill[doc.status].label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 min-w-[120px] max-w-[180px] text-[#4B5163]">
                      <KodeArsip kode={doc.kode_arsip} prefix="#" className="block font-mono text-xs" />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-xs text-[#4B5163]">{doc.waktu}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right text-xs text-[#4B5163]">{doc.ukuran_file}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
