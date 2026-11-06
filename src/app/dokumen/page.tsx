'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { UserRole, DokumenStatus } from '@/types'
import {
  Search,
  X,
  Plus,
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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// TIPE & DATA
// ============================================================
interface DocRow {
  id: string
  kode_arsip: string
  nomor_dokumen: string
  judul: string
  kategori_id: string
  kategori: string
  deskripsi: string
  status: DokumenStatus
  lokasi_saat_ini: string
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

const PRIVILEGED: UserRole[] = ['admin', 'pic_arsip', 'atasan']
const PAGE_SIZE = 8

const fallbackKategori: Kategori[] = [
  { id: 'k-lgl', nama: 'Kontrak & Legal' },
  { id: 'k-keu', nama: 'Keuangan' },
  { id: 'k-sdm', nama: 'SDM & Kepegawaian' },
  { id: 'k-ops', nama: 'Operasional & Logistik' },
]

const demoDocuments: DocRow[] = [
  {
    id: '1', kode_arsip: 'ARS-2026-0001', nomor_dokumen: '042/LEG-KTR/PL/I/2026',
    judul: 'Kontrak Kerja Sama Vendor PT Prima Logistik 2026', kategori_id: 'k-lgl', kategori: 'Kontrak & Legal',
    deskripsi: '', status: 'aktif', lokasi_saat_ini: 'Ruang Arsip Aktif - Rak A1',
    tanggal_dokumen: '2026-01-03', tanggal_kadaluarsa: '2029-11-03', file_size: 4_800_000,
    file_path: '', bucket: 'arsip-aktif', pemilik_id: 'demo',
  },
  {
    id: '2', kode_arsip: 'ARS-2026-0002', nomor_dokumen: '118/KEU-AUD/X/2026',
    judul: 'Laporan Keuangan & Audit Neraca Kas Triwulan III 2026', kategori_id: 'k-keu', kategori: 'Keuangan',
    deskripsi: '', status: 'menunggu_persetujuan', lokasi_saat_ini: 'Meja Verifikasi PIC',
    tanggal_dokumen: '2026-10-18', tanggal_kadaluarsa: null, file_size: 12_300_000,
    file_path: '', bucket: 'arsip-aktif', pemilik_id: 'demo',
  },
  {
    id: '3', kode_arsip: 'ARS-2026-0003', nomor_dokumen: '007/SK-DIR/SDM/2026',
    judul: 'Surat Keputusan Direksi Tentang Kebijakan Mutasi & Promosi 2026', kategori_id: 'k-sdm', kategori: 'SDM & Kepegawaian',
    deskripsi: '', status: 'aktif', lokasi_saat_ini: 'Ruang Direksi Lt. 3',
    tanggal_dokumen: '2023-12-15', tanggal_kadaluarsa: '2026-12-15', file_size: 2_100_000,
    file_path: '', bucket: 'arsip-aktif', pemilik_id: 'demo',
  },
  {
    id: '4', kode_arsip: 'ARS-2023-0045', nomor_dokumen: 'BA-240/TIK-LOG/XI/2023',
    judul: 'Berita Acara Pengadaan Server & Komponen Basis Data Utama 2023', kategori_id: 'k-ops', kategori: 'Operasional & Logistik',
    deskripsi: '', status: 'nonaktif', lokasi_saat_ini: 'Gudang Non-Aktif - Kotak B-12',
    tanggal_dokumen: '2023-11-01', tanggal_kadaluarsa: '2026-11-01', file_size: 8_400_000,
    file_path: '', bucket: 'arsip-inaktif', pemilik_id: 'demo',
  },
  {
    id: '5', kode_arsip: 'ARS-2026-0004', nomor_dokumen: 'NDA-099/LGL/2026',
    judul: 'Dokumen Perjanjian Kerahasiaan Data Klien (NDA) Multinasional', kategori_id: 'k-lgl', kategori: 'Kontrak & Legal',
    deskripsi: '', status: 'aktif', lokasi_saat_ini: 'Ruang Arsip Aktif - Rak A2',
    tanggal_dokumen: '2026-02-12', tanggal_kadaluarsa: '2029-02-12', file_size: 1_900_000,
    file_path: '', bucket: 'arsip-aktif', pemilik_id: 'demo',
  },
]

const statusPill: Record<DokumenStatus, { label: string; className: string }> = {
  aktif: { label: 'Aktif', className: 'bg-[#E7F6EC] text-[#2F9E5B]' },
  menunggu_persetujuan: { label: 'Menunggu', className: 'bg-[#FFF4DE] text-[#C98A1B]' },
  nonaktif: { label: 'Non-Aktif', className: 'bg-[#EEF0F4] text-[#6B7185]' },
  ditolak: { label: 'Ditolak', className: 'bg-[#FDECEC] text-[#D64545]' },
}

const DOC_SELECT = `
  id, kode_arsip, nomor_dokumen, judul, deskripsi, status, kategori_id,
  file_path, bucket, file_size, lokasi_saat_ini, tanggal_dokumen,
  tanggal_kadaluarsa, pemilik_id, kategori_dokumen ( nama )
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
    judul: d.judul,
    kategori_id: d.kategori_id || '',
    kategori: d.kategori_dokumen?.nama || 'Umum',
    deskripsi: d.deskripsi || '',
    status: d.status,
    lokasi_saat_ini: d.lokasi_saat_ini || '-',
    tanggal_dokumen: d.tanggal_dokumen || '',
    tanggal_kadaluarsa: d.tanggal_kadaluarsa || null,
    file_size: d.file_size ?? null,
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
  lokasi_saat_ini: 'Meja Pengaju',
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
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('demo_role') as UserRole | null
  const [supabase] = useState(() => createClient())

  // Data
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [kategoriList, setKategoriList] = useState<Kategori[]>(fallbackKategori)
  const [isLoading, setIsLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileRole, setProfileRole] = useState<UserRole>('user')
  const role: UserRole = isDemo ? roleParam || 'admin' : profileRole

  // Filter & tampilan
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('semua')
  const [selectedKategori, setSelectedKategori] = useState('semua')
  const [sortBy, setSortBy] = useState('terbaru')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [page, setPage] = useState(1)
  const [exportOpen, setExportOpen] = useState(false)

  // Modal & form
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
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
    const { data, error } = await supabase.from('dokumen').select(DOC_SELECT).order('created_at', { ascending: false })
    if (error) throw error
    setDocuments((data || []).map(mapRow))
  }, [supabase])

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsDemo(true)
          setDocuments(demoDocuments)
          return
        }
        setUserId(user.id)

        const [{ data: profile }, { data: kats }] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', user.id).single(),
          supabase.from('kategori_dokumen').select('id, nama').eq('is_active', true).order('nama'),
        ])
        if (profile?.role) setProfileRole(profile.role as UserRole)
        if (kats && kats.length > 0) setKategoriList(kats)

        await loadDocuments()
      } catch (err) {
        console.warn('Gagal memuat dokumen dari Supabase, beralih ke mode demo:', err)
        setIsDemo(true)
        setDocuments(demoDocuments)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [supabase, loadDocuments])

  // ---------------- PERMISSION ----------------
  const isPrivileged = PRIVILEGED.includes(role)
  const canCreate = role !== 'viewer' && role !== 'accounting'
  const isOwnerPending = (doc: DocRow) => doc.pemilik_id === userId && doc.status === 'menunggu_persetujuan'
  const canEdit = (doc: DocRow) => isDemo ? canCreate : isPrivileged || isOwnerPending(doc)
  const canDelete = (doc: DocRow) =>
    isDemo ? role === 'admin' || role === 'pic_arsip' : role === 'admin' || role === 'pic_arsip' || isOwnerPending(doc)

  // ---------------- FILTER ----------------
  const filteredDocs = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return documents
      .filter((doc) => {
        const matchSearch =
          !q ||
          doc.kode_arsip.toLowerCase().includes(q) ||
          doc.judul.toLowerCase().includes(q) ||
          doc.nomor_dokumen.toLowerCase().includes(q) ||
          doc.lokasi_saat_ini.toLowerCase().includes(q)
        const matchKategori = selectedKategori === 'semua' || doc.kategori === selectedKategori
        const sisa = sisaHari(doc.tanggal_kadaluarsa)
        const matchStatus =
          selectedStatus === 'semua' ||
          (selectedStatus === 'kritis' ? doc.status === 'aktif' && sisa !== null && sisa < 90 : doc.status === selectedStatus)
        return matchSearch && matchKategori && matchStatus
      })
      .sort((a, b) => {
        if (sortBy === 'terlama') return a.kode_arsip.localeCompare(b.kode_arsip)
        if (sortBy === 'judul_az') return a.judul.localeCompare(b.judul)
        if (sortBy === 'kadaluarsa') return (sisaHari(a.tanggal_kadaluarsa) ?? 99999) - (sisaHari(b.tanggal_kadaluarsa) ?? 99999)
        return b.kode_arsip.localeCompare(a.kode_arsip)
      })
  }, [documents, searchQuery, selectedStatus, selectedKategori, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedDocs = filteredDocs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const counts = {
    semua: documents.length,
    aktif: documents.filter((d) => d.status === 'aktif').length,
    menunggu_persetujuan: documents.filter((d) => d.status === 'menunggu_persetujuan').length,
    kritis: documents.filter((d) => {
      const s = sisaHari(d.tanggal_kadaluarsa)
      return d.status === 'aktif' && s !== null && s < 90
    }).length,
    nonaktif: documents.filter((d) => d.status === 'nonaktif').length,
    ditolak: documents.filter((d) => d.status === 'ditolak').length,
  }

  const statusTabs = [
    { id: 'semua', label: 'Semua' },
    { id: 'aktif', label: 'Aktif' },
    { id: 'menunggu_persetujuan', label: 'Menunggu' },
    { id: 'kritis', label: 'Kritis < 90 Hari' },
    { id: 'nonaktif', label: 'Non-Aktif' },
    { id: 'ditolak', label: 'Ditolak' },
  ] as const

  // ---------------- FORM HANDLER ----------------
  const openCreate = () => {
    setForm(emptyForm(kategoriList[0]?.id || ''))
    setEditing(null)
    setFormError(null)
    setFormMode('create')
  }

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
    if (formMode === 'create' && !isDemo && !form.file) return setFormError('Pilih berkas dokumen yang akan diunggah.')

    setIsSaving(true)
    setFormError(null)

    // ----- Mode demo: simpan di state lokal saja -----
    if (isDemo) {
      if (formMode === 'create') {
        const nextNo = documents.length + 1
        const newDoc: DocRow = {
          id: `demo-${Date.now()}`,
          kode_arsip: `ARS-${new Date().getFullYear()}-${String(nextNo).padStart(4, '0')}`,
          nomor_dokumen: form.nomor_dokumen,
          judul: form.judul.trim(),
          kategori_id: form.kategori_id,
          kategori: kategoriName(form.kategori_id),
          deskripsi: form.deskripsi,
          status: 'menunggu_persetujuan',
          lokasi_saat_ini: form.lokasi_saat_ini || 'Meja Pengaju',
          tanggal_dokumen: form.tanggal_dokumen,
          tanggal_kadaluarsa: null,
          file_size: form.file?.size ?? null,
          file_path: '',
          bucket: 'arsip-aktif',
          pemilik_id: 'demo',
        }
        setDocuments((prev) => [newDoc, ...prev])
        showToast('success', `Dokumen ${newDoc.kode_arsip} ditambahkan (mode demo).`)
      } else if (editing) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === editing.id
              ? {
                  ...d,
                  judul: form.judul.trim(),
                  nomor_dokumen: form.nomor_dokumen,
                  kategori_id: form.kategori_id,
                  kategori: kategoriName(form.kategori_id),
                  deskripsi: form.deskripsi,
                  tanggal_dokumen: form.tanggal_dokumen,
                  lokasi_saat_ini: form.lokasi_saat_ini,
                  status: form.status,
                }
              : d
          )
        )
        showToast('success', `Dokumen ${editing.kode_arsip} diperbarui (mode demo).`)
      }
      setIsSaving(false)
      setFormMode(null)
      return
    }

    // ----- Mode live: Supabase -----
    try {
      if (formMode === 'create' && form.file && userId) {
        const safeName = form.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `${userId}/${Date.now()}_${safeName}`
        const { error: uploadError } = await supabase.storage.from('arsip-aktif').upload(filePath, form.file)
        if (uploadError) throw new Error(`Gagal mengunggah berkas: ${uploadError.message}`)

        const { data, error } = await supabase
          .from('dokumen')
          .insert({
            nomor_dokumen: form.nomor_dokumen || null,
            judul: form.judul.trim(),
            kategori_id: form.kategori_id,
            deskripsi: form.deskripsi || null,
            status: 'menunggu_persetujuan',
            file_path: filePath,
            bucket: 'arsip-aktif',
            file_size: form.file.size,
            mime_type: form.file.type || null,
            pemilik_id: userId,
            pemegang_saat_ini: userId,
            lokasi_saat_ini: form.lokasi_saat_ini || 'Meja Pengaju',
            tanggal_dokumen: form.tanggal_dokumen,
          })
          .select('kode_arsip')
          .single()

        if (error) {
          await supabase.storage.from('arsip-aktif').remove([filePath])
          throw error
        }
        showToast('success', `Dokumen ${data?.kode_arsip ?? ''} berhasil ditambahkan.`)
      } else if (formMode === 'edit' && editing) {
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

    if (isDemo) {
      setDocuments((prev) => prev.filter((d) => d.id !== deleting.id))
      showToast('success', `Dokumen ${deleting.kode_arsip} dihapus (mode demo).`)
      setIsDeleting(false)
      setDeleting(null)
      return
    }

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

  // ---------------- RENDER HELPERS ----------------
  const RetensiCell = ({ doc }: { doc: DocRow }) => {
    const sisa = sisaHari(doc.tanggal_kadaluarsa)
    if (sisa === null) return <span className="text-[#A5ABBC]">-</span>
    if (sisa === 0) return <span className="text-[#8A90A2]">Kedaluwarsa</span>
    const kritis = doc.status === 'aktif' && sisa < 90
    return (
      <div>
        <span className={`font-medium ${kritis ? 'text-[#D64545]' : 'text-[#1F2333]'}`}>
          {kritis && <AlertTriangle className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />}
          {sisa} hari
        </span>
        <span className="block text-xs text-[#8A90A2]">s.d. {formatTanggal(doc.tanggal_kadaluarsa)}</span>
      </div>
    )
  }

  const ActionButtons = ({ doc }: { doc: DocRow }) => (
    <div className="flex items-center justify-end gap-1">
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
    <AppLayout currentRole={isDemo ? role : undefined}>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#1F2333]">Daftar Dokumen</h1>
            <p className="mt-1 text-sm text-[#4B5163]">Kelola, telusuri, dan perbarui seluruh arsip dokumen Anda</p>
          </div>
          <div className="flex items-center gap-3">
            {canCreate && (
              <button
                type="button"
                onClick={openCreate}
                className="flex items-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-medium text-white shadow-sm shadow-[#3BA4E8]/30 transition-colors hover:bg-[#2A92D6]"
              >
                <Plus className="h-4 w-4" />
                Tambah Dokumen
              </button>
            )}
          </div>
        </div>

        {isDemo && (
          <div className="flex items-start gap-3 rounded-xl border border-[#BFE2F8] bg-[#EAF5FD] px-4 py-3 text-sm text-[#1E86C8]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">Mode demo.</span> Anda belum masuk atau koneksi Supabase gagal, jadi perubahan hanya tersimpan sementara di
              browser dan hilang saat halaman dimuat ulang.
            </p>
          </div>
        )}

        {/* Kartu ringkasan */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Total Dokumen', value: counts.semua, color: 'text-[#1F2333]' },
            { label: 'Arsip Aktif', value: counts.aktif, color: 'text-[#2F9E5B]' },
            { label: 'Menunggu Persetujuan', value: counts.menunggu_persetujuan, color: 'text-[#C98A1B]' },
            { label: 'Kritis < 90 Hari', value: counts.kritis, color: 'text-[#D64545]' },
          ].map((s) => (
            <div key={s.label} className={`${cardClass} p-5`}>
              <p className="text-sm text-[#4B5163]">{s.label}</p>
              <p className={`mt-2 text-[26px] font-bold tracking-tight ${s.color}`}>{s.value}</p>
            </div>
          ))}
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
                  placeholder="Cari kode arsip, judul, nomor dokumen, lokasi..."
                  className={`${inputClass} pl-10 pr-9`}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA0B2] hover:text-[#1F2333]">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
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
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#6B7185]">
              <Loader2 className="h-5 w-5 animate-spin" /> Memuat dokumen...
            </div>
          ) : filteredDocs.length === 0 ? (
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
                    <th className="px-5 py-3 font-normal">Dokumen</th>
                    <th className="px-4 py-3 font-normal">Kategori</th>
                    <th className="px-4 py-3 font-normal">Status</th>
                    <th className="px-4 py-3 font-normal">Lokasi</th>
                    <th className="px-4 py-3 font-normal">Retensi</th>
                    <th className="px-5 py-3 text-right font-normal">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F2F7]">
                  {pagedDocs.map((doc) => (
                    <tr key={doc.id} className="transition-colors hover:bg-[#F9FBFE]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EAF5FD] text-[#3BA4E8]">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <Link href={`/dokumen/${doc.id}`} className="block max-w-[320px] truncate font-semibold text-[#1F2333] hover:text-[#1E86C8]">
                              {doc.judul}
                            </Link>
                            <span className="block text-xs text-[#8A90A2]">
                              #{doc.kode_arsip}
                              {doc.nomor_dokumen && ` • ${doc.nomor_dokumen}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[#4B5163]">{doc.kategori}</td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${statusPill[doc.status].className}`}>
                          {statusPill[doc.status].label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[#4B5163]">{doc.lokasi_saat_ini}</td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <RetensiCell doc={doc} />
                      </td>
                      <td className="px-5 py-3.5">
                        <ActionButtons doc={doc} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
              {pagedDocs.map((doc) => (
                <div key={doc.id} className="flex flex-col rounded-xl border border-[#ECEEF5] p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EAF5FD] text-[#3BA4E8]">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${statusPill[doc.status].className}`}>{statusPill[doc.status].label}</span>
                  </div>
                  <Link href={`/dokumen/${doc.id}`} className="mt-3 line-clamp-2 font-semibold leading-snug text-[#1F2333] hover:text-[#1E86C8]">
                    {doc.judul}
                  </Link>
                  <p className="mt-1 text-xs text-[#8A90A2]">#{doc.kode_arsip}</p>
                  <div className="mt-3 space-y-1.5 text-xs text-[#4B5163]">
                    <p className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 text-[#9AA0B2]" /> {doc.kategori}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#9AA0B2]" /> <span className="truncate">{doc.lokasi_saat_ini}</span>
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-[#F1F2F7] pt-3 text-xs">
                    <span className="text-[#8A90A2]">{formatSize(doc.file_size)}</span>
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
      </div>

      {/* ================= MODAL TAMBAH / UBAH ================= */}
      {formMode && (
        <Modal
          title={formMode === 'create' ? 'Tambah Dokumen' : 'Ubah Dokumen'}
          subtitle={formMode === 'create' ? 'Dokumen baru akan berstatus Menunggu Persetujuan' : `#${editing?.kode_arsip}`}
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
                <Field label="Lokasi Fisik" hint={!isPrivileged && formMode === 'edit' ? 'Hanya PIC/Atasan/Admin yang dapat mengubah' : undefined}>
                  <input
                    className={inputClass}
                    value={form.lokasi_saat_ini}
                    disabled={formMode === 'edit' && !isPrivileged}
                    onChange={(e) => setForm({ ...form, lokasi_saat_ini: e.target.value })}
                    placeholder="Ruang Arsip - Rak A1"
                  />
                </Field>
              </div>

              {formMode === 'edit' && isPrivileged && (
                <Field label="Status">
                  <select
                    className={`${inputClass} cursor-pointer`}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as DokumenStatus })}
                  >
                    <option value="menunggu_persetujuan">Menunggu Persetujuan</option>
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Non-Aktif</option>
                    <option value="ditolak">Ditolak</option>
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

              {formMode === 'create' && (
                <Field label="Berkas Dokumen" required={!isDemo}>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#BFE2F8] bg-[#F5FAFE] px-4 py-6 text-center transition-colors hover:border-[#3BA4E8]">
                    <UploadCloud className="h-7 w-7 text-[#3BA4E8]" />
                    {form.file ? (
                      <>
                        <span className="text-sm font-medium text-[#1F2333]">{form.file.name}</span>
                        <span className="text-xs text-[#8A90A2]">{formatSize(form.file.size)} • klik untuk mengganti</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-[#1F2333]">Klik untuk memilih berkas</span>
                        <span className="text-xs text-[#8A90A2]">PDF, DOCX, JPG, atau PNG</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
                    />
                  </label>
                </Field>
              )}
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
                {formMode === 'create' ? 'Simpan Dokumen' : 'Simpan Perubahan'}
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
