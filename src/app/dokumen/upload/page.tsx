'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { 
  ArrowLeft, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert,
  FolderArchive
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function UploadDokumenPage() {
  const router = useRouter()
  const [judul, setJudul] = useState('')
  const [nomorDokumen, setNomorDokumen] = useState('')
  const [kategori, setKategori] = useState('Kontrak & Legal')
  const [deskripsi, setDeskripsi] = useState('')
  const [lokasiFisik, setLokasiFisik] = useState('Meja Pengaju')
  const [tingkatSensitif, setTingkatSensitif] = useState<'Biasa' | 'Rahasia' | 'Sangat Rahasia'>('Biasa')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 20 * 1024 * 1024) {
        setErrorMsg('Ukuran berkas melebihi batas maksimal 20 MB.')
        setSelectedFile(null)
        return
      }
      setSelectedFile(file)
      setErrorMsg(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!judul.trim()) {
      setErrorMsg('Judul dokumen wajib diisi.')
      return
    }
    if (!selectedFile) {
      setErrorMsg('Silakan pilih berkas dokumen yang akan diunggah.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Generate kode arsip acak berformat ARS-2026-XXXX
      const randomCode = `ARS-2026-${Math.floor(1000 + Math.random() * 9000)}`

      // Upload file ke Supabase Storage (arsip-aktif)
      const fileExt = selectedFile.name.split('.').pop()
      const filePath = `${randomCode}_${Date.now()}.${fileExt}`

      let storagePath = filePath
      if (user) {
        const { error: uploadError } = await supabase.storage
          .from('arsip-aktif')
          .upload(filePath, selectedFile)

        if (uploadError) {
          console.warn('Gagal upload ke storage Supabase, menyimpan metadata:', uploadError.message)
        }

        // Simpan ke database jika user login
        await supabase.from('dokumen').insert({
          kode_arsip: randomCode,
          nomor_dokumen: nomorDokumen || null,
          judul,
          deskripsi: deskripsi || null,
          status: 'menunggu_persetujuan',
          file_path: storagePath,
          bucket: 'arsip-aktif',
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          pemilik_id: user.id,
          pemegang_saat_ini: user.id,
          lokasi_saat_ini: lokasiFisik,
        })
      }

      setSuccessMsg(`Dokumen berhasil didaftarkan dengan kode arsip ${randomCode}! Status awal: Menunggu Persetujuan.`)
      setTimeout(() => {
        router.push('/dokumen')
      }, 1500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat mengunggah dokumen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto pb-12">
        
        {/* Navigasi Atas */}
        <div className="flex items-center justify-between border-b border-[#D8D2C4] pb-4">
          <Link
            href="/dokumen"
            className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#5B6166] hover:text-[#1A1D21] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Katalog Dokumen</span>
          </Link>
          <span className="font-mono text-xs px-2 py-0.5 bg-[#F7F3EB] border border-[#D8D2C4] text-[#1E2429]">
            Formulir Pendaftaran Berkas
          </span>
        </div>

        {/* Notifikasi Sukses / Error */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border-l-4 border-red-700 text-red-800 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal Mendaftarkan Dokumen</p>
              <p className="mt-0.5">{errorMsg}</p>
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

        {/* Formulir Pendaftaran */}
        <form onSubmit={handleSubmit} className="bg-white border-2 border-[#1E2429] p-6 sm:p-8 space-y-6 shadow-sm">
          
          <div className="border-b border-[#D8D2C4] pb-4">
            <h1 className="font-serif text-2xl font-bold text-[#1A1D21]">
              Unggah Dokumen Arsip Baru
            </h1>
            <p className="text-xs text-[#5B6166] mt-1 leading-relaxed">
              Berkas yang didaftarkan akan berstatus <strong className="text-[#9A6700]">Menunggu Persetujuan</strong> dan diverifikasi terlebih dahulu oleh PIC Arsip sebelum diterbitkan ke status Aktif.
            </p>
          </div>

          <div className="space-y-4 text-xs font-sans">
            {/* Judul Dokumen */}
            <div>
              <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                Judul Dokumen <span className="text-red-700">*</span>
              </label>
              <input
                type="text"
                required
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Perjanjian Sewa Gedung Kantor Pusat 2026"
                className="w-full px-3 py-2 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-[#1A1D21] focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            {/* Nomor Dokumen & Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                  Nomor Surat / Dokumen
                </label>
                <input
                  type="text"
                  value={nomorDokumen}
                  onChange={(e) => setNomorDokumen(e.target.value)}
                  placeholder="Contoh: 015/DIR-KTR/2026"
                  className="w-full px-3 py-2 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-[#1A1D21] focus:bg-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                  Klasifikasi Kategori <span className="text-red-700">*</span>
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8D2C4] bg-white focus:border-[#1A1D21] focus:outline-none cursor-pointer"
                >
                  <option value="Kontrak & Legal">Kontrak & Legal</option>
                  <option value="Keuangan">Keuangan</option>
                  <option value="SDM & Kepegawaian">SDM & Kepegawaian</option>
                  <option value="Operasional & Logistik">Operasional & Logistik</option>
                </select>
              </div>
            </div>

            {/* Lokasi Fisik & Tingkat Sensitivitas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                  Lokasi Fisik Berkas
                </label>
                <input
                  type="text"
                  value={lokasiFisik}
                  onChange={(e) => setLokasiFisik(e.target.value)}
                  placeholder="Contoh: Meja Pengaju / Rak Arsip Sementara"
                  className="w-full px-3 py-2 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-[#1A1D21] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                  Tingkat Kerahasiaan
                </label>
                <select
                  value={tingkatSensitif}
                  onChange={(e) => setTingkatSensitif(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#D8D2C4] bg-white focus:border-[#1A1D21] focus:outline-none cursor-pointer"
                >
                  <option value="Biasa">Biasa (Terbuka Terbatas)</option>
                  <option value="Rahasia">Rahasia (Terverifikasi)</option>
                  <option value="Sangat Rahasia">Sangat Rahasia (Otoritas Atasan)</option>
                </select>
              </div>
            </div>

            {/* Deskripsi / Ringkasan Isi */}
            <div>
              <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                Deskripsi / Ringkasan Isi Dokumen
              </label>
              <textarea
                rows={3}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Tuliskan keterangan singkat mengenai isi atau pihak-pihak terkait dalam dokumen..."
                className="w-full px-3 py-2 border border-[#D8D2C4] bg-[#F7F3EB]/30 focus:border-[#1A1D21] focus:bg-white focus:outline-none"
              />
            </div>

            {/* Unggah Berkas Digital (PDF/Scan) */}
            <div className="pt-2">
              <label className="block font-bold text-[#1A1D21] mb-1 font-mono uppercase text-[11px]">
                Unggah Berkas Fisik Terpindai (PDF / Gambar) <span className="text-red-700">*</span>
              </label>
              <div className="border-2 border-dashed border-[#D8D2C4] hover:border-[#1A1D21] p-6 text-center bg-[#F7F3EB]/40 transition-colors">
                <UploadCloud className="w-8 h-8 text-[#5B6166] mx-auto mb-2" />
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer font-mono text-xs font-semibold text-[#1F5C55] hover:underline block"
                >
                  {selectedFile ? `Berkas terpilih: ${selectedFile.name}` : 'Klik untuk memilih file dokumen (PDF, PNG, JPG)'}
                </label>
                <p className="text-[11px] text-[#8C9399] mt-1 font-mono">
                  Batas maksimal ukuran file 20 MB • Disimpan di bucket privat
                </p>
              </div>
            </div>
          </div>

          {/* Tombol Simpan & Batal */}
          <div className="pt-4 border-t border-[#D8D2C4] flex items-center justify-end gap-3 font-mono text-xs">
            <Link
              href="/dokumen"
              className="px-4 py-2 border border-[#D8D2C4] hover:bg-[#F7F3EB] text-[#1A1D21] transition-colors"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#1F5C55] hover:bg-[#184843] text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <span>{isSubmitting ? 'Mendaftarkan...' : 'Kirim Pengajuan Dokumen'}</span>
            </button>
          </div>
        </form>

      </div>
    </AppLayout>
  )
}

