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
  Info,
  Sparkles,
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
      if (file.size > 20 * 1024 * 1024) {
        setErrorMsg('Ukuran berkas utama melebihi batas maksimal 20 MB.')
        setSelectedFile(null)
        return
      }

      setSelectedFile(file)
      setErrorMsg(null)

      // Coba ekstraksi token SIG dari nama file otomatis (Blueprint 3.2 poin 6)
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
      setErrorMsg('Kategori klasifikasi dokumen wajib dipilih.')
      return
    }
    if (!selectedFile) {
      setErrorMsg('Silakan pilih berkas dokumen fisik utama yang akan diunggah.')
      return
    }

    if (!kodeValidation.isValid) {
      setErrorMsg(kodeValidation.message || 'Format kode arsip tidak valid.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('judul', judul.trim())
      formData.append('kode_arsip', compositeKodeArsip)
      formData.append('nomor_ppl', nomorPpl.trim())
      formData.append('nomor_dokumen', docVoucher.trim())
      formData.append('penandatangan', penandatangan.trim())
      formData.append('kategori_id', kategoriId)
      formData.append('deskripsi', deskripsi.trim())
      formData.append('lokasi_saat_ini', lokasiFisik.trim() || 'Ruang Arsip Aktif')

      // Lampiran
      for (const lamp of lampiranFiles) {
        formData.append('lampiran', lamp)
      }

      const res = await fetch('/api/dokumen/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Gagal mendaftarkan dokumen ke sistem.')
      }

      setSuccessMsg(
        `Dokumen ${compositeKodeArsip} berhasil diajukan! Status: Menunggu Persetujuan. Mengalihkan...`
      )

      setTimeout(() => {
        router.push(result.dokumen?.id ? `/dokumen/${result.dokumen.id}` : '/dokumen')
      }, 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      setErrorMsg(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingInitial) {
    return (
      <AppLayout>
        <div className="py-20 text-center font-mono text-xs text-[#5B6166]">
          Menyiapkan formulir pendaftaran arsip...
        </div>
      </AppLayout>
    )
  }

  // Jika bukan Pengaju atau Admin (misal Viewer atau Accounting)
  if (currentUserRole && currentUserRole !== 'user' && currentUserRole !== 'admin') {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-12">
          <div className="bg-amber-50 border-2 border-amber-600 p-6 text-xs text-amber-900 space-y-3">
            <h2 className="font-bold font-serif text-lg text-amber-950 flex items-center gap-2">
              <Info className="w-5 h-5 text-amber-700" />
              Otoritas Tidak Diizinkan
            </h2>
            <p>
              Akun Anda memiliki peran <strong>{currentUserRole}</strong>. Berdasarkan aturan kearsipan Bab 5, hanya akun dengan peran <strong>Pengaju (User)</strong> yang berhak mengunggah berkas pengajuan dokumen baru.
            </p>
            <div className="pt-2">
              <Link
                href="/dokumen"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E2429] text-white font-mono font-semibold"
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
        <div className="flex items-center justify-between border-b border-[#D8D2C4] pb-4">
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#5B6166] hover:text-[#1A1D21] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Katalog Dokumen</span>
          </Link>
          <span className="font-mono text-xs px-2.5 py-1 bg-[#F7F3EB] border border-[#D8D2C4] text-[#1E2429] font-bold">
            Formulir Pendaftaran Berkas Arsip
          </span>
        </div>

        {/* Notifikasi Sukses / Error */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border-l-4 border-red-700 text-red-800 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal Mendaftarkan Dokumen</p>
              <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border-l-4 border-emerald-700 text-emerald-800 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Pengajuan Berhasil</p>
              <p className="mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Formulir Registrasi Arsip */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border-2 border-[#1E2429] p-6 sm:p-8 space-y-6 shadow-sm"
        >
          {/* Header Formulir */}
          <div className="border-b border-[#D8D2C4] pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] px-2 py-0.5 bg-[#1F5C55] text-white font-bold">
                SEMEN INDONESIA GROUP
              </span>
              <span className="text-xs text-[#5B6166] font-mono">
                Standar Kearsipan Elektronik R.02
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#1A1D21] mt-1">
              Pengajuan Dokumen Arsip Baru
            </h1>
            <p className="text-xs text-[#5B6166] mt-1 leading-relaxed">
              Dokumen yang didaftarkan akan berstatus{' '}
              <strong className="text-[#9A6700]">Menunggu Persetujuan</strong> dan diverifikasi
              oleh PIC Arsip (Tahap 1) sebelum diajukan ke Atasan untuk persetujuan akhir (Tahap
              2).
            </p>
          </div>

          <div className="space-y-5 text-xs font-sans">
            {/* 1. Judul Dokumen */}
            <div>
              <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                Judul Dokumen <span className="text-red-700">*</span>
              </label>
              <input
                type="text"
                required
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Laporan Keuangan Neraca Triwulan III 2026 PT SIA"
                className="w-full px-3 py-2.5 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-[#1A1D21] focus:bg-white focus:outline-none transition-colors text-sm"
              />
            </div>

            {/* 2. Kategori Dokumen Master */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                  Klasifikasi Kategori <span className="text-red-700">*</span>
                </label>
                <select
                  required
                  value={kategoriId}
                  onChange={(e) => setKategoriId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8D2C4] bg-white focus:border-[#1A1D21] focus:outline-none cursor-pointer text-xs"
                >
                  {kategoriList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} ({k.kode || k.kode_kategori}) — {k.deskripsi}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[#5B6166] mt-1 block">
                  3 Kategori Resmi Master: Keuangan, SDM, Kontrak.
                </span>
              </div>

              <div>
                <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                  Pihak Penandatangan Berkas
                </label>
                <input
                  type="text"
                  value={penandatangan}
                  onChange={(e) => setPenandatangan(e.target.value)}
                  placeholder="Contoh: Senior Manager Keuangan / Direktur Utama"
                  className="w-full px-3 py-2 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-[#1A1D21] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* 3. Standardisasi Kode Arsip SIG */}
            <div className="border border-[#D8D2C4] bg-[#F7F3EB]/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#D8D2C4] pb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#1F5C55]" />
                  <span className="font-mono font-bold text-[11px] text-[#1A1D21] uppercase">
                    Pola Penomoran Kode Arsip SIG
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNonPayment(!isNonPayment)}
                  className="text-[10px] font-mono text-[#1F5C55] hover:underline"
                >
                  {isNonPayment ? 'Gunakan Pola 4 Token SIG' : 'Dokumen Khusus (Non-Payment)'}
                </button>
              </div>

              {!isNonPayment ? (
                <>
                  <p className="text-[11px] text-[#5B6166]">
                    Format SIG:{' '}
                    <code className="px-1 py-0.5 bg-white border border-[#D8D2C4] font-bold">
                      TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
                    </code>{' '}
                    (31 karakter). Nilai terisi otomatis bila nama file sesuai.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="block font-mono text-[10px] text-[#5B6166] uppercase mb-0.5 font-bold">
                        Tahun (4 digit)
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={tahun}
                        onChange={(e) => setTahun(e.target.value.replace(/\D/g, ''))}
                        placeholder="2025"
                        className="w-full px-2.5 py-1.5 border border-[#D8D2C4] bg-white font-mono text-xs focus:border-[#1A1D21] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] text-[#5B6166] uppercase mb-0.5 font-bold">
                        Kode Perusahaan
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={kodePerusahaan}
                        onChange={(e) => setKodePerusahaan(e.target.value.replace(/\D/g, ''))}
                        placeholder="2000"
                        className="w-full px-2.5 py-1.5 border border-[#D8D2C4] bg-white font-mono text-xs focus:border-[#1A1D21] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] text-[#5B6166] uppercase mb-0.5 font-bold">
                        No. Payment / PPL (10 digit)
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={nomorPpl}
                        onChange={(e) => setNomorPpl(e.target.value.replace(/\D/g, ''))}
                        placeholder="1500013765"
                        className="w-full px-2.5 py-1.5 border border-[#D8D2C4] bg-white font-mono text-xs focus:border-[#1A1D21] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] text-[#5B6166] uppercase mb-0.5 font-bold">
                        Doc Voucher (10 digit)
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={docVoucher}
                        onChange={(e) => setDocVoucher(e.target.value.replace(/\D/g, ''))}
                        placeholder="1900009386"
                        className="w-full px-2.5 py-1.5 border border-[#D8D2C4] bg-white font-mono text-xs focus:border-[#1A1D21] focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="block font-mono text-[10px] text-[#5B6166] uppercase font-bold">
                    Kode Arsip Khusus (Kontrak / Sertifikat)
                  </label>
                  <input
                    type="text"
                    value={customKodeArsip}
                    onChange={(e) => setCustomKodeArsip(e.target.value)}
                    placeholder="Contoh: 2026_KTR_SIA_SEWA_GEDUNG_001"
                    className="w-full px-3 py-2 border border-[#D8D2C4] bg-white font-mono text-xs focus:border-[#1A1D21] focus:outline-none"
                  />
                  <p className="text-[10px] text-[#5B6166]">
                    Sesuai Blueprint 3.2 poin 5: bila dokumen tidak memiliki nomor transaksi pembayaran, kode dokumen dicatat langsung dan diverifikasi oleh PIC Arsip.
                  </p>
                </div>
              )}

              {/* Pratinjau Kode Arsip yang Dihasilkan */}
              <div className="p-3 bg-white border border-[#D8D2C4] flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] text-[#5B6166] uppercase block">
                    Usulan Kode Arsip Terbentuk:
                  </span>
                  <span className="font-mono font-bold text-xs text-[#1A1D21] tracking-wider">
                    {compositeKodeArsip || 'Belum lengkap'}
                  </span>
                </div>
                <div>
                  {kodeValidation.isValid ? (
                    <span className="font-mono text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                      FORMAT VALID
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 font-bold border border-amber-300">
                      BELUM SESUAI POLA
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Lokasi Fisik & Deskripsi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                  Lokasi Fisik Berkas
                </label>
                <input
                  type="text"
                  value={lokasiFisik}
                  onChange={(e) => setLokasiFisik(e.target.value)}
                  placeholder="Ruang Arsip Aktif / Rak A-01"
                  className="w-full px-3 py-2 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-[#1A1D21] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                  Ringkasan / Catatan Dokumen
                </label>
                <input
                  type="text"
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Keterangan singkat perihal dokumen..."
                  className="w-full px-3 py-2 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-[#1A1D21] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* 5. Unggah Berkas Utama (Wajib) */}
            <div className="pt-2">
              <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                Berkas Utama Dokumen (PDF / Scan) <span className="text-red-700">*</span>
              </label>
              <div className="border-2 border-dashed border-[#D8D2C4] hover:border-[#1A1D21] p-6 text-center bg-[#F7F3EB]/40 transition-colors">
                <UploadCloud className="w-8 h-8 text-[#5B6166] mx-auto mb-2" />
                <input
                  type="file"
                  id="main-file-upload"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleMainFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="main-file-upload"
                  className="cursor-pointer font-mono text-xs font-semibold text-[#1F5C55] hover:underline block"
                >
                  {selectedFile
                    ? `Berkas terpilih: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`
                    : 'Pilih Berkas Dokumen Utama (PDF, JPG, PNG)'}
                </label>
                <p className="text-[10px] text-[#8C9399] mt-1 font-mono">
                  Batas maks. 20 MB • Disimpan di bucket privat arsip-aktif
                </p>
              </div>
            </div>

            {/* 6. Lampiran Pendukung (Opsional, Blueprint 6.5) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-[#1A1D21] font-mono uppercase text-[11px]">
                  Lampiran Pendukung (Opsional)
                </label>
                <span className="font-mono text-[10px] text-[#5B6166]">
                  Format: PDF, XLSX, DOCX, JPG, PNG (Maks. total 25 MB)
                </span>
              </div>

              <div className="border border-[#D8D2C4] p-4 bg-white space-y-3">
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
                    className="px-3 py-1.5 bg-[#F7F3EB] border border-[#D8D2C4] hover:border-[#1A1D21] text-[#1A1D21] text-xs font-mono font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Pilih Berkas Lampiran</span>
                  </label>
                  <span className="text-[11px] text-[#5B6166] font-mono">
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
                  <div className="divide-y divide-[#D8D2C4] border border-[#D8D2C4] bg-[#F7F3EB]/20 text-xs font-mono">
                    {lampiranFiles.map((lamp, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-3.5 h-3.5 text-[#5B6166] shrink-0" />
                          <span className="truncate text-[#1A1D21]">{lamp.name}</span>
                          <span className="text-[#8C9399] shrink-0">
                            ({(lamp.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLampiran(idx)}
                          className="text-red-700 hover:text-red-900 p-1"
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
          <div className="pt-4 border-t border-[#D8D2C4] flex items-center justify-end gap-3 font-mono text-xs">
            <Link
              href="/dokumen"
              className="px-4 py-2 border border-[#D8D2C4] hover:bg-[#F7F3EB] text-[#1A1D21] transition-colors"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !kodeValidation.isValid}
              className="px-5 py-2.5 bg-[#1F5C55] hover:bg-[#184843] text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <span>{isSubmitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Dokumen'}</span>
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
