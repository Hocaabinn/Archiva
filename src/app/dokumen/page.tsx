'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { StampBadge } from '@/components/ui/stamp-badge'
import { DocumentQR } from '@/components/documents/qr-code'
import { UserRole, DokumenStatus } from '@/types'
import {
  Search,
  X,
  Pencil,
  Trash2,
  Eye,
  QrCode,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Download,
  Printer,
  AlertTriangle,
  Loader2,
  UploadCloud,
  CheckCircle2,
  Info,
  MapPin,
  FolderOpen,
  FileStack,
  Hourglass,
  AlarmClock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'
import { skorPencarian, SKOR } from '@/lib/pencarian-kode-arsip'

// ============================================================
// TIPE & DATA
// ============================================================
interface DocRow {
  id: string
  kode_arsip: string
  nomor_dokumen: string
  nomor_ppl?: string
  judul: string
  kategori_id: string
  kategori: string
  deskripsi: string
  status: DokumenStatus
  lokasi_saat_ini: string
  pemegang_saat_ini?: string
  pemegang_nama?: string
  tanggal_dokumen: string // yyyy-mm-dd
  tanggal_kadaluarsa: string | null // yyyy-mm-dd
  file_size: number | null
  file_path: string
  bucket: string
  pemilik_id: string
}

interface Kategori {
  id: string
  nama: string
}

interface FormState {
  judul: string
  nomor_dokumen: string
  kategori_id: string
  tanggal_dokumen: string
  lokasi_saat_ini: string
  deskripsi: string
  status: DokumenStatus
  file: File | null
}

const PRIVILEGED: UserRole[] = ['superadmin', 'pic_aktif', 'atasan_aktif', 'pic_inaktif', 'atasan_inaktif']
const PAGE_SIZE = 8

// Blueprint 3.1: 3 Kategori resmi (Keuangan, SDM, Kontrak)
const blueprintKategori: Kategori[] = [
  { id: 'keu', nama: 'Keuangan' },
  { id: 'sdm', nama: 'SDM' },
  { id: 'ktr', nama: 'Kontrak' },
]

const statusPill: Record<DokumenStatus, { label: string; className: string }> = {
  aktif: { label: 'Aktif', className: 'bg-[#E7F6EC] text-[#2F9E5B]' },
  menunggu_persetujuan: { label: 'Menunggu', className: 'bg-[#FFF4DE] text-[#C98A1B]' },
  inaktif: { label: 'Inaktif', className: 'bg-[#EEF0F4] text-[#6B7185]' },
  ditolak: { label: 'Ditolak', className: 'bg-[#FDECEC] text-[#D64545]' },
  dibatalkan: { label: 'Dibatalkan', className: 'bg-[#FDECEC] text-[#800000]' },
}

const roleHeaderConfig: Record<
  UserRole,
  {
    badge: string
    badgeClass: string
    subtitle: string
  }
> = {
  superadmin: {
    badge: 'SUPERADMIN',
    badgeClass: 'bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]',
    subtitle: 'Pusat kendali, pengelolaan master data, pengguna, dan administrasi seluruh arsip instansi',
  },
  pic_aktif: {
    badge: 'PIC ARSIP AKTIF',
    badgeClass: 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]',
    subtitle: 'Entri dokumen unit, edit metadata, serah terima, dan pencetakan label QR berkas',
  },
  atasan_aktif: {
    badge: 'ATASAN ARSIP AKTIF',
    badgeClass: 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]',
    subtitle: 'Persetujuan akhir dokumen unit, pembatalan dokumen aktif, dan pengawasan retensi',
  },
  pic_inaktif: {
    badge: 'PIC ARSIP INAKTIF',
    badgeClass: 'bg-[#EAF5FD] text-[#1E86C8] border-[#BCE1F9]',
    subtitle: 'Pengelolaan arsip inaktif, pelayanan peminjaman, dan kapasitas gudang inaktif',
  },
  atasan_inaktif: {
    badge: 'ATASAN ARSIP INAKTIF',
    badgeClass: 'bg-[#F3E8FD] text-[#7E3FBF] border-[#E2CCF9]',
    subtitle: 'Pengawasan penerimaan berkas inaktif dan monitoring kapasitas gudang inaktif',
  },
  staff: {
    badge: 'STAFF',
    badgeClass: 'bg-[#F1F3F4] text-[#5F6368] border-[#DADCE0]',
    subtitle: 'Katalog penelusuran dan pengunduhan arsip kedinasan resmi',
  },
}

const DOC_SELECT = `
  id, kode_arsip, nomor_dokumen, nomor_ppl, judul, deskripsi, status, kategori_id,
  file_path, bucket, ukuran_file, lokasi_saat_ini, tanggal_dokumen,
  tanggal_kadaluarsa, pemilik_id, pemegang_saat_ini,
  kategori_dokumen ( id, nama, kode ),
  pemegang:profiles!dokumen_pemegang_saat_ini_fkey ( id, nama_lengkap, email ),
  pemilik:profiles!dokumen_pemilik_id_fkey ( id, nama_lengkap, email )
`

