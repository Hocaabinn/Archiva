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
  verifikasi_pic_oleh: string | null
  verifikator_nama?: string
  disetujui_oleh: string | null
  approver_nama?: string
  alasan_penolakan: string | null
  created_at: string
}

export default function DetailDokumenPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('user')
  const [doc, setDoc] = useState<DetailDokumen | null>(null)
  const [lampiranList, setLampiranList] = useState<Lampiran[]>([])
  const [logList, setLogList] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null)

  // Modal State untuk Aksi Approval / Tolak / Ajukan Ulang / Pembatalan
  const [modalType, setModalType] = useState<'verifikasi' | 'approve' | 'tolak' | 'ajukan_ulang' | 'batal' | null>(null)
  const [alasanTolak, setAlasanTolak] = useState('')
  const [alasanBatal, setAlasanBatal] = useState('')
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
          tanggal_disetujui, tanggal_kadaluarsa, verifikasi_pic_oleh, disetujui_oleh,
          alasan_penolakan, created_at,
          kategori_dokumen ( nama ),
          pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email ),
          pemegang:profiles!dokumen_pemegang_saat_ini_fkey ( nama_lengkap, email ),
          verifikator:profiles!dokumen_verifikasi_pic_oleh_fkey ( nama_lengkap, email ),
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
        pemilik_nama: (d.pemilik as any)?.nama_lengkap || (d.pemilik as any)?.email || 'Pengaju',
        pemegang_saat_ini: d.pemegang_saat_ini,
        pemegang_nama: (d.pemegang as any)?.nama_lengkap || (d.pemegang as any)?.email || 'Pemegang',
        lokasi_saat_ini: d.lokasi_saat_ini || 'Ruang Arsip Aktif',
        tanggal_dokumen: d.tanggal_dokumen,
        tanggal_masuk: d.tanggal_masuk,
        tanggal_disetujui: d.tanggal_disetujui,
        tanggal_kadaluarsa: d.tanggal_kadaluarsa,
        verifikasi_pic_oleh: d.verifikasi_pic_oleh,
        verifikator_nama: (d.verifikator as any)?.nama_lengkap || (d.verifikator as any)?.email,
        disetujui_oleh: d.disetujui_oleh,
        approver_nama: (d.approver as any)?.nama_lengkap || (d.approver as any)?.email,
        alasan_penolakan: d.alasan_penolakan,
        created_at: d.created_at,
      }

      setDoc(formatted)

      // Inisialisasi form edit ajukan ulang
      setEditJudul(formatted.judul)
      setEditNomorDokumen(formatted.nomor_dokumen || '')
      setEditNomorPpl(formatted.nomor_ppl || '')
      setEditPenandatangan(formatted.penandatangan || '')
      setEditDeskripsi(formatted.deskripsi || '')
      setEditLokasi(formatted.lokasi_saat_ini)

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

  // Download Handler
  const handleDownload = () => {
    if (currentUserRole === 'viewer') {
      setDownloadNotice('Akses Ditolak: Peran Viewer hanya berhak melihat pratinjau dan dilarang mengunduh berkas fisik.')
      return
    }
    window.open(`/api/dokumen/${id}/download`, '_blank')
  }

  const handleDownloadLampiran = (lampId: string) => {
    if (currentUserRole === 'viewer') {
      setDownloadNotice('Akses Ditolak: Peran Viewer dilarang mengunduh berkas lampiran.')
      return
    }
    window.open(`/api/lampiran/${lampId}/download`, '_blank')
  }

  // Aksi Eksekusi Modal (Verifikasi / Approve / Tolak / Ajukan Ulang)
  const handleExecuteModal = async () => {
    if (!modalType || !doc) return
    setIsSubmittingModal(true)

    try {
      if (modalType === 'verifikasi') {
        const res = await fetch(`/api/dokumen/${doc.id}/verifikasi`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal memverifikasi dokumen.')
        showToast('success', 'Dokumen lolos verifikasi tahap 1 dan diteruskan ke Atasan.')
      } else if (modalType === 'approve') {
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
        showToast('success', 'Dokumen ditolak dan dikembalikan ke Pengaju beserta alasan.')
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
      }

      setModalType(null)
      setAlasanTolak('')
      setAlasanBatal('')
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
  const isPicArsip = currentUserRole === 'pic_arsip' || currentUserRole === 'admin'
  const isAtasan = currentUserRole === 'atasan'
  const status = STATUS_PILL[doc.status] || STATUS_PILL.inaktif
  const StatusIcon = status.icon
  const namaFile = doc.file_path.split('/').pop()?.replace(/^\d+_/, '') || 'Berkas dokumen'
  const kodeBagian = doc.kode_arsip.split('_')

  const cardClass = 'rounded-xl border border-[#ECEEF5] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
  const fieldInput =
    'w-full rounded-lg border border-[#E3E6F0] bg-white px-3.5 py-2.5 text-sm text-[#1F2333] placeholder:text-[#A5ABBC] focus:border-[#3BA4E8] focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]/15'

  const metaRows: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }[] = [
    { icon: User, label: 'Pengaju (Pemilik)', value: doc.pemilik_nama },
    { icon: User, label: 'Pemegang Saat Ini', value: doc.pemegang_nama },
    { icon: MapPin, label: 'Lokasi Fisik', value: doc.lokasi_saat_ini },
    { icon: Pencil, label: 'Penandatangan', value: doc.penandatangan || '-' },
    { icon: Calendar, label: 'Tanggal Dokumen', value: formatTanggal(doc.tanggal_dokumen, 'long') },
    {
      icon: ShieldCheck,
      label: 'Verifikator PIC',
      value: doc.verifikator_nama || (doc.verifikasi_pic_oleh ? 'Terverifikasi PIC' : 'Belum diverifikasi'),
    },
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
                    title="Pembatalan Dokumen Aktif oleh Atasan (Blueprint Bab 6.7)"
                  >
                    <XCircle className="h-4 w-4" />
                    Batalkan Dokumen
                  </button>
                )}
              </>
            )}
            {doc.status === 'inaktif' && currentUserRole !== 'viewer' && (
              <Link
                href={`/peminjaman?dokumen_id=${doc.id}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2A92D6] sm:flex-none"
              >
                <BookOpenCheck className="h-4 w-4" />
                Ajukan Peminjaman
              </Link>
            )}
          </div>
        </div>

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
                Kode arsip tetap tersimpan dan tidak dipakai ulang (Blueprint Bab 6.7).
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
            {currentUserRole !== 'viewer' && (
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
                <p className="font-semibold text-[#1F2333]">Menunggu persetujuan</p>
                <p className="mt-0.5 text-[#4B5163]">
                  {!doc.verifikasi_pic_oleh
                    ? 'Tahap 1 — menunggu verifikasi kelengkapan format SIG oleh PIC Arsip.'
                    : 'Tahap 2 — menunggu pengesahan akhir arsip aktif 3 tahun oleh Atasan.'}
                </p>
              </div>
            </div>

            {((!doc.verifikasi_pic_oleh && isPicArsip) || (doc.verifikasi_pic_oleh && isAtasan)) && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalType('tolak')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#F5C2C2] bg-white px-4 py-2 text-sm font-semibold text-[#D64545] hover:bg-[#FDECEC] sm:flex-none"
                >
                  <XCircle className="h-4 w-4" />
                  Tolak
                </button>
                <button
                  type="button"
                  onClick={() => setModalType(doc.verifikasi_pic_oleh ? 'approve' : 'verifikasi')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2A92D6] sm:flex-none"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {doc.verifikasi_pic_oleh ? 'Sahkan Aktif (+3 Tahun)' : 'Loloskan Verifikasi'}
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
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={currentUserRole === 'viewer'}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2A92D6] disabled:cursor-not-allowed disabled:bg-[#C9D3DE]"
                  >
                    {currentUserRole === 'viewer' ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {currentUserRole === 'viewer' ? 'Unduh Dikunci' : 'Unduh Berkas'}
                  </button>
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
                          <button
                            type="button"
                            onClick={() => handleDownloadLampiran(lamp.id)}
                            disabled={currentUserRole === 'viewer'}
                            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E3E6F0] bg-white px-3 py-1.5 text-xs font-medium text-[#4B5163] hover:border-[#3BA4E8] hover:text-[#1E86C8] disabled:opacity-40"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Unduh
                          </button>
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

      {/* ================= MODAL AKSI ================= */}
      {modalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => !isSubmittingModal && setModalType(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl p-6 sm:p-7 space-y-5 font-sans text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-3.5">
              <div>
                <h3 className="font-bold text-base text-[#1F2333]">
                  {modalType === 'verifikasi'
                    ? 'Verifikasi Tahap 1 (PIC Arsip)'
                    : modalType === 'approve'
                    ? 'Pengesahan Akhir (Atasan)'
                    : modalType === 'tolak'
                    ? 'Tolak Pengajuan Dokumen'
                    : modalType === 'batal'
                    ? 'Pembatalan Dokumen Aktif (Atasan)'
                    : 'Perbaiki & Ajukan Ulang Dokumen'}
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Kode Arsip: <strong className="font-mono text-[#0284C7]">{doc.kode_arsip}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-[#64748B] hover:text-[#1F2333] p-1 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalType === 'verifikasi' && (
              <p className="leading-relaxed text-[#1F2333] text-sm">
                Apakah Anda menyatakan bahwa dokumen <strong>{doc.judul}</strong> ({doc.kode_arsip}) telah diperiksa kelengkapan fisiknya dan sesuai standar penomoran SIG? Dokumen akan diteruskan ke antrean Persetujuan Akhir Atasan.
              </p>
            )}

            {modalType === 'approve' && (
              <div className="space-y-2 text-[#1F2333] text-sm leading-relaxed">
                <p>
                  Dengan mengesahkan dokumen ini, status dokumen akan berubah menjadi <strong>Aktif</strong> dengan masa retensi selama <strong>3 tahun</strong> ke depan, dan label QR resmi siap diterbitkan.
                </p>
              </div>
            )}

            {modalType === 'tolak' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1F2333] uppercase">
                  Alasan Penolakan <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={alasanTolak}
                  onChange={(e) => setAlasanTolak(e.target.value)}
                  placeholder="Tuliskan alasan penolakan secara jelas..."
                  className="w-full p-3 border border-[#CBD7E3] rounded-lg bg-white focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none text-xs"
                />
              </div>
            )}

            {modalType === 'batal' && (
              <div className="space-y-3 font-sans">
                <p className="leading-relaxed text-[#1F2333]">
                  Sesuai ketentuan Blueprint Bab 6.7, pembatalan dokumen Aktif hanya dapat disahkan oleh Atasan. Kode arsip <strong>{doc.kode_arsip}</strong> akan tetap disimpan dan tidak akan dipakai ulang. Dokumen akan berstatus <strong>DIBATALKAN</strong>.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-[#1F2333] uppercase mb-1">
                    Alasan Pembatalan Dokumen <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={alasanBatal}
                    onChange={(e) => setAlasanBatal(e.target.value)}
                    placeholder="Tuliskan alasan resmi pembatalan dokumen aktif ini..."
                    className="w-full p-3 border border-red-300 rounded-lg bg-white focus:border-red-600 focus:outline-none text-xs"
                  />
                </div>
              </div>
            )}

            {modalType === 'ajukan_ulang' && (
              <div className="space-y-3 font-sans">
                <p className="text-xs text-[#64748B]">
                  Perbaiki metadata dokumen di bawah ini. Setelah diajukan ulang, alur verifikasi akan dimulai kembali dari tahap verifikasi PIC Arsip.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                    Judul Dokumen <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editJudul}
                    onChange={(e) => setEditJudul(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CBD7E3] rounded-lg bg-white text-xs focus:border-[#3BA4E8] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#64748B] mb-1">
                      No. Payment / PPL
                    </label>
                    <input
                      type="text"
                      value={editNomorPpl}
                      onChange={(e) => setEditNomorPpl(e.target.value)}
                      className="w-full px-3 py-2 border border-[#CBD7E3] rounded-lg bg-white font-mono text-xs focus:border-[#3BA4E8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#64748B] mb-1">
                      Doc Voucher
                    </label>
                    <input
                      type="text"
                      value={editNomorDokumen}
                      onChange={(e) => setEditNomorDokumen(e.target.value)}
                      className="w-full px-3 py-2 border border-[#CBD7E3] rounded-lg bg-white font-mono text-xs focus:border-[#3BA4E8] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1">
                    Penandatangan
                  </label>
                  <input
                    type="text"
                    value={editPenandatangan}
                    onChange={(e) => setEditPenandatangan(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CBD7E3] rounded-lg bg-white text-xs focus:border-[#3BA4E8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1">
                    Lokasi Fisik Berkas
                  </label>
                  <input
                    type="text"
                    value={editLokasi}
                    onChange={(e) => setEditLokasi(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CBD7E3] rounded-lg bg-white text-xs focus:border-[#3BA4E8] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="pt-3.5 border-t border-[#E2E8F0] flex items-center justify-end gap-3 text-xs">
              <button
                type="button"
                disabled={isSubmittingModal}
                onClick={() => setModalType(null)}
                className="px-4 py-2 border border-[#CBD7E3] hover:bg-[#F8FAFC] text-[#1F2333] rounded-lg font-medium transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  isSubmittingModal ||
                  (modalType === 'tolak' && !alasanTolak.trim()) ||
                  (modalType === 'batal' && !alasanBatal.trim())
                }
                onClick={handleExecuteModal}
                className={`px-5 py-2.5 text-white font-semibold rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50 ${
                  modalType === 'tolak' || modalType === 'batal'
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-[#3BA4E8] hover:bg-[#2A92D6] active:bg-[#1E80C2]'
                }`}
              >
                {isSubmittingModal
                  ? 'Memproses...'
                  : modalType === 'verifikasi'
                  ? 'Konfirmasi Lolos Verifikasi'
                  : modalType === 'approve'
                  ? 'Konfirmasi Sahkan Aktif'
                  : modalType === 'tolak'
                  ? 'Konfirmasi Tolak'
                  : modalType === 'batal'
                  ? 'Konfirmasi Batalkan Dokumen'
                  : 'Kirim Ajukan Ulang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST NOTIFIKASI ================= */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex max-w-md items-start gap-2.5 p-4 text-xs font-sans text-white shadow-xl rounded-xl ${
            toast.type === 'success' ? 'bg-emerald-700' : 'bg-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 text-red-200" />
          )}
          <span className="flex-1 leading-relaxed">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="text-white/70 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}
    </AppLayout>
  )
}
