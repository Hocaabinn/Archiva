'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { StampBadge } from '@/components/ui/stamp-badge'
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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

  const isKritis = doc?.status === 'aktif' && sisaHari !== null && sisaHari < 90

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
        const res = await fetch(`/api/dokumen/${doc.id}/ajukan-ulang`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            judul: editJudul.trim(),
            nomor_dokumen: editNomorDokumen.trim() || null,
            nomor_ppl: editNomorPpl.trim() || null,
            penandatangan: editPenandatangan.trim() || null,
            deskripsi: editDeskripsi.trim() || null,
            lokasi_saat_ini: editLokasi.trim() || doc.lokasi_saat_ini,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal mengajukan ulang dokumen.')
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
        <div className="py-24 text-center font-mono text-xs text-[#5B6166]">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1F5C55]" />
          <span>Memuat lembar arsip dokumen...</span>
        </div>
      </AppLayout>
    )
  }

  if (errorMsg || !doc) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-16 text-center font-mono space-y-4">
          <div className="p-4 bg-red-50 border border-red-300 text-red-800 text-xs">
            {errorMsg || 'Dokumen arsip tidak ditemukan.'}
          </div>
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E2429] text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Katalog Dokumen</span>
          </Link>
        </div>
      </AppLayout>
    )
  }

  const isOwner = currentUserId === doc.pemilik_id
  const isPicArsip = currentUserRole === 'pic_arsip' || currentUserRole === 'admin'
  const isAtasan = currentUserRole === 'atasan'

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
        {/* Navigasi Atas & Tombol Cetak / Aksi */}
        <div className="flex items-center justify-between border-b border-[#D8D2C4] pb-4">
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#5B6166] hover:text-[#1A1D21] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Katalog Dokumen</span>
          </Link>

          <div className="flex items-center gap-2 font-mono text-xs">
            {doc.status === 'aktif' && (
              <>
                <Link
                  href={`/serah-terima?kode=${doc.kode_arsip}`}
                  className="px-3 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Serah Terima</span>
                </Link>
                {isAtasan && (
                  <button
                    type="button"
                    onClick={() => setModalType('batal')}
                    className="px-3 py-1.5 bg-white border border-red-700 hover:bg-red-50 text-red-800 font-semibold flex items-center gap-1.5 transition-colors"
                    title="Pembatalan Dokumen Aktif oleh Atasan (Blueprint Bab 6.7)"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-700" />
                    <span>Batalkan Dokumen</span>
                  </button>
                )}
              </>
            )}
            {doc.status === 'inaktif' && currentUserRole !== 'viewer' && (
              <Link
                href={`/peminjaman?dokumen_id=${doc.id}`}
                className="px-3 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white font-semibold flex items-center gap-1.5 transition-colors"
              >
                <BookOpenCheck className="w-3.5 h-3.5" />
                <span>Ajukan Peminjaman</span>
              </Link>
            )}
          </div>
        </div>

        {/* Banner Dokumen Dibatalkan (Blueprint Bab 6.7) */}
        {doc.status === 'dibatalkan' && (
          <div className="p-4 bg-red-50 border-2 border-red-800 text-red-950 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-2 text-sm text-red-950 font-serif">
                <XCircle className="w-4 h-4 text-red-800" />
                DOKUMEN RESMI DIBATALKAN
              </span>
              <span className="font-mono text-[11px] text-red-800 font-semibold">
                Sesuai Ketentuan Blueprint Bab 6.7
              </span>
            </div>
            <p className="leading-relaxed">
              <strong>Alasan Pembatalan:</strong> {doc.alasan_penolakan || 'Tidak ada keterangan spesifik.'}
            </p>
            <p className="text-[11px] text-red-900/80 font-mono">
              Kode arsip ({doc.kode_arsip}) tetap tersimpan dan tidak dipakai ulang. Dokumen tetap dapat dilihat dengan penanda cap DIBATALKAN.
            </p>
          </div>
        )}

        {/* Banner Dokumen Inaktif (Blueprint Bab 3.4 & 3.6) */}
        {doc.status === 'inaktif' && (
          <div className="p-4 bg-[#F7F3EB] border-2 border-[#5B6166] text-[#1A1D21] text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono">
            <div>
              <span className="font-bold text-[#1A1D21] block">
                STATUS DOKUMEN: INAKTIF (GUDANG INAKTIF)
              </span>
              <span className="text-[#5B6166] text-[11px]">
                Masa retensi aktif dokumen telah berakhir. Berkas fisik tersimpan di Gudang Inaktif dan dapat dipinjam melalui PIC Arsip Inaktif.
              </span>
            </div>
            {currentUserRole !== 'viewer' && (
              <Link
                href={`/peminjaman?dokumen_id=${doc.id}`}
                className="px-4 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white font-semibold flex items-center gap-1.5 shrink-0"
              >
                <BookOpenCheck className="w-3.5 h-3.5" />
                <span>Pinjam Dokumen Ini</span>
              </Link>
            )}
          </div>
        )}

        {/* Banner Peringatan Dokumen Ditolak */}
        {doc.status === 'ditolak' && (
          <div className="p-4 bg-red-50 border-2 border-red-700 text-red-900 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-2 text-sm text-red-950 font-serif">
                <AlertCircle className="w-4 h-4 text-red-700" />
                DOKUMEN DITOLAK
              </span>
              <span className="font-mono text-[11px] text-red-700">
                Alur pengajuan dikembalikan ke pembuat
              </span>
            </div>
            <p className="leading-relaxed">
              <strong>Alasan Penolakan:</strong> {doc.alasan_penolakan || 'Tidak ada keterangan spesifik.'}
            </p>
            {isOwner && (
              <div className="pt-2">
                <button
                  onClick={() => setModalType('ajukan_ulang')}
                  className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white font-mono font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Perbaiki & Ajukan Ulang</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Banner Tindakan Persetujuan Cepat (Untuk PIC / Atasan) */}
        {doc.status === 'menunggu_persetujuan' && (
          <div className="p-4 bg-[#F7F3EB] border-2 border-[#1E2429] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-mono">
            <div>
              <span className="font-bold text-[#1A1D21] block">
                STATUS: MENUNGGU PERSETUJUAN
              </span>
              <span className="text-[#5B6166] text-[11px]">
                {!doc.verifikasi_pic_oleh
                  ? 'Tahap 1: Menunggu verifikasi kelengkapan format SIG oleh PIC Arsip.'
                  : 'Tahap 2: Menunggu pengesahan akhir arsip aktif 3 tahun oleh Atasan.'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Tombol PIC */}
              {!doc.verifikasi_pic_oleh && isPicArsip && (
                <>
                  <button
                    onClick={() => setModalType('tolak')}
                    className="px-3 py-1.5 border border-red-700 bg-white hover:bg-red-50 text-red-800 font-semibold"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => setModalType('verifikasi')}
                    className="px-4 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white font-semibold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Loloskan Verifikasi</span>
                  </button>
                </>
              )}

              {/* Tombol Atasan */}
              {doc.verifikasi_pic_oleh && isAtasan && (
                <>
                  <button
                    onClick={() => setModalType('tolak')}
                    className="px-3 py-1.5 border border-red-700 bg-white hover:bg-red-50 text-red-800 font-semibold"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => setModalType('approve')}
                    className="px-4 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white font-semibold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sahkan Aktif (+3 Tahun)</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Notifikasi Akses Download Viewer */}
        {downloadNotice && (
          <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs flex items-center justify-between font-mono">
            <span>{downloadNotice}</span>
            <button onClick={() => setDownloadNotice(null)} className="font-bold">×</button>
          </div>
        )}

        {/* ======================================================== */}
        {/* LEMBAR RESMI ARSIP FISIK                                 */}
        {/* ======================================================== */}
        <div className="bg-white border-2 border-[#1E2429] p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Kepala Lembar Dokumen */}
          <div className="border-b-2 border-[#1E2429] pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs px-2 py-0.5 bg-[#1E2429] text-white font-bold">
                  LEMBAR REGISTER ARSIP RESMI
                </span>
                <span className="text-xs text-[#5B6166] font-mono">
                  Sistem Kearsipan Elektronik SIG
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1D21] mt-2 leading-tight">
                {doc.judul}
              </h1>
              <p className="font-mono text-xs text-[#5B6166] mt-1">
                No. Registrasi / Doc Voucher: <strong className="text-[#1A1D21]">{doc.nomor_dokumen || '-'}</strong>
                {doc.nomor_ppl ? ` • No. PPL (Payment): ${doc.nomor_ppl}` : ''}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <StampBadge status={doc.status} className="scale-110 origin-right" />
              <span className="font-mono text-[11px] text-[#5B6166]">
                Klasifikasi: <strong className="text-[#1A1D21]">{doc.kategori_nama}</strong>
              </span>
            </div>
          </div>

          {/* Grid Informasi Metadata & Barcode */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Kolom 1 & 2: Rincian Metadata Berkas */}
            <div className="md:col-span-2 space-y-4">
              <div className="border border-[#D8D2C4] divide-y divide-[#D8D2C4] text-xs font-mono">
                <div className="grid grid-cols-3 p-3 bg-[#F7F3EB]/40">
                  <span className="text-[#5B6166]">Kode Arsip SIG</span>
                  <span className="col-span-2 font-bold text-[#1A1D21] break-all">{doc.kode_arsip}</span>
                </div>
                <div className="grid grid-cols-3 p-3">
                  <span className="text-[#5B6166]">Pengaju (Pemilik)</span>
                  <span className="col-span-2 text-[#1A1D21] font-semibold">{doc.pemilik_nama}</span>
                </div>
                <div className="grid grid-cols-3 p-3 bg-[#F7F3EB]/40">
                  <span className="text-[#5B6166]">Pemegang Saat Ini</span>
                  <span className="col-span-2 text-[#1A1D21] font-semibold">{doc.pemegang_nama}</span>
                </div>
                <div className="grid grid-cols-3 p-3">
                  <span className="text-[#5B6166]">Lokasi Fisik Berkas</span>
                  <span className="col-span-2 text-[#1A1D21] font-semibold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#1F5C55]" />
                    <span>{doc.lokasi_saat_ini}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3 bg-[#F7F3EB]/40">
                  <span className="text-[#5B6166]">Penandatangan</span>
                  <span className="col-span-2 text-[#1A1D21]">{doc.penandatangan || '-'}</span>
                </div>
                <div className="grid grid-cols-3 p-3">
                  <span className="text-[#5B6166]">Tanggal Dokumen</span>
                  <span className="col-span-2 text-[#1A1D21]">
                    {new Date(doc.tanggal_dokumen).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3 bg-[#F7F3EB]/40">
                  <span className="text-[#5B6166]">Masa Retensi Aktif</span>
                  <span className="col-span-2 text-[#1A1D21]">
                    {doc.status === 'aktif' && doc.tanggal_kadaluarsa ? (
                      <span className={isKritis ? 'font-bold text-red-700' : 'text-[#1F5C55] font-bold'}>
                        {sisaHari} Hari Lagi (s.d. {new Date(doc.tanggal_kadaluarsa).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })})
                      </span>
                    ) : doc.status === 'inaktif' ? (
                      <span className="text-[#8C9399]">Masa Aktif Berakhir (Inaktif)</span>
                    ) : (
                      <span className="text-[#8C9399]">Menunggu Pengesahan Atasan</span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3">
                  <span className="text-[#5B6166]">Verifikator PIC</span>
                  <span className="col-span-2 text-[#1A1D21]">
                    {doc.verifikator_nama || (doc.verifikasi_pic_oleh ? 'Terverifikasi PIC' : 'Belum diverifikasi')}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3 bg-[#F7F3EB]/40">
                  <span className="text-[#5B6166]">Approver Atasan</span>
                  <span className="col-span-2 text-[#1A1D21]">
                    {doc.approver_nama || (doc.disetujui_oleh ? 'Disahkan Atasan' : 'Belum disahkan')}
                  </span>
                </div>
                {doc.deskripsi && (
                  <div className="grid grid-cols-3 p-3">
                    <span className="text-[#5B6166]">Deskripsi / Ringkasan</span>
                    <span className="col-span-2 text-[#1A1D21] font-sans">{doc.deskripsi}</span>
                  </div>
                )}
              </div>

              {/* Rangkuman Berkas Digital Utama */}
              <div className="p-4 bg-[#F7F3EB] border border-[#D8D2C4] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-white border border-[#D8D2C4] shrink-0">
                    <FileText className="w-6 h-6 text-[#1F5C55]" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-[#1A1D21] block truncate">
                      {doc.file_path.split('/').pop()?.replace(/^\d+_/, '')}
                    </span>
                    <span className="font-mono text-[11px] text-[#5B6166]">
                      {doc.ukuran_file ? `${(doc.ukuran_file / 1024 / 1024).toFixed(2)} MB` : '-'} • Bucket: {doc.bucket}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={currentUserRole === 'viewer'}
                  className="px-4 py-2 bg-[#1E2429] hover:bg-black text-white text-xs font-mono font-semibold flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>{currentUserRole === 'viewer' ? 'Unduh Dikunci' : 'Unduh Berkas'}</span>
                </button>
              </div>

              {/* Berkas Lampiran Pendukung (Blueprint 6.5) */}
              {lampiranList.length > 0 && (
                <div className="border border-[#D8D2C4] p-4 bg-white space-y-3 font-mono text-xs">
                  <div className="flex items-center gap-2 border-b border-[#D8D2C4] pb-2">
                    <Paperclip className="w-4 h-4 text-[#1F5C55]" />
                    <span className="font-bold text-[#1A1D21] uppercase">
                      Berkas Lampiran Pendukung ({lampiranList.length})
                    </span>
                  </div>
                  <div className="divide-y divide-[#D8D2C4] border border-[#D8D2C4]">
                    {lampiranList.map((lamp) => (
                      <div
                        key={lamp.id}
                        className="p-2.5 flex items-center justify-between gap-2 hover:bg-[#F7F3EB]/40 transition-colors"
                      >
                        <div className="truncate">
                          <span className="font-bold text-[#1A1D21] block truncate">{lamp.nama_file}</span>
                          <span className="text-[10px] text-[#5B6166]">
                            {(lamp.file_size / 1024).toFixed(0)} KB • {lamp.mime_type || 'file'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadLampiran(lamp.id)}
                          disabled={currentUserRole === 'viewer'}
                          className="px-2.5 py-1 bg-white border border-[#D8D2C4] hover:border-[#1E2429] text-[#1A1D21] font-semibold text-[11px] flex items-center gap-1 disabled:opacity-40"
                        >
                          <Download className="w-3 h-3" />
                          <span>Unduh</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Kolom 3: Label QR Code Fisik Resmi */}
            <div>
              <DocumentQR
                kodeArsip={doc.kode_arsip}
                judul={doc.judul}
                nomorDokumen={doc.nomor_dokumen || undefined}
                nomorPpl={doc.nomor_ppl || undefined}
                size={170}
              />
            </div>
          </div>

          {/* ======================================================== */}
          {/* BUKU LOG MUTASI & RIWAYAT AKTIVITAS                      */}
          {/* ======================================================== */}
          <div className="border-t-2 border-[#1E2429] pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#1F5C55]" />
              <h3 className="font-serif font-bold text-base text-[#1A1D21]">
                Buku Log Mutasi & Riwayat Dokumen
              </h3>
            </div>

            {logList.length === 0 ? (
              <p className="text-xs font-mono text-[#5B6166] italic">
                Belum ada riwayat aktivitas tercatat untuk dokumen ini.
              </p>
            ) : (
              <div className="border border-[#D8D2C4] divide-y divide-[#D8D2C4] bg-white text-xs font-sans">
                {logList.map((log) => {
                  const userDisplay = (log as any).user?.nama_lengkap || (log as any).user?.email || 'Sistem'
                  return (
                    <div
                      key={log.id}
                      className="p-3.5 flex items-start justify-between gap-3 hover:bg-[#F7F3EB]/30 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-[#1F5C55] mt-1.5 shrink-0" />
                        <div>
                          <span className="font-bold text-[#1A1D21] font-mono uppercase text-[11px] block">
                            {log.aksi.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[#5B6166] text-xs leading-relaxed">
                            {log.keterangan}
                          </span>
                          <span className="block font-mono text-[10px] text-[#8C9399] mt-0.5">
                            Oleh: {userDisplay}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-[#8C9399] shrink-0">
                        {new Date(log.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= MODAL AKSI ================= */}
      {modalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => !isSubmittingModal && setModalType(null)}
        >
          <div
            className="w-full max-w-lg bg-white border-2 border-[#1E2429] shadow-2xl p-6 space-y-4 font-sans text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#D8D2C4] pb-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A1D21]">
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
                <p className="font-mono text-xs text-[#5B6166]">
                  Kode Arsip: <strong>{doc.kode_arsip}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-[#5B6166] hover:text-[#1A1D21] p-1"
              >
                ✕
              </button>
            </div>

            {modalType === 'verifikasi' && (
              <p className="leading-relaxed text-[#1A1D21]">
                Apakah Anda menyatakan bahwa dokumen <strong>{doc.judul}</strong> ({doc.kode_arsip}) telah diperiksa kelengkapan fisiknya dan sesuai standar penomoran SIG? Dokumen akan diteruskan ke antrean Persetujuan Akhir Atasan.
              </p>
            )}

            {modalType === 'approve' && (
              <div className="space-y-2 text-[#1A1D21]">
                <p className="leading-relaxed">
                  Dengan mengesahkan dokumen ini, status dokumen akan berubah menjadi <strong>Aktif</strong> dengan masa retensi selama <strong>3 tahun</strong> ke depan, dan label QR resmi siap diterbitkan.
                </p>
              </div>
            )}

            {modalType === 'tolak' && (
              <div className="space-y-2">
                <label className="block font-mono text-[11px] font-bold text-[#1A1D21] uppercase">
                  Alasan Penolakan <span className="text-red-700">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={alasanTolak}
                  onChange={(e) => setAlasanTolak(e.target.value)}
                  placeholder="Tuliskan alasan penolakan secara jelas..."
                  className="w-full p-2.5 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-[#1A1D21] focus:outline-none"
                />
              </div>
            )}

            {modalType === 'batal' && (
              <div className="space-y-3 font-sans">
                <p className="leading-relaxed text-[#1A1D21]">
                  Sesuai ketentuan Blueprint Bab 6.7, pembatalan dokumen Aktif hanya dapat disahkan oleh Atasan. Kode arsip <strong>{doc.kode_arsip}</strong> akan tetap disimpan dan tidak akan dipakai ulang. Dokumen akan berstatus <strong>DIBATALKAN</strong>.
                </p>
                <div>
                  <label className="block font-mono text-[11px] font-bold text-[#1A1D21] uppercase mb-1">
                    Alasan Pembatalan Dokumen <span className="text-red-700">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={alasanBatal}
                    onChange={(e) => setAlasanBatal(e.target.value)}
                    placeholder="Tuliskan alasan resmi pembatalan dokumen aktif ini..."
                    className="w-full p-2.5 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-red-700 focus:outline-none text-xs"
                  />
                </div>
              </div>
            )}

            {modalType === 'ajukan_ulang' && (
              <div className="space-y-3 font-sans">
                <p className="text-[11px] text-[#5B6166]">
                  Perbaiki metadata dokumen di bawah ini. Setelah diajukan ulang, alur verifikasi akan dimulai kembali dari tahap verifikasi PIC Arsip.
                </p>
                <div>
                  <label className="block font-mono text-[10px] uppercase font-bold text-[#1A1D21] mb-0.5">
                    Judul Dokumen <span className="text-red-700">*</span>
                  </label>
                  <input
                    type="text"
                    value={editJudul}
                    onChange={(e) => setEditJudul(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#D8D2C4] bg-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#5B6166] mb-0.5">
                      No. Payment / PPL
                    </label>
                    <input
                      type="text"
                      value={editNomorPpl}
                      onChange={(e) => setEditNomorPpl(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-[#D8D2C4] bg-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#5B6166] mb-0.5">
                      Doc Voucher
                    </label>
                    <input
                      type="text"
                      value={editNomorDokumen}
                      onChange={(e) => setEditNomorDokumen(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-[#D8D2C4] bg-white text-xs focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase font-bold text-[#5B6166] mb-0.5">
                    Penandatangan
                  </label>
                  <input
                    type="text"
                    value={editPenandatangan}
                    onChange={(e) => setEditPenandatangan(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#D8D2C4] bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase font-bold text-[#5B6166] mb-0.5">
                    Lokasi Fisik Berkas
                  </label>
                  <input
                    type="text"
                    value={editLokasi}
                    onChange={(e) => setEditLokasi(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#D8D2C4] bg-white focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#D8D2C4] flex items-center justify-end gap-3 font-mono text-xs">
              <button
                type="button"
                disabled={isSubmittingModal}
                onClick={() => setModalType(null)}
                className="px-4 py-2 border border-[#D8D2C4] hover:bg-[#F7F3EB] text-[#1A1D21]"
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
                className={`px-5 py-2 text-white font-semibold transition-colors disabled:opacity-50 ${
                  modalType === 'tolak' || modalType === 'batal'
                    ? 'bg-red-800 hover:bg-red-900'
                    : 'bg-[#1F5C55] hover:bg-[#184843]'
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
          className={`fixed bottom-6 right-6 z-[60] flex max-w-md items-start gap-2.5 p-4 text-xs font-mono text-white shadow-xl ${
            toast.type === 'success' ? 'bg-[#1F5C55]' : 'bg-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 text-red-300" />
          )}
          <span className="flex-1 leading-relaxed">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="text-white/70 hover:text-white">
            ✕
          </button>
        </div>
      )}
    </AppLayout>
  )
}
