'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AppLayout } from '@/components/layout/app-layout'
import { StampBadge } from '@/components/ui/stamp-badge'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'
import {
  Scan,
  Camera,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  FileText,
  MapPin,
  User,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Inbox,
  Send,
  History,
  ShieldCheck,
  ChevronRight,
  X,
} from 'lucide-react'

interface ScannedDoc {
  id: string
  kode_arsip: string
  nomor_dokumen?: string
  nomor_ppl?: string
  judul: string
  status: string
  kategori: string
  lokasi_saat_ini: string
  pemegang_id: string
  pemegang_nama: string
  pemegang_email: string
  pemegang_jabatan?: string
  tanggal_dokumen?: string
  barcode_path?: string
}

interface ProfileOption {
  id: string
  nama_lengkap: string
  email: string
  role: string
  jabatan?: string
}

interface SerahTerimaItem {
  id: string
  dokumen_id: string
  dari_user_id: string
  ke_user_id: string
  dari_lokasi: string
  ke_lokasi: string
  status_serah: 'Menunggu konfirmasi' | 'Diterima' | 'Ditolak'
  tanggal_serah: string
  tanggal_terima?: string
  keterangan?: string
  bukti_pdf_path?: string
  created_at: string
  dokumen?: {
    id: string
    kode_arsip: string
    judul: string
    status: string
    lokasi_saat_ini: string
    kategori_dokumen?: { nama: string }
  }
  penyerah?: {
    nama_lengkap: string
    email: string
    jabatan?: string
  }
  penerima?: {
    nama_lengkap: string
    email: string
    jabatan?: string
  }
}