// ============================================================
// HELPER
// ============================================================
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatTanggal(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatSize(bytes: number | null) {
  if (!bytes) return '-'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sisaHari(iso: string | null) {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(d: any): DocRow {
  return {
    id: d.id,
    kode_arsip: d.kode_arsip,
    nomor_dokumen: d.nomor_dokumen || '',
    nomor_ppl: d.nomor_ppl || '',
    judul: d.judul,
    kategori_id: d.kategori_id || '',
    kategori: d.kategori_dokumen?.nama || 'Umum',
    deskripsi: d.deskripsi || '',
    status: d.status,
    lokasi_saat_ini: d.lokasi_saat_ini || '-',
    pemegang_saat_ini: d.pemegang_saat_ini || d.pemilik_id,
    pemegang_nama: (d.pemegang as any)?.nama_lengkap || (d.pemegang as any)?.email || (d.pemilik as any)?.nama_lengkap || (d.pemilik as any)?.email || 'PIC Unit',
    tanggal_dokumen: d.tanggal_dokumen || '',
    tanggal_kadaluarsa: d.tanggal_kadaluarsa || null,
    file_size: d.ukuran_file ?? d.file_size ?? null,
    file_path: d.file_path || '',
    bucket: d.bucket || 'arsip-aktif',
    pemilik_id: d.pemilik_id,
  }
}

const emptyForm = (kategoriId = ''): FormState => ({
  judul: '',
  nomor_dokumen: '',
  kategori_id: kategoriId,
  tanggal_dokumen: todayISO(),
  lokasi_saat_ini: 'Ruang PIC Arsip Aktif',
  deskripsi: '',
  status: 'menunggu_persetujuan',
  file: null,
})

// ============================================================
// KOMPONEN UI KECIL
// ============================================================
function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2333]/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#ECEEF5] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[#1F2333]">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-[#6B7185]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-[#8A90A2] hover:bg-[#F4F5FA] hover:text-[#1F2333]">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-[#E3E6F0] bg-white px-3.5 py-2.5 text-sm text-[#1F2333] placeholder:text-[#A5ABBC] focus:border-[#3BA4E8] focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]/15 disabled:bg-[#F7F8FC] disabled:text-[#8A90A2]'

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[#1F2333]">
        {label} {required && <span className="text-[#D64545]">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[#8A90A2]">{hint}</span>}
    </label>
  )
}

// ============================================================
// HALAMAN
// ============================================================
function DaftarDokumenContent() {
  const [supabase] = useState(() => createClient())

  // Data
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [kategoriList, setKategoriList] = useState<Kategori[]>(blueprintKategori)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileRole, setProfileRole] = useState<UserRole>('staff')
  const role: UserRole = profileRole

  // Baca cache dari localStorage setelah mount agar konsisten dengan SSR
  useEffect(() => {
    const saved = localStorage.getItem('archiva_user_role') as UserRole | null
    if (saved) setProfileRole(saved)
  }, [])

  // Filter & tampilan
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('semua')
  const [selectedKategori, setSelectedKategori] = useState('semua')
  const [selectedPemegang, setSelectedPemegang] = useState('semua')
  const [selectedLokasi, setSelectedLokasi] = useState('semua')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [showFilterLanjutan, setShowFilterLanjutan] = useState(false)
  const [sortBy, setSortBy] = useState('terbaru')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [page, setPage] = useState(1)
  const [exportOpen, setExportOpen] = useState(false)

  // Modal & form
  const [formMode, setFormMode] = useState<'edit' | null>(null)
  const [editing, setEditing] = useState<DocRow | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleting, setDeleting] = useState<DocRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [qrDoc, setQrDoc] = useState<DocRow | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ---------------- READ ----------------
  const loadDocuments = useCallback(async () => {
    setErrorMessage(null)
    const { data, error } = await supabase.from('dokumen').select(DOC_SELECT).order('created_at', { ascending: false })
    if (error) throw error
    setDocuments((data || []).map(mapRow))
  }, [supabase])

  useEffect(() => {
    async function init() {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
          setErrorMessage('Anda belum masuk atau sesi telah berakhir. Silakan masuk terlebih dahulu untuk mengakses daftar dokumen.')
          setDocuments([])
          return
        }
        setUserId(user.id)

        const [{ data: profile }, { data: kats }] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', user.id).single(),
          supabase.from('kategori_dokumen').select('id, nama').eq('is_active', true).order('nama'),
        ])
        if (profile?.role) {
          const r = profile.role as UserRole
          setProfileRole(r)
          if (typeof window !== 'undefined') {
            localStorage.setItem('archiva_user_role', r)
          }
        }
        if (kats && kats.length > 0) setKategoriList(kats)

        await loadDocuments()
      } catch (err) {
        console.error('Gagal memuat dokumen dari Supabase:', err)
        setErrorMessage(err instanceof Error ? err.message : 'Gagal terhubung ke Supabase live.')
        setDocuments([])
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [supabase, loadDocuments])

  // ---------------- PERMISSION SESUAI ROLE ----------------
  const isPrivileged = PRIVILEGED.includes(role)
  const isOwnerPending = (doc: DocRow) => doc.pemilik_id === userId && doc.status === 'menunggu_persetujuan'

  // PIC Arsip Aktif: boleh ubah metadata dokumen miliknya yang berstatus menunggu_persetujuan atau ditolak
  // Superadmin: akses darurat maintainer
  const canEdit = (doc: DocRow) => {
    if (role === 'pic_aktif') return doc.status === 'menunggu_persetujuan' || doc.status === 'ditolak'
    return role === 'superadmin'
  }

  const canDelete = (_doc: DocRow) => {
    return role === 'superadmin'
  }

  // PIC Arsip Aktif — boleh entri / upload (dokumen unitnya)
  const canUpload = role === 'pic_aktif'

  // Seluruh peran berhak mengunduh/ekspor
  const canExport = true

  const roleHeader = roleHeaderConfig[role] || roleHeaderConfig.staff

  // ---------------- DAFTAR PILIHAN FILTER UNIK ----------------
  const uniquePemegang = useMemo(() => {
    const set = new Set<string>()
    documents.forEach((d) => {
      if (d.pemegang_nama) set.add(d.pemegang_nama)
    })
    return Array.from(set).sort()
  }, [documents])

  const uniqueLokasi = useMemo(() => {
    const set = new Set<string>()
    documents.forEach((d) => {
      if (d.lokasi_saat_ini && d.lokasi_saat_ini !== '-') set.add(d.lokasi_saat_ini)
    })
    return Array.from(set).sort()
  }, [documents])

  // ---------------- FILTER & PENCARIAN ----------------
  // Blueprint 3.7:
  // "Pencarian utama berdasarkan kode arsip (termasuk nomor payment / PPL dan doc voucher di dalamnya),
  // serta pencarian tambahan berdasarkan judul.
  // Filter: status, kategori, tanggal, pemegang, dan lokasi."
  //
  // Pencarian cerdas: kata kunci dicocokkan ke tiap bagian kode arsip
  // (TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER) & judul, pemisah diabaikan,
  // dan hasil diurutkan berdasarkan kekuatan kecocokan. Data `documents` sudah
  // dibatasi RLS sesuai peran, jadi pencarian tidak memperluas hak akses.
  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim()
    const skorMap = new Map<string, number>()
    return documents
      .filter((doc) => {
        // 1. Pencarian utama (bagian kode arsip) & tambahan (judul)
        let matchSearch = true
        if (q) {
          const skor = skorPencarian(q, doc)
          skorMap.set(doc.id, skor)
          matchSearch = skor > SKOR.TIDAK_COCOK
        }

        // 2. Filter Kategori
        const matchKategori = selectedKategori === 'semua' || doc.kategori === selectedKategori

        // 3. Filter Status
        const sisa = sisaHari(doc.tanggal_kadaluarsa)
        const matchStatus =
          selectedStatus === 'semua' ||
          (selectedStatus === 'akan_kadaluarsa' ? doc.status === 'aktif' && sisa !== null && sisa < 90 : doc.status === selectedStatus)

        // 4. Filter Pemegang
        const matchPemegang = selectedPemegang === 'semua' || doc.pemegang_nama === selectedPemegang

        // 5. Filter Lokasi
        const matchLokasi = selectedLokasi === 'semua' || doc.lokasi_saat_ini === selectedLokasi

        // 6. Filter Rentang Tanggal Dokumen
        let matchTanggal = true
        if (startDateFilter && doc.tanggal_dokumen) {
          matchTanggal = matchTanggal && doc.tanggal_dokumen >= startDateFilter
        }
        if (endDateFilter && doc.tanggal_dokumen) {
          matchTanggal = matchTanggal && doc.tanggal_dokumen <= endDateFilter
        }

        return matchSearch && matchKategori && matchStatus && matchPemegang && matchLokasi && matchTanggal
      })
      .sort((a, b) => {
        // Saat mencari: urutkan berdasarkan kecocokan dulu, pilihan urutan jadi penentu seri
        if (q) {
          const selisih = (skorMap.get(b.id) ?? 0) - (skorMap.get(a.id) ?? 0)
          if (selisih !== 0) return selisih
        }
        if (sortBy === 'terlama') return a.kode_arsip.localeCompare(b.kode_arsip)
        if (sortBy === 'judul_az') return a.judul.localeCompare(b.judul)
        if (sortBy === 'kadaluarsa') return (sisaHari(a.tanggal_kadaluarsa) ?? 99999) - (sisaHari(b.tanggal_kadaluarsa) ?? 99999)
        return b.kode_arsip.localeCompare(a.kode_arsip)
      })
  }, [documents, searchQuery, selectedStatus, selectedKategori, selectedPemegang, selectedLokasi, startDateFilter, endDateFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedDocs = filteredDocs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const counts = {
    semua: documents.length,
    aktif: documents.filter((d) => d.status === 'aktif').length,
    menunggu_persetujuan: documents.filter((d) => d.status === 'menunggu_persetujuan').length,
    akan_kadaluarsa: documents.filter((d) => {
      const s = sisaHari(d.tanggal_kadaluarsa)
      return d.status === 'aktif' && s !== null && s < 90
    }).length,
    inaktif: documents.filter((d) => d.status === 'inaktif').length,
    ditolak: documents.filter((d) => d.status === 'ditolak').length,
    dibatalkan: documents.filter((d) => d.status === 'dibatalkan').length,
  }

  const statusTabs = [
    { id: 'semua', label: 'Semua' },
    { id: 'aktif', label: 'Aktif' },
    { id: 'menunggu_persetujuan', label: 'Menunggu' },
    { id: 'akan_kadaluarsa', label: 'Akan Kadaluarsa' },
    { id: 'inaktif', label: 'Inaktif' },
    { id: 'ditolak', label: 'Ditolak' },
    { id: 'dibatalkan', label: 'Dibatalkan' },
  ] as const

  // ---------------- FORM HANDLER ----------------
  const openEdit = (doc: DocRow) => {
    setForm({
      judul: doc.judul,
      nomor_dokumen: doc.nomor_dokumen,
      kategori_id: doc.kategori_id,
      tanggal_dokumen: doc.tanggal_dokumen || todayISO(),
      lokasi_saat_ini: doc.lokasi_saat_ini,
      deskripsi: doc.deskripsi,
      status: doc.status,
      file: null,
    })
    setEditing(doc)
    setFormError(null)
    setFormMode('edit')
  }

  const closeForm = () => {
    if (isSaving) return
    setFormMode(null)
    setEditing(null)
  }

  const kategoriName = (id: string) => kategoriList.find((k) => k.id === id)?.nama || 'Umum'

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.judul.trim()) return setFormError('Judul dokumen wajib diisi.')
    if (!form.kategori_id) return setFormError('Pilih kategori dokumen.')

    setIsSaving(true)
    setFormError(null)

    // Mode live: Supabase
    try {
      if (formMode === 'edit' && editing) {
        const payload: Record<string, unknown> = {
          judul: form.judul.trim(),
          nomor_dokumen: form.nomor_dokumen || null,
          kategori_id: form.kategori_id,
          deskripsi: form.deskripsi || null,
          tanggal_dokumen: form.tanggal_dokumen,
        }
        if (isPrivileged) {
          payload.lokasi_saat_ini = form.lokasi_saat_ini
          payload.status = form.status
        }
        const { data, error } = await supabase.from('dokumen').update(payload).eq('id', editing.id).select('id')
        if (error) throw error
        if (!data || data.length === 0) throw new Error('Perubahan ditolak: Anda tidak memiliki izin mengubah dokumen ini.')
        showToast('success', `Dokumen ${editing.kode_arsip} berhasil diperbarui.`)
      }

      await loadDocuments()
      setFormMode(null)
      setEditing(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan dokumen.')
    } finally {
      setIsSaving(false)
    }
  }

  // ---------------- DELETE ----------------
  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)

    try {
      const { data, error } = await supabase.from('dokumen').delete().eq('id', deleting.id).select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Penghapusan ditolak: Anda tidak memiliki izin, atau policy DELETE belum dipasang di Supabase.')
      }
      if (deleting.file_path) {
        await supabase.storage.from(deleting.bucket).remove([deleting.file_path])
      }
      showToast('success', `Dokumen ${deleting.kode_arsip} berhasil dihapus.`)
      await loadDocuments()
      setDeleting(null)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus dokumen.')
    } finally {
      setIsDeleting(false)
    }
  }

  // ---------------- EKSPOR CSV ----------------
  const exportCsv = () => {
    const header = ['Kode Arsip', 'Nomor Dokumen', 'Judul', 'Kategori', 'Status', 'Lokasi', 'Tanggal Dokumen', 'Kedaluwarsa']
    const rows = filteredDocs.map((d) => [
      d.kode_arsip, d.nomor_dokumen, d.judul, d.kategori, statusPill[d.status].label,
      d.lokasi_saat_ini, d.tanggal_dokumen, d.tanggal_kadaluarsa || '',
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `daftar-dokumen-${todayISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  // ---------------- RENDER HELPERS ----------------
  const RetensiCell = ({ doc }: { doc: DocRow }) => {
    const sisa = sisaHari(doc.tanggal_kadaluarsa)
    if (sisa === null) return <span className="text-[#A5ABBC]">-</span>
    if (sisa === 0) return <span className="text-[#8A90A2]">Kedaluwarsa</span>
    const akanKadaluarsa = doc.status === 'aktif' && sisa < 90
    return (
      <div>
        <span className={`font-medium ${akanKadaluarsa ? 'text-[#D64545]' : 'text-[#1F2333]'}`}>
          {akanKadaluarsa && <AlertTriangle className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />}
          {sisa} hari
        </span>
        <span className="block text-xs text-[#8A90A2]">s.d. {formatTanggal(doc.tanggal_kadaluarsa)}</span>
      </div>
    )
  }

  const ActionButtons = ({ doc }: { doc: DocRow }) => (
    <div className="flex items-center justify-end gap-1">
      {role !== 'staff' && (
        <button type="button" onClick={() => setQrDoc(doc)} title="Label QR" className="rounded-md p-1.5 text-[#6B7185] hover:bg-[#EEF7FD] hover:text-[#1E86C8]">
          <QrCode className="h-4 w-4" />
        </button>
      )}
      <Link href={`/dokumen/${doc.id}`} title="Lihat detail" className="rounded-md p-1.5 text-[#6B7185] hover:bg-[#EEF7FD] hover:text-[#1E86C8]">
        <Eye className="h-4 w-4" />
      </Link>
      {canEdit(doc) && (
        <button type="button" onClick={() => openEdit(doc)} title="Ubah" className="rounded-md p-1.5 text-[#6B7185] hover:bg-[#EEF7FD] hover:text-[#1E86C8]">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {canDelete(doc) && (
        <button type="button" onClick={() => setDeleting(doc)} title="Hapus" className="rounded-md p-1.5 text-[#6B7185] hover:bg-[#FDECEC] hover:text-[#D64545]">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )

  const cardClass = 'bg-white rounded-xl border border-[#ECEEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

  return (
    <AppLayout currentRole={role}>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[28px] font-bold tracking-tight text-[#1F2333]">Daftar Dokumen</h1>
              <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${roleHeader.badgeClass}`} suppressHydrationWarning>
                {roleHeader.badge}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#4B5163]" suppressHydrationWarning>{roleHeader.subtitle}</p>
          </div>
          <div className="flex items-center gap-2.5">
            {(role === 'atasan_aktif' || role === 'atasan_inaktif') && (
              <Link
                href="/persetujuan"
                className="flex items-center gap-1.5 rounded-lg border border-[#B06000]/30 bg-[#FEF7E0] px-3.5 py-2 text-sm font-medium text-[#B06000] hover:bg-[#FEEFC3] transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Persetujuan Dokumen</span>
              </Link>
            )}
            {canExport && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg border border-[#1F2333] bg-white px-4 py-2 text-sm font-medium text-[#1F2333] transition-colors hover:bg-[#F7F8FC]"
                >
                  <Download className="h-4 w-4" />
                  Ekspor
                  <ChevronDown className="h-4 w-4" />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-[#ECEEF5] bg-white p-1.5 shadow-lg">
                    <button type="button" onClick={exportCsv} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#4B5163] hover:bg-[#EEF7FD]">
                      <FileText className="h-4 w-4" /> Unduh CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false)
                        window.print()
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#4B5163] hover:bg-[#EEF7FD]"
                    >
                      <Printer className="h-4 w-4" /> Cetak Daftar
                    </button>
                  </div>
                )}
              </div>
            )}
            {canUpload && (
              <Link
                href="/dokumen/upload"
                className="flex items-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2A92D6] active:scale-[0.98]"
              >
                <UploadCloud className="h-4 w-4" />
                <span>Upload Dokumen</span>
              </Link>
            )}
          </div>
        </div>

        {errorMessage && !isLoading && (
          <div className="flex items-start gap-3 rounded-xl border border-[#FDECEC] bg-[#FFF5F5] px-4 py-3 text-sm text-[#D64545]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Koneksi Supabase Gagal / Belum Masuk</p>
              <p className="mt-0.5">{errorMessage}</p>
              {!userId && (
                <Link href="/login" className="mt-2 inline-flex items-center text-xs font-semibold text-[#1E86C8] hover:underline">
                  Masuk ke Akun Anda &rarr;
                </Link>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-[#6B7185]">
            <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
            <p className="text-sm font-medium">Memuat daftar dokumen...</p>
          </div>
        ) : (
          <>
            {/* Kartu ringkasan */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[
                { label: 'Total Dokumen', value: counts.semua, icon: FileStack, color: 'text-[#1F2333]', bar: 'bg-[#3BA4E8]', iconBox: 'bg-[#EAF5FD] text-[#3BA4E8]' },
                { label: 'Arsip Aktif', value: counts.aktif, icon: CheckCircle2, color: 'text-[#137333]', bar: 'bg-[#34A853]', iconBox: 'bg-[#E6F4EA] text-[#137333]' },
                { label: 'Menunggu Persetujuan', value: counts.menunggu_persetujuan, icon: Hourglass, color: 'text-[#B06000]', bar: 'bg-[#FBBC04]', iconBox: 'bg-[#FEF7E0] text-[#B06000]' },
                { label: 'Akan Kadaluarsa', hint: '< 90 hari', value: counts.akan_kadaluarsa, icon: AlarmClock, color: 'text-[#D64545]', bar: 'bg-[#EA4335]', iconBox: 'bg-[#FDECEC] text-[#D64545]' },
              ].map((s: { label: string; hint?: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string; bar: string; iconBox: string }) => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="relative flex items-start justify-between gap-2 overflow-hidden rounded-2xl border border-[#ECEEF5] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:shadow-sm">
                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-[#64748B] truncate">{s.label}</p>
                      {s.hint && <p className="text-[11px] text-[#9AA0B2] truncate">{s.hint}</p>}
                      <p className={`mt-1.5 sm:mt-2 text-2xl sm:text-[28px] font-bold tracking-tight ${s.color}`}>{s.value}</p>
                    </div>
                    <span className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl ${s.iconBox}`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                  </div>
                )
              })}
            </div>

        {/* Daftar */}
        <div className={cardClass}>
          {/* Toolbar */}
          <div className="space-y-4 border-b border-[#ECEEF5] p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA0B2]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Cari kode arsip, no. payment (PPL), doc voucher, judul dokumen..."
                  className={`${inputClass} pl-10 pr-9`}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA0B2] hover:text-[#1F2333]">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <select
                  value={selectedKategori}
                  onChange={(e) => {
                    setSelectedKategori(e.target.value)
                    setPage(1)
                  }}
                  className={`${inputClass} w-auto cursor-pointer`}
                >
                  <option value="semua">Semua Kategori</option>
                  {kategoriList.map((k) => (
                    <option key={k.id} value={k.nama}>
                      {k.nama}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowFilterLanjutan((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    showFilterLanjutan || selectedPemegang !== 'semua' || selectedLokasi !== 'semua' || startDateFilter || endDateFilter
                      ? 'border-[#1E3A5F] bg-[#EEF7FD] text-[#1E3A5F]'
                      : 'border-[#E3E6F0] bg-white text-[#4B5163] hover:bg-[#F7F8FC]'
                  }`}
                >
                  <span>Filter</span>
                  {(selectedPemegang !== 'semua' || selectedLokasi !== 'semua' || startDateFilter || endDateFilter) && (
                    <span className="h-2 w-2 rounded-full bg-[#1E3A5F]" />
                  )}
                </button>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${inputClass} w-auto cursor-pointer`}>
                  <option value="terbaru">Terbaru</option>
                  <option value="terlama">Terlama</option>
                  <option value="kadaluarsa">Kedaluwarsa Terdekat</option>
                  <option value="judul_az">Judul A–Z</option>
                </select>
                <div className="flex shrink-0 rounded-lg bg-[#F4F5FA] p-1">
                  {(['table', 'grid'] as const).map((mode) => {
                    const Icon = mode === 'table' ? List : LayoutGrid
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setViewMode(mode)}
                        title={mode === 'table' ? 'Tampilan tabel' : 'Tampilan kartu'}
                        className={`rounded-md p-1.5 transition-colors ${viewMode === mode ? 'bg-white text-[#1E86C8] shadow-sm' : 'text-[#6B7185] hover:text-[#1F2333]'}`}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Filter Lanjutan (Pemegang, Lokasi, dan Rentang Tanggal) - Blueprint 3.7 */}
            {showFilterLanjutan && (
              <div className="grid gap-3 rounded-lg border border-[#E3E6F0] bg-[#F8FAFC] p-4 text-xs sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#64748B] mb-1">
                    Pemegang Dokumen
                  </label>
                  <select
                    value={selectedPemegang}
                    onChange={(e) => {
                      setSelectedPemegang(e.target.value)
                      setPage(1)
                    }}
                    className="w-full h-9 rounded-md border border-[#CBD7E3] bg-white px-2.5 text-xs text-[#111827]"
                  >
                    <option value="semua">Semua Pemegang</option>
                    {uniquePemegang.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#64748B] mb-1">
                    Lokasi Fisik
                  </label>
                  <select
                    value={selectedLokasi}
                    onChange={(e) => {
                      setSelectedLokasi(e.target.value)
                      setPage(1)
                    }}
                    className="w-full h-9 rounded-md border border-[#CBD7E3] bg-white px-2.5 text-xs text-[#111827]"
                  >
                    <option value="semua">Semua Lokasi</option>
                    {uniqueLokasi.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#64748B] mb-1">
                    Tanggal Dokumen Dari
                  </label>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => {
                      setStartDateFilter(e.target.value)
                      setPage(1)
                    }}
                    className="w-full h-9 rounded-md border border-[#CBD7E3] bg-white px-2.5 text-xs text-[#111827]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#64748B] mb-1">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => {
                      setEndDateFilter(e.target.value)
                      setPage(1)
                    }}
                    className="w-full h-9 rounded-md border border-[#CBD7E3] bg-white px-2.5 text-xs text-[#111827]"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto">
              {statusTabs.map((tab) => {
                const active = selectedStatus === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(tab.id)
                      setPage(1)
                    }}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active ? 'bg-[#3BA4E8] text-white' : 'bg-[#F4F5FA] text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1E86C8]'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-md px-1.5 text-xs ${active ? 'bg-white/25' : 'bg-white text-[#6B7185]'}`}>{counts[tab.id]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Konten */}
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF5FD] text-[#3BA4E8]">
                <FolderOpen className="h-6 w-6" />
              </span>
              <p className="mt-1 font-semibold text-[#1F2333]">Belum ada dokumen yang cocok</p>
              <p className="text-sm text-[#6B7185]">Ubah kata kunci atau filter, atau tambahkan dokumen baru.</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#ECEEF5] text-xs text-[#4B5163]">
                    <th className="w-12 px-4 py-3 text-center font-normal">No.</th>
                    <th className="px-5 py-3 font-normal">Dokumen</th>
                    <th className="px-4 py-3 font-normal">Kategori</th>
                    <th className="px-4 py-3 font-normal">Status</th>
                    <th className="px-4 py-3 font-normal">Pemegang & Lokasi</th>
                    <th className="px-4 py-3 font-normal">Retensi</th>
                    <th className="px-5 py-3 text-right font-normal">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F2F7]">
                  {pagedDocs.map((doc, idx) => {
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1
                    return (
                      <tr key={doc.id} className="transition-colors hover:bg-[#F9FBFE]">
                        <td className="w-12 px-4 py-3.5 text-center text-xs font-mono font-medium text-[#6B7185]">
                          {rowNumber}
                        </td>
                        <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF7FD] text-[#3BA4E8]">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 max-w-[240px] sm:max-w-[340px] lg:max-w-[420px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Link href={`/dokumen/${doc.id}`} className="block truncate font-semibold text-[#1F2333] hover:text-[#1E86C8]">
                                {doc.judul}
                              </Link>
                              {doc.pemilik_id === userId && (
                                <span className="inline-flex shrink-0 items-center rounded-full bg-[#EBF5FB] px-2 py-0.5 text-[10px] font-semibold text-[#1E86C8] border border-[#3BA4E8]/20">
                                  Milik Anda
                                </span>
                              )}
                            </div>
                            <KodeArsip kode={doc.kode_arsip} prefix="#" className="block font-mono text-xs text-[#64748B] select-all" />
                            {(doc.nomor_ppl || doc.nomor_dokumen) && (
                              <span className="block font-mono text-[11px] text-[#94A3B8] break-all">
                                {doc.nomor_ppl && `PPL: ${doc.nomor_ppl}`}
                                {doc.nomor_ppl && doc.nomor_dokumen && ' • '}
                                {doc.nomor_dokumen && `Doc: ${doc.nomor_dokumen}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[#4B5163]">{doc.kategori}</td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <StampBadge status={doc.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[#4B5163]">
                        <span className="font-medium text-[#111827] block">{doc.pemegang_nama || 'PIC Unit'}</span>
                        <span className="text-[#64748B] flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {doc.lokasi_saat_ini}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <RetensiCell doc={doc} />
                      </td>
                      <td className="px-5 py-3.5">
                        <ActionButtons doc={doc} />
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {pagedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="group flex flex-col justify-between rounded-2xl border border-[#ECEEF5] bg-white p-4.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3BA4E8]/40 hover:shadow-md"
                >
                  <div>
                    {/* Header kartu: icon di kiri, badge status & kepemilikan di kanan */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF7FD] text-[#3BA4E8]">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[70%]">
                        {doc.pemilik_id === userId && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-[#EBF5FB] px-2 py-0.5 text-[10px] font-semibold text-[#1E86C8] border border-[#3BA4E8]/20">
                            Milik Anda
                          </span>
                        )}
                        <StampBadge status={doc.status} />
                      </div>
                    </div>

                    {/* Judul & Kode Arsip */}
                    <div className="mt-3 min-w-0">
                      <Link
                        href={`/dokumen/${doc.id}`}
                        className="line-clamp-2 font-semibold text-sm leading-snug text-[#1F2333] hover:text-[#3BA4E8] transition-colors"
                        title={doc.judul}
                      >
                        {doc.judul}
                      </Link>
                      <div className="mt-1.5 min-w-0">
                        <KodeArsip kode={doc.kode_arsip} prefix="#" className="block font-mono text-[11px] text-[#64748B] select-all" />
                        {(doc.nomor_ppl || doc.nomor_dokumen) && (
                          <p className="font-mono text-[10px] text-[#94A3B8] truncate mt-0.5">
                            {doc.nomor_ppl && `PPL: ${doc.nomor_ppl}`}
                            {doc.nomor_ppl && doc.nomor_dokumen && ` • `}
                            {doc.nomor_dokumen && `Doc: ${doc.nomor_dokumen}`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Kategori & Lokasi Fisik */}
                    <div className="mt-3.5 space-y-1.5 text-xs text-[#4B5163] min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[#4B5163]">
                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                        <span className="truncate">{doc.kategori}</span>
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-[#4B5163]">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                        <span className="truncate">{doc.lokasi_saat_ini || 'Ruang Arsip'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Footer kartu: ukuran berkas & tombol aksi */}
                  <div className="mt-4 flex items-center justify-between border-t border-[#F1F2F7] pt-3 text-xs">
                    <span className="text-[#8A90A2] font-medium">{formatSize(doc.file_size)}</span>
                    <ActionButtons doc={doc} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && filteredDocs.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#ECEEF5] px-5 py-3.5 text-sm text-[#6B7185] sm:flex-row sm:items-center sm:justify-between">
              <span>
                Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredDocs.length)} dari {filteredDocs.length} dokumen
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="rounded-md border border-[#E3E6F0] p-1.5 hover:bg-[#F4F5FA] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`h-8 min-w-8 rounded-md px-2 text-sm ${n === currentPage ? 'bg-[#3BA4E8] text-white' : 'hover:bg-[#F4F5FA]'}`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="rounded-md border border-[#E3E6F0] p-1.5 hover:bg-[#F4F5FA] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    )}
  </div>

  {/* ================= MODAL UBAH DOKUMEN ================= */}
  {formMode === 'edit' && editing && (
    <Modal
      title="Ubah Dokumen"
      subtitle={`#${editing.kode_arsip}`}
      onClose={closeForm}
    >
      <form onSubmit={handleSave}>
        <div className="space-y-4 px-6 py-5">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-[#F5C2C2] bg-[#FDECEC] px-3.5 py-2.5 text-sm text-[#B42318]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
            </div>
          )}

          <Field label="Judul Dokumen" required>
            <input
              className={inputClass}
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              placeholder="Contoh: Kontrak Kerja Sama Vendor 2026"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nomor Dokumen">
              <input
                className={inputClass}
                value={form.nomor_dokumen}
                onChange={(e) => setForm({ ...form, nomor_dokumen: e.target.value })}
                placeholder="042/LEG/2026"
              />
            </Field>
            <Field label="Kategori" required>
              <select className={`${inputClass} cursor-pointer`} value={form.kategori_id} onChange={(e) => setForm({ ...form, kategori_id: e.target.value })}>
                <option value="" disabled>
                  Pilih kategori
                </option>
                {kategoriList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal Dokumen" required>
              <input
                type="date"
                className={inputClass}
                value={form.tanggal_dokumen}
                onChange={(e) => setForm({ ...form, tanggal_dokumen: e.target.value })}
              />
            </Field>
            <Field label="Lokasi Fisik" hint={!isPrivileged ? 'Hanya PIC/Atasan/Admin yang dapat mengubah' : undefined}>
              <input
                className={inputClass}
                value={form.lokasi_saat_ini}
                disabled={!isPrivileged}
                onChange={(e) => setForm({ ...form, lokasi_saat_ini: e.target.value })}
                placeholder="Ruang Arsip - Rak A1"
              />
            </Field>
          </div>

          {isPrivileged && (
            <Field label="Status">
              <select
                className={`${inputClass} cursor-pointer`}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as DokumenStatus })}
              >
                <option value="menunggu_persetujuan">Menunggu Persetujuan</option>
                <option value="aktif">Aktif</option>
                <option value="inaktif">Inaktif</option>
                <option value="ditolak">Ditolak</option>
                <option value="dibatalkan">Dibatalkan</option>
              </select>
            </Field>
          )}

          <Field label="Deskripsi">
            <textarea
              rows={3}
              className={`${inputClass} resize-none`}
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Ringkasan isi dokumen (opsional)"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#ECEEF5] px-6 py-4">
          <button
            type="button"
            onClick={closeForm}
            disabled={isSaving}
            className="rounded-lg border border-[#E3E6F0] px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F4F5FA] disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-medium text-white hover:bg-[#2A92D6] disabled:opacity-60"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan Perubahan
          </button>
        </div>
      </form>
    </Modal>
  )}

      {/* ================= MODAL HAPUS ================= */}
      {deleting && (
        <Modal title="Hapus Dokumen?" onClose={() => !isDeleting && setDeleting(null)} maxWidth="max-w-md">
          <div className="space-y-3 px-6 py-5 text-sm text-[#4B5163]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FDECEC] text-[#D64545]">
                <Trash2 className="h-5 w-5" />
              </span>
              <p>
                Dokumen <span className="font-semibold text-[#1F2333]">{deleting.judul}</span> (#{deleting.kode_arsip}) beserta berkasnya akan dihapus
                permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[#ECEEF5] px-6 py-4">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              disabled={isDeleting}
              className="rounded-lg border border-[#E3E6F0] px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F4F5FA] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 rounded-lg bg-[#D64545] px-4 py-2 text-sm font-medium text-white hover:bg-[#C03535] disabled:opacity-60"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Ya, Hapus
            </button>
          </div>
        </Modal>
      )}

      {/* ================= MODAL QR ================= */}
      {qrDoc && (
        <Modal title="Label QR Code" subtitle={`#${qrDoc.kode_arsip}`} onClose={() => setQrDoc(null)} maxWidth="max-w-md">
          <div className="p-6">
            <DocumentQR
              kodeArsip={qrDoc.kode_arsip}
              judul={qrDoc.judul}
              nomorDokumen={qrDoc.nomor_dokumen || undefined}
              size={180}
            />
          </div>
        </Modal>
      )}

      {/* ================= TOAST ================= */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-sm text-white shadow-lg ${
            toast.type === 'success' ? 'bg-[#1F2333]' : 'bg-[#D64545]'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6FD39A]" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          {toast.text}
        </div>
      )}
    </AppLayout>
  )
}

export default function DaftarDokumenPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#6B7185]">Memuat daftar dokumen...</div>}>
      <DaftarDokumenContent />
    </Suspense>
  )
}
