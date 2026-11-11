'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KategoriDokumen, UserRole } from '@/types'
import { extractSigTokens, validateKodeArsipSIG } from '@/lib/server-dokumen'

export default function UploadDokumenPage() {
  const router = useRouter()
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null)
  const [kategoriList, setKategoriList] = useState<KategoriDokumen[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)

  // Field Form
  const [judul, setJudul] = useState('')
  const [kategoriId, setKategoriId] = useState('')
  const [penandatangan, setPenandatangan] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [lokasiFisik, setLokasiFisik] = useState('Ruang Arsip Aktif')

  // Token Kode Arsip SIG: TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
  const [tahun, setTahun] = useState(new Date().getFullYear().toString())
  const [kodePerusahaan, setKodePerusahaan] = useState('2000')
  const [nomorPpl, setNomorPpl] = useState('') // No. Payment / PPL (10 digit)
  const [docVoucher, setDocVoucher] = useState('') // Doc Voucher / No. Dokumen (10 digit)
  const [isNonPayment, setIsNonPayment] = useState(false)
  const [customKodeArsip, setCustomKodeArsip] = useState('')

  // Berkas
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [lampiranFiles, setLampiranFiles] = useState<File[]>([])

  // State Submisi
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Hitung kode arsip komposit
  const compositeKodeArsip = isNonPayment
    ? customKodeArsip.trim()
    : `${tahun || ''}_${kodePerusahaan || ''}_${nomorPpl || ''}_${docVoucher || ''}`

  const kodeValidation = validateKodeArsipSIG(compositeKodeArsip)

  // Load Kategori & Role Pengguna
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

        const [{ data: profile }, { data: kats }] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', user.id).single(),
          supabase.from('kategori_dokumen').select('*').eq('is_active', true).order('nama'),
        ])

        if (profile?.role) {
          setCurrentUserRole(profile.role as UserRole)
        }

        if (kats && kats.length > 0) {
          setKategoriList(kats)
          setKategoriId(kats[0].id)
        }
      } catch (err) {
        console.error('Error inisialisasi form upload:', err)
      } finally {
        setLoadingInitial(false)
      }
    }
    init()
  }, [router])

  // Handler Berkas Utama
  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      setErrorMsg(null)

      // Ekstraksi token SIG dari nama file otomatis
      const extracted = extractSigTokens(file.name)
      if (extracted.tahun) setTahun(extracted.tahun)
      if (extracted.kodePerusahaan) setKodePerusahaan(extracted.kodePerusahaan)
      if (extracted.noPayment) setNomorPpl(extracted.noPayment)
      if (extracted.docVoucher) setDocVoucher(extracted.docVoucher)
    }
  }

  // Handler Lampiran Tambahan
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

  // Submisi
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!judul.trim()) {
      setErrorMsg('Judul dokumen wajib diisi.')
      return
    }
    if (!kategoriId) {
      setErrorMsg('Pilih kategori dokumen master.')
      return
    }
    if (!selectedFile) {
      setErrorMsg('Berkas utama dokumen wajib diunggah.')
      return
    }

    if (!kodeValidation.isValid) {
      setErrorMsg(`Pola kode arsip belum valid: ${kodeValidation.message || 'Periksa kembali nilai token SIG.'}`)
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
      formData.append('kode_arsip', compositeKodeArsip)
      if (nomorPpl) formData.append('nomor_ppl', nomorPpl.trim())
      if (docVoucher) formData.append('nomor_dokumen', docVoucher.trim())
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
        throw new Error(data.error || 'Terjadi kesalahan saat memproses pendaftaran dokumen.')
      }

      setSuccessMsg(`Dokumen "${compositeKodeArsip}" berhasil didaftarkan. Mengalihkan ke lembar detail dokumen...`)
      setTimeout(() => {
        router.push(`/dokumen/${data.dokumen.id}`)
      }, 1200)
    } catch (err: unknown) {
      console.error('Error saat upload dokumen:', err)
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
          <div className="flex items-center gap-3 text-sm text-[#64748B]">
            <Loader2 className="w-5 h-5 animate-spin text-[#3BA4E8]" />
            <span>Memuat formulir pendaftaran arsip...</span>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Proteksi hak akses Pengaju (User)
  if (currentUserRole && currentUserRole !== 'user') {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto py-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 text-sm shadow-xs">
            <h2 className="font-bold text-base mb-1">Akses Pendaftaran Khusus Pengaju</h2>
            <p className="text-xs leading-relaxed text-amber-800">
              Sesuai aturan alur kerja kearsipan, hanya pengguna dengan peran <strong>Pengaju (User)</strong> yang berhak mengunggah berkas arsip baru. Peran Anda ({currentUserRole}) memiliki tugas verifikasi/persetujuan di menu terkait.
            </p>
            <div className="mt-4">
              <Link
                href="/dokumen"
                className="inline-flex items-center gap-2 rounded-lg bg-white border border-amber-300 px-3.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
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

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        {/* Navigasi Atas */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#64748B] hover:text-[#3BA4E8] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Katalog Dokumen</span>
          </Link>
          <span className="text-xs px-3 py-1 bg-[#F0F9FF] border border-[#BAE6FD] text-[#0284C7] font-semibold rounded-full">
            Formulir Pendaftaran Berkas Arsip
          </span>
        </div>

        {/* Notifikasi Sukses / Error */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="font-semibold text-sm">Gagal Mendaftarkan Dokumen</p>
              <p className="mt-0.5 leading-relaxed text-red-700">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3 shadow-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-semibold text-sm">Pengajuan Berhasil</p>
              <p className="mt-0.5 text-emerald-700">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Formulir Registrasi Arsip */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm"
        >
          {/* Header Formulir */}
          <div className="border-b border-[#E2E8F0] pb-5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs px-2.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] font-semibold rounded-md">
                SEMEN INDONESIA GROUP
              </span>
              <span className="text-xs text-[#64748B]">
                Standar Kearsipan Elektronik R.02
              </span>
            </div>
            <h1 className="text-2xl font-sans font-bold text-[#1F2333] mt-1">
              Pengajuan Dokumen Arsip Baru
            </h1>
            <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
              Dokumen yang didaftarkan akan berstatus{' '}
              <strong className="text-amber-700 font-semibold">Menunggu Persetujuan</strong> dan diverifikasi
              oleh PIC Arsip (Tahap 1) sebelum diajukan ke Atasan untuk persetujuan akhir (Tahap 2).
            </p>
          </div>

          <div className="space-y-5 text-xs font-sans">
            {/* 1. Judul Dokumen */}
            <div>
              <label className="block font-semibold text-[#1F2333] mb-1.5 text-xs">
                Judul Dokumen <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Laporan Keuangan Neraca Triwulan III 2026 PT SIA"
                className="w-full h-11 px-3.5 bg-white border border-[#CBD7E3] rounded-lg text-sm text-[#1F2333] placeholder-[#94A3B8] focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none transition-all"
              />
            </div>

            {/* 2. Kategori Dokumen Master */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#1F2333] mb-1.5 text-xs">
                  Klasifikasi Kategori <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={kategoriId}
                  onChange={(e) => setKategoriId(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-[#CBD7E3] rounded-lg text-xs text-[#1F2333] focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none cursor-pointer"
                >
                  {kategoriList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} ({k.kode || k.kode_kategori}) — {k.deskripsi}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-[#64748B] mt-1 block">
                  3 Kategori Resmi Master: Keuangan, SDM, Kontrak.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-[#1F2333] mb-1.5 text-xs">
                  Pihak Penandatangan Berkas
                </label>
                <input
                  type="text"
                  value={penandatangan}
                  onChange={(e) => setPenandatangan(e.target.value)}
                  placeholder="Contoh: Senior Manager Keuangan / Direktur Utama"
                  className="w-full h-11 px-3.5 bg-white border border-[#CBD7E3] rounded-lg text-xs text-[#1F2333] placeholder-[#94A3B8] focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 3. Standardisasi Kode Arsip SIG */}
            <div className="border border-[#BAE6FD] bg-[#F0F9FF]/50 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#BAE6FD] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0284C7]" />
                  <span className="font-semibold text-xs text-[#0284C7] uppercase tracking-wide">
                    Pola Penomoran Kode Arsip SIG
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNonPayment(!isNonPayment)}
                  className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                >
                  {isNonPayment ? 'Gunakan Pola 4 Token SIG' : 'Dokumen Khusus (Non-Payment)'}
                </button>
              </div>

              {!isNonPayment ? (
                <>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    Format SIG:{' '}
                    <code className="px-1.5 py-0.5 bg-white border border-[#BAE6FD] rounded text-[#0284C7] font-mono font-bold text-xs">
                      TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
                    </code>{' '}
                    (31 karakter). Nilai terisi otomatis bila nama berkas sesuai format.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-[#64748B] uppercase mb-1 font-semibold">
                        Tahun (4 digit)
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={tahun}
                        onChange={(e) => setTahun(e.target.value.replace(/\D/g, ''))}
                        placeholder="2025"
                        className="w-full h-10 px-3 bg-white border border-[#CBD7E3] rounded-lg font-mono text-xs text-[#1F2333] focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#64748B] uppercase mb-1 font-semibold">
                        Kode Perusahaan
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={kodePerusahaan}
                        onChange={(e) => setKodePerusahaan(e.target.value.replace(/\D/g, ''))}
                        placeholder="2000"
                        className="w-full h-10 px-3 bg-white border border-[#CBD7E3] rounded-lg font-mono text-xs text-[#1F2333] focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#64748B] uppercase mb-1 font-semibold">
                        No. Payment / PPL (10 digit)
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={nomorPpl}
                        onChange={(e) => setNomorPpl(e.target.value.replace(/\D/g, ''))}
                        placeholder="1500013765"
                        className="w-full h-10 px-3 bg-white border border-[#CBD7E3] rounded-lg font-mono text-xs text-[#1F2333] focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#64748B] uppercase mb-1 font-semibold">
                        Doc Voucher (10 digit)
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={docVoucher}
                        onChange={(e) => setDocVoucher(e.target.value.replace(/\D/g, ''))}
                        placeholder="1900009386"
                        className="w-full h-10 px-3 bg-white border border-[#CBD7E3] rounded-lg font-mono text-xs text-[#1F2333] focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#64748B] uppercase font-semibold">
                    Kode Arsip Khusus (Kontrak / Sertifikat)
                  </label>
                  <input
                    type="text"
                    value={customKodeArsip}
                    onChange={(e) => setCustomKodeArsip(e.target.value)}
                    placeholder="Contoh: 2026_KTR_SIA_SEWA_GEDUNG_001"
                    className="w-full h-10 px-3 bg-white border border-[#CBD7E3] rounded-lg font-mono text-xs text-[#1F2333] focus:border-[#3BA4E8] focus:outline-none"
                  />
                  <p className="text-[11px] text-[#64748B]">
                    Sesuai Blueprint 3.2 poin 5: bila dokumen tidak memiliki nomor transaksi pembayaran, kode dokumen dicatat langsung dan diverifikasi oleh PIC Arsip.
                  </p>
                </div>
              )}

              {/* Pratinjau Kode Arsip yang Dihasilkan */}
              <div className="p-3.5 bg-white border border-[#BAE6FD] rounded-xl flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[11px] text-[#64748B] uppercase block font-semibold">
                    Usulan Kode Arsip Terbentuk:
                  </span>
                  <span className="font-mono font-bold text-sm text-[#0284C7] tracking-wider mt-0.5 block">
                    {compositeKodeArsip || 'Belum lengkap'}
                  </span>
                </div>
                <div>
                  {kodeValidation.isValid ? (
                    <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full border border-emerald-300">
                      FORMAT VALID
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-full border border-amber-300">
                      BELUM SESUAI POLA
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Lokasi Fisik & Deskripsi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#1F2333] mb-1.5 text-xs">
                  Lokasi Fisik Berkas
                </label>
                <input
                  type="text"
                  value={lokasiFisik}
                  onChange={(e) => setLokasiFisik(e.target.value)}
                  placeholder="Ruang Arsip Aktif / Rak A-01"
                  className="w-full h-11 px-3.5 bg-white border border-[#CBD7E3] rounded-lg text-xs text-[#1F2333] placeholder-[#94A3B8] focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1F2333] mb-1.5 text-xs">
                  Ringkasan / Catatan Dokumen
                </label>
                <input
                  type="text"
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Keterangan singkat perihal dokumen..."
                  className="w-full h-11 px-3.5 bg-white border border-[#CBD7E3] rounded-lg text-xs text-[#1F2333] placeholder-[#94A3B8] focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 5. Unggah Berkas Utama (Wajib) */}
            <div className="pt-2">
              <label className="block font-semibold text-[#1F2333] mb-1.5 text-xs">
                Berkas Utama Dokumen (PDF / Scan) <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-[#BAE6FD] hover:border-[#3BA4E8] p-8 text-center bg-[#F0F9FF]/40 hover:bg-[#F0F9FF]/80 rounded-2xl transition-all cursor-pointer">
                <UploadCloud className="w-9 h-9 text-[#3BA4E8] mx-auto mb-2" />
                <input
                  type="file"
                  id="main-file-upload"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleMainFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="main-file-upload"
                  className="cursor-pointer text-xs font-semibold text-[#0284C7] hover:underline block"
                >
                  {selectedFile
                    ? `Berkas terpilih: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`
                    : 'Pilih Berkas Dokumen Utama (PDF, JPG, PNG)'}
                </label>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Format berkas: PDF, PNG, JPG • Disimpan di bucket privat arsip-aktif
                </p>
              </div>
            </div>

            {/* 6. Lampiran Pendukung (Opsional, Blueprint 6.5) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-semibold text-[#1F2333] text-xs">
                  Lampiran Pendukung (Opsional)
                </label>
                <span className="text-[11px] text-[#64748B]">
                  Format: PDF, XLSX, DOCX, JPG, PNG (Maks. total 25 MB)
                </span>
              </div>

              <div className="border border-[#E2E8F0] rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    id="lampiran-upload"
                    multiple
                    accept=".pdf,.xlsx,.docx,.jpg,.jpeg,.png"
                    onChange={handleLampiranChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="lampiran-upload"
                    className="px-3.5 py-1.5 bg-[#F0F9FF] border border-[#BAE6FD] hover:border-[#3BA4E8] text-[#0284C7] text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Pilih Berkas Lampiran</span>
                  </label>
                  <span className="text-xs text-[#64748B]">
                    {lampiranFiles.length > 0
                      ? `${lampiranFiles.length} lampiran dipilih (${(
                          lampiranFiles.reduce((a, b) => a + b.size, 0) /
                          1024 /
                          1024
                        ).toFixed(2)} MB)`
                      : 'Belum ada lampiran ditambahkan'}
                  </span>
                </div>

                {lampiranFiles.length > 0 && (
                  <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-lg overflow-hidden bg-[#F8FAFC] text-xs">
                    {lampiranFiles.map((lamp, idx) => (
                      <div
                        key={idx}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-[#3BA4E8] shrink-0" />
                          <span className="truncate text-[#1F2333] font-medium">{lamp.name}</span>
                          <span className="text-[#64748B] shrink-0 text-[11px]">
                            ({(lamp.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLampiran(idx)}
                          className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                          title="Hapus lampiran"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3 text-xs">
            <Link
              href="/dokumen"
              className="px-4 py-2.5 border border-[#CBD7E3] hover:bg-[#F8FAFC] text-[#1F2333] rounded-lg font-medium transition-colors"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !kodeValidation.isValid}
              className="px-6 py-2.5 bg-[#3BA4E8] hover:bg-[#2A92D6] active:bg-[#1E80C2] text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengirim Pengajuan...</span>
                </>
              ) : (
                <span>Kirim Pengajuan Dokumen</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
