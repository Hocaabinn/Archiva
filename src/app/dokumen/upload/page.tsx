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
  Scan,
  X,
  Camera,
  Building2,
  Sparkles,
  UploadCloud,
  FileUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KategoriDokumen, UserRole } from '@/types'
import { validateKodeArsipSIG } from '@/lib/kode-arsip'
import { LokasiCascadeSelect, LokasiCascadeValue } from '@/components/documents/lokasi-cascade-select'

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
  const [selectedLokasi, setSelectedLokasi] = useState<LokasiCascadeValue | null>(null)

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
          setCurrentUserRole(infoData.userRole)
          if (infoData.unit) {
            setUnitInfo(infoData.unit)
          }
          if (infoData.nextDocVoucher) {
            setNextDocVoucher(infoData.nextDocVoucher)
          }
        }

        if (katsRes.data && katsRes.data.length > 0) {
          setKategoriList(katsRes.data as KategoriDokumen[])
          setKategoriId(katsRes.data[0].id)
        }
      } catch (err) {
        console.error('Gagal inisialisasi form upload:', err)
        setErrorMsg('Gagal memuat parameter entri dokumen dari server.')
      } finally {
        setLoadingInitial(false)
      }
    }

    init()
  }, [router])

  // Voice Typing Handler (Web Speech API)
  const toggleVoiceTyping = () => {
    if (!voiceSupported) return

    if (isListening) {
      setIsListening(false)
      return
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = 'id-ID'
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        // Bersihkan spasi dan ambil angka saja untuk nomor payment
        const cleanedDigits = transcript.replace(/\D/g, '')
        if (cleanedDigits) {
          setNomorPpl(cleanedDigits)
        } else {
          setNomorPpl(transcript.trim())
        }
        setIsListening(false)
      }

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } catch (err) {
      console.error('Voice typing error:', err)
      setIsListening(false)
    }
  }

  // Camera Scanner Handler (MediaDevices getUserMedia)
  const startCamera = async () => {
    setIsScanning(true)
    setCameraError(null)

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung oleh browser ini.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err: unknown) {
      console.error('Camera error:', err)
      const msg = err instanceof Error ? err.message : 'Gagal mengakses kamera perangkat.'
      setCameraError(msg)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
    setCameraError(null)
  }

  // Helper pembuat deskripsi/catatan otomatis berdasarkan metadata berkas & form
  const generateAutoDeskripsi = (file: File | null, currJudul: string, currKatId: string, currPpl: string) => {
    const parts: string[] = []
    const katName = kategoriList.find((k) => k.id === currKatId)?.nama || ''

    if (file) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
      parts.push(`Berkas: ${file.name}`)
    }

    if (katName) {
      parts.push(`Kategori: ${katName}`)
    }

    if (currPpl) {
      parts.push(`No. Payment/PPL: ${currPpl}`)
    }

    if (currJudul) {
      parts.push(`Perihal: ${currJudul}`)
    }

    return parts.length > 0 ? parts.join(' | ') : ''
  }

  // File Upload Handlers
  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type !== 'application/pdf') {
        setErrorMsg('Berkas dokumen utama harus berformat PDF.')
        return
      }
      if (file.size > 25 * 1024 * 1024) {
        setErrorMsg('Ukuran berkas utama melebihi batas maksimal 25 MB.')
        return
      }
      setSelectedFile(file)
      setErrorMsg(null)

      // Otomatis isi judul jika masih kosong dari nama berkas yang bersih
      if (!judul.trim()) {
        const cleanTitle = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[_-]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
        setJudul(cleanTitle)
      }

      // Otomatis buatkan deskripsi jika belum diisi manual
      if (!deskripsi.trim()) {
        const autoText = generateAutoDeskripsi(file, judul, kategoriId, nomorPpl)
        setDeskripsi(autoText)
      }
    }
  }

  const handleLampiranChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
      ]
      const newFiles: File[] = []
      let totalSize = lampiranFiles.reduce((acc, f) => acc + f.size, 0)

      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i]
        if (!allowedTypes.includes(file.type)) {
          setErrorMsg(`Format berkas "${file.name}" tidak didukung. Lampiran harus PDF, XLSX, DOCX, JPG, atau PNG.`)
          return
        }
        totalSize += file.size
        if (totalSize > 25 * 1024 * 1024) {
          setErrorMsg('Total seluruh berkas lampiran tidak boleh melebihi batas sistem 25 MB.')
          return
        }
        newFiles.push(file)
      }

      setLampiranFiles((prev) => [...prev, ...newFiles])
      setErrorMsg(null)
    }
  }

  const removeLampiran = (index: number) => {
    setLampiranFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validasi Form Wajib
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
    if (!selectedLokasi || !selectedLokasi.rakId) {
      setErrorMsg('Lokasi fisik wajib dipilih lengkap dari Master Lokasi bertingkat (Gedung > Ruangan > Rak).')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // Jika pengguna tidak mengisi deskripsi secara manual, buatkan otomatis dari berkas dan form saat didaftarkan
      const finalDeskripsi = deskripsi.trim() || generateAutoDeskripsi(selectedFile, judul, kategoriId, nomorPpl) || 'Dokumen arsip resmi instansi PT Semen Indonesia Group (SIG).'

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

      formData.append('deskripsi', finalDeskripsi)
      if (selectedLokasi?.rakId) {
        formData.append('rak_id', selectedLokasi.rakId)
        formData.append('lokasi_saat_ini', selectedLokasi.lokasiString)
      }

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
          <div className="flex items-center gap-3 text-sm text-[#0284C7] bg-[#F0F9FF] border border-[#BAE6FD] px-5 py-3 rounded-xl shadow-xs">
            <Loader2 className="w-5 h-5 animate-spin text-[#0284C7]" />
            <span className="font-mono text-xs font-semibold tracking-wide">Menyiapkan formulir entri arsip...</span>
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
          <div className="border border-[#FCA5A5] bg-[#FEF2F2] rounded-xl p-6 text-[#991B1B] text-xs font-mono shadow-sm">
            <div className="flex items-center gap-2 mb-2 font-bold text-sm text-[#991B1B]">
              <AlertCircle className="w-4 h-4 text-[#DC2626]" />
              <span>AKSES DITOLAK (403 FORBIDDEN)</span>
            </div>
            <p className="leading-relaxed text-[#7F1D1D]">
              Sesuai aturan Blueprint Bab 5 dan R.03: <strong>HANYA PIC Arsip Aktif (pic_aktif)</strong> yang berhak mengentri dokumen baru.
              Akun Anda memiliki peran: <span className="bg-[#FEE2E2] px-1.5 py-0.5 rounded font-bold uppercase">{currentUserRole}</span>.
            </p>
            <div className="mt-4">
              <Link
                href="/dokumen"
                className="inline-flex items-center gap-2 border border-[#CBD7E3] bg-white px-3.5 py-2 rounded-lg text-xs font-semibold text-[#0369A1] hover:bg-[#F0F9FF] transition-colors"
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
        <div className="flex items-center justify-between border-b border-[#BAE6FD]/80 pb-3.5">
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#0284C7] hover:text-[#0369A1] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#E0F2FE]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold tracking-wide">KEMBALI KE KATALOG DOKUMEN</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-3 py-1 border border-[#BAE6FD] bg-[#F0F9FF] text-[#0284C7] font-semibold tracking-wider rounded-full shadow-2xs">
              STATUS AWAL: MENUNGGU PERSETUJUAN
            </span>
          </div>
        </div>

        {/* Notifikasi Alert Error */}
        {errorMsg && (
          <div className="p-4 border border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B] text-xs font-mono rounded-xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
            <div>
              <p className="font-bold tracking-wide">GAGAL MENDAFTARKAN DOKUMEN</p>
              <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Notifikasi Alert Sukses */}
        {successMsg && (
          <div className="p-4 border border-[#86EFAC] bg-[#F0FDF4] text-[#166534] text-xs font-mono rounded-xl flex items-start gap-3 shadow-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
            <div>
              <p className="font-bold tracking-wide">PENGAJUAN DOKUMEN BERHASIL</p>
              <p className="mt-0.5 leading-relaxed">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Modal Scanner Kamera */}
        {isScanning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white border border-[#BAE6FD] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#E0F2FE] pb-3">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#0369A1]">
                  <Camera className="w-4 h-4 text-[#0284C7]" />
                  <span>PEMINDAI BARCODE / QR NO. PAYMENT</span>
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cameraError ? (
                <div className="p-3 border border-red-200 bg-red-50 text-red-800 text-xs font-mono rounded-lg">
                  {cameraError}
                </div>
              ) : (
                <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  <div className="absolute inset-8 border-2 border-dashed border-[#38BDF8] pointer-events-none flex items-center justify-center rounded-lg">
                    <span className="text-[10px] font-mono bg-black/70 text-white px-2.5 py-1 rounded">
                      Arahkan kamera ke Barcode / QR
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 border border-[#CBD7E3] rounded-lg text-xs font-mono font-semibold text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                >
                  Tutup Pemindai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KARTU PREVIEW KODE ARSIP OTOMATIS (SIG) - BIRU LANGIT & PUTIH */}
        <div className="border border-[#BAE6FD] bg-linear-to-b from-[#F0F9FF] to-[#E0F2FE]/50 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#BAE6FD] pb-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[#0284C7] text-white">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="font-mono text-xs font-bold text-[#0369A1] tracking-wider uppercase">
                SUSUNAN KODE ARSIP OTOMATIS (STANDAR SIG)
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 border border-[#86EFAC] bg-[#F0FDF4] text-[#15803D] font-bold rounded-full">
                SISTEM SIG
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#0369A1] font-mono bg-white/80 border border-[#BAE6FD] px-3 py-1 rounded-lg">
              <Building2 className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>Unit: <strong className="text-[#0369A1]">{unitInfo.nama}</strong> ({kodePerusahaan})</span>
            </div>
          </div>

          {/* Kotak Kode Arsip Monospace Besar */}
          <div className="p-4 bg-white border border-[#BAE6FD] rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] mb-1">
                KODE ARSIP LENGKAP (PREVIEW HASIL GENERATE):
              </div>
              <div className="font-mono font-bold text-base sm:text-xl text-[#0F172A] tracking-wider">
                {isNonPayment ? (
                  nomorDokumenNonPayment ? (
                    <span className="text-[#0284C7]">{nomorDokumenNonPayment}</span>
                  ) : (
                    <span className="text-[#94A3B8] italic font-normal">[Nomor Dokumen Kontrak/Sertifikat]</span>
                  )
                ) : (
                  <>
                    <span className="text-[#0284C7]">{tahunDokumen}</span>
                    <span className="text-[#94A3B8]">_</span>
                    <span className="text-[#0369A1]">{kodePerusahaan}</span>
                    <span className="text-[#94A3B8]">_</span>
                    <span className={nomorPpl.trim() ? 'text-[#0284C7] underline decoration-[#38BDF8] decoration-2' : 'text-[#E11D48] font-bold'}>
                      {displayPayment}
                    </span>
                    <span className="text-[#94A3B8]">_</span>
                    <span className="text-[#0369A1]">{nextDocVoucher}</span>
                  </>
                )}
              </div>
            </div>

            <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-[#F1F5F9]">
              <span className="text-[10px] font-mono text-[#64748B] block">Format Pola SIG:</span>
              <span className="text-[11px] font-mono font-semibold text-[#0369A1] bg-[#F0F9FF] border border-[#BAE6FD] px-2 py-0.5 rounded">
                TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
              </span>
            </div>
          </div>

          {/* Breakdown Komponen Token */}
          {!isNonPayment && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-[11px] font-mono">
              <div className="border border-[#BAE6FD] bg-white rounded-lg p-2.5 shadow-2xs">
                <span className="text-[#64748B] block text-[10px]">1. Tahun Dokumen</span>
                <span className="font-bold text-[#0284C7] text-xs">{tahunDokumen}</span>
                <span className="text-[9px] text-[#94A3B8] block mt-0.5">(dari Tanggal Dokumen)</span>
              </div>
              <div className="border border-[#BAE6FD] bg-white rounded-lg p-2.5 shadow-2xs">
                <span className="text-[#64748B] block text-[10px]">2. Kode Perusahaan</span>
                <span className="font-bold text-[#0369A1] text-xs">{kodePerusahaan}</span>
                <span className="text-[9px] text-[#94A3B8] block mt-0.5">(Master: {unitInfo.nama})</span>
              </div>
              <div className="border border-[#BAE6FD] bg-white rounded-lg p-2.5 shadow-2xs">
                <span className="text-[#64748B] block text-[10px]">3. No. Payment (PPL)</span>
                <span className="font-bold text-[#0284C7] text-xs truncate block">
                  {nomorPpl.trim() || '(Wajib diisi)'}
                </span>
                <span className="text-[9px] text-[#94A3B8] block mt-0.5">(Input PIC Aktif)</span>
              </div>
              <div className="border border-[#BAE6FD] bg-white rounded-lg p-2.5 shadow-2xs">
                <span className="text-[#64748B] block text-[10px]">4. Doc Voucher</span>
                <span className="font-bold text-[#0369A1] text-xs">{nextDocVoucher}</span>
                <span className="text-[9px] text-[#94A3B8] block mt-0.5">(Otomatis Sistem)</span>
              </div>
            </div>
          )}
        </div>

        {/* FORMULIR PENDAFTARAN DOKUMEN - BERSIH PUTIH & BIRU LANGIT */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#BAE6FD] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs font-mono text-xs"
        >
          <div className="border-b border-[#E0F2FE] pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#E0F2FE] text-[#0284C7]">
                <FileUp className="w-4 h-4" />
              </span>
              <h1 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">
                FORMULIR PENDAFTARAN DOKUMEN ARSIP AKTIF
              </h1>
            </div>
            <p className="text-[11px] text-[#64748B] font-sans leading-relaxed">
              Dokumen akan otomatis diverifikasi polanya, diterbitkan Doc Voucher oleh sistem, dan diajukan ke antrean persetujuan Atasan Arsip Aktif unit <strong className="text-[#0369A1]">{unitInfo.nama}</strong>.
            </p>
          </div>

          <div className="space-y-5">
            {/* Opsi Dokumen Non-Payment Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-[#BAE6FD] bg-[#F0F9FF]/70 rounded-xl p-3.5">
              <div>
                <span className="font-bold text-[#0F172A]">Jenis Penomoran Dokumen:</span>
                <p className="text-[10px] text-[#64748B] font-sans">
                  Pilih apakah dokumen memiliki nomor pembayaran SIG (PPL) atau dokumen khusus (kontrak/sertifikat).
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 border border-[#BAE6FD] rounded-lg shadow-2xs hover:bg-[#F8FAFC] transition-colors">
                <input
                  type="checkbox"
                  checked={isNonPayment}
                  onChange={(e) => setIsNonPayment(e.target.checked)}
                  className="rounded border-[#CBD7E3] text-[#0284C7] focus:ring-[#0284C7]"
                />
                <span className="text-[11px] font-semibold text-[#0369A1]">Dokumen Non-Payment (Kontrak/Sertifikat)</span>
              </label>
            </div>

            {/* FIELD UTAMA: NOMOR PAYMENT / PPL (1 Field untuk SIG) */}
            {!isNonPayment ? (
              <div className="space-y-2 border-l-3 border-[#0284C7] pl-3.5 py-1 bg-[#F8FBFE] rounded-r-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block font-bold text-[#0F172A]">
                    NOMOR PAYMENT / PPL (10 DIGIT) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-[#64748B] font-sans">
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
                      className="w-full h-10 border border-[#BAE6FD] bg-white rounded-lg px-3 text-xs font-mono font-bold tracking-wider text-[#0F172A] focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] transition-all"
                    />
                    {nomorPpl && (
                      <button
                        type="button"
                        onClick={() => setNomorPpl('')}
                        className="absolute right-2.5 top-2.5 text-[#94A3B8] hover:text-[#334155]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Tombol Scan Barcode / QR */}
                  <button
                    type="button"
                    onClick={startCamera}
                    title="Scan Barcode / QR dari Kamera"
                    className="flex items-center gap-1.5 border border-[#BAE6FD] bg-white hover:bg-[#F0F9FF] px-3.5 h-10 rounded-lg text-xs font-semibold text-[#0369A1] transition-colors shadow-2xs"
                  >
                    <Scan className="w-4 h-4 text-[#0284C7]" />
                    <span className="hidden sm:inline">Scan QR</span>
                  </button>

                  {/* Tombol Voice Typing */}
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={toggleVoiceTyping}
                      title="Ketik dengan Suara (Voice Typing)"
                      className={`flex items-center gap-1.5 border h-10 px-3.5 rounded-lg text-xs font-semibold transition-colors shadow-2xs ${
                        isListening
                          ? 'border-red-400 bg-red-50 text-red-700 animate-pulse'
                          : 'border-[#BAE6FD] bg-white hover:bg-[#F0F9FF] text-[#0369A1]'
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4 text-red-600" /> : <Mic className="w-4 h-4 text-[#0284C7]" />}
                      <span className="hidden sm:inline">{isListening ? 'Mendengarkan...' : 'Voice'}</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[#64748B] font-sans">
                  Sesuai Blueprint 3.2 poin 2: input satu field nomor payment saja; tahun, kode perusahaan, dan doc voucher disusun otomatis oleh sistem.
                </p>
              </div>
            ) : (
              <div className="space-y-2 border-l-3 border-[#0284C7] pl-3.5 py-1 bg-[#F8FBFE] rounded-r-xl">
                <label className="block font-bold text-[#0F172A]">
                  NOMOR DOKUMEN / KONTRAK / SERTIFIKAT <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nomorDokumenNonPayment}
                  onChange={(e) => setNomorDokumenNonPayment(e.target.value)}
                  placeholder="Contoh: KTR/2026/001 atau NO-SERT-889"
                  required={isNonPayment}
                  className="w-full h-10 border border-[#BAE6FD] bg-white rounded-lg px-3 text-xs font-mono font-bold tracking-wider text-[#0F172A] focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] transition-all"
                />
                <p className="text-[10px] text-[#64748B] font-sans">
                  Sesuai Blueprint 3.2 poin 5: Untuk dokumen tanpa payment/doc voucher, nomor dokumen dicatat langsung sebagai kode arsip.
                </p>
              </div>
            )}

            {/* FIELD WAJIB M3: JUMLAH HALAMAN (LEMBAR FISIK) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 border-l-3 border-[#38BDF8] pl-3.5 py-1 bg-[#F8FBFE] rounded-r-xl">
                <label className="block font-bold text-[#0F172A]">
                  JUMLAH HALAMAN FISIK (LEMBAR) <span className="text-red-500">*</span>
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
                    className="w-full h-10 border border-[#BAE6FD] bg-white rounded-lg px-3 text-xs font-mono font-bold text-[#0F172A] focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] transition-all"
                  />
                  <span className="text-xs font-mono text-[#64748B] shrink-0 font-medium">lembar</span>
                </div>
                <p className="text-[10px] text-[#64748B] font-sans">
                  Wajib diisi (Blueprint 3.5 & 4.4): untuk alokasi otomatis kapasitas boks (maks. 500 lembar per boks).
                </p>
              </div>

              {/* TANGGAL DOKUMEN */}
              <div className="space-y-2 border-l-3 border-[#0369A1] pl-3.5 py-1 bg-[#F8FBFE] rounded-r-xl">
                <label className="block font-bold text-[#0F172A]">
                  TANGGAL DOKUMEN <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={tanggalDokumen}
                    onChange={(e) => setTanggalDokumen(e.target.value)}
                    required
                    className="w-full h-10 border border-[#BAE6FD] bg-white rounded-lg px-3 text-xs font-mono font-bold text-[#0F172A] focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] transition-all"
                  />
                </div>
                <p className="text-[10px] text-[#64748B] font-sans">
                  Tahun ({tahunDokumen}) diambil otomatis sebagai segmen pertama kode arsip SIG.
                </p>
              </div>
            </div>

            {/* KATEGORI MASTER & JUDUL DOKUMEN */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="space-y-2">
                <label className="block font-bold text-[#0F172A]">
                  KATEGORI MASTER <span className="text-red-500">*</span>
                </label>
                <select
                  value={kategoriId}
                  onChange={(e) => setKategoriId(e.target.value)}
                  required
                  className="w-full h-10 border border-[#BAE6FD] bg-white rounded-lg px-3 text-xs font-mono font-semibold text-[#0F172A] focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] transition-all"
                >
                  {kategoriList.map((kat) => (
                    <option key={kat.id} value={kat.id}>
                      {kat.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="block font-bold text-[#0F172A]">
                  JUDUL DOKUMEN ARSIP <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Contoh: Pembayaran Jasa Pengangkutan Semen Q1 2026"
                  required
                  className="w-full h-10 border border-[#BAE6FD] bg-white rounded-lg px-3 text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] transition-all"
                />
              </div>
            </div>

            {/* LOKASI AWAL DARI MASTER */}
            <div className="space-y-4 pt-1">
              {/* LOKASI BERTINGKAT DARI MASTER LOKASI (BLUEPRINT 3.5 & M5) */}
              <div className="space-y-2 border-l-3 border-[#0284C7] pl-3.5 py-2.5 bg-[#F0F9FF]/60 rounded-r-xl border-y border-r border-[#BAE6FD]">
                <LokasiCascadeSelect
                  onChange={(val) => setSelectedLokasi(val)}
                  required
                  label="LOKASI PENYIMPANAN FISIK AWAL (MASTER LOKASI BERTINGKAT)"
                />
              </div>
            </div>

            {/* DESKRIPSI / CATATAN */}
            <div className="space-y-2 pt-1">
              <label className="block font-bold text-[#0F172A]">
                DESKRIPSI / CATATAN TAMBAHAN (OPSIONAL)
              </label>
              <textarea
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                rows={2}
                placeholder="Dibuat otomatis oleh sistem dari data berkas saat Anda klik Daftarkan Dokumen (atau Anda dapat mengetik catatan khusus sendiri di sini)..."
                className="w-full border border-[#BAE6FD] bg-white rounded-lg p-3 text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] transition-all"
              />
              <p className="text-[10px] text-[#64748B] font-sans">
                Bila dikosongkan, sistem akan otomatis mencatat nama berkas yang diunggah, kategori, nomor payment/kontrak, dan perihal dokumen ke dalam arsip.
              </p>
            </div>

            {/* UNGGAH BERKAS UTAMA (PDF) */}
            <div className="space-y-2 pt-2 border-t border-[#E0F2FE]">
              <label className="block font-bold text-[#0F172A]">
                BERKAS UTAMA DOKUMEN (PDF) <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-[#BAE6FD] hover:border-[#0284C7] rounded-xl p-5 text-center bg-[#F0F9FF]/40 hover:bg-[#F0F9FF] transition-all">
                <input
                  type="file"
                  id="main-file"
                  accept=".pdf,application/pdf"
                  onChange={handleMainFileChange}
                  className="hidden"
                />
                <label htmlFor="main-file" className="cursor-pointer block">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shadow-2xs">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  {selectedFile ? (
                    <div className="text-xs font-mono">
                      <span className="font-bold text-[#0369A1]">{selectedFile.name}</span>
                      <span className="text-[#64748B] block mt-0.5">
                        ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB) — Klik untuk mengganti berkas
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-[#64748B]">
                      <span className="font-bold text-[#0284C7] underline underline-offset-2">Pilih Berkas PDF</span> atau seret file ke area ini
                      <span className="text-[10px] text-[#94A3B8] block mt-1">Format file dokumen utama wajib PDF (Maks. 25 MB)</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* UNGGAH LAMPIRAN TAMBAHAN */}
            <div className="space-y-2 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="block font-bold text-[#0F172A]">
                  BERKAS LAMPIRAN TAMBAHAN (OPSIONAL)
                </label>
                <span className="text-[10px] text-[#64748B]">
                  Maksimal total 25 MB (PDF, XLSX, DOCX, JPG, PNG)
                </span>
              </div>

              <div className="border border-[#BAE6FD] bg-[#F8FBFE] rounded-xl p-3.5 space-y-2.5">
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
                  className="inline-flex items-center gap-1.5 border border-[#BAE6FD] bg-white px-3.5 py-2 rounded-lg text-xs font-mono font-semibold text-[#0369A1] hover:bg-[#F0F9FF] cursor-pointer shadow-2xs transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Tambah Berkas Lampiran</span>
                </label>

                {lampiranFiles.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {lampiranFiles.map((lamp, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between border border-[#BAE6FD] bg-white rounded-lg px-3 py-2 text-xs font-mono shadow-2xs"
                      >
                        <span className="truncate max-w-sm text-[#0F172A] font-medium">{lamp.name}</span>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                            {(lamp.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLampiran(idx)}
                            className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                            title="Hapus berkas lampiran"
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
          <div className="border-t border-[#E0F2FE] pt-5 flex items-center justify-between">
            <Link
              href="/dokumen"
              className="px-4 py-2.5 border border-[#CBD7E3] rounded-xl text-xs font-mono font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
            >
              Batal
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 border border-[#0284C7] bg-[#0284C7] text-white hover:bg-[#0369A1] px-6 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-colors disabled:opacity-50 shadow-sm shadow-[#0284C7]/20"
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
