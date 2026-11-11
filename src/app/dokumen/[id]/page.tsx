'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { DocumentQR } from '@/components/documents/qr-code'
import {
  ArrowLeft,
  Download,
  History,
  FileText,
  Paperclip,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  MapPin,
  QrCode,
  BookOpenCheck,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DokumenStatus, UserRole } from '@/types'
import { StampBadge } from '@/components/ui/stamp-badge'

interface PageProps {
  params: Promise<{ id: string }>
}

interface DocDetail {
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
  barcode_path: string | null
  alasan_penolakan: string | null
  verifikasi_pic_oleh: string | null
  verifikator_nama?: string
  disetujui_oleh: string | null
  approver_nama?: string
}

interface LampiranItem {
  id: string
  nama_file: string
  file_path: string
  file_size: number
  mime_type: string | null
  created_at: string
}

interface LogItem {
  id: string
  aksi: string
  keterangan: string
  created_at: string
  user?: { nama_lengkap?: string; email?: string }
}

export default function DetailDokumenPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [doc, setDoc] = useState<DocDetail | null>(null)
  const [lampiranList, setLampiranList] = useState<LampiranItem[]>([])
  const [logList, setLogList] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Autentikasi & Hak Akses
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('user')

  // State Modal Aksi (Verifikasi / Approval / Tolak / Batal / Ajukan Ulang)
  const [modalType, setModalType] = useState<'verifikasi' | 'approve' | 'tolak' | 'batal' | 'ajukan_ulang' | null>(null)
  const [alasanTolak, setAlasanTolak] = useState('')
  const [alasanBatal, setAlasanBatal] = useState('')
  const [isSubmittingModal, setIsSubmittingModal] = useState(false)

  // Form edit metadata saat ajukan ulang
  const [editJudul, setEditJudul] = useState('')
  const [editNomorDokumen, setEditNomorDokumen] = useState('')
  const [editNomorPpl, setEditNomorPpl] = useState('')
  const [editPenandatangan, setEditPenandatangan] = useState('')
  const [editLokasi, setEditLokasi] = useState('')

  // Toast / Feedback Notifikasi
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 5000)
  }

  // Load Data Dokumen Lengkap
  useEffect(() => {
    async function fetchDetail() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          if (profile?.role) setCurrentUserRole(profile.role as UserRole)
        }

        // Ambil dokumen beserta relasi
        const { data: d, error: docErr } = await supabase
          .from('dokumen')
          .select(`
            id, kode_arsip, nomor_dokumen, nomor_ppl, judul, kategori_id,
            penandatangan, deskripsi, status, bucket, file_path, file_tipe, ukuran_file,
            pemilik_id, pemegang_saat_ini, lokasi_saat_ini, tanggal_dokumen, tanggal_masuk,
            tanggal_disetujui, tanggal_kadaluarsa, barcode_path, alasan_penolakan,
            verifikasi_pic_oleh, disetujui_oleh,
            kategori_dokumen ( nama ),
            pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email ),
            pemegang:profiles!dokumen_pemegang_saat_ini_fkey ( nama_lengkap, email ),
            verifikator:profiles!dokumen_verifikasi_pic_oleh_fkey ( nama_lengkap, email ),
            approver:profiles!dokumen_disetujui_oleh_fkey ( nama_lengkap, email )
          `)
          .eq('id', id)
          .single()

        if (docErr || !d) {
          throw new Error(docErr?.message || 'Dokumen tidak ditemukan dalam sistem.')
        }

        const detail: DocDetail = {
          id: d.id,
          kode_arsip: d.kode_arsip,
          nomor_dokumen: d.nomor_dokumen,
          nomor_ppl: d.nomor_ppl,
          judul: d.judul,
          kategori_id: d.kategori_id,
          kategori_nama: (d.kategori_dokumen as any)?.nama || 'Umum',
          penandatangan: d.penandatangan,
          deskripsi: d.deskripsi,
          status: d.status as DokumenStatus,
          bucket: d.bucket,
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
          barcode_path: d.barcode_path,
          alasan_penolakan: d.alasan_penolakan,
          verifikasi_pic_oleh: d.verifikasi_pic_oleh,
          verifikator_nama: (d.verifikator as any)?.nama_lengkap || (d.verifikator as any)?.email,
          disetujui_oleh: d.disetujui_oleh,
          approver_nama: (d.approver as any)?.nama_lengkap || (d.approver as any)?.email,
        }

        setDoc(detail)
        setEditJudul(detail.judul)
        setEditNomorDokumen(detail.nomor_dokumen || '')
        setEditNomorPpl(detail.nomor_ppl || '')
        setEditPenandatangan(detail.penandatangan || '')
        setEditLokasi(detail.lokasi_saat_ini)

        // Ambil lampiran pendukung
        const { data: lamps } = await supabase
          .from('lampiran')
          .select('id, nama_file, file_path, file_size, mime_type, created_at')
          .eq('dokumen_id', id)
          .order('created_at', { ascending: true })

        if (lamps) setLampiranList(lamps)

        // Ambil riwayat log aktivitas
        const { data: logs } = await supabase
          .from('log_aktivitas')
          .select(`
            id, aksi, keterangan, created_at,
            user:profiles!log_aktivitas_user_id_fkey ( nama_lengkap, email )
          `)
          .eq('dokumen_id', id)
          .order('created_at', { ascending: false })

        if (logs) setLogList(logs as any)
      } catch (err: unknown) {
        console.error('Error saat fetch detail dokumen:', err)
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem')
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [id, supabase])

  // Download Berkas Utama (Aturan Keras Bab 5: Viewer Dilarang Download)
  const handleDownload = async () => {
    if (!doc) return
    if (currentUserRole === 'viewer') {
      setDownloadNotice('Akses Ditolak: Peran Viewer hanya berhak melihat pratinjau dan dilarang mengunduh berkas fisik.')
      showToast('error', 'Akses Ditolak: Peran Viewer tidak diizinkan mengunduh berkas fisik.')
      return
    }

    try {
      const res = await fetch(`/api/dokumen/${doc.id}/download?json=true`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses tautan unduhan dokumen.')
      }

      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank')
        showToast('success', 'Tautan unduhan bertanda waktu berhasil dibuat.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh berkas'
      showToast('error', msg)
    }
  }

  // Download Berkas Lampiran
  const handleDownloadLampiran = async (lampiranId: string) => {
    if (currentUserRole === 'viewer') {
      showToast('error', 'Akses Ditolak: Peran Viewer tidak diizinkan mengunduh berkas lampiran.')
      return
    }

    try {
      const res = await fetch(`/api/lampiran/${lampiranId}/download?json=true`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses unduhan lampiran.')
      }

      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh lampiran'
      showToast('error', msg)
    }
  }

  // Eksekusi Modal Aksi (Verifikasi, Approve, Tolak, Batal, Ajukan Ulang)
  const handleExecuteModal = async () => {
    if (!doc) return
    setIsSubmittingModal(true)

    try {
      let endpoint = ''
      let payload: Record<string, unknown> = {}

      if (modalType === 'verifikasi') {
        endpoint = `/api/dokumen/${doc.id}/verifikasi`
      } else if (modalType === 'approve') {
        endpoint = `/api/dokumen/${doc.id}/approve`
      } else if (modalType === 'tolak') {
        if (!alasanTolak.trim()) throw new Error('Alasan penolakan wajib diisi.')
        endpoint = `/api/dokumen/${doc.id}/tolak`
        payload = { alasan: alasanTolak.trim() }
      } else if (modalType === 'batal') {
        if (!alasanBatal.trim()) throw new Error('Alasan pembatalan wajib diisi.')
        endpoint = `/api/dokumen/${doc.id}/batal`
        payload = { alasan: alasanBatal.trim() }
      } else if (modalType === 'ajukan_ulang') {
        if (!editJudul.trim()) throw new Error('Judul dokumen wajib diisi.')
        endpoint = `/api/dokumen/${doc.id}/ajukan-ulang`
        payload = {
          judul: editJudul.trim(),
          nomor_dokumen: editNomorDokumen.trim() || null,
          nomor_ppl: editNomorPpl.trim() || null,
          penandatangan: editPenandatangan.trim() || null,
          lokasi_saat_ini: editLokasi.trim() || 'Ruang Arsip Aktif',
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Gagal memproses aksi pada dokumen.')
      }

      showToast('success', result.message || 'Aksi berhasil disimpan.')
      setModalType(null)

      // Refresh data
      setTimeout(() => {
        window.location.reload()
      }, 800)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      showToast('error', msg)
    } finally {
      setIsSubmittingModal(false)
    }
  }

  // Render Skeleton Loading
  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-[#64748B]">
            <Loader2 className="w-5 h-5 animate-spin text-[#3BA4E8]" />
            <span>Memuat lembar arsip dokumen...</span>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Render Galat
  if (error || !doc) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto py-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-xs">
            <h2 className="font-bold text-base mb-1">Dokumen Tidak Ditemukan</h2>
            <p className="text-xs leading-relaxed text-red-700">{error || 'Dokumen yang diminta tidak tersedia.'}</p>
            <div className="mt-4">
              <Link
                href="/dokumen"
                className="inline-flex items-center gap-2 rounded-lg bg-white border border-red-200 px-3.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Katalog Dokumen</span>
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Hak Aksi Cepat
  const isOwner = currentUserId === doc.pemilik_id
  const isPicArsip = currentUserRole === 'pic_arsip' || currentUserRole === 'admin'
  const isAtasan = currentUserRole === 'atasan' || currentUserRole === 'admin'

  // Perhitungan Kadaluarsa
  let sisaHari: number | null = null
  let isKritis = false
  if (doc.status === 'aktif' && doc.tanggal_kadaluarsa) {
    const expTime = new Date(doc.tanggal_kadaluarsa).getTime()
    const nowTime = new Date().getTime()
    sisaHari = Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24))
    isKritis = sisaHari <= 30
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
        {/* Navigasi Atas & Tombol Cetak / Aksi */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#64748B] hover:text-[#3BA4E8] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Katalog Dokumen</span>
          </Link>

          <div className="flex items-center gap-2 text-xs">
            {doc.status === 'aktif' && (
              <>
                <Link
                  href={`/serah-terima?kode=${doc.kode_arsip}`}
                  className="px-3.5 py-2 bg-[#3BA4E8] hover:bg-[#2A92D6] active:bg-[#1E80C2] text-white font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Serah Terima</span>
                </Link>
                {isAtasan && (
                  <button
                    type="button"
                    onClick={() => setModalType('batal')}
                    className="px-3.5 py-2 bg-white border border-red-300 hover:bg-red-50 text-red-700 font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Pembatalan Dokumen Aktif oleh Atasan"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    <span>Batalkan Dokumen</span>
                  </button>
                )}
              </>
            )}
            {doc.status === 'inaktif' && currentUserRole !== 'viewer' && (
              <Link
                href={`/peminjaman?dokumen_id=${doc.id}`}
                className="px-3.5 py-2 bg-[#3BA4E8] hover:bg-[#2A92D6] text-white font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
              >
                <BookOpenCheck className="w-3.5 h-3.5" />
                <span>Ajukan Peminjaman</span>
              </Link>
            )}
          </div>
        </div>

        {/* Banner Dokumen Dibatalkan */}
        {doc.status === 'dibatalkan' && (
          <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-950 text-xs space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-2 text-sm text-red-950 font-sans">
                <XCircle className="w-4 h-4 text-red-700" />
                DOKUMEN RESMI DIBATALKAN
              </span>
              <span className="text-[11px] text-red-700 font-semibold px-2 py-0.5 bg-red-100 rounded">
                Sesuai Ketentuan Blueprint Bab 6.7
              </span>
            </div>
            <p className="leading-relaxed">
              <strong>Alasan Pembatalan:</strong> {doc.alasan_penolakan || 'Tidak ada keterangan spesifik.'}
            </p>
            <p className="text-[11px] text-red-800/80">
              Kode arsip ({doc.kode_arsip}) tetap tersimpan dan tidak dipakai ulang. Dokumen tetap dapat dilihat dengan penanda cap DIBATALKAN.
            </p>
          </div>
        )}

        {/* Banner Dokumen Inaktif */}
        {doc.status === 'inaktif' && (
          <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#CBD7E3] text-[#1F2333] text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div>
              <span className="font-bold text-[#1F2333] text-sm block">
                STATUS DOKUMEN: INAKTIF (GUDANG INAKTIF)
              </span>
              <span className="text-[#64748B] text-xs mt-0.5 block">
                Masa retensi aktif dokumen telah berakhir. Berkas fisik tersimpan di Gudang Inaktif dan dapat dipinjam melalui PIC Arsip Inaktif.
              </span>
            </div>
            {currentUserRole !== 'viewer' && (
              <Link
                href={`/peminjaman?dokumen_id=${doc.id}`}
                className="px-4 py-2 bg-[#3BA4E8] hover:bg-[#2A92D6] text-white font-semibold rounded-lg flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <BookOpenCheck className="w-3.5 h-3.5" />
                <span>Pinjam Dokumen Ini</span>
              </Link>
            )}
          </div>
        )}

        {/* Banner Peringatan Dokumen Ditolak */}
        {doc.status === 'ditolak' && (
          <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-2 text-sm text-red-950 font-sans">
                <AlertCircle className="w-4 h-4 text-red-700" />
                DOKUMEN DITOLAK
              </span>
              <span className="text-[11px] text-red-700 bg-red-100 px-2 py-0.5 rounded">
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
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
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
          <div className="p-5 rounded-2xl bg-[#F0F9FF] border border-[#BAE6FD] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] rounded-full font-semibold text-[11px]">
                  MENUNGGU PERSETUJUAN
                </span>
                <span className="font-semibold text-[#1F2333] text-sm">
                  Alur Verifikasi Kearsipan
                </span>
              </div>
              <p className="text-[#64748B] text-xs">
                {!doc.verifikasi_pic_oleh
                  ? 'Tahap 1: Menunggu verifikasi kelengkapan format SIG oleh PIC Arsip.'
                  : 'Tahap 2: Menunggu pengesahan akhir arsip aktif 3 tahun oleh Atasan.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Tombol PIC */}
              {!doc.verifikasi_pic_oleh && isPicArsip && (
                <>
                  <button
                    onClick={() => setModalType('tolak')}
                    className="px-3.5 py-2 border border-red-300 bg-white hover:bg-red-50 text-red-700 font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => setModalType('verifikasi')}
                    className="px-4 py-2 bg-[#3BA4E8] hover:bg-[#2A92D6] text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Loloskan Verifikasi</span>
                  </button>
                </>
              )}

              {/* Tombol Atasan */}
              {doc.verifikasi_pic_oleh && isAtasan && (
                <>
                  <button
                    onClick={() => setModalType('tolak')}
                    className="px-3.5 py-2 border border-red-300 bg-white hover:bg-red-50 text-red-700 font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => setModalType('approve')}
                    className="px-4 py-2 bg-[#3BA4E8] hover:bg-[#2A92D6] text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sahkan Aktif (+3 Tahun)</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Notifikasi Akses Download Viewer */}
        {downloadNotice && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
            <span>{downloadNotice}</span>
            <button onClick={() => setDownloadNotice(null)} className="font-bold text-red-600 hover:text-red-800">×</button>
          </div>
        )}

        {/* ======================================================== */}
        {/* LEMBAR RESMI ARSIP FISIK                                 */}
        {/* ======================================================== */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Kepala Lembar Dokumen */}
          <div className="border-b border-[#E2E8F0] pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs px-2.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] font-semibold rounded-md">
                  LEMBAR REGISTER ARSIP RESMI
                </span>
                <span className="text-xs text-[#64748B]">
                  Sistem Kearsipan Elektronik SIG
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-sans font-bold text-[#1F2333] mt-1 leading-tight">
                {doc.judul}
              </h1>
              <p className="text-xs text-[#64748B] mt-1.5 font-mono">
                No. Registrasi / Doc Voucher: <strong className="text-[#1F2333]">{doc.nomor_dokumen || '-'}</strong>
                {doc.nomor_ppl ? ` • No. PPL (Payment): ${doc.nomor_ppl}` : ''}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <StampBadge status={doc.status} className="scale-105 origin-right" />
              <span className="text-xs text-[#64748B]">
                Klasifikasi: <strong className="text-[#1F2333]">{doc.kategori_nama}</strong>
              </span>
            </div>
          </div>

          {/* Grid Informasi Metadata & Barcode */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Kolom 1 & 2: Rincian Metadata Berkas */}
            <div className="md:col-span-2 space-y-4">
              <div className="rounded-xl border border-[#E2E8F0] divide-y divide-[#E2E8F0] overflow-hidden text-xs font-sans">
                <div className="grid grid-cols-3 p-3.5 bg-[#F8FAFC]">
                  <span className="text-[#64748B] font-medium">Kode Arsip SIG</span>
                  <span className="col-span-2 font-mono font-bold text-[#0284C7] break-all">{doc.kode_arsip}</span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-white">
                  <span className="text-[#64748B] font-medium">Pengaju (Pemilik)</span>
                  <span className="col-span-2 text-[#1F2333] font-semibold">{doc.pemilik_nama}</span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-[#F8FAFC]">
                  <span className="text-[#64748B] font-medium">Pemegang Saat Ini</span>
                  <span className="col-span-2 text-[#1F2333] font-semibold">{doc.pemegang_nama}</span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-white">
                  <span className="text-[#64748B] font-medium">Lokasi Fisik Berkas</span>
                  <span className="col-span-2 text-[#1F2333] font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#3BA4E8]" />
                    <span>{doc.lokasi_saat_ini}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-[#F8FAFC]">
                  <span className="text-[#64748B] font-medium">Penandatangan</span>
                  <span className="col-span-2 text-[#1F2333]">{doc.penandatangan || '-'}</span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-white">
                  <span className="text-[#64748B] font-medium">Tanggal Dokumen</span>
                  <span className="col-span-2 text-[#1F2333]">
                    {new Date(doc.tanggal_dokumen).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-[#F8FAFC]">
                  <span className="text-[#64748B] font-medium">Masa Retensi Aktif</span>
                  <span className="col-span-2 text-[#1F2333]">
                    {doc.status === 'aktif' && doc.tanggal_kadaluarsa ? (
                      <span className={isKritis ? 'font-bold text-red-600' : 'text-emerald-700 font-semibold'}>
                        {sisaHari} Hari Lagi (s.d. {new Date(doc.tanggal_kadaluarsa).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })})
                      </span>
                    ) : doc.status === 'inaktif' ? (
                      <span className="text-[#8C9399]">Masa Aktif Berakhir (Inaktif)</span>
                    ) : (
                      <span className="text-[#8C9399]">Menunggu Pengesahan Atasan</span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-white">
                  <span className="text-[#64748B] font-medium">Verifikator PIC</span>
                  <span className="col-span-2 text-[#1F2333]">
                    {doc.verifikator_nama || (doc.verifikasi_pic_oleh ? 'Terverifikasi PIC' : 'Belum diverifikasi')}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-[#F8FAFC]">
                  <span className="text-[#64748B] font-medium">Approver Atasan</span>
                  <span className="col-span-2 text-[#1F2333]">
                    {doc.approver_nama || (doc.disetujui_oleh ? 'Disahkan Atasan' : 'Belum disahkan')}
                  </span>
                </div>
                {doc.deskripsi && (
                  <div className="grid grid-cols-3 p-3.5 bg-white">
                    <span className="text-[#64748B] font-medium">Deskripsi / Ringkasan</span>
                    <span className="col-span-2 text-[#1F2333] leading-relaxed">{doc.deskripsi}</span>
                  </div>
                )}
              </div>

              {/* Rangkuman Berkas Digital Utama */}
              <div className="p-4 bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-white border border-[#BAE6FD] rounded-lg shrink-0 text-[#0284C7]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-[#1F2333] block truncate">
                      {doc.file_path.split('/').pop()?.replace(/^\d+_/, '')}
                    </span>
                    <span className="text-[11px] text-[#64748B]">
                      {doc.ukuran_file ? `${(doc.ukuran_file / 1024 / 1024).toFixed(2)} MB` : '-'} • Bucket: {doc.bucket}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={currentUserRole === 'viewer'}
                  className="px-4 py-2 bg-[#3BA4E8] hover:bg-[#2A92D6] active:bg-[#1E80C2] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{currentUserRole === 'viewer' ? 'Unduh Dikunci' : 'Unduh Berkas'}</span>
                </button>
              </div>

              {/* Berkas Lampiran Pendukung */}
              {lampiranList.length > 0 && (
                <div className="border border-[#E2E8F0] rounded-xl p-4 bg-white space-y-3 text-xs font-sans">
                  <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2">
                    <Paperclip className="w-4 h-4 text-[#0284C7]" />
                    <span className="font-bold text-[#1F2333]">
                      Berkas Lampiran Pendukung ({lampiranList.length})
                    </span>
                  </div>
                  <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-lg overflow-hidden bg-[#F8FAFC]">
                    {lampiranList.map((lamp) => (
                      <div
                        key={lamp.id}
                        className="p-3 flex items-center justify-between gap-2 hover:bg-[#F0F9FF]/50 transition-colors"
                      >
                        <div className="truncate">
                          <span className="font-semibold text-[#1F2333] block truncate">{lamp.nama_file}</span>
                          <span className="text-[11px] text-[#64748B]">
                            {(lamp.file_size / 1024).toFixed(0)} KB • {lamp.mime_type || 'file'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadLampiran(lamp.id)}
                          disabled={currentUserRole === 'viewer'}
                          className="px-3 py-1.5 bg-white border border-[#CBD7E3] hover:border-[#3BA4E8] text-[#1F2333] font-medium text-xs rounded-md flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5" />
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
          <div className="border-t border-[#E2E8F0] pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#3BA4E8]" />
              <h3 className="font-sans font-bold text-base text-[#1F2333]">
                Buku Log Mutasi & Riwayat Dokumen
              </h3>
            </div>

            {logList.length === 0 ? (
              <p className="text-xs text-[#64748B] italic">
                Belum ada riwayat aktivitas tercatat untuk dokumen ini.
              </p>
            ) : (
              <div className="rounded-xl border border-[#E2E8F0] divide-y divide-[#E2E8F0] overflow-hidden bg-white text-xs font-sans">
                {logList.map((log) => {
                  const userDisplay = (log as any).user?.nama_lengkap || (log as any).user?.email || 'Sistem'
                  return (
                    <div
                      key={log.id}
                      className="p-3.5 flex items-start justify-between gap-3 hover:bg-[#F8FAFC] transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3BA4E8] mt-1 shrink-0" />
                        <div>
                          <span className="font-bold text-[#1F2333] uppercase text-[11px] block">
                            {log.aksi.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[#64748B] text-xs leading-relaxed">
                            {log.keterangan}
                          </span>
                          <span className="block text-[11px] text-[#8C9399] mt-0.5">
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
