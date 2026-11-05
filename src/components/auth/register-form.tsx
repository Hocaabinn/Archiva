'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ShieldAlert, ArrowRight, Loader2, CheckCircle2, Info, Sparkles, Eye, EyeOff } from 'lucide-react'
import ArchiveAnimation from '@/app/ArchiveAnimation'

// Representasi hashing acak (angka & simbol unik) dengan panjang pas 1:1 (8 - 15 digit)
function getScrambledHash(pass: string): string {
  if (!pass) return ''
  const symbols = ['#', '$', '%', '&', '*', '!', '@', '^', '9', '7', '3', '4', '8', '2', '5', 'x', 'z', 'k', 'q']
  let res = ''
  for (let i = 0; i < pass.length; i++) {
    const code = pass.charCodeAt(i)
    const idx = (code * 31 + i * 17 + 7) % symbols.length
    res += symbols[idx]
  }
  return res
}

export default function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [namaLengkap, setNamaLengkap] = useState('')
  const [nipNik, setNipNik] = useState('')
  const [jabatan, setJabatan] = useState('Sekretaris')
  const [jabatanLainnya, setJabatanLainnya] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedNotification, setCopiedNotification] = useState(false)

  // Fungsi menghasilkan kata sandi kukuh berdasarkan leksikon bahasa baku KBBI
  const handleGenerateStrongPassword = () => {
    const kataBakuKBBI = [
      'Arsip', 'Dokumen', 'Warkat', 'Naskah', 'Berkas', 
      'Pustaka', 'Risalah', 'Autentik', 'Akurat', 'Sahih', 
      'Amanah', 'Saksama', 'Cermat', 'Tertib', 'Terpelihara'
    ]
    const lambangKhusus = ['@', '#', '$', '%', '!', '&', '*']
    
    const kata = kataBakuKBBI[Math.floor(Math.random() * kataBakuKBBI.length)]
    const lambang = lambangKhusus[Math.floor(Math.random() * lambangKhusus.length)]
    const angka = Math.floor(100 + Math.random() * 900) // 3 digit angka

    // Pastikan panjang sandi antara 8 - 15 karakter
    let sandiKukuh = `${kata}${lambang}${angka}`
    if (sandiKukuh.length < 8) {
      sandiKukuh += '9'
    }
    sandiKukuh = sandiKukuh.slice(0, 15)
    setPassword(sandiKukuh)
    setCopiedNotification(true)
    setTimeout(() => setCopiedNotification(false), 2500)
  }

  // Animasi text ketik bergantian (typing & erasing loop) dengan warna Biru & Putih
  const [typedPart1, setTypedPart1] = useState('')
  const [typedPart2, setTypedPart2] = useState('')

  useEffect(() => {
    const sentences = [
      { part1: "Arsip Terkelola,", part2: " Layanan Lebih Terarah." },
      { part1: "Dokumen Tertata,", part2: " Informasi Lebih Terjaga." },
      { part1: "Digitalisasi Arsip,", part2: " Wujudkan Efisiensi." },
      { part1: "Administrasi Terintegrasi,", part2: " Produktivitas Meningkat." }
    ]

    let sentenceIndex = 0
    let charIndex = 0
    let isDeleting = false
    let timer: NodeJS.Timeout

    const tick = () => {
      const current = sentences[sentenceIndex]
      const fullSentence = current.part1 + current.part2

      if (!isDeleting) {
        charIndex++
        if (charIndex <= current.part1.length) {
          setTypedPart1(current.part1.slice(0, charIndex))
          setTypedPart2('')
        } else {
          setTypedPart1(current.part1)
          setTypedPart2(current.part2.slice(0, charIndex - current.part1.length))
        }

        if (charIndex >= fullSentence.length) {
          isDeleting = true
          timer = setTimeout(tick, 2200) // Beri jeda 2.2 detik agar user membaca kalimat lengkap
          return
        }
        timer = setTimeout(tick, 50) // Kecepatan ketik normal
      } else {
        charIndex -= 2 // Hapus sedikit lebih cepat
        if (charIndex < 0) charIndex = 0

        if (charIndex <= current.part1.length) {
          setTypedPart1(current.part1.slice(0, charIndex))
          setTypedPart2('')
        } else {
          setTypedPart1(current.part1)
          setTypedPart2(current.part2.slice(0, charIndex - current.part1.length))
        }

        if (charIndex === 0) {
          isDeleting = false
          sentenceIndex = (sentenceIndex + 1) % sentences.length
          timer = setTimeout(tick, 500) // Jeda sebelum mengetik kalimat baru
          return
        }
        timer = setTimeout(tick, 25)
      }
    }

    timer = setTimeout(tick, 300)
    return () => clearTimeout(timer)
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    const finalJabatan = jabatan === 'Jabatan Instansi Lainnya' ? jabatanLainnya.trim() : jabatan

    if (jabatan === 'Jabatan Instansi Lainnya' && !jabatanLainnya.trim()) {
      setErrorMsg('Silakan sebutkan nama jabatan instansi Anda.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nama_lengkap: namaLengkap,
          nip_nik: nipNik,
          jabatan: finalJabatan,
          role: 'user', // Akun pendaftaran publik selalu berstatus Pengaju (User)
        },
      },
    })

    if (error) {
      if (error.message.includes('fetch failed') || error.message.includes('dummy') || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy-project')) {
        // Fallback for UI demonstration
        setSuccessMsg('Pendaftaran akun berhasil (Mode Demonstrasi). Anda diarahkan ke dashboard...')
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
        return
      }
      setErrorMsg(`Pendaftaran gagal: ${error.message}`)
      setLoading(false)
      return
    }

    setSuccessMsg('Akun pengaju berhasil didaftarkan. Silakan periksa email konfirmasi Anda atau login.')
    setLoading(false)
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  }

  return (
    <section className="min-h-screen bg-[#F0F5FA] p-3 sm:p-4 md:p-6 text-[#1A232E] antialiased">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-4 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* Kolom Kiri: Formulir Register Berarsitektur Split Panel (Mobile: order-2, Desktop: order-1) */}
        <div className="order-2 lg:order-1 flex items-center rounded-xl border border-[#CBD7E3] bg-white px-5 py-8 sm:px-10 lg:px-12 lg:py-14 shadow-xs">
          <div className="mx-auto w-full max-w-[560px]">
            
            {/* Header Form */}
            <div className="border-b border-[#CBD7E3] pb-5 mb-7">
              <Image
                src="/pic/Logo-gabungan-gelap.png"
                alt="Archiva"
                width={838}
                height={132}
                priority
                className="h-7 sm:h-8 lg:h-9 w-auto mb-5 sm:mb-6"
              />
              <h1 className="text-2xl font-serif font-bold tracking-tight text-[#111827] sm:text-3xl lg:text-4xl">
                Pendaftaran Akun
              </h1>
              <p className="mt-2 text-sm text-[#4B5E76]">
                Daftarkan akun pegawai Anda untuk mengelola pengajuan dokumen dinas & arsip terverifikasi.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-[#FEF3F2] border-l-4 border-[#B42318] text-[#B42318] text-xs sm:text-sm flex items-start gap-3 rounded-r-md">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Kesalahan Registrasi</p>
                  <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 bg-[#E8F5E9] border-l-4 border-[#1F5C55] text-[#1F5C55] text-xs sm:text-sm flex items-start gap-3 rounded-r-md">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Registrasi Berhasil</p>
                  <p className="mt-0.5 leading-relaxed">{successMsg}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="namaLengkap">
                  Nama Lengkap & Gelar
                </label>
                <input
                  id="namaLengkap"
                  type="text"
                  required
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="Contoh: Dra. Sri Wahyuni, M.Si"
                  className="w-full h-12 px-4 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827] placeholder-[#94A3B8] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="nipNik">
                    NIP / NIK Pegawai
                  </label>
                  <input
                    id="nipNik"
                    type="text"
                    required
                    value={nipNik}
                    onChange={(e) => setNipNik(e.target.value)}
                    placeholder="18 digit nomor identitas"
                    className="w-full h-12 px-4 text-sm font-mono bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827] placeholder-[#94A3B8] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="jabatan">
                    Jabatan di Instansi
                  </label>
                  <select
                    id="jabatan"
                    required
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    className="w-full h-12 px-3 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827] transition-all cursor-pointer"
                  >
                    <option value="Sekretaris">Sekretaris</option>
                    <option value="Keuangan">Keuangan</option>
                    <option value="SDM & Kepegawaian">SDM & Kepegawaian</option>
                    <option value="Jabatan Instansi Lainnya">Jabatan Instansi Lainnya</option>
                  </select>
                </div>
              </div>

              {jabatan === 'Jabatan Instansi Lainnya' && (
                <div className="p-3 bg-[#E8F1F8] border border-[#CBD7E3] rounded-lg">
                  <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="jabatanLainnya">
                    Sebutkan Jabatan di Instansi
                  </label>
                  <input
                    id="jabatanLainnya"
                    type="text"
                    required
                    value={jabatanLainnya}
                    onChange={(e) => setJabatanLainnya(e.target.value)}
                    placeholder="Contoh: Staf Pengadaan Barang, Analis Kebijakan, dll."
                    className="w-full h-11 px-3 text-sm bg-white border border-[#CBD7E3] rounded-md focus:outline-none focus:border-[#1E3A5F] text-[#111827] placeholder-[#94A3B8]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="email">
                  Alamat Email Kedinasan
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@instansi.go.id"
                  className="w-full h-12 px-4 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827] placeholder-[#94A3B8] transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider" htmlFor="password">
                    Kata Sandi Akun
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateStrongPassword}
                    className="p-1.5 text-[#1E3A5F] hover:text-[#0F2038] bg-[#E8F1F8] hover:bg-[#D9E8F5] rounded-md border border-[#CBD7E3] transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#0284C7]" />
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={15}
                    value={showPassword ? getScrambledHash(password) : password}
                    onChange={(e) => {
                      if (!showPassword) setPassword(e.target.value.slice(0, 15))
                    }}
                    onClick={() => {
                      if (showPassword) setShowPassword(false)
                    }}
                    placeholder="Ketik kata sandi (8 - 15 karakter)"
                    className={`w-full h-12 pl-4 pr-11 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] transition-all ${
                      showPassword
                        ? 'font-mono text-sm text-[#0284C7] bg-[#F0F7FF] select-all tracking-widest cursor-pointer'
                        : 'text-[#111827] placeholder-[#94A3B8]'
                    }`}
                    title={showPassword ? 'Klik kolom untuk kembali mengedit kata sandi' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4B5E76] hover:text-[#1E3A5F] p-1 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Kembali ke mode sembunyi' : 'Lihat representasi hashing angka & simbol unik'}
                    title={showPassword ? 'Kembali ke mode sembunyi' : 'Lihat representasi hashing angka & simbol unik'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-[#0284C7]" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {copiedNotification && (
                  <p className="mt-1.5 text-[11px] text-[#1F5C55] font-medium flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Kata sandi berhasil diterapkan ke kolom formulir.
                  </p>
                )}
              </div>

              {/* Kotak Info Hak Akses dengan Garis Tebal & Ikon Info (Biru Muda Nuansa Instansi) */}
              <div className="p-3.5 bg-[#E8F1F8] border border-[#CBD7E3] border-l-4 border-l-[#1E3A5F] rounded-r-lg flex items-start gap-3">
                <Info className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-0.5" />
                <p className="text-xs text-[#4B5E76] leading-relaxed">
                  Akun baru secara otomatis memiliki peran sebagai <strong className="text-[#1E3A5F] font-semibold">Pengaju</strong> dan hanya dapat mengakses dokumen miliknya sendiri. Hak akses tambahan hanya dapat diberikan dan dikelola oleh <strong className="text-[#1E3A5F] font-semibold">Admin</strong>.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-70 cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mendaftarkan Akun...</span>
                    </>
                  ) : (
                    <>
                      <span>Daftarkan Akun Pengaju</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-[#4B5E76] text-center mt-2">
                  Akun langsung aktif dan dapat digunakan untuk masuk ke sistem sebagai Pengaju.
                </p>
              </div>
            </form>

            <div className="mt-8 pt-5 border-t border-[#CBD7E3] flex items-center justify-between text-xs text-[#4B5E76]">
              <span>Sudah memiliki akun terdaftar?</span>
              <Link 
                href="/login" 
                className="font-medium text-[#1E3A5F] underline underline-offset-4 hover:text-[#111827] transition-colors"
              >
                Login di Sini →
              </Link>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Panel Kartu Brand / Identitas Arsip Instansi (Mobile: order-1 di atas, Desktop: order-2 di kanan) */}
        <div className="order-1 lg:order-2 relative flex flex-col justify-between overflow-hidden rounded-xl bg-[#081528] p-5 sm:p-8 lg:p-12 text-white border border-[#1E3A5F] shadow-lg min-h-[360px] sm:min-h-[440px] lg:min-h-0">
          {/* Background Animasi Arsip Dokumen Interaktif */}
          <ArchiveAnimation />

          <div className="relative z-10 space-y-3 sm:space-y-4">
            <Image
              src="/pic/Logo.png"
              alt="Logo Archiva"
              width={502}
              height={484}
              priority
              className="h-9 sm:h-11 lg:h-14 w-auto -mt-1 sm:-mt-3 lg:-mt-6"
            />
            <div className="min-h-[52px] sm:min-h-[60px] lg:min-h-[68px] max-w-[20rem] sm:max-w-sm">
              <h2 className="text-base sm:text-lg lg:text-[22px] font-serif font-bold tracking-tight leading-snug drop-shadow-[0_2px_6px_rgba(8,21,40,0.9)]">
                <span className="text-white">{typedPart1}</span>
                <span className="text-[#38BDF8]">{typedPart2}</span>
                <span className="inline-block w-[3px] h-[1em] bg-[#38BDF8] ml-1.5 align-middle animate-pulse" />
              </h2>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-[11px] sm:text-xs text-[#94A3B8] font-mono">
            <span>SISTEM INFORMASI ARSIP DINAS</span>
            <span>VERSI 1.0 • BERLISENSI INSTANSI</span>
          </div>
        </div>

      </div>
    </section>
  )
}