export default function SerahTerimaPage() {
  const [supabase] = useState(() => createClient())

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('staff')
  const [activeTab, setActiveTab] = useState<'scan' | 'menunggu' | 'riwayat'>('scan')

  // Scanner & Search State
  const [scanCode, setScanCode] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [scannedDoc, setScannedDoc] = useState<ScannedDoc | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Form Pengajuan Serah Terima
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [selectedPenerimaId, setSelectedPenerimaId] = useState('')
  const [targetLokasi, setTargetLokasi] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Data Tab Menunggu & Riwayat
  const [pendingTransfers, setPendingTransfers] = useState<SerahTerimaItem[]>([])
  const [historyTransfers, setHistoryTransfers] = useState<SerahTerimaItem[]>([])
  const [isLoadingList, setIsLoadingList] = useState(false)

  // Modal Konfirmasi / Tolak
  const [confirmModalItem, setConfirmModalItem] = useState<SerahTerimaItem | null>(null)
  const [rejectModalItem, setRejectModalItem] = useState<SerahTerimaItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Toast / Feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string; actionUrl?: string; actionText?: string } | null>(null)

  const scanInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const showToast = (type: 'success' | 'error', text: string, actionUrl?: string, actionText?: string) => {
    setToast({ type, text, actionUrl, actionText })
    setTimeout(() => setToast(null), 7000)
  }

  // 1. Inisialisasi Pengguna & Daftar Profiles
  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .single()
        if (prof?.role) setCurrentUserRole(prof.role)

        // Ambil daftar pengguna untuk dropdown penerima
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, nama_lengkap, email, role, jabatan')
          .order('nama_lengkap', { ascending: true })

        if (profs) {
          setProfiles(profs.filter((p) => p.id !== user.id))
        }
      }
    }
    initUser()
  }, [supabase])

  // Fokuskan input scanner USB otomatis saat tab Scan aktif
  useEffect(() => {
    if (activeTab === 'scan' && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [activeTab])

  // 2. Load Data Menunggu Konfirmasi & Riwayat
  const loadLists = useCallback(async () => {
    setIsLoadingList(true)
    try {
      // Ambil yang menunggu konfirmasi saya
      const resPending = await fetch('/api/serah-terima?type=menunggu')
      const dataPending = await resPending.json()
      if (dataPending.data) setPendingTransfers(dataPending.data)

      // Ambil riwayat lengkap
      const resHistory = await fetch('/api/serah-terima?type=semua')
      const dataHistory = await resHistory.json()
      if (dataHistory.data) setHistoryTransfers(dataHistory.data)
    } catch (err) {
      console.error('Error loading serah terima lists:', err)
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadLists()
  }, [loadLists])

  // 3. Cari / Scan Dokumen (Gaya Kasir Scanner USB / Input Manual)
  const handleSearchCode = async (codeToSearch?: string) => {
    const code = (codeToSearch || scanCode).trim()
    if (!code) return

    setIsSearching(true)
    setScanError(null)
    setScannedDoc(null)

    try {
      const res = await fetch(`/api/serah-terima/scan?code=${encodeURIComponent(code)}`)
      const result = await res.json()

      if (!res.ok) {
        setScanError(result.error || 'Dokumen tidak dapat diproses.')
        return
      }

      setScannedDoc(result.dokumen)
      // Default lokasi awal
      setTargetLokasi('')
      setKeterangan('')
      if (profiles.length > 0 && !selectedPenerimaId) {
        setSelectedPenerimaId(profiles[0].id)
      }
    } catch (err) {
      setScanError('Terjadi kesalahan jaringan saat memindai kode.')
    } finally {
      setIsSearching(false)
    }
  }

  // Ref ke versi terbaru handleSearchCode, agar loop kamera tidak memakai closure lama
  const handleSearchCodeRef = useRef(handleSearchCode)
  useEffect(() => {
    handleSearchCodeRef.current = handleSearchCode
  })

  // Buka langsung dari tombol "Serah Terima" di detail dokumen: /serah-terima?kode=...
  useEffect(() => {
    const kode = new URLSearchParams(window.location.search).get('kode')?.trim()
    if (kode) {
      setScanCode(kode)
      handleSearchCodeRef.current(kode)
    }
  }, [])

  // Handle Enter Key untuk Scanner USB Gaya Kasir
  const handleKeyDownScanner = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearchCode()
    }
  }

  // 4. Kamera HP Pemindai Barcode / QR
  const startCamera = async () => {
    setIsCameraActive(true)
    setCameraError(null)
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: { ideal: 'environment' } },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      const onDetected = (value: string) => {
        stopCamera()
        setScanCode(value)
        handleSearchCodeRef.current(value)
      }

      // Deteksi Barcode modern jika didukung browser (Chrome / Android)
      // Fallback: decode QR via jsQR (Safari iOS, Firefox, dsb.)
      if (!('BarcodeDetector' in window)) {
        const jsQR = (await import('jsqr')).default
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        const decodeLoop = () => {
          const video = videoRef.current
          if (!streamRef.current || !video || !ctx) return
          if (video.readyState >= 2 && video.videoWidth > 0) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
            if (result?.data) {
              onDetected(result.data)
              return
            }
          }
          requestAnimationFrame(decodeLoop)
        }
        requestAnimationFrame(decodeLoop)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
        })

        const detectLoop = async () => {
          if (!streamRef.current || !videoRef.current) return
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const detectedValue = barcodes[0].rawValue
              if (detectedValue) {
                onDetected(detectedValue)
                return
              }
            }
          } catch (e) {
            // Ignore frame detection failures
          }
          if (streamRef.current) {
            requestAnimationFrame(detectLoop)
          }
        }
        requestAnimationFrame(detectLoop)
      }
    } catch (err: unknown) {
      console.warn('Gagal membuka kamera:', err)
      const msg = err instanceof Error ? err.message : 'Kamera tidak dapat diakses'
      setCameraError(`Tidak dapat mengakses kamera: ${msg}. Anda dapat memasukkan kode manual atau menggunakan scanner USB.`)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsCameraActive(false)
  }

  // 5. Ajukan Serah Terima Dokumen
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scannedDoc) return
    if (!selectedPenerimaId) {
      showToast('error', 'Pilih penerima dokumen terlebih dahulu.')
      return
    }
    if (!targetLokasi.trim()) {
      showToast('error', 'Isi lokasi tujuan fisik dokumen.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/serah-terima/ajukan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dokumen_id: scannedDoc.id,
          ke_user_id: selectedPenerimaId,
          ke_lokasi: targetLokasi.trim(),
          keterangan: keterangan.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        showToast('error', data.error || 'Gagal mengajukan serah terima.')
        return
      }

      showToast(
        'success',
        `Pengajuan serah terima ${scannedDoc.kode_arsip} berhasil dikirimkan. Pemegang fisik dokumen akan resmi berpindah setelah penerima mengonfirmasi.`
      )
      // Reset form
      setScannedDoc(null)
      setScanCode('')
      setTargetLokasi('')
      setKeterangan('')
      loadLists()
      if (scanInputRef.current) scanInputRef.current.focus()
    } catch (err) {
      showToast('error', 'Terjadi kesalahan sistem saat mengajukan serah terima.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 6. Konfirmasi Terima Dokumen (Penerima)
  const handleConfirmReceive = async (item: SerahTerimaItem) => {
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/serah-terima/${item.id}/konfirmasi`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        showToast('error', data.error || 'Gagal mengonfirmasi penerimaan dokumen.')
        return
      }

      setConfirmModalItem(null)
      showToast(
        'success',
        `Dokumen ${item.dokumen?.kode_arsip} resmi Anda terima. Pemegang dokumen telah diperbarui dan Berita Acara PDF telah diterbitkan.`,
        `/api/serah-terima/${item.id}/bukti-pdf`,
        'Unduh Bukti PDF (BAST)'
      )
      loadLists()
    } catch (err) {
      showToast('error', 'Terjadi kesalahan sistem saat memproses konfirmasi.')
    } finally {
      setIsActionLoading(false)
    }
  }

  // 7. Tolak Serah Terima Dokumen (Penerima)
  const handleRejectReceive = async () => {
    if (!rejectModalItem) return
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/serah-terima/${rejectModalItem.id}/tolak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alasan: rejectReason }),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast('error', data.error || 'Gagal menolak serah terima.')
        return
      }

      setRejectModalItem(null)
      setRejectReason('')
      showToast('success', `Serah terima dokumen ${rejectModalItem.dokumen?.kode_arsip} telah ditolak. Pemegang dan lokasi fisik tetap pada penyerah.`)
      loadLists()
    } catch (err) {
      showToast('error', 'Terjadi kesalahan saat menolak serah terima.')
    } finally {
      setIsActionLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Toast Notifikasi */}
        {toast && (
          <div
            className={`flex items-center justify-between gap-4 rounded-xl border p-4 shadow-md transition-all ${
              toast.type === 'success'
                ? 'border-[#2F9E5B]/30 bg-[#E7F6EC] text-[#1E6B3E]'
                : 'border-[#D64545]/30 bg-[#FDECEC] text-[#A82828]'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2F9E5B]" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-[#D64545]" />
              )}
              <p className="text-sm font-medium">{toast.text}</p>
            </div>
            <div className="flex items-center gap-2">
              {toast.actionUrl && (
                <a
                  href={toast.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#162A45]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{toast.actionText || 'Unduh'}</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded-md p-1 hover:bg-black/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Header Halaman */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold tracking-tight text-[#111827] sm:text-3xl">
              Serah Terima Fisik Dokumen
            </h1>
            <p className="mt-1 text-sm text-[#4B5E76]">
              Pencatatan perpindahan fisik dokumen arsip aktif menggunakan pemindaian QR / barcode scanner kasir & mobile.
            </p>
          </div>
          <button
            type="button"
            onClick={loadLists}
            className="flex items-center gap-2 rounded-lg border border-[#CBD7E3] bg-white px-3.5 py-2 text-xs font-medium text-[#1E3A5F] shadow-2xs hover:bg-[#F8FAFC]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-[#CBD7E3]">
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'scan'
                ? 'border-[#1E3A5F] text-[#1E3A5F]'
                : 'border-transparent text-[#64748B] hover:text-[#1E3A5F]'
            }`}
          >
            <Scan className="h-4 w-4" />
            <span>Pindai & Serahkan Dokumen</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('menunggu')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'menunggu'
                ? 'border-[#1E3A5F] text-[#1E3A5F]'
                : 'border-transparent text-[#64748B] hover:text-[#1E3A5F]'
            }`}
          >
            <Inbox className="h-4 w-4" />
            <span>Menunggu Konfirmasi Saya</span>
            {pendingTransfers.length > 0 && (
              <span className="rounded-full bg-[#D64545] px-2 py-0.5 text-[10px] font-bold text-white">
                {pendingTransfers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('riwayat')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'riwayat'
                ? 'border-[#1E3A5F] text-[#1E3A5F]'
                : 'border-transparent text-[#64748B] hover:text-[#1E3A5F]'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Riwayat Serah Terima</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: PINDAI & AJUKAN SERAH TERIMA                     */}
        {/* ======================================================== */}
        {activeTab === 'scan' && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Kolom Kiri: Input Pemindaian (USB Barcode Scanner & Kamera HP) */}
            <div className="space-y-6">
              <div className="rounded-xl border border-[#CBD7E3] bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#CBD7E3] pb-4 mb-5">
                  <div className="flex items-center gap-2.5">
                    <Scan className="h-5 w-5 text-[#1E3A5F]" />
                    <div>
                      <h2 className="text-base font-semibold text-[#111827]">
                        Pemindaian Kode Arsip
                      </h2>
                      <p className="text-xs text-[#4B5E76]">
                        Mendukung scanner USB gaya kasir (otomatis proses saat scan) atau input manual
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isCameraActive) stopCamera()
                      else startCamera()
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isCameraActive
                        ? 'border-[#D64545] bg-[#FDECEC] text-[#D64545]'
                        : 'border-[#CBD7E3] bg-[#F8FAFC] text-[#1E3A5F] hover:bg-[#EEF7FD]'
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>{isCameraActive ? 'Tutup Kamera' : 'Kamera HP'}</span>
                  </button>
                </div>

                {/* Tampilan Kamera Live Scanner jika aktif */}
                {isCameraActive && (
                  <div className="relative mb-5 overflow-hidden rounded-xl border border-[#1E3A5F] bg-black">
                    <video ref={videoRef} className="h-64 w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="h-48 w-48 rounded-lg border-2 border-dashed border-[#38BDF8] bg-white/5 animate-pulse" />
                    </div>
                    <div className="absolute bottom-2 left-0 right-0 text-center">
                      <span className="rounded-md bg-black/70 px-3 py-1 text-[11px] font-mono text-white">
                        Arahkan kamera ke QR Code / Barcode dokumen
                      </span>
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="mb-4 rounded-lg bg-[#FEF3F2] p-3 text-xs text-[#B42318] flex items-start gap-2 border-l-4 border-[#B42318]">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>{cameraError}</p>
                  </div>
                )}

                {/* Input Scanner Utama */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSearchCode()
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#1E3A5F] mb-1.5" htmlFor="barcodeInput">
                      Kode Arsip / Nomor Payment / Doc Voucher
                    </label>
                    <div className="relative">
                      <input
                        ref={scanInputRef}
                        id="barcodeInput"
                        type="text"
                        value={scanCode}
                        onChange={(e) => setScanCode(e.target.value)}
                        onKeyDown={handleKeyDownScanner}
                        placeholder="Scan barcode USB atau ketik: 2025_2000_1500013765_1900009386..."
                        className="w-full h-12 pl-4 pr-24 font-mono text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827] placeholder-[#94A3B8]"
                      />
                      <button
                        type="submit"
                        disabled={isSearching || !scanCode.trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-medium rounded-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        {isSearching ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Search className="h-3.5 w-3.5" />
                            <span>Cari</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-[#64748B]">
                      Gaya Kasir: Hubungkan barcode scanner USB, lalu tembakkan laser ke barcode/QR dokumen.
                    </p>
                  </div>
                </form>

                {/* Pesan Kesalahan Scan */}
                {scanError && (
                  <div className="mt-5 rounded-lg border-l-4 border-[#B42318] bg-[#FEF3F2] p-4 text-xs text-[#B42318] flex items-start gap-3">
                    <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Dokumen Tidak Dapat Diserahterimakan</p>
                      <p className="mt-0.5 leading-relaxed">{scanError}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Petunjuk Alur Serah Terima */}
              <div className="rounded-xl border border-[#CBD7E3] bg-[#F8FAFC] p-5 text-xs text-[#4B5E76] space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[#1E3A5F]">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Ketentuan Kearsipan Serah Terima</span>
                </div>
                <ul className="space-y-1.5 pl-5 list-disc leading-relaxed">
                  <li><strong>Hanya dokumen Aktif</strong> yang dapat diserahterimakan. Dokumen inaktif, menunggu persetujuan, atau ditolak dilarang diserahterimakan.</li>
                  <li><strong>Pemegang dan lokasi fisik</strong> pada sistem <em>belum berpindah</em> sebelum pihak penerima mengonfirmasi terima.</li>
                  <li>Setelah dikonfirmasi, sistem menerbitkan <strong>Berita Acara Serah Terima (BAST)</strong> resmi dalam bentuk PDF bertanda tangan digital.</li>
                </ul>
              </div>
            </div>

            {/* Kolom Kanan: Hasil Dokumen Ditemukan & Formulir Penyerahan */}
            <div>
              {scannedDoc ? (
                <div className="rounded-xl border border-[#CBD7E3] bg-white p-6 shadow-xs space-y-6 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-[#CBD7E3] pb-4">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold">
                        Dokumen Ditemukan & Aktif
                      </span>
                      <h3 className="text-base font-serif font-bold text-[#111827] mt-0.5">
                        {scannedDoc.judul}
                      </h3>
                    </div>
                    <StampBadge status="aktif" />
                  </div>

                  {/* Detail Dokumen Terkini */}
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#F8FAFC] p-3.5 border border-[#E2E8F0] text-xs">
                    <div>
                      <span className="text-[#64748B] block">Kode Arsip SIG:</span>
                      <KodeArsip kode={scannedDoc.kode_arsip} className="block font-mono font-bold text-[#1E3A5F]" />
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Kategori:</span>
                      <span className="font-medium text-[#111827]">{scannedDoc.kategori}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Pemegang Fisik Saat Ini:</span>
                      <span className="font-medium text-[#111827]">{scannedDoc.pemegang_nama}</span>
                      <span className="text-[10px] text-[#64748B] block">{scannedDoc.pemegang_jabatan}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Lokasi Fisik Saat Ini:</span>
                      <span className="font-medium text-[#111827] flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-[#1E3A5F]" />
                        {scannedDoc.lokasi_saat_ini}
                      </span>
                    </div>
                  </div>

                  {/* Formulir Penyerahan */}
                  <form onSubmit={handleSubmitTransfer} className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[#1E3A5F] mb-1.5" htmlFor="selectPenerima">
                        Pilih Pihak Penerima (Calon Pemegang Baru) <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="selectPenerima"
                        required
                        value={selectedPenerimaId}
                        onChange={(e) => setSelectedPenerimaId(e.target.value)}
                        className="w-full h-11 px-3 text-xs bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#111827]"
                      >
                        <option value="">-- Pilih Pegawai Penerima --</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nama_lengkap} — {p.jabatan || p.role.toUpperCase()} ({p.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[#1E3A5F] mb-1.5" htmlFor="inputLokasi">
                        Lokasi Tujuan Penyimpanan Baru <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="inputLokasi"
                        type="text"
                        required
                        value={targetLokasi}
                        onChange={(e) => setTargetLokasi(e.target.value)}
                        placeholder="Contoh: Ruang Akuntansi Lt. 2 - Meja Verifikasi"
                        className="w-full h-11 px-3 text-xs bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#111827]"
                      />
                      {/* Shortcut Pilihan Lokasi Umum */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {['Ruang Akuntansi Lt. 2', 'Ruang Arsip Aktif - Rak A', 'Meja PIC Perpajakan', 'Direksi Lt. 3'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setTargetLokasi(preset)}
                            className="rounded border border-[#CBD7E3] bg-white px-2 py-0.5 text-[10px] text-[#4B5E76] hover:bg-[#EEF7FD] hover:text-[#1E3A5F]"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[#1E3A5F] mb-1.5" htmlFor="inputKet">
                        Catatan Khusus / Keperluan Serah Terima (Opsional)
                      </label>
                      <textarea
                        id="inputKet"
                        rows={2}
                        value={keterangan}
                        onChange={(e) => setKeterangan(e.target.value)}
                        placeholder="Contoh: Dokumen diserahkan untuk proses audit neraca..."
                        className="w-full p-3 text-xs bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#111827]"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-[#CBD7E3]">
                      <button
                        type="button"
                        onClick={() => setScannedDoc(null)}
                        className="px-4 py-2 text-xs font-medium text-[#64748B] hover:text-[#111827]"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Mengajukan...</span>
                          </>
                        ) : (
                          <>
                            <span>Ajukan Serah Terima</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#CBD7E3] bg-white p-12 text-center text-xs text-[#64748B]">
                  <Scan className="mx-auto h-12 w-12 text-[#94A3B8] stroke-1 mb-3" />
                  <p className="font-semibold text-sm text-[#111827]">Menunggu Pemindaian Kode Arsip</p>
                  <p className="mt-1 text-[#4B5E76] max-w-sm mx-auto">
                    Pindai barcode atau ketik kode arsip pada formulir di sebelah kiri untuk memunculkan data dokumen dan mengajukan serah terima fisik.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MENUNGGU KONFIRMASI SAYA                         */}
        {/* ======================================================== */}
        {activeTab === 'menunggu' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#CBD7E3] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#CBD7E3] pb-4 mb-5">
                <div>
                  <h2 className="text-base font-semibold text-[#111827]">
                    Serah Terima Masuk (Menunggu Konfirmasi Anda)
                  </h2>
                  <p className="text-xs text-[#4B5E76]">
                    Periksa fisik dokumen secara teliti sebelum mengonfirmasi terima. Pemegang resmi hanya berpindah setelah konfirmasi Anda.
                  </p>
                </div>
                <span className="rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-semibold text-[#1F5C55]">
                  {pendingTransfers.length} Dokumen Menunggu
                </span>
              </div>

              {pendingTransfers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#CBD7E3] p-10 text-center text-xs text-[#64748B]">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-[#2F9E5B] mb-2" />
                  <p className="font-medium text-sm text-[#111827]">Tidak Ada Serah Terima Tertunda</p>
                  <p className="mt-0.5">Seluruh serah terima dokumen fisik yang ditujukan kepada Anda telah selesai diproses.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTransfers.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#CBD7E3] bg-[#F8FAFC] p-4.5 hover:bg-[#F0F5FA] transition-colors"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <KodeArsip kode={item.dokumen?.kode_arsip} className="font-mono text-xs font-bold text-[#1E3A5F]" />
                          <span className="rounded bg-[#FFF4DE] px-2 py-0.5 text-[10px] font-semibold text-[#C98A1B]">
                            Menunggu Konfirmasi
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-[#111827]">
                          {item.dokumen?.judul}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4B5E76]">
                          <span>
                            <strong>Dari:</strong> {item.penyerah?.nama_lengkap} ({item.dari_lokasi})
                          </span>
                          <span>
                            <strong>Tujuan:</strong> {item.ke_lokasi}
                          </span>
                          <span>
                            <strong>Diajukan:</strong> {new Date(item.tanggal_serah).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                        {item.keterangan && (
                          <p className="text-[11px] italic text-[#64748B]">
                            Catatan: &ldquo;{item.keterangan}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Tombol Aksi Konfirmasi / Tolak */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectModalItem(item)
                            setRejectReason('')
                          }}
                          className="rounded-lg border border-[#D64545] bg-white px-3 py-1.5 text-xs font-medium text-[#D64545] hover:bg-[#FDECEC] transition-colors cursor-pointer"
                        >
                          Tolak
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmModalItem(item)}
                          className="rounded-lg bg-[#1E3A5F] hover:bg-[#162A45] px-3.5 py-1.5 text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Konfirmasi Terima</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: RIWAYAT SERAH TERIMA                              */}
        {/* ======================================================== */}
        {activeTab === 'riwayat' && (
          <div className="rounded-xl border border-[#CBD7E3] bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-[#CBD7E3] pb-4">
              <h2 className="text-base font-semibold text-[#111827]">
                Riwayat Lengkap Serah Terima Dokumen
              </h2>
              <p className="text-xs text-[#4B5E76]">
                Daftar rekaman seluruh perpindahan fisik dokumen arsip beserta tautan Berita Acara PDF resmi
              </p>
            </div>

            {historyTransfers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#CBD7E3] p-10 text-center text-xs text-[#64748B]">
                <p>Belum ada rekaman serah terima dokumen dalam sistem.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#CBD7E3] bg-[#F8FAFC] text-[#1E3A5F] font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3">Tanggal</th>
                      <th className="py-3 px-3">Kode Arsip & Judul</th>
                      <th className="py-3 px-3">Pihak Penyerah</th>
                      <th className="py-3 px-3">Pihak Penerima</th>
                      <th className="py-3 px-3">Lokasi Baru</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Bukti BAST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {historyTransfers.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-3 whitespace-nowrap text-[#64748B]">
                          {new Date(item.tanggal_serah).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <Link
                            href={`/dokumen/${item.dokumen_id}`}
                            className="font-mono font-bold text-[#1E3A5F] hover:underline block min-w-[120px] max-w-[200px]"
                          >
                            <KodeArsip kode={item.dokumen?.kode_arsip} />
                          </Link>
                          <span className="text-[11px] text-[#4B5E76] line-clamp-1">
                            {item.dokumen?.judul}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#111827]">
                          <span className="font-medium block">{item.penyerah?.nama_lengkap || '-'}</span>
                          <span className="text-[10px] text-[#64748B]">{item.dari_lokasi}</span>
                        </td>
                        <td className="py-3 px-3 text-[#111827]">
                          <span className="font-medium block">{item.penerima?.nama_lengkap || '-'}</span>
                          <span className="text-[10px] text-[#64748B]">{item.penerima?.jabatan}</span>
                        </td>
                        <td className="py-3 px-3 text-[#4B5E76] whitespace-nowrap">
                          {item.ke_lokasi}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              item.status_serah === 'Diterima'
                                ? 'bg-[#E7F6EC] text-[#2F9E5B]'
                                : item.status_serah === 'Ditolak'
                                ? 'bg-[#FDECEC] text-[#D64545]'
                                : 'bg-[#FFF4DE] text-[#C98A1B]'
                            }`}
                          >
                            {item.status_serah}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {item.status_serah === 'Diterima' ? (
                            <a
                              href={`/api/serah-terima/${item.id}/bukti-pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-[#1E3A5F] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#162A45]"
                            >
                              <Download className="h-3 w-3" />
                              <span>PDF</span>
                            </a>
                          ) : (
                            <span className="text-[#94A3B8]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI TERIMA                                  */}
      {/* ======================================================== */}
      {confirmModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-[#CBD7E3] bg-white p-6 shadow-2xl space-y-4">
            <div className="border-b border-[#CBD7E3] pb-3">
              <h3 className="text-base font-serif font-bold text-[#111827]">
                Konfirmasi Penerimaan Fisik Dokumen
              </h3>
              <p className="text-xs text-[#4B5E76] mt-0.5">
                Pastikan Anda telah memegang berkas fisik dokumen ini secara nyata.
              </p>
            </div>

            <div className="rounded-lg bg-[#F8FAFC] p-3 border border-[#E2E8F0] text-xs space-y-1.5">
              <div>
                <span className="text-[#64748B]">Kode Arsip:</span>{' '}
                <strong className="font-mono text-[#1E3A5F]">{confirmModalItem.dokumen?.kode_arsip}</strong>
              </div>
              <div>
                <span className="text-[#64748B]">Judul:</span>{' '}
                <span className="font-medium text-[#111827]">{confirmModalItem.dokumen?.judul}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Penyerah:</span>{' '}
                <span>{confirmModalItem.penyerah?.nama_lengkap}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Lokasi Penyimpanan Baru:</span>{' '}
                <strong className="text-[#1E3A5F]">{confirmModalItem.ke_lokasi}</strong>
              </div>
            </div>

            <p className="text-xs text-[#4B5E76] leading-relaxed">
              Setelah dikonfirmasi, Anda akan resmi tercatat sebagai <strong>Pemegang Saat Ini</strong> pada dokumen ini dan sistem akan menerbitkan lembar Berita Acara Serah Terima (BAST) PDF resmi.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#CBD7E3]">
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => setConfirmModalItem(null)}
                className="px-3.5 py-2 text-xs font-medium text-[#64748B] hover:text-[#111827]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => handleConfirmReceive(confirmModalItem)}
                className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {isActionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Ya, Saya Terima Fisik Dokumen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL TOLAK SERAH TERIMA                                 */}
      {/* ======================================================== */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-[#CBD7E3] bg-white p-6 shadow-2xl space-y-4">
            <div className="border-b border-[#CBD7E3] pb-3">
              <h3 className="text-base font-serif font-bold text-[#D64545]">
                Tolak Penerimaan Fisik Dokumen
              </h3>
              <p className="text-xs text-[#4B5E76] mt-0.5">
                Pemegang fisik dan lokasi dokumen akan tetap berada pada pihak penyerah.
              </p>
            </div>

            <div className="text-xs text-[#4B5E76]">
              Dokumen: <strong className="font-mono text-[#111827]">{rejectModalItem.dokumen?.kode_arsip}</strong>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#1E3A5F] mb-1.5" htmlFor="alasanTolak">
                Alasan Penolakan <span className="text-red-500">*</span>
              </label>
              <textarea
                id="alasanTolak"
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Berkas fisik tidak lengkap / dokumen belum diserahkan ke meja saya..."
                className="w-full p-3 text-xs bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#111827]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#CBD7E3]">
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => setRejectModalItem(null)}
                className="px-3.5 py-2 text-xs font-medium text-[#64748B] hover:text-[#111827]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isActionLoading || !rejectReason.trim()}
                onClick={handleRejectReceive}
                className="px-4 py-2 bg-[#D64545] hover:bg-[#B42318] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {isActionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menolak...</span>
                  </>
                ) : (
                  <span>Konfirmasi Penolakan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

