'use client'

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { UserRole } from '@/types'
import {
  Search,
  Scan,
  Camera,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  User,
  MapPin,
  Building2,
  Check,
  Inbox,
  Loader2,
  Calendar,
  Layers,
  AlertCircle,
  Clock,
  ArrowRight,
  Download,
  AlertTriangle,
  Archive,
  FileCheck2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'

interface TransferQueueItem {
  id: string
  nomor_ba: string
  catatan: string
  tanggal_pengajuan: string
  penyerah: {
    id: string
    nama_lengkap: string
    email: string
    jabatan: string
  }
  dokumen: {
    id: string
    kode_arsip: string
    nomor_dokumen: string | null
    nomor_ppl: string | null
    judul: string
    jumlah_halaman: number
    tanggal_dokumen: string
    tanggal_kadaluarsa: string | null
    lokasi_saat_ini: string
    kategori_nama: string
  }
}

function VerifikasiTransferContent() {
  const router = useRouter()
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('staff')
  const [currentUserName, setCurrentUserName] = useState<string>('')
  const [items, setItems] = useState<TransferQueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannedCode, setScannedCode] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Modal Terima
  const [acceptItem, setAcceptItem] = useState<TransferQueueItem | null>(null)
  const [tandaTanganNama, setTandaTanganNama] = useState('')
  const [isAccepting, setIsAccepting] = useState(false)

  // Modal Tolak
  const [rejectItem, setRejectItem] = useState<TransferQueueItem | null>(null)
  const [alasanTolak, setAlasanTolak] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)

  // Feedback Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'reject'
    text: string
    detail?: string
  } | null>(null)

  const showToast = (type: 'success' | 'reject', text: string, detail?: string) => {
    setToast({ type, text, detail })
    setTimeout(() => setToast(null), 6000)
  }

  // Load Antrean Transfer
  const fetchTransferQueue = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, nama_lengkap, email')
          .eq('id', user.id)
          .single()

        const role = (profile?.role as UserRole) || 'staff'
        setCurrentUserRole(role)
        const name = profile?.nama_lengkap || profile?.email || 'PIC Arsip Inaktif'
        setCurrentUserName(name)
        setTandaTanganNama(name)
      }

      const res = await fetch('/api/transfer-arsip/antrean')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat antrean transfer.')
      setItems(data.antrean || [])
    } catch (err: any) {
      console.error('Error fetching antrean:', err)
      showToast('reject', err.message || 'Gagal memuat antrean berkas.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTransferQueue()
  }, [fetchTransferQueue])

  // Camera Barcode/QR Scanner
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsCameraActive(false)
  }

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
        setScannedCode(value)
        setSearchQuery(value)
      }

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
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
        })
        const detectLoop = async () => {
          const video = videoRef.current
          if (!streamRef.current || !video) return
          try {
            if (video.readyState >= 2) {
              const barcodes = await barcodeDetector.detect(video)
              if (barcodes.length > 0) {
                onDetected(barcodes[0].rawValue)
                return
              }
            }
          } catch {
            // continue
          }
          requestAnimationFrame(detectLoop)
        }
        requestAnimationFrame(detectLoop)
      }
    } catch (err: any) {
      console.error('Kamera error:', err)
      setCameraError('Kamera tidak dapat diakses atau diblokir oleh izin peramban.')
      stopCamera()
    }
  }

  // Filter Antrean
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase().trim()
    return items.filter(
      (item) =>
        item.dokumen.kode_arsip.toLowerCase().includes(q) ||
        item.dokumen.judul.toLowerCase().includes(q) ||
        item.dokumen.nomor_dokumen?.toLowerCase().includes(q) ||
        item.nomor_ba.toLowerCase().includes(q) ||
        item.penyerah.nama_lengkap.toLowerCase().includes(q)
    )
  }, [items, searchQuery])

  // Aksi Terima Verifikasi
  const handleConfirmTerima = async () => {
    if (!acceptItem) return
    setIsAccepting(true)
    try {
      const res = await fetch(`/api/transfer-arsip/${acceptItem.id}/verifikasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aksi: 'terima',
          tandaTanganNama: tandaTanganNama.trim() || currentUserName,
          scanCodeMatch: acceptItem.dokumen.kode_arsip,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menerima berkas.')

      showToast(
        'success',
        `Berkas ${acceptItem.dokumen.kode_arsip} Berhasil Diverifikasi!`,
        `Status beralih ke Inaktif, file dipindahkan ke arsip-inaktif, boks dialokasikan di ${data.alokasiBoks?.nomorBoks || 'Boks Inaktif'}.`
      )

      setAcceptItem(null)
      await fetchTransferQueue()
    } catch (err: any) {
      console.error('Error terima verifikasi:', err)
      showToast('reject', err.message || 'Gagal menerima berkas.')
    } finally {
      setIsAccepting(false)
    }
  }

  // Aksi Tolak Verifikasi
  const handleConfirmTolak = async () => {
    if (!rejectItem) return
    if (!alasanTolak.trim()) {
      showToast('reject', 'Alasan penolakan fisik wajib diisi.')
      return
    }

    setIsRejecting(true)
    try {
      const res = await fetch(`/api/transfer-arsip/${rejectItem.id}/verifikasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aksi: 'tolak',
          alasan: alasanTolak.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menolak berkas.')

      showToast(
        'reject',
        `Berkas ${rejectItem.dokumen.kode_arsip} Ditolak.`,
        'Dokumen tetap berstatus Aktif dan dikembalikan kepada PIC Arsip Aktif.'
      )

      setRejectItem(null)
      setAlasanTolak('')
      await fetchTransferQueue()
    } catch (err: any) {
      console.error('Error tolak verifikasi:', err)
      showToast('reject', err.message || 'Gagal menolak berkas.')
    } finally {
      setIsRejecting(false)
    }
  }

  const isPicInaktif = currentUserRole === 'pic_inaktif'
  const isSuperadmin = currentUserRole === 'superadmin'
  const isAtasanInaktif = currentUserRole === 'atasan_inaktif'
  const canVerify = isPicInaktif || isSuperadmin || isAtasanInaktif

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-xl border p-4 shadow-xl max-w-md animate-in fade-in ${
            toast.type === 'success'
              ? 'border-[#CEEAD6] bg-[#E6F4EA] text-[#137333]'
              : 'border-[#FAD2CF] bg-[#FDECEC] text-[#D64545]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-0.5">
            <p className="font-bold text-sm">{toast.text}</p>
            {toast.detail && <p className="text-xs opacity-90">{toast.detail}</p>}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-2xl border border-[#BCE1F9] bg-gradient-to-r from-[#F0F8FF] to-[#E6F3FD] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3BA4E8]/30 bg-white/80 px-3 py-1 text-xs font-semibold text-[#1E86C8]">
              <Archive className="h-3.5 w-3.5" />
              Penerimaan &amp; Verifikasi Fisik Inaktif (M8 — R.03)
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1F2333]">
              Verifikasi Dokumen Transfer Inaktif
            </h1>
            <p className="text-sm text-[#4B5163]">
              Cocokkan fisik berkas yang diserahkan PIC Arsip Aktif dengan memindai Barcode/QR Kode Arsip SIG. Konfirmasi penerimaan untuk mengubah status menjadi Inaktif dan mengalokasikan boks inaktif otomatis.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={isCameraActive ? stopCamera : startCamera}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                isCameraActive
                  ? 'bg-[#D64545] text-white hover:bg-[#B91C1C]'
                  : 'bg-white border border-[#3BA4E8] text-[#1E86C8] hover:bg-[#EEF7FD]'
              }`}
            >
              <Camera className="h-4 w-4" />
              {isCameraActive ? 'Tutup Kamera' : 'Pindai Kamera QR'}
            </button>
          </div>
        </div>
      </div>

      {/* Live Camera Scanner Viewport */}
      {isCameraActive && (
        <div className="rounded-xl border border-[#3BA4E8] bg-black p-4 text-white space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-white/80">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              Arahkan kamera ke label QR / Barcode dokumen pada fisik berkas
            </span>
            <button
              type="button"
              onClick={stopCamera}
              className="text-white/70 hover:text-white"
            >
              Tutup [ESC]
            </button>
          </div>
          <div className="relative aspect-video max-h-72 w-full overflow-hidden rounded-lg bg-neutral-900 flex items-center justify-center">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
            <div className="absolute inset-0 border-2 border-dashed border-[#3BA4E8]/60 pointer-events-none rounded-lg m-6" />
          </div>
          {cameraError && (
            <p className="text-xs text-red-400 font-medium">{cameraError}</p>
          )}
        </div>
      )}

      {/* Search & Scanner Input Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#ECEEF5] shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Scan className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A90A2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Scan atau ketik Kode Arsip / Nomor BA..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-[#D5D9E2] rounded-lg focus:outline-none focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 font-mono"
          />
        </div>

        <div className="flex items-center gap-3 text-xs font-medium text-[#4B5163]">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F7F8FC] px-3 py-1.5 border border-[#ECEEF5]">
            <span className="h-2 w-2 rounded-full bg-[#E37400]" />
            Antrean Masuk: <strong className="text-[#1F2333] ml-1">{items.length} berkas</strong>
          </span>
          <button
            type="button"
            onClick={fetchTransferQueue}
            className="p-1.5 rounded-lg border border-[#ECEEF5] hover:bg-[#F7F8FC] text-[#6B7185]"
            title="Segarkan Antrean"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#6B7185]">
            <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
            <p className="text-sm font-medium">Memuat antrean verifikasi fisik berkas...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-[#6B7185] space-y-2">
            <Inbox className="h-10 w-10 mx-auto text-[#8A90A2] stroke-[1.5]" />
            <p className="text-sm font-semibold text-[#1F2333]">
              Tidak Ada Berkas Menunggu Verifikasi
            </p>
            <p className="text-xs text-[#8A90A2] max-w-md mx-auto">
              Saat ini tidak ada permohonan transfer dokumen yang menunggu konfirmasi dari PIC Arsip Aktif.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F7F8FC] border-b border-[#ECEEF5] text-xs font-semibold text-[#4B5163] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Dokumen &amp; Kode Arsip</th>
                  <th className="py-3 px-4">Penyerah (PIC Aktif)</th>
                  <th className="py-3 px-4">No. Berita Acara</th>
                  <th className="py-3 px-4">Ket. Fisik</th>
                  <th className="py-3 px-4 text-right">Aksi Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F7F8FC] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <KodeArsip kode={item.dokumen.kode_arsip} className="text-xs" />
                        <p className="font-semibold text-[#1F2333] line-clamp-1">
                          {item.dokumen.judul}
                        </p>
                        <p className="text-xs text-[#6B7185]">
                          No. Dok: <span className="font-mono">{item.dokumen.nomor_dokumen || '-'}</span> • {item.dokumen.kategori_nama}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-[#1F2333]">
                          <User className="h-3 w-3 text-[#8A90A2]" />
                          <span>{item.penyerah.nama_lengkap}</span>
                        </div>
                        <p className="text-[#8A90A2]">{item.penyerah.jabatan || 'PIC Arsip Aktif'}</p>
                        <p className="text-[11px] text-[#6B7185]">
                          Tgl: {new Date(item.tanggal_pengajuan).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="space-y-1">
                        <span className="font-mono font-bold text-[#1E86C8] bg-[#EEF7FD] px-2 py-0.5 rounded border border-[#BCE1F9]">
                          {item.nomor_ba}
                        </span>
                        {item.catatan && (
                          <p className="text-[11px] text-[#8A90A2] line-clamp-2 italic">
                            &quot;{item.catatan}&quot;
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="space-y-1">
                        <span className="inline-block rounded-md bg-[#EEF0F4] px-2 py-0.5 text-xs font-semibold text-[#4B5163]">
                          {item.dokumen.jumlah_halaman} lembar
                        </span>
                        <p className="text-[#8A90A2]">
                          Asal: {item.dokumen.lokasi_saat_ini}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {canVerify ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectItem(item)
                              setAlasanTolak('')
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#FAD2CF] bg-[#FFF5F5] px-3 py-1.5 text-xs font-semibold text-[#D64545] hover:bg-[#FDECEC] transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Tolak
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAcceptItem(item)
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#3BA4E8] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#2A93D7] transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Terima Fisik
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#8A90A2] italic">
                          Hanya PIC / Atasan Inaktif
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Penerimaan Fisik */}
      {acceptItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#ECEEF5] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#2F9E5B]" />
                <h3 className="text-lg font-bold text-[#1F2333]">
                  Konfirmasi Penerimaan Fisik Berkas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAcceptItem(null)}
                className="text-[#8A90A2] hover:text-[#1F2333]"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm text-[#4B5163]">
              <div className="rounded-xl border border-[#ECEEF5] bg-[#F7F8FC] p-3 space-y-1 text-xs">
                <p>
                  <strong>Kode Arsip:</strong> <span className="font-mono text-[#1F2333]">{acceptItem.dokumen.kode_arsip}</span>
                </p>
                <p>
                  <strong>Judul:</strong> <span className="text-[#1F2333]">{acceptItem.dokumen.judul}</span>
                </p>
                <p>
                  <strong>Jumlah Lembar:</strong> {acceptItem.dokumen.jumlah_halaman} lembar
                </p>
                <p>
                  <strong>No. Berita Acara:</strong> <span className="font-mono text-[#1E86C8]">{acceptItem.nomor_ba}</span>
                </p>
              </div>

              <div className="rounded-xl bg-[#E6F4EA] border border-[#CEEAD6] p-3 text-xs text-[#137333] space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Alur Kearsipan Otomatis (R.03):
                </p>
                <p>1. Status dokumen beralih menjadi <strong>Inaktif</strong>.</p>
                <p>2. Berkas digital dipindahkan dari bucket <code>arsip-aktif</code> ke <code>arsip-inaktif</code>.</p>
                <p>3. Lokasi fisik ditempatkan di <strong>Gudang Inaktif (Rak Inaktif 01)</strong>.</p>
                <p>4. Alokasi nomor boks inaktif otomatis berkapasitas 500 lembar.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                  Nama Penerima (Tanda Tangan / Konfirmasi)
                </label>
                <input
                  type="text"
                  value={tandaTanganNama}
                  onChange={(e) => setTandaTanganNama(e.target.value)}
                  placeholder="Nama Lengkap Petugas PIC Inaktif"
                  className="w-full rounded-lg border border-[#D5D9E2] p-2.5 text-sm focus:outline-none focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 font-medium text-[#1F2333]"
                />
                <p className="text-[11px] text-[#8A90A2] mt-1">
                  Waktu penerimaan tercatat resmi pada: {new Date().toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#ECEEF5]">
              <button
                type="button"
                onClick={() => setAcceptItem(null)}
                className="rounded-lg border border-[#D5D9E2] px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F7F8FC]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isAccepting || !tandaTanganNama.trim()}
                onClick={handleConfirmTerima}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2F9E5B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#25834A] disabled:opacity-50"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses Pemindahan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Terima &amp; Alokasikan Boks
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak Verifikasi */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#ECEEF5] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-[#D64545]" />
                <h3 className="text-lg font-bold text-[#1F2333]">
                  Tolak Penerimaan Fisik Berkas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                className="text-[#8A90A2] hover:text-[#1F2333]"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm text-[#4B5163]">
              <p>
                Dokumen <strong className="font-mono text-[#1F2333]">{rejectItem.dokumen.kode_arsip}</strong> akan ditolak dan dikembalikan ke PIC Arsip Aktif. Status dokumen <strong>tetap Aktif</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                  Alasan Penolakan Fisik (Wajib Diisi) <span className="text-[#D64545]">*</span>
                </label>
                <textarea
                  value={alasanTolak}
                  onChange={(e) => setAlasanTolak(e.target.value)}
                  placeholder="Contoh: Berkas fisik tidak lengkap / halaman hilang, kondisi fisik basah/rusak, dsb..."
                  rows={3}
                  className="w-full rounded-lg border border-[#D5D9E2] p-2.5 text-sm focus:outline-none focus:border-[#D64545] focus:ring-2 focus:ring-[#D64545]/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#ECEEF5]">
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                className="rounded-lg border border-[#D5D9E2] px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F7F8FC]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isRejecting || !alasanTolak.trim()}
                onClick={handleConfirmTolak}
                className="inline-flex items-center gap-2 rounded-lg bg-[#D64545] px-5 py-2 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Kirim Penolakan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VerifikasiTransferPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
          </div>
        }
      >
        <VerifikasiTransferContent />
      </Suspense>
    </AppLayout>
  )
}
