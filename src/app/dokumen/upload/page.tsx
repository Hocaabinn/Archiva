'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Trash2,
  Loader2,
  Mic,
  MicOff,
  QrCode,
  Scan,
  X,
  Camera,
  Layers,
  Building2,
  Calendar,
  Hash,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KategoriDokumen, UserRole } from '@/types'
import { validateKodeArsipSIG } from '@/lib/server-dokumen'

interface UnitInfo {
  id: string
  nama: string
  kode_perusahaan: string
}

export default function UploadDokumenPage() {
  const router = useRouter()
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null)
  const [unitInfo, setUnitInfo] = useState<UnitInfo>({ id: '', nama: 'Keuangan', kode_perusahaan: '2000' })
  const [nextDocVoucher, setNextDocVoucher] = useState('1900000001')
  const [kategoriList, setKategoriList] = useState<KategoriDokumen[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)

  // Field Form Wajib
  const [judul, setJudul] = useState('')
  const [kategoriId, setKategoriId] = useState('')
  const [tanggalDokumen, setTanggalDokumen] = useState(() => new Date().toISOString().slice(0, 10))
  const [jumlahHalaman, setJumlahHalaman] = useState<number | ''>(1)

  // Nomor Payment / PPL (1 field utama untuk SIG)
  const [nomorPpl, setNomorPpl] = useState('')
  const [isNonPayment, setIsNonPayment] = useState(false)
  const [nomorDokumenNonPayment, setNomorDokumenNonPayment] = useState('')

  // Field Form Opsional
  const [penandatangan, setPenandatangan] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [lokasiFisik, setLokasiFisik] = useState('Ruang Arsip Aktif')

  // Berkas
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [lampiranFiles, setLampiranFiles] = useState<File[]>([])

  // State Submisi & Notifikasi
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Voice Typing State
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)

  // Scanner Modal State
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Hitung Token Kode Arsip Otomatis (R.03)
  const tahunDokumen = tanggalDokumen ? tanggalDokumen.slice(0, 4) : new Date().getFullYear().toString()
  const kodePerusahaan = unitInfo.kode_perusahaan || '2000'
  const displayPayment = nomorPpl.trim() ? nomorPpl.trim() : '__________'

  const compositeKodeArsip = isNonPayment
    ? nomorDokumenNonPayment.trim()
    : `${tahunDokumen}_${kodePerusahaan}_${nomorPpl.trim()}_${nextDocVoucher}`

  const kodeValidation = validateKodeArsipSIG(
    isNonPayment ? nomorDokumenNonPayment.trim() : `${tahunDokumen}_${kodePerusahaan}_${nomorPpl.trim() || '0000000000'}_${nextDocVoucher}`
  )

  // Deteksi dukungan Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
      setVoiceSupported(hasSpeech)
    }
  }, [])

  // Load Info Entri (Unit, Next Doc Voucher, Kategori)
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        // Ambil info entri dari API khusus
        const [infoRes, katsRes] = await Promise.all([
          fetch('/api/dokumen/info-entri'),
          supabase.from('kategori_dokumen').select('*').eq('is_active', true).order('nama'),
        ])

        if (infoRes.ok) {
          const infoData = await infoRes.json()
          if (infoData.user?.role) setCurrentUserRole(infoData.user.role)
          if (infoData.unit) setUnitInfo(infoData.unit)
          if (infoData.nextDocVoucher) setNextDocVoucher(infoData.nextDocVoucher)
        } else if (infoRes.status === 403) {
          // Bukan pic_aktif
          const errData = await infoRes.json()
          setErrorMsg(errData.error || 'Akses entri dokumen hanya untuk PIC Arsip Aktif.')
          setCurrentUserRole('staff')
        }

        if (katsRes.data && katsRes.data.length > 0) {
          setKategoriList(katsRes.data)
          setKategoriId(katsRes.data[0].id)
        }
      } catch (err) {
        console.error('Error inisialisasi entri:', err)
      } finally {
        setLoadingInitial(false)
      }
    }
    init()
  }, [router])

  // Voice Typing Handler
  const toggleVoiceTyping = () => {
    if (isListening) {
      setIsListening(false)
      return
    }

    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Peramban Anda belum mendukung fitur Voice Typing.')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'id-ID'
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        // Ambil digit angka dari ucapan suara
        const digits = transcript.replace(/\D/g, '')
        if (digits) {
          setNomorPpl(digits)
        } else {
          setNomorPpl(transcript.trim())
        }
        setIsListening(false)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } catch (err) {
      console.error('Gagal memulai Voice Typing:', err)
      setIsListening(false)
    }
  }

  // Scanner Kamera Handler (jsQR / BarcodeDetector)
  const startCamera = async () => {
    setIsScanning(true)
    setCameraError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      // Loop scanning dengan jsQR
      const jsQR = (await import('jsqr')).default
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      const scanLoop = () => {
        const video = videoRef.current
        if (!streamRef.current || !video || !ctx) return

        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })

          if (result?.data) {
            // Jika yang di-scan adalah kode SIG lengkap, ekstrak nomor payment
            const raw = result.data.trim()
            const sigMatch = raw.match(/^\d{4}_\d{4}_(\d{5,10})_\d{5,10}$/)
            if (sigMatch) {
              setNomorPpl(sigMatch[1])
            } else {
              // Bersihkan hanya digit
              const cleanDigits = raw.replace(/\D/g, '')
              setNomorPpl(cleanDigits || raw)
            }
            stopCamera()
            return
          }
        }
        requestAnimationFrame(scanLoop)
      }
      requestAnimationFrame(scanLoop)
    } catch (err: unknown) {
      console.error('Kamera error:', err)
      const msg = err instanceof Error ? err.message : 'Tidak dapat mengakses kamera'
      setCameraError(`Gagal membuka kamera: ${msg}. Pastikan izin kamera telah diberikan.`)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }

  // Handler Berkas
  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setErrorMsg(null)
    }
  }

  const handleLampiranChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const incoming = Array.from(e.target.files)
    const MAX_TOTAL_SIZE = 25 * 1024 * 1024

    const updated = [...lampiranFiles, ...incoming]
    const totalSize = updated.reduce((acc, f) => acc + f.size, 0)

    if (totalSize > MAX_TOTAL_SIZE) {
      setErrorMsg('Total seluruh berkas lampiran melebihi batas maksimal 25 MB.')
      return
    }

    setLampiranFiles(updated)
    setErrorMsg(null)
  }

  const removeLampiran = (index: number) => {
    setLampiranFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!judul.trim()) {
      setErrorMsg('Judul dokumen arsip wajib diisi.')
      return
    }
    if (!kategoriId) {
      setErrorMsg('Pilih kategori dokumen master.')
      return
    }
    if (!selectedFile) {
      setErrorMsg('Berkas utama dokumen wajib diunggah (format PDF).')
      return
    }
    if (!jumlahHalaman || Number(jumlahHalaman) <= 0) {
      setErrorMsg('Jumlah halaman (lembar fisik) wajib diisi dengan angka minimal 1 untuk alokasi boks.')
      return
    }

    if (!isNonPayment && !nomorPpl.trim()) {
      setErrorMsg('Nomor payment / PPL wajib diisi (bisa diketik, discan barcode/QR, atau voice typing).')
      return
    }
    if (isNonPayment && !nomorDokumenNonPayment.trim()) {
      setErrorMsg('Nomor kontrak / sertifikat wajib diisi untuk dokumen non-payment.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('judul', judul.trim())
      formData.append('kategori_id', kategoriId)
      formData.append('tanggal_dokumen', tanggalDokumen)
      formData.append('jumlah_halaman', String(jumlahHalaman))
      formData.append('is_non_payment', isNonPayment ? 'true' : 'false')

      if (isNonPayment) {
        formData.append('nomor_dokumen_non_payment', nomorDokumenNonPayment.trim())
      } else {
        formData.append('nomor_ppl', nomorPpl.trim())
      }

      if (penandatangan.trim()) formData.append('penandatangan', penandatangan.trim())
      if (deskripsi.trim()) formData.append('deskripsi', deskripsi.trim())
      if (lokasiFisik.trim()) formData.append('lokasi_saat_ini', lokasiFisik.trim())

      lampiranFiles.forEach((lamp) => {
        formData.append('lampiran', lamp)
      })

      const res = await fetch('/api/dokumen/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat mendaftarkan dokumen.')
      }

      setSuccessMsg(`Dokumen "${data.dokumen?.kode_arsip}" berhasil diajukan dengan status MENUNGGU PERSETUJUAN Atasan. Mengalihkan...`)
      setTimeout(() => {
        router.push(`/dokumen/${data.dokumen.id}`)
      }, 1400)
    } catch (err: unknown) {
      console.error('Error submit dokumen:', err)
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem yang tidak terduga.'
      setErrorMsg(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingInitial) {
    return (
      <AppLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-[#555]">
            <Loader2 className="w-5 h-5 animate-spin text-[#9A3412]" />
            <span className="font-mono">Menyiapkan formulir entri arsip...</span>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Proteksi hak akses PIC Arsip Aktif
  if (currentUserRole && currentUserRole !== 'pic_aktif') {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto py-12">
          <div className="border border-[#DC2626] bg-[#FEF2F2] p-6 text-[#991B1B] text-xs font-mono shadow-xs">
            <div className="flex items-center gap-2 mb-2 font-bold text-sm text-[#7F1D1D]">
              <AlertCircle className="w-4 h-4 text-[#DC2626]" />
              <span>AKSES DITOLAK (403 FORBIDDEN)</span>
            </div>
            <p className="leading-relaxed">
              Sesuai aturan Blueprint Bab 5 dan R.03: <strong>HANYA PIC Arsip Aktif (pic_aktif)</strong> yang berhak mengentri dokumen baru.
              Akun Anda memiliki peran: <span className="bg-red-200 px-1 py-0.5 font-bold uppercase">{currentUserRole}</span>.
            </p>
            <div className="mt-4">
              <Link
                href="/dokumen"
                className="inline-flex items-center gap-2 border border-[#991B1B] bg-white px-3 py-1.5 text-xs font-semibold text-[#7F1D1D] hover:bg-red-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Katalog Dokumen</span>
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        {/* Navigasi Atas & Status Cap */}
        <div className="flex items-center justify-between border-b border-[#D9D4C7] pb-3">
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 text-xs font-mono text-[#555] hover:text-[#1A1A1A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>KEMBALI KE KATALOG DOKUMEN</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2.5 py-0.5 border border-[#9A3412] bg-[#FFF7ED] text-[#9A3412] font-semibold tracking-wider">
              STATUS AWAL: MENUNGGU PERSETUJUAN
            </span>
          </div>
        </div>

        {/* Notifikasi Alert */}
        {errorMsg && (
          <div className="p-3.5 border border-[#DC2626] bg-[#FEF2F2] text-[#991B1B] text-xs font-mono flex items-start gap-2.5 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
            <div>
              <p className="font-bold">GAGAL MENDAFTARKAN DOKUMEN</p>
              <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 border border-[#16A34A] bg-[#F0FDF4] text-[#166534] text-xs font-mono flex items-start gap-2.5 shadow-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
            <div>
              <p className="font-bold">PENGAJUAN DOKUMEN BERHASIL</p>
              <p className="mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Modal Scanner Kamera */}
        {isScanning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-white border-2 border-[#1A1A1A] p-5 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#1A1A1A]">
                  <Camera className="w-4 h-4" />
                  <span>PEMINDAI BARCODE / QR NO. PAYMENT</span>
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-1 text-[#666] hover:text-[#1A1A1A]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cameraError ? (
                <div className="p-3 border border-red-300 bg-red-50 text-red-800 text-xs font-mono">
                  {cameraError}
                </div>
              ) : (
                <div className="relative aspect-video bg-black rounded overflow-hidden flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  <div className="absolute inset-8 border-2 border-dashed border-[#3BA4E8] pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] font-mono bg-black/60 text-white px-2 py-0.5">
                      Arahkan kamera ke Barcode / QR
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-1.5 border border-[#1A1A1A] text-xs font-mono font-semibold hover:bg-[#F5F5F5]"
                >
                  Tutup Pemindai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KARTU PREVIEW KODE ARSIP OTOMATIS (SIG) */}
        <div className="border border-[#D9D4C7] bg-[#FDFCF7] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-[#1A1A1A] tracking-wider uppercase">
                SUSUNAN KODE ARSIP OTOMATIS (STANDAR SIG)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 border border-[#16A34A] bg-[#F0FDF4] text-[#166534]">
                TIDAK BISA DIUBAH MANUAL
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#555] font-mono">
              <Building2 className="w-3.5 h-3.5" />
              <span>Unit: <strong>{unitInfo.nama}</strong> ({kodePerusahaan})</span>
            </div>
          </div>

          {/* Kotak Kode Arsip Monospace Besar */}
          <div className="p-3.5 bg-white border border-[#C5BFB0] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-[#777] mb-0.5">
                KODE ARSIP LENGKAP (PREVIEW HASIL GENERATE):
              </div>
              <div className="font-mono font-bold text-base sm:text-lg text-[#1A1A1A] tracking-wider">
                {isNonPayment ? (
                  nomorDokumenNonPayment ? (
                    <span className="text-[#1A1A1A]">{nomorDokumenNonPayment}</span>
                  ) : (
                    <span className="text-[#999] italic">[Nomor Dokumen Kontrak/Sertifikat]</span>
                  )
                ) : (
                  <>
                    <span className="text-[#0369A1]">{tahunDokumen}</span>
                    <span className="text-[#777]">_</span>
                    <span className="text-[#15803D]">{kodePerusahaan}</span>
                    <span className="text-[#777]">_</span>
                    <span className={nomorPpl.trim() ? 'text-[#B45309]' : 'text-[#DC2626] font-bold'}>
                      {displayPayment}
                    </span>
                    <span className="text-[#777]">_</span>
                    <span className="text-[#6D28D9]">{nextDocVoucher}</span>
                  </>
                )}
              </div>
            </div>

            <div className="hidden sm:block text-right">
              <span className="text-[10px] font-mono text-[#666] block">Format Pola SIG:</span>
              <span className="text-[10px] font-mono font-semibold text-[#1A1A1A]">
                TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
              </span>
            </div>
          </div>

          {/* Breakdown Komponen Token */}
          {!isNonPayment && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
              <div className="border border-[#E2E8F0] bg-white p-2">
                <span className="text-[#64748B] block text-[10px]">1. Tahun Dokumen</span>
                <span className="font-bold text-[#0369A1]">{tahunDokumen}</span>
                <span className="text-[9px] text-[#94A3B8] block">(dari Tanggal Dokumen)</span>
              </div>
              <div className="border border-[#E2E8F0] bg-white p-2">
                <span className="text-[#64748B] block text-[10px]">2. Kode Perusahaan</span>
                <span className="font-bold text-[#15803D]">{kodePerusahaan}</span>
                <span className="text-[9px] text-[#94A3B8] block">(Master: {unitInfo.nama})</span>
              </div>
              <div className="border border-[#E2E8F0] bg-white p-2">
                <span className="text-[#64748B] block text-[10px]">3. No. Payment (PPL)</span>
                <span className="font-bold text-[#B45309] truncate block">
                  {nomorPpl.trim() || '(Wajib diisi)'}
                </span>
                <span className="text-[9px] text-[#94A3B8] block">(Input PIC Aktif)</span>
              </div>
              <div className="border border-[#E2E8F0] bg-white p-2">
                <span className="text-[#64748B] block text-[10px]">4. Doc Voucher</span>
                <span className="font-bold text-[#6D28D9]">{nextDocVoucher}</span>
                <span className="text-[9px] text-[#94A3B8] block">(Otomatis Sistem)</span>
              </div>
            </div>
          )}
        </div>

        {/* FORMULIR PENDAFTARAN DOKUMEN */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#D9D4C7] p-6 sm:p-7 space-y-6 shadow-xs font-mono text-xs"
        >
          <div className="border-b border-[#E5E5E5] pb-3">
            <h1 className="text-base font-bold text-[#1A1A1A] tracking-tight">
              FORMULIR PENDAFTARAN DOKUMEN ARSIP AKTIF
            </h1>
            <p className="text-[11px] text-[#666] mt-1 font-sans">
              Dokumen akan otomatis diverifikasi polanya, diterbitkan Doc Voucher oleh sistem, dan diajukan ke antrean persetujuan Atasan Arsip Aktif unit {unitInfo.nama}.
            </p>
          </div>

          <div className="space-y-4">
            {/* Opsi Dokumen Non-Payment Toggle */}
            <div className="flex items-center justify-between border border-[#E5E5E5] bg-[#FAFAFA] p-3">
              <div>
                <span className="font-bold text-[#1A1A1A]">Jenis Penomoran Dokumen:</span>
                <p className="text-[10px] text-[#666] font-sans">
                  Pilih apakah dokumen memiliki nomor pembayaran SIG (PPL) atau dokumen khusus (kontrak/sertifikat).
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNonPayment}
                  onChange={(e) => setIsNonPayment(e.target.checked)}
                  className="rounded border-[#C5BFB0] text-[#9A3412] focus:ring-[#9A3412]"
                />
                <span className="text-[11px] font-semibold text-[#1A1A1A]">Dokumen Non-Payment (Kontrak/Sertifikat)</span>
              </label>
            </div>

            {/* FIELD UTAMA: NOMOR PAYMENT / PPL (1 Field untuk SIG) */}
            {!isNonPayment ? (
              <div className="space-y-1.5 border-l-2 border-[#9A3412] pl-3 py-1">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-[#1A1A1A]">
                    NOMOR PAYMENT / PPL (10 DIGIT) <span className="text-red-600">*</span>
                  </label>
                  <span className="text-[10px] text-[#666] font-sans">
                    Bisa diketik manual, discan kamera, atau voice typing
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={nomorPpl}
                      onChange={(e) => setNomorPpl(e.target.value)}
                      placeholder="Contoh: 1500013765"
                      maxLength={15}
                      required={!isNonPayment}
                      className="w-full border border-[#C5BFB0] px-3 py-2 text-xs font-mono font-bold tracking-wider text-[#1A1A1A] focus:outline-none focus:border-[#9A3412]"
                    />
                    {nomorPpl && (
                      <button
                        type="button"
                        onClick={() => setNomorPpl('')}
                        className="absolute right-2.5 top-2 text-[#999] hover:text-[#333]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Tombol Scan Barcode / QR */}
                  <button
                    type="button"
                    onClick={startCamera}
                    title="Scan Barcode / QR dari Kamera"
                    className="flex items-center gap-1.5 border border-[#1A1A1A] bg-[#F5F5F5] hover:bg-[#EAEAEA] px-3 py-2 text-xs font-semibold text-[#1A1A1A] transition-colors"
                  >
                    <Scan className="w-4 h-4 text-[#9A3412]" />
                    <span className="hidden sm:inline">Scan QR</span>
                  </button>

                  {/* Tombol Voice Typing */}
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={toggleVoiceTyping}
                      title="Ketik dengan Suara (Voice Typing)"
                      className={`flex items-center gap-1.5 border px-3 py-2 text-xs font-semibold transition-colors ${
                        isListening
                          ? 'border-red-600 bg-red-50 text-red-700 animate-pulse'
                          : 'border-[#1A1A1A] bg-[#F5F5F5] hover:bg-[#EAEAEA] text-[#1A1A1A]'
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4 text-red-600" /> : <Mic className="w-4 h-4 text-[#9A3412]" />}
                      <span className="hidden sm:inline">{isListening ? 'Mendengarkan...' : 'Voice'}</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[#666] font-sans">
                  Sesuai Blueprint 3.2 poin 2: input satu field nomor payment saja; tahun, kode perusahaan, dan doc voucher disusun otomatis oleh sistem.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 border-l-2 border-[#0284C7] pl-3 py-1">
                <label className="block font-bold text-[#1A1A1A]">
                  NOMOR DOKUMEN / KONTRAK / SERTIFIKAT <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={nomorDokumenNonPayment}
                  onChange={(e) => setNomorDokumenNonPayment(e.target.value)}
                  placeholder="Contoh: KTR/2026/001 atau NO-SERT-889"
                  required={isNonPayment}
                  className="w-full border border-[#C5BFB0] px-3 py-2 text-xs font-mono font-bold tracking-wider text-[#1A1A1A] focus:outline-none focus:border-[#0284C7]"
                />
                <p className="text-[10px] text-[#666] font-sans">
                  Sesuai Blueprint 3.2 poin 5: Untuk dokumen tanpa payment/doc voucher, nomor dokumen dicatat langsung sebagai kode arsip.
                </p>
              </div>
            )}

            {/* FIELD WAJIB M3: JUMLAH HALAMAN (LEMBAR FISIK) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 border-l-2 border-[#15803D] pl-3 py-1">
                <label className="block font-bold text-[#1A1A1A]">
                  JUMLAH HALAMAN FISIK (LEMBAR) <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={jumlahHalaman}
                    onChange={(e) => setJumlahHalaman(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    required
                    placeholder="Contoh: 15"
                    className="w-full border border-[#C5BFB0] px-3 py-2 text-xs font-mono font-bold text-[#1A1A1A] focus:outline-none focus:border-[#15803D]"
                  />
                  <span className="text-xs font-mono text-[#555] shrink-0">lembar</span>
                </div>
                <p className="text-[10px] text-[#666] font-sans">
                  Wajib diisi (Blueprint 3.5 & 4.4): untuk alokasi otomatis kapasitas boks (maks. 500 lembar per boks).
                </p>
              </div>

              {/* TANGGAL DOKUMEN */}
              <div className="space-y-1.5 border-l-2 border-[#0369A1] pl-3 py-1">
                <label className="block font-bold text-[#1A1A1A]">
                  TANGGAL DOKUMEN <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={tanggalDokumen}
                    onChange={(e) => setTanggalDokumen(e.target.value)}
                    required
                    className="w-full border border-[#C5BFB0] px-3 py-2 text-xs font-mono font-bold text-[#1A1A1A] focus:outline-none focus:border-[#0369A1]"
                  />
                </div>
                <p className="text-[10px] text-[#666] font-sans">
                  Tahun ({tahunDokumen}) diambil otomatis sebagai segmen pertama kode arsip SIG.
                </p>
              </div>
            </div>

            {/* KATEGORI MASTER & JUDUL DOKUMEN */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="block font-bold text-[#1A1A1A]">
                  KATEGORI MASTER <span className="text-red-600">*</span>
                </label>
                <select
                  value={kategoriId}
                  onChange={(e) => setKategoriId(e.target.value)}
                  required
                  className="w-full border border-[#C5BFB0] bg-white px-3 py-2 text-xs font-mono font-semibold text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  {kategoriList.map((kat) => (
                    <option key={kat.id} value={kat.id}>
                      {kat.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block font-bold text-[#1A1A1A]">
                  JUDUL DOKUMEN ARSIP <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Contoh: Pembayaran Jasa Pengangkutan Semen Q1 2026"
                  required
                  className="w-full border border-[#C5BFB0] px-3 py-2 text-xs font-mono text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
            </div>

            {/* PENANDATANGAN & LOKASI AWAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="block font-bold text-[#1A1A1A]">
                  PENANDATANGAN DOKUMEN
                </label>
                <input
                  type="text"
                  value={penandatangan}
                  onChange={(e) => setPenandatangan(e.target.value)}
                  placeholder="Nama penandatangan dokumen (opsional)"
                  className="w-full border border-[#C5BFB0] px-3 py-2 text-xs font-mono text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-[#1A1A1A]">
                  LOKASI FISIK AWAL
                </label>
                <input
                  type="text"
                  value={lokasiFisik}
                  onChange={(e) => setLokasiFisik(e.target.value)}
                  placeholder="Ruang Arsip Aktif"
                  className="w-full border border-[#C5BFB0] px-3 py-2 text-xs font-mono text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
            </div>

            {/* DESKRIPSI / CATATAN */}
            <div className="space-y-1.5 pt-1">
              <label className="block font-bold text-[#1A1A1A]">
                DESKRIPSI / CATATAN TAMBAHAN
              </label>
              <textarea
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                rows={2}
                placeholder="Catatan ringkas mengenai isi dokumen arsip..."
                className="w-full border border-[#C5BFB0] px-3 py-2 text-xs font-mono text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>

            {/* UNGGAH BERKAS UTAMA (PDF) */}
            <div className="space-y-2 pt-2 border-t border-[#E5E5E5]">
              <label className="block font-bold text-[#1A1A1A]">
                BERKAS UTAMA DOKUMEN (PDF) <span className="text-red-600">*</span>
              </label>
              <div className="border-2 border-dashed border-[#C5BFB0] hover:border-[#1A1A1A] p-4 text-center bg-[#FAFAF8] transition-colors">
                <input
                  type="file"
                  id="main-file"
                  accept=".pdf,application/pdf"
                  onChange={handleMainFileChange}
                  className="hidden"
                />
                <label htmlFor="main-file" className="cursor-pointer block">
                  <FileText className="w-8 h-8 text-[#9A3412] mx-auto mb-2" />
                  {selectedFile ? (
                    <div className="text-xs font-mono">
                      <span className="font-bold text-[#1A1A1A]">{selectedFile.name}</span>
                      <span className="text-[#666] block">
                        ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB) — Klik untuk mengganti berkas
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-[#666]">
                      <span className="font-bold text-[#1A1A1A] underline">Pilih Berkas PDF</span> atau seret file ke area ini
                      <span className="text-[10px] text-[#999] block mt-0.5">Format file dokumen utama wajib PDF</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* UNGGAH LAMPIRAN TAMBAHAN */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-[#1A1A1A]">
                  BERKAS LAMPIRAN TAMBAHAN (OPSIONAL)
                </label>
                <span className="text-[10px] text-[#666]">
                  Maksimal total 25 MB (PDF, XLSX, DOCX, JPG, PNG)
                </span>
              </div>

              <div className="border border-[#D9D4C7] bg-[#FAFAF8] p-3 space-y-2">
                <input
                  type="file"
                  id="lampiran-file"
                  multiple
                  accept=".pdf,.xlsx,.docx,.jpg,.jpeg,.png"
                  onChange={handleLampiranChange}
                  className="hidden"
                />
                <label
                  htmlFor="lampiran-file"
                  className="inline-flex items-center gap-1.5 border border-[#1A1A1A] bg-white px-3 py-1.5 text-xs font-mono font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5] cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Tambah Berkas Lampiran</span>
                </label>

                {lampiranFiles.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {lampiranFiles.map((lamp, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs font-mono"
                      >
                        <span className="truncate max-w-sm text-[#1A1A1A]">{lamp.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-[#777]">
                            {(lamp.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLampiran(idx)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="border-t border-[#E5E5E5] pt-5 flex items-center justify-between">
            <Link
              href="/dokumen"
              className="px-4 py-2 border border-[#C5BFB0] text-xs font-mono font-semibold text-[#555] hover:bg-[#F5F5F5]"
            >
              Batal
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 border-2 border-[#1A1A1A] bg-[#1A1A1A] text-white hover:bg-[#333] px-6 py-2.5 text-xs font-mono font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>MEMPROSES PENDAFTARAN...</span>
                </>
              ) : (
                <span>DAFTARKAN DOKUMEN ARSIP</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
