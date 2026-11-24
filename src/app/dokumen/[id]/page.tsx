'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { DocumentQR } from '@/components/documents/qr-code'
import { UserRole, DokumenStatus, Lampiran, LogAktivitas } from '@/types'
import {
  ArrowLeft,
  QrCode,
  Download,
  FileText,
  Calendar,
  MapPin,
  User,
  ShieldCheck,
  AlertTriangle,
  FileDown,
  CheckCircle2,
  XCircle,
  History,
  Lock,
  Paperclip,
  Pencil,
  RotateCcw,
  AlertCircle,
  Info,
  Clock,
  Send,
  Loader2,
  BookOpenCheck,
  Upload,
  Trash2,
  ShieldAlert,
  Archive,
  Eye,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'

const STATUS_PILL: Record<DokumenStatus, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  aktif: { label: 'Aktif', className: 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]', icon: CheckCircle2 },
  menunggu_persetujuan: { label: 'Menunggu Persetujuan', className: 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]', icon: Clock },
  inaktif: { label: 'Inaktif', className: 'bg-[#EEF0F4] text-[#4B5163] border-[#DADCE0]', icon: Info },
  ditolak: { label: 'Ditolak', className: 'bg-[#FDECEC] text-[#D64545] border-[#F5C2C2]', icon: AlertCircle },
  dibatalkan: { label: 'Dibatalkan', className: 'bg-[#FDECEC] text-[#A82828] border-[#F5C2C2]', icon: XCircle },
}

function formatTanggal(value: string | null | undefined, month: 'short' | 'long' = 'short') {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month, year: 'numeric' })
}

interface PageProps {
  params: Promise<{ id: string }>
}

interface LogItem {
  id: string
  dokumen_id?: string
  user_id?: string
  aksi: string
  keterangan?: string
  created_at: string
  user?: { nama_lengkap?: string; email?: string }
}

export interface DokumenBoksInfo {
  id: string
  boks_id: string
  nomor_boks: string
  status_boks: string
  jumlah_lembar: number
  urutan: number
  lokasi_teks?: string
}

interface DetailDokumen {
  id: string
  kode_arsip: string
  nomor_dokumen: string | null
  nomor_ppl: string | null
  judul: string
  kategori_id: string
  kategori_nama: string
  penandatangan: string | null
  deskripsi: string | null
  status: DokumenStatus
  bucket: string
  file_path: string
  file_tipe: string | null
  ukuran_file: number | null
  pemilik_id: string
  pemilik_nama: string
  pemegang_saat_ini: string | null
  pemegang_nama: string
  lokasi_saat_ini: string
  tanggal_dokumen: string
  tanggal_masuk: string
  tanggal_disetujui: string | null
  tanggal_kadaluarsa: string | null
  disetujui_oleh: string | null
  approver_nama?: string
  alasan_penolakan: string | null
  created_at: string
  jumlah_halaman?: number
  unit_nama?: string
}

export default function DetailDokumenPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('staff')
  const [doc, setDoc] = useState<DetailDokumen | null>(null)
  const [lampiranList, setLampiranList] = useState<Lampiran[]>([])
  const [dokumenBoksList, setDokumenBoksList] = useState<DokumenBoksInfo[]>([])
  const [logList, setLogList] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null)

  // Modal State untuk Aksi Approval / Tolak / Ajukan Ulang / Pembatalan / Persetujuan Hapus / Hapus Permanen
  const [modalType, setModalType] = useState<
    'approve' | 'tolak' | 'ajukan_ulang' | 'batal' | 'persetujuan_hapus' | 'hapus_permanen' | null
  >(null)
  const [alasanTolak, setAlasanTolak] = useState('')
  const [alasanBatal, setAlasanBatal] = useState('')
  const [alasanPersetujuanHapus, setAlasanPersetujuanHapus] = useState('')
  const [alasanHapusPermanen, setAlasanHapusPermanen] = useState('')
  const [isSubmittingModal, setIsSubmittingModal] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // State Form Edit untuk Ajukan Ulang
  const [editJudul, setEditJudul] = useState('')
  const [editNomorDokumen, setEditNomorDokumen] = useState('')
  const [editNomorPpl, setEditNomorPpl] = useState('')
  const [editPenandatangan, setEditPenandatangan] = useState('')
  const [editDeskripsi, setEditDeskripsi] = useState('')
  const [editLokasi, setEditLokasi] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  // Load Data Dokumen
  const loadDocumentData = useCallback(async () => {
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

      // Query Dokumen Detail
      const { data: d, error: dError } = await supabase
        .from('dokumen')
        .select(`
          id, kode_arsip, nomor_dokumen, nomor_ppl, judul, kategori_id,
          penandatangan, deskripsi, status, bucket, file_path, file_tipe, ukuran_file,
          pemilik_id, pemegang_saat_ini, lokasi_saat_ini, tanggal_dokumen, tanggal_masuk,
          tanggal_disetujui, tanggal_kadaluarsa, disetujui_oleh,
          alasan_penolakan, created_at, jumlah_halaman, unit_id, boks_id,
          kategori_dokumen ( nama ),
          unit:unit_organisasi ( nama ),
          pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email ),
          pemegang:profiles!dokumen_pemegang_saat_ini_fkey ( nama_lengkap, email ),
          approver:profiles!dokumen_disetujui_oleh_fkey ( nama_lengkap, email )
        `)
        .eq('id', id)
        .single()

      if (dError || !d) {
        throw new Error(dError?.message || 'Dokumen tidak ditemukan dalam basis data.')
      }

      const formatted: DetailDokumen = {
        id: d.id,
        kode_arsip: d.kode_arsip,
        nomor_dokumen: d.nomor_dokumen,
        nomor_ppl: d.nomor_ppl,
        judul: d.judul,
        kategori_id: d.kategori_id,
        kategori_nama: (d.kategori_dokumen as any)?.nama || 'Umum',
        penandatangan: d.penandatangan,
        deskripsi: d.deskripsi,
        status: d.status,
        bucket: d.bucket || 'arsip-aktif',
        file_path: d.file_path,
        file_tipe: d.file_tipe,
        ukuran_file: d.ukuran_file,
        pemilik_id: d.pemilik_id,
        pemilik_nama: (d.pemilik as any)?.nama_lengkap || (d.pemilik as any)?.email || 'PIC Arsip Aktif',
        pemegang_saat_ini: d.pemegang_saat_ini,
        pemegang_nama: (d.pemegang as any)?.nama_lengkap || (d.pemegang as any)?.email || 'Pemegang',
        lokasi_saat_ini: d.lokasi_saat_ini || 'Ruang Arsip Aktif',
        tanggal_dokumen: d.tanggal_dokumen,
        tanggal_masuk: d.tanggal_masuk,
        tanggal_disetujui: d.tanggal_disetujui,
        tanggal_kadaluarsa: d.tanggal_kadaluarsa,
        disetujui_oleh: d.disetujui_oleh,
        approver_nama: (d.approver as any)?.nama_lengkap || (d.approver as any)?.email,
        alasan_penolakan: d.alasan_penolakan,
        created_at: d.created_at,
        jumlah_halaman: d.jumlah_halaman,
        unit_nama: (d.unit as any)?.nama || 'Keuangan',
      }

      setDoc(formatted)

      // Inisialisasi form edit ajukan ulang
      setEditJudul(formatted.judul)
      setEditNomorDokumen(formatted.nomor_dokumen || '')
      setEditNomorPpl(formatted.nomor_ppl || '')
      setEditPenandatangan(formatted.penandatangan || '')
      setEditDeskripsi(formatted.deskripsi || '')
      setEditLokasi(formatted.lokasi_saat_ini)

      // Query Dokumen Boks (Multi-Boks M9)
      try {
        const { data: dboksData } = await supabase
          .from('dokumen_boks')
          .select(`
            id, boks_id, jumlah_lembar, urutan,
            boks:boks_id (
              id, nomor_boks, status,
              lokasi:rak_id ( nama, parent:parent_id ( nama, parent:parent_id ( nama ) ) )
            )
          `)
          .eq('dokumen_id', id)
          .order('urutan', { ascending: true })

        if (dboksData && dboksData.length > 0) {
          const formattedBoks: DokumenBoksInfo[] = dboksData.map((b: any) => {
            const rak = b.boks?.lokasi?.nama || ''
            const ruangan = b.boks?.lokasi?.parent?.nama || ''
            const gedung = b.boks?.lokasi?.parent?.parent?.nama || ''
            const lokasiStr = [gedung, ruangan, rak].filter(Boolean).join(' > ')
            return {
              id: b.id,
              boks_id: b.boks_id,
              nomor_boks: b.boks?.nomor_boks || 'BOKS',
              status_boks: b.boks?.status || 'Aktif',
              jumlah_lembar: b.jumlah_lembar || 0,
              urutan: b.urutan || 1,
              lokasi_teks: lokasiStr || undefined,
            }
          })
          setDokumenBoksList(formattedBoks)
        } else if (d.boks_id) {
          const { data: singleBoks } = await supabase
            .from('boks')
            .select('id, nomor_boks, status')
            .eq('id', d.boks_id)
            .single()

          if (singleBoks) {
            setDokumenBoksList([
              {
                id: singleBoks.id,
                boks_id: singleBoks.id,
                nomor_boks: singleBoks.nomor_boks,
                status_boks: singleBoks.status || 'Aktif',
                jumlah_lembar: d.jumlah_halaman || 1,
                urutan: 1,
              },
            ])
          } else {
            setDokumenBoksList([])
          }
        } else {
          setDokumenBoksList([])
        }
      } catch (errBoks) {
        console.error('Gagal memuat relasi dokumen_boks:', errBoks)
        setDokumenBoksList([])
      }

      // Query Lampiran
      const { data: lamps } = await supabase
        .from('lampiran')
        .select('*')
        .eq('dokumen_id', id)
        .order('created_at', { ascending: true })

      setLampiranList(lamps || [])

      // Query Log Aktivitas untuk dokumen ini
      const { data: logs } = await supabase
        .from('log_aktivitas')
        .select(`
          id, dokumen_id, user_id, aksi, keterangan, created_at,
          user:profiles!log_aktivitas_user_id_fkey ( nama_lengkap, email )
        `)
        .eq('dokumen_id', id)
        .order('created_at', { ascending: false })

      const formattedLogs: LogItem[] = (logs || []).map((l: any) => ({
        id: l.id,
        dokumen_id: l.dokumen_id,
        user_id: l.user_id,
        aksi: l.aksi,
        keterangan: l.keterangan,
        created_at: l.created_at,
        user: Array.isArray(l.user) ? l.user[0] : l.user,
      }))

      setLogList(formattedLogs)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat dokumen'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDocumentData()
  }, [loadDocumentData])

  // Hitung sisa hari aktif
  const sisaHari = doc?.tanggal_kadaluarsa
    ? Math.max(0, Math.ceil((new Date(doc.tanggal_kadaluarsa).getTime() - Date.now()) / 86400000))
    : null

  const isAkanKadaluarsa = doc?.status === 'aktif' && sisaHari !== null && sisaHari < 90

  // Download Handler (Seluruh peran berhak mengunduh)
  const handleDownload = () => {
    window.open(`/api/dokumen/${id}/download`, '_blank')
  }

  const handleDownloadLampiran = (lampId: string) => {
    window.open(`/api/lampiran/${lampId}/download`, '_blank')
  }

  // State untuk Pratinjau Berkas (Modal Preview PDF, PNG, JPG, dll)
  const [previewFile, setPreviewFile] = useState<{
    nama: string
    url: string
    type: 'pdf' | 'image' | 'other'
    ukuran?: number | null
    downloadUrl: string
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const handlePreviewMainDoc = async () => {
    if (!doc) return
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/dokumen/${doc.id}/download?json=true&preview=true`)
      const data = await res.json()
      if (!res.ok || !data.signedUrl) {
        throw new Error(data.error || 'Gagal menerbitkan tautan pratinjau berkas.')
      }
      const rawExt = (namaFile || doc.file_path).split('.').pop()?.toLowerCase() || ''
      const isPdf = rawExt === 'pdf'
      const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(rawExt)

      setPreviewFile({
        nama: namaFile,
        url: data.signedUrl,
        type: isPdf ? 'pdf' : isImage ? 'image' : 'other',
        ukuran: doc.ukuran_file,
        downloadUrl: `/api/dokumen/${doc.id}/download`,
      })
    } catch (err: unknown) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal membuka pratinjau berkas.',
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handlePreviewLampiran = async (lamp: Lampiran) => {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/lampiran/${lamp.id}/download?json=true&preview=true`)
      const data = await res.json()
      if (!res.ok || !data.signedUrl) {
        throw new Error(data.error || 'Gagal menerbitkan tautan pratinjau lampiran.')
      }
      const rawExt = lamp.nama_file.split('.').pop()?.toLowerCase() || ''
      const isPdf = rawExt === 'pdf' || lamp.mime_type?.includes('pdf')
      const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(rawExt) || lamp.mime_type?.startsWith('image/')

      setPreviewFile({
        nama: lamp.nama_file,
        url: data.signedUrl,
        type: isPdf ? 'pdf' : isImage ? 'image' : 'other',
        ukuran: lamp.file_size,
        downloadUrl: `/api/lampiran/${lamp.id}/download`,
      })
    } catch (err: unknown) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal membuka pratinjau lampiran.',
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  // Aksi Eksekusi Modal (Verifikasi / Approve / Tolak / Ajukan Ulang)
  const handleExecuteModal = async () => {
    if (!modalType || !doc) return
    setIsSubmittingModal(true)

    try {
      if (modalType === 'approve') {
        const res = await fetch(`/api/dokumen/${doc.id}/approve`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menyetujui dokumen.')
        showToast('success', `Dokumen disahkan menjadi Aktif selama 3 tahun (s.d. ${data.tanggal_kadaluarsa}).`)
      } else if (modalType === 'tolak') {
        if (!alasanTolak.trim()) {
          showToast('error', 'Alasan penolakan wajib diisi.')
          setIsSubmittingModal(false)
          return
        }
        const res = await fetch(`/api/dokumen/${doc.id}/tolak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alasan: alasanTolak.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menolak dokumen.')
        showToast('success', 'Dokumen ditolak dan dikembalikan ke PIC Arsip Aktif beserta alasan.')
      } else if (modalType === 'ajukan_ulang') {
        if (!editJudul.trim()) {
          showToast('error', 'Judul dokumen wajib diisi.')
          setIsSubmittingModal(false)
          return
        }
        const fd = new FormData()
        fd.append('judul', editJudul.trim())
        fd.append('nomor_dokumen', editNomorDokumen.trim())
        fd.append('nomor_ppl', editNomorPpl.trim())
        fd.append('penandatangan', editPenandatangan.trim())
        fd.append('deskripsi', editDeskripsi.trim())
        fd.append('lokasi_saat_ini', editLokasi.trim() || doc.lokasi_saat_ini)
        if (editFile) fd.append('file', editFile)
        const res = await fetch(`/api/dokumen/${doc.id}/ajukan-ulang`, { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal mengajukan ulang dokumen.')
        setEditFile(null)
        showToast('success', 'Dokumen berhasil diperbaiki dan diajukan ulang untuk verifikasi PIC Arsip.')
      } else if (modalType === 'batal') {
        if (!alasanBatal.trim()) {
          showToast('error', 'Alasan pembatalan dokumen wajib diisi.')
          setIsSubmittingModal(false)
          return
        }
        const res = await fetch(`/api/dokumen/${doc.id}/batal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alasan: alasanBatal.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal membatalkan dokumen.')
        showToast('success', `Dokumen ${doc.kode_arsip} resmi dibatalkan dan berstatus DIBATALKAN.`)
      } else if (modalType === 'persetujuan_hapus') {
        if (!alasanPersetujuanHapus.trim()) {
          showToast('error', 'Alasan persetujuan hapus wajib diisi.')
          setIsSubmittingModal(false)
          return
        }
        const res = await fetch(`/api/dokumen/${doc.id}/persetujuan-hapus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alasan: alasanPersetujuanHapus.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal memberikan persetujuan hapus.')
        showToast('success', data.message || 'Persetujuan hapus berhasil dicatat di log aktivitas.')
        setAlasanPersetujuanHapus('')
      } else if (modalType === 'hapus_permanen') {
        if (!alasanHapusPermanen.trim()) {
          showToast('error', 'Alasan penghapusan permanen wajib diisi.')
          setIsSubmittingModal(false)
          return
        }
        const res = await fetch(`/api/dokumen/${doc.id}/hapus-permanen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alasan: alasanHapusPermanen.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menghapus permanen dokumen.')
        showToast('success', data.message || 'Dokumen berhasil dimusnahkan secara permanen.')
        router.push('/dokumen')
        return
      }

      setModalType(null)
      setAlasanTolak('')
      setAlasanBatal('')
      setAlasanPersetujuanHapus('')
      setAlasanHapusPermanen('')
      await loadDocumentData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      showToast('error', msg)
    } finally {
      setIsSubmittingModal(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-[#6B7185]">
          <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
          <p className="text-sm font-medium">Memuat detail dokumen...</p>
        </div>
      </AppLayout>
    )
  }

  if (errorMsg || !doc) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FDECEC] text-[#D64545]">
            <AlertCircle className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-semibold text-[#1F2333]">Dokumen tidak dapat dimuat</p>
          <p className="mt-1 text-xs text-[#6B7185]">{errorMsg || 'Dokumen arsip tidak ditemukan.'}</p>
          <Link
            href="/dokumen"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2A92D6]"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Dokumen
          </Link>
        </div>
      </AppLayout>
    )
  }

  const isOwner = currentUserId === doc.pemilik_id
  const isPicArsip = currentUserRole === 'pic_aktif'
  const isAtasan = currentUserRole === 'atasan_aktif' || currentUserRole === 'atasan_inaktif'
  const hasApprovalHapus = logList.some((l) => l.aksi === 'persetujuan_hapus')
  const status = STATUS_PILL[doc.status] || STATUS_PILL.inaktif
  const StatusIcon = status.icon
  const namaFile = doc.file_path.split('/').pop()?.replace(/^\d+_/, '') || 'Berkas dokumen'
  const kodeBagian = doc.kode_arsip.split('_')

  const cardClass = 'rounded-xl border border-[#ECEEF5] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
  const fieldInput =
    'w-full rounded-lg border border-[#E3E6F0] bg-white px-3.5 py-2.5 text-sm text-[#1F2333] placeholder:text-[#A5ABBC] focus:border-[#3BA4E8] focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]/15'

  const metaRows: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }[] = [
    { icon: User, label: 'Pengunggah (PIC Unit)', value: doc.pemilik_nama },
    { icon: User, label: 'Pemegang Saat Ini', value: doc.pemegang_nama },
    { icon: MapPin, label: 'Lokasi Fisik', value: doc.lokasi_saat_ini },
    { icon: Calendar, label: 'Tanggal Dokumen', value: formatTanggal(doc.tanggal_dokumen, 'long') },
    { icon: FileText, label: 'Lembar Fisik', value: `${doc.jumlah_halaman || 1} lembar` },
    {
      icon: Archive,
      label: 'Alokasi Boks Fisik',
      value:
        dokumenBoksList.length > 0 ? (
          <div className="flex flex-col gap-1.5 pt-0.5">
            {dokumenBoksList.map((b) => (
              <div key={b.id || b.boks_id} className="inline-flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-[#1F2333]">BOKS-{b.nomor_boks}</span>
                <span className="text-[#6B7185]">&mdash; {b.jumlah_lembar} lembar</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    b.status_boks === 'Penuh'
                      ? 'bg-[#FDECEC] text-[#D64545]'
                      : 'bg-[#E6F4EA] text-[#137333]'
                  }`}
                >
                  {b.status_boks}
                </span>
              </div>
            ))}
          </div>
        ) : (
          '-'
        ),
    },
    { icon: ShieldCheck, label: 'Unit Organisasi', value: doc.unit_nama || 'Keuangan' },
    {
      icon: CheckCircle2,
      label: 'Approver Atasan',
      value: doc.approver_nama || (doc.disetujui_oleh ? 'Disahkan Atasan' : 'Belum disahkan'),
    },
  ]

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-5 pb-16">
        {/* Navigasi atas & aksi */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#6B7185] transition-colors hover:text-[#1E86C8]"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Dokumen
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {doc.status === 'aktif' && (
              <>
                <Link
                  href={`/serah-terima?kode=${doc.kode_arsip}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2A92D6] sm:flex-none"
                >
                  <QrCode className="h-4 w-4" />
                  Serah Terima
                </Link>
                {isAtasan && (
                  <button
                    type="button"
                    onClick={() => setModalType('batal')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#F5C2C2] bg-white px-4 py-2 text-sm font-semibold text-[#D64545] transition-colors hover:bg-[#FDECEC] sm:flex-none"
                    title="Pembatalan Dokumen Aktif oleh Atasan Unit"
                  >
                    <XCircle className="h-4 w-4" />
                    Batalkan Dokumen
                  </button>
                )}
              </>
            )}
            {doc.status === 'inaktif' && (
              <Link
                href={`/peminjaman?dokumen_id=${doc.id}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2A92D6] sm:flex-none"
              >
                <BookOpenCheck className="h-4 w-4" />
                Ajukan Peminjaman
              </Link>
            )}

            {/* Aksi Persetujuan Hapus bagi Atasan */}
            {isAtasan && !hasApprovalHapus && (
              <button
                type="button"
                onClick={() => setModalType('persetujuan_hapus')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#FEEFC3] bg-[#FEF7E0] px-4 py-2 text-sm font-semibold text-[#B06000] transition-colors hover:bg-[#FEEFC3] sm:flex-none"
                title="Beri persetujuan hapus dokumen untuk dieksekusi Superadmin"
              >
                <ShieldAlert className="h-4 w-4" />
                Setujui Hapus
              </button>
            )}

            {/* Status bila Atasan telah menyetujui hapus */}
            {hasApprovalHapus && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#CEEAD6] bg-[#E6F4EA] px-3 py-2 text-xs font-semibold text-[#137333]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Persetujuan Hapus Atasan Terverifikasi
              </span>
            )}

            {/* Aksi Hapus Permanen HANYA untuk Superadmin */}
            {currentUserRole === 'superadmin' && (
              <button
                type="button"
                onClick={() => setModalType('hapus_permanen')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#D64545] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B91C1C] sm:flex-none cursor-pointer"
                title="Hapus permanen berkas dan dokumen"
              >
                <Trash2 className="h-4 w-4" />
                Hapus Permanen
              </button>
            )}
          </div>
        </div>

        {/* Banner Mode Audit Superadmin */}
        {currentUserRole === 'superadmin' && (
          <div className="flex items-center gap-2.5 rounded-xl border border-[#BCE1F9] bg-[#F0F8FF] px-4 py-2.5 text-xs text-[#1E86C8] shadow-xs">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#3BA4E8]" />
            <span>
              <strong>Mode Audit Dokumen (Superadmin):</strong> Meninjau berkas, seluruh metadata, serta jejak audit aktivitas secara lengkap dan transparan.
            </span>
          </div>
        )}

        {/* Kartu judul */}
        <div className={`${cardClass} relative overflow-hidden`}>
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#3BA4E8] to-[#7CC4F2]" />
          <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FD] text-[#3BA4E8] sm:flex">
                <FileText className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#ECEEF5] bg-[#F7F8FC] px-2.5 py-0.5 text-xs font-medium text-[#4B5163]">
                    {doc.kategori_nama}
                  </span>
                  {isAkanKadaluarsa && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#F5C2C2] bg-[#FDECEC] px-2.5 py-0.5 text-xs font-semibold text-[#D64545]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Akan Kadaluarsa
                    </span>
                  )}
                </div>
                <h1 className="mt-2 break-words text-xl font-bold leading-tight tracking-tight text-[#1F2333] sm:text-2xl">
                  {doc.judul}
                </h1>
                <KodeArsip kode={doc.kode_arsip} className="block mt-1.5 font-mono text-sm text-[#1E86C8]" />
              </div>
            </div>
          </div>

          {/* Pecahan kode arsip */}
          <div className="grid grid-cols-2 border-t border-[#ECEEF5] sm:grid-cols-4">
            {[
              { label: 'Tahun', value: kodeBagian.length === 4 ? kodeBagian[0] : '-' },
              { label: 'Kode Perusahaan', value: kodeBagian.length === 4 ? kodeBagian[1] : '-' },
              { label: 'No. Payment (PPL)', value: doc.nomor_ppl || (kodeBagian.length === 4 ? kodeBagian[2] : '-') },
              { label: 'Doc Voucher', value: doc.nomor_dokumen || (kodeBagian.length === 4 ? kodeBagian[3] : '-') },
            ].map((item, i) => (
              <div
                key={item.label}
                className={`px-5 py-3.5 sm:px-6 ${i % 2 === 1 ? 'border-l border-[#ECEEF5]' : ''} ${i >= 2 ? 'border-t border-[#ECEEF5] sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''}`}
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#9AA0B2]">{item.label}</p>
                <p className="mt-0.5 break-all font-mono text-sm font-semibold text-[#1F2333]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Banner status */}
        {doc.status === 'dibatalkan' && (
          <div className="flex items-start gap-3 rounded-xl border border-[#F5C2C2] bg-[#FFF5F5] p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#D64545]" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-[#A82828]">Dokumen telah dibatalkan</p>
              <p className="mt-1 text-[#4B5163]">
                <span className="font-medium">Alasan:</span> {doc.alasan_penolakan || 'Tidak ada keterangan spesifik.'}
              </p>
              <p className="mt-1 text-xs text-[#8A90A2]">
                Kode arsip tetap tersimpan dan tidak dapat dipakai ulang.
              </p>
            </div>
          </div>
        )}

        {doc.status === 'inaktif' && (
          <div className="flex flex-col gap-3 rounded-xl border border-[#BCE1F9] bg-[#F3FAFF] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#3BA4E8]" />
              <div className="text-sm">
                <p className="font-semibold text-[#1F2333]">Dokumen berstatus Inaktif</p>
                <p className="mt-0.5 text-[#4B5163]">
                  Masa aktif telah berakhir. Berkas tersimpan di Gudang Inaktif dan dapat dipinjam melalui PIC Arsip.
                </p>
              </div>
            </div>
            {currentUserRole && (
              <Link
                href={`/peminjaman?dokumen_id=${doc.id}`}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2A92D6]"
              >
                <BookOpenCheck className="h-4 w-4" />
                Pinjam Dokumen Ini
              </Link>
            )}
          </div>
        )}

        {doc.status === 'ditolak' && (
          <div className="flex flex-col gap-3 rounded-xl border border-[#F5C2C2] bg-[#FFF5F5] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#D64545]" />
              <div className="text-sm">
                <p className="font-semibold text-[#A82828]">Dokumen ditolak</p>
                <p className="mt-0.5 text-[#4B5163]">
                  <span className="font-medium">Alasan:</span> {doc.alasan_penolakan || 'Tidak ada keterangan spesifik.'}
                </p>
              </div>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setModalType('ajukan_ulang')}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2A92D6]"
              >
                <RotateCcw className="h-4 w-4" />
                Perbaiki & Ajukan Ulang
              </button>
            )}
          </div>
        )}

        {doc.status === 'menunggu_persetujuan' && (
          <div className="flex flex-col gap-3 rounded-xl border border-[#FEEFC3] bg-[#FFFBEF] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#B06000]" />
              <div className="text-sm">
                <p className="font-semibold text-[#1F2333]">Menunggu Persetujuan Atasan</p>
                <p className="mt-0.5 text-[#4B5163]">
                  Dokumen telah dientri oleh PIC Arsip Aktif dan sedang menunggu pengesahan menjadi arsip aktif oleh Atasan Arsip Aktif.
                </p>
              </div>
            </div>

            {isAtasan && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalType('tolak')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#F5C2C2] bg-white px-4 py-2 text-sm font-semibold text-[#D64545] hover:bg-[#FDECEC] sm:flex-none"
                >
                  <XCircle className="h-4 w-4" />
                  Tolak Dokumen
                </button>
                <button
                  type="button"
                  onClick={() => setModalType('approve')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#15803D] sm:flex-none"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Sahkan Aktif (+3 Tahun)
                </button>
              </div>
            )}
          </div>
        )}

        {downloadNotice && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#F5C2C2] bg-[#FFF5F5] px-4 py-3 text-sm text-[#A82828]">
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0" />
              {downloadNotice}
            </span>
            <button type="button" onClick={() => setDownloadNotice(null)} className="rounded-md p-1 hover:bg-black/5">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Konten utama */}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {/* Masa retensi */}
            <div className={`${cardClass} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isAkanKadaluarsa ? 'bg-[#FDECEC] text-[#D64545]' : 'bg-[#EAF5FD] text-[#3BA4E8]'
                    }`}
                  >
                    <Clock className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-[#8A90A2]">Masa Retensi Aktif</p>
                    {doc.status === 'aktif' && doc.tanggal_kadaluarsa ? (
                      <p className={`text-base font-semibold ${isAkanKadaluarsa ? 'text-[#D64545]' : 'text-[#1F2333]'}`}>
                        {sisaHari} hari lagi
                        <span className="ml-1.5 text-sm font-normal text-[#8A90A2]">
                          s.d. {formatTanggal(doc.tanggal_kadaluarsa)}
                        </span>
                      </p>
                    ) : doc.status === 'inaktif' ? (
                      <p className="text-base font-semibold text-[#6B7185]">Masa aktif berakhir</p>
                    ) : (
                      <p className="text-base font-semibold text-[#6B7185]">Menunggu pengesahan Atasan</p>
                    )}
                  </div>
                </div>
              </div>
              {doc.status === 'aktif' && sisaHari !== null && (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F1F3F8]">
                  <div
                    className={`h-full rounded-full ${isAkanKadaluarsa ? 'bg-[#EA4335]' : 'bg-[#3BA4E8]'}`}
                    style={{ width: `${Math.min(100, Math.max(3, (sisaHari / (365 * 3)) * 100))}%` }}
                  />
                </div>
              )}
            </div>

            {/* Informasi dokumen */}
            <div className={cardClass}>
              <div className="border-b border-[#ECEEF5] px-5 py-4">
                <h2 className="text-base font-semibold text-[#1F2333]">Informasi Dokumen</h2>
              </div>
              <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
                {metaRows.map((row) => {
                  const Icon = row.icon
                  return (
                    <div key={row.label} className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3FAFF] text-[#3BA4E8]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-xs text-[#8A90A2]">{row.label}</dt>
                        <dd className="break-words text-sm font-medium text-[#1F2333]">{row.value}</dd>
                      </div>
                    </div>
                  )
                })}
              </dl>
              {dokumenBoksList.length > 1 && (
                <div className="border-t border-[#ECEEF5] bg-[#F0F8FF] px-5 py-3.5 flex items-start gap-3">
                  <Archive className="h-5 w-5 text-[#1E86C8] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#1F2333]">
                    <span className="font-bold text-[#1E86C8]">Alokasi Multi-Boks (Aturan M9):</span>
                    <p className="mt-0.5 text-[#4B5163]">
                      Dokumen bervolume tebal ({doc.jumlah_halaman} lembar) dipecah secara berurutan ke{' '}
                      <strong>{dokumenBoksList.length} boks</strong> sesuai kapasitas maksimal standar (500 lembar per boks):{' '}
                      <span className="font-semibold text-[#1F2333]">
                        {dokumenBoksList.map((b) => `BOKS-${b.nomor_boks} (${b.jumlah_lembar} lbr - ${b.status_boks})`).join(', ')}
                      </span>.
                    </p>
                  </div>
                </div>
              )}
              {doc.deskripsi && (
                <div className="border-t border-[#ECEEF5] px-5 py-4">
                  <p className="text-xs text-[#8A90A2]">Deskripsi / Ringkasan</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#4B5163]">{doc.deskripsi}</p>
                </div>
              )}
            </div>

            {/* Berkas digital */}
            <div className={cardClass}>
              <div className="border-b border-[#ECEEF5] px-5 py-4">
                <h2 className="text-base font-semibold text-[#1F2333]">Berkas Digital</h2>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex flex-col gap-3 rounded-xl border border-[#ECEEF5] bg-[#F8FBFE] p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#3BA4E8] shadow-sm">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#1F2333]">{namaFile}</p>
                      <p className="text-xs text-[#8A90A2]">
                        {doc.ukuran_file ? `${(doc.ukuran_file / 1024 / 1024).toFixed(2)} MB` : '-'} · {doc.bucket}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handlePreviewMainDoc}
                      disabled={previewLoading}
                      title="Lihat isi berkas (Pratinjau)"
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-[#CBD7E3] bg-white px-3.5 py-2 text-sm font-semibold text-[#1F2333] shadow-xs transition-colors hover:bg-[#EEF7FD] hover:text-[#1E86C8] hover:border-[#3BA4E8] active:scale-[0.98] disabled:opacity-50"
                    >
                      {previewLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#1E86C8]" />
                      ) : (
                        <Eye className="h-4 w-4 text-[#1E86C8]" />
                      )}
                      <span>Lihat</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      title="Unduh berkas"
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-[#3BA4E8] px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#2A92D6] active:scale-[0.98]"
                    >
                      <Download className="h-4 w-4" />
                      <span>Unduh</span>
                    </button>

                    {/* Ikon Sampah Hapus File Khusus Superadmin */}
                    {currentUserRole === 'superadmin' && (
                      <button
                        type="button"
                        onClick={() => setModalType('hapus_permanen')}
                        title="Hapus permanen berkas dan dokumen"
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2 text-sm font-semibold text-[#D64545] shadow-xs transition-colors hover:bg-[#FEE2E2] active:scale-[0.98] cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4 text-[#D64545]" />
                        <span className="text-[#D64545]">Hapus</span>
                      </button>
                    )}
                  </div>
                </div>

                {lampiranList.length > 0 && (
                  <div>
                    <p className="mb-2 mt-1 flex items-center gap-1.5 text-xs font-medium text-[#8A90A2]">
                      <Paperclip className="h-3.5 w-3.5" />
                      Lampiran Pendukung ({lampiranList.length})
                    </p>
                    <div className="divide-y divide-[#ECEEF5] rounded-xl border border-[#ECEEF5]">
                      {lampiranList.map((lamp) => (
                        <div key={lamp.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-[#F7FBFE]">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-[#1F2333]">{lamp.nama_file}</p>
                            <p className="text-xs text-[#9AA0B2]">
                              {(lamp.file_size / 1024).toFixed(0)} KB · {lamp.mime_type || 'file'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handlePreviewLampiran(lamp)}
                              disabled={previewLoading}
                              title="Lihat isi lampiran"
                              className="flex items-center gap-1 rounded-lg border border-[#E3E6F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#4B5163] hover:border-[#3BA4E8] hover:text-[#1E86C8] transition-colors disabled:opacity-50"
                            >
                              <Eye className="h-3.5 w-3.5 text-[#1E86C8]" />
                              <span>Lihat</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadLampiran(lamp.id)}
                              title="Unduh lampiran"
                              className="flex items-center gap-1 rounded-lg border border-[#E3E6F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#4B5163] hover:border-[#3BA4E8] hover:text-[#1E86C8] transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Unduh</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Riwayat */}
            <div className={cardClass}>
              <div className="flex items-center gap-2 border-b border-[#ECEEF5] px-5 py-4">
                <History className="h-4 w-4 text-[#3BA4E8]" />
                <h2 className="text-base font-semibold text-[#1F2333]">Riwayat Dokumen</h2>
              </div>
              {logList.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[#8A90A2]">
                  Belum ada riwayat aktivitas untuk dokumen ini.
                </p>
              ) : (
                <ol className="relative px-5 py-4">
                  {logList.map((log, idx) => {
                    const userDisplay = log.user?.nama_lengkap || log.user?.email || 'Sistem'
                    const last = idx === logList.length - 1
                    return (
                      <li key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {!last && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-[#E3E6F0]" />}
                        <span
                          className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-[3px] ${
                            idx === 0 ? 'border-[#BCE1F9] bg-[#3BA4E8]' : 'border-white bg-[#C9D3DE] ring-1 ring-[#E3E6F0]'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                            <p className="text-sm font-semibold capitalize text-[#1F2333]">
                              {log.aksi.replace(/_/g, ' ').toLowerCase()}
                            </p>
                            <span className="shrink-0 text-xs text-[#9AA0B2]">
                              {new Date(log.created_at).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {log.keterangan && (
                            <p className="mt-0.5 break-words text-sm leading-relaxed text-[#4B5163]">{log.keterangan}</p>
                          )}
                          <p className="mt-0.5 text-xs text-[#9AA0B2]">oleh {userDisplay}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </div>

          {/* Kolom kanan: label QR */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <DocumentQR
              kodeArsip={doc.kode_arsip}
              judul={doc.judul}
              nomorDokumen={doc.nomor_dokumen || undefined}
              nomorPpl={doc.nomor_ppl || undefined}
              size={170}
              className="bg-white"
            />
          </div>
        </div>
      </div>

      {/* ================= MODAL PRATINJAU BERKAS (PDF / GAMBAR / BERKAS LAIN) ================= */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative flex flex-col w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-[#CBD7E3] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-[#ECEEF5] px-5 py-3.5 bg-[#F8FAFC]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-2 rounded-lg bg-[#E0F2FE] text-[#0284C7] shrink-0">
                  {previewFile.type === 'pdf' ? (
                    <FileText className="h-4 w-4" />
                  ) : previewFile.type === 'image' ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#1F2333] truncate" title={previewFile.nama}>
                    {previewFile.nama}
                  </h3>
                  <p className="text-[11px] text-[#6B7185]">
                    {previewFile.ukuran ? `${(previewFile.ukuran / 1024 / 1024).toFixed(2)} MB • ` : ''}
                    {previewFile.type === 'pdf' ? 'Dokumen PDF' : previewFile.type === 'image' ? 'Berkas Gambar' : 'Berkas Fisik'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewFile.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD7E3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F2333] hover:bg-[#EEF7FD] hover:text-[#1E86C8] transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 rounded-lg text-[#6B7185] hover:text-[#1F2333] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
                  title="Tutup Pratinjau"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Konten File */}
            <div className="flex-1 overflow-auto bg-[#0F172A]/5 p-2 sm:p-4 flex items-center justify-center min-h-[440px] max-h-[calc(92vh-120px)]">
              {previewFile.type === 'pdf' ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.nama}
                  className="w-full h-full min-h-[560px] rounded-lg bg-white border border-[#CBD7E3] shadow-xs"
                />
              ) : previewFile.type === 'image' ? (
                <div className="max-w-full max-h-full flex items-center justify-center p-2">
                  <img
                    src={previewFile.url}
                    alt={previewFile.nama}
                    className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-md border border-[#E2E8F0] bg-white"
                  />
                </div>
              ) : (
                <div className="text-center p-8 space-y-3 bg-white rounded-xl border border-[#ECEEF5] max-w-md shadow-xs">
                  <FileText className="h-12 w-12 text-[#94A3B8] mx-auto" />
                  <div>
                    <p className="text-sm font-semibold text-[#1F2333]">Pratinjau Langsung Tidak Tersedia</p>
                    <p className="text-xs text-[#6B7185] mt-1">
                      Format berkas ini ({previewFile.nama.split('.').pop()?.toUpperCase()}) tidak mendukung pratinjau browser langsung. Silakan unduh berkas untuk membukanya.
                    </p>
                  </div>
                  <a
                    href={previewFile.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1E86C8] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#166EAA] transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Unduh Sekarang</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL AKSI ================= */}
      {modalType && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => !isSubmittingModal && setModalType(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#ECEEF5] p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    modalType === 'tolak' || modalType === 'batal' || modalType === 'hapus_permanen'
                      ? 'bg-[#FDECEC] text-[#D64545]'
                      : modalType === 'persetujuan_hapus'
                      ? 'bg-[#FEF7E0] text-[#B06000]'
                      : 'bg-[#EAF5FD] text-[#3BA4E8]'
                  }`}
                >
                  {modalType === 'tolak' || modalType === 'batal' ? (
                    <XCircle className="h-5 w-5" />
                  ) : modalType === 'hapus_permanen' ? (
                    <Trash2 className="h-5 w-5" />
                  ) : modalType === 'persetujuan_hapus' ? (
                    <ShieldAlert className="h-5 w-5" />
                  ) : modalType === 'ajukan_ulang' ? (
                    <Send className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[#1F2333]">
                    {modalType === 'approve'
                      ? 'Pengesahan Akhir (Atasan)'
                      : modalType === 'tolak'
                      ? 'Tolak Pengajuan Dokumen'
                      : modalType === 'batal'
                      ? 'Pembatalan Dokumen Aktif'
                      : modalType === 'persetujuan_hapus'
                      ? 'Persetujuan Hapus Dokumen (Atasan)'
                      : modalType === 'hapus_permanen'
                      ? 'Hapus Permanen Dokumen (Superadmin)'
                      : 'Perbaiki & Ajukan Ulang'}
                  </h3>
                  <KodeArsip kode={doc.kode_arsip} className="block mt-0.5 font-mono text-xs text-[#6B7185]" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingModal && setModalType(null)}
                className="rounded-lg p-1.5 text-[#6B7185] hover:bg-[#F4F5FA] hover:text-[#1F2333]"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5 text-sm text-[#4B5163]">
              {modalType === 'approve' && (
                <p className="leading-relaxed">
                  Status dokumen akan menjadi <strong className="text-[#1F2333]">Aktif</strong> dengan masa retensi <strong className="text-[#1F2333]">3 tahun</strong>, dan label QR resmi siap diterbitkan.
                </p>
              )}

              {modalType === 'tolak' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">
                    Alasan Penolakan <span className="text-[#D64545]">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={alasanTolak}
                    onChange={(e) => setAlasanTolak(e.target.value)}
                    placeholder="Tuliskan alasan penolakan secara jelas..."
                    className={`${fieldInput} resize-none focus:border-[#D64545] focus:ring-[#D64545]/15`}
                  />
                </div>
              )}

              {modalType === 'batal' && (
                <>
                  <p className="leading-relaxed">
                    Pembatalan dokumen Aktif hanya dapat disahkan oleh Atasan Arsip Aktif unit terkait. Kode arsip tetap disimpan dan tidak dapat dipakai ulang; dokumen akan berstatus <strong className="text-[#1F2333]">Dibatalkan</strong>.
                  </p>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">
                      Alasan Pembatalan <span className="text-[#D64545]">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={alasanBatal}
                      onChange={(e) => setAlasanBatal(e.target.value)}
                      placeholder="Tuliskan alasan resmi pembatalan dokumen ini..."
                      className={`${fieldInput} resize-none focus:border-[#D64545] focus:ring-[#D64545]/15`}
                    />
                  </div>
                </>
              )}

              {modalType === 'persetujuan_hapus' && (
                <>
                  <p className="leading-relaxed text-xs text-[#B06000] bg-[#FEF7E0] border border-[#FEEFC3] p-3 rounded-xl">
                    Persetujuan ini memberikan wewenang kepada Superadmin untuk memusnahkan arsip secara permanen. Tindakan ini akan dicatat dalam audit trail log aktivitas kearsipan.
                  </p>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">
                      Alasan Persetujuan Hapus <span className="text-[#D64545]">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={alasanPersetujuanHapus}
                      onChange={(e) => setAlasanPersetujuanHapus(e.target.value)}
                      placeholder="Tuliskan alasan dan dasar persetujuan penghapusan dokumen ini..."
                      className={`${fieldInput} resize-none focus:border-[#B06000] focus:ring-[#B06000]/15`}
                    />
                  </div>
                </>
              )}

              {modalType === 'hapus_permanen' && (
                <>
                  <div className="rounded-xl border border-[#F5C2C2] bg-[#FFF5F5] p-3.5 space-y-1">
                    <p className="text-xs font-bold text-[#A82828] flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Peringatan Tindakan Pemusnahan Permanen
                    </p>
                    <p className="text-xs text-[#4B5163] leading-relaxed">
                      Dokumen <strong className="font-mono text-[#1F2333]">{doc.kode_arsip}</strong> beserta seluruh berkas digital di storage akan <strong>dihapus permanen</strong> dari sistem.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">
                      Alasan Penghapusan Permanen (Audit) <span className="text-[#D64545]">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={alasanHapusPermanen}
                      onChange={(e) => setAlasanHapusPermanen(e.target.value)}
                      placeholder="Tuliskan alasan pemusnahan dokumen untuk catatan audit Superadmin..."
                      className={`${fieldInput} resize-none focus:border-[#D64545] focus:ring-[#D64545]/15`}
                    />
                  </div>
                </>
              )}

              {modalType === 'ajukan_ulang' && (
                <>
                  <p className="text-xs text-[#6B7185]">
                    Perbaiki data di bawah ini. Setelah diajukan ulang, alur dimulai kembali dari verifikasi PIC Arsip.
                  </p>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">
                      Judul Dokumen <span className="text-[#D64545]">*</span>
                    </label>
                    <input type="text" value={editJudul} onChange={(e) => setEditJudul(e.target.value)} className={fieldInput} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">No. Payment / PPL</label>
                      <input
                        type="text"
                        value={editNomorPpl}
                        onChange={(e) => setEditNomorPpl(e.target.value)}
                        className={`${fieldInput} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">Doc Voucher</label>
                      <input
                        type="text"
                        value={editNomorDokumen}
                        onChange={(e) => setEditNomorDokumen(e.target.value)}
                        className={`${fieldInput} font-mono`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">Lokasi Fisik Berkas</label>
                    <input type="text" value={editLokasi} onChange={(e) => setEditLokasi(e.target.value)} className={fieldInput} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#1F2333]">
                      Unggah Dokumen Perbaikan <span className="font-normal text-[#9AA0B2]">(opsional)</span>
                    </label>
                    {editFile ? (
                      <div className="flex items-center gap-3 rounded-xl border border-[#BCE1F9] bg-[#F3FAFF] p-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#3BA4E8] shadow-sm">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#1F2333]">{editFile.name}</p>
                          <p className="text-xs text-[#8A90A2]">{(editFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditFile(null)}
                          className="rounded-md p-1 text-[#8A90A2] hover:bg-white hover:text-[#D64545]"
                          title="Hapus berkas"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-[#BCE1F9] bg-[#F8FBFE] px-4 py-5 text-center transition-colors hover:border-[#3BA4E8] hover:bg-[#F3FAFF]">
                        <Upload className="h-5 w-5 text-[#3BA4E8]" />
                        <span className="text-sm font-medium text-[#1E86C8]">Pilih berkas pengganti</span>
                        <span className="text-xs text-[#8A90A2]">PDF, XLSX, XLS, CSV, PNG, atau JPG</span>
                        <input
                          type="file"
                          accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                          className="sr-only"
                          onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                    <p className="mt-1 text-xs text-[#8A90A2]">
                      Kosongkan bila berkas tidak berubah. Berkas lama tetap tersimpan sebagai jejak arsip.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#ECEEF5] p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isSubmittingModal}
                onClick={() => setModalType(null)}
                className="rounded-lg border border-[#E3E6F0] bg-white px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F7F8FC]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  isSubmittingModal ||
                  (modalType === 'tolak' && !alasanTolak.trim()) ||
                  (modalType === 'batal' && !alasanBatal.trim()) ||
                  (modalType === 'persetujuan_hapus' && !alasanPersetujuanHapus.trim()) ||
                  (modalType === 'hapus_permanen' && !alasanHapusPermanen.trim())
                }
                onClick={handleExecuteModal}
                className={`flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${
                  modalType === 'tolak' || modalType === 'batal' || modalType === 'hapus_permanen'
                    ? 'bg-[#D64545] hover:bg-[#C03A3A]'
                    : modalType === 'persetujuan_hapus'
                    ? 'bg-[#E37400] hover:bg-[#C26300]'
                    : 'bg-[#3BA4E8] hover:bg-[#2A92D6]'
                }`}
              >
                {isSubmittingModal && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmittingModal
                  ? 'Memproses...'
                  : modalType === 'approve'
                  ? 'Sahkan Aktif (+3 Tahun)'
                  : modalType === 'tolak'
                  ? 'Tolak Dokumen'
                  : modalType === 'batal'
                  ? 'Batalkan Dokumen'
                  : modalType === 'persetujuan_hapus'
                  ? 'Setujui Penghapusan'
                  : modalType === 'hapus_permanen'
                  ? 'Eksekusi Hapus Permanen'
                  : 'Kirim Ajukan Ulang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST ================= */}
      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 z-[60] flex items-start gap-3 rounded-xl border p-4 shadow-lg sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200 ${
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
          <p className="flex-1 text-sm font-medium leading-relaxed">{toast.text}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-md p-0.5 hover:bg-black/10">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}
    </AppLayout>
  )
}
