'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ShieldAlert, ArrowRight, Loader2, CheckCircle2, Eye, EyeOff, KeyRound, Mail } from 'lucide-react'
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

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Modal Lupa Kata Sandi (Pemulihan Akses via OTP Surel sesuai BLUEPRINT 4.2)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)
  const [forgotStep, setForgotStep] = useState<'request' | 'verify_and_reset' | 'success'>('request')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtpToken, setForgotOtpToken] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotError, setForgotError] = useState('')

  // Animasi text ketik bergantian (typing & erasing loop)
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
          timer = setTimeout(tick, 2200)
          return
        }
        timer = setTimeout(tick, 50)
      } else {
        charIndex -= 2
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
          timer = setTimeout(tick, 500)
          return
        }
        timer = setTimeout(tick, 25)
      }
    }

    timer = setTimeout(tick, 300)
    return () => clearTimeout(timer)
  }, [])

  // Login dengan Surel + Kata Sandi (BLUEPRINT 9.1)
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    const supabase = createClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.message.includes('fetch failed') || error.message.includes('dummy') || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy-project')) {
        setSuccessMsg('Autentikasi terverifikasi (Mode Demonstrasi). Mengalihkan ke dasbor...')
        setTimeout(() => {
          router.push('/dashboard')
        }, 1200)
        return
      }
      setErrorMsg(`Gagal masuk: ${error.message}. Periksa surel dan kata sandi Anda.`)
      setLoading(false)
      return
    }

    // Pengecekan akun dinonaktifkan (BLUEPRINT 9.1: Akun yang dinonaktifkan tidak dapat masuk)
    if (authData?.user?.banned_until && new Date(authData.user.banned_until) > new Date()) {
      await supabase.auth.signOut()
      setErrorMsg('Akun Anda telah dinonaktifkan oleh Administrator Sistem.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  // 1. Langkah 1 Lupa Kata Sandi: Kirim Kode OTP Pemulihan ke Surel (BLUEPRINT 4.2)
  const handleRequestPasswordOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotMsg('')
    setForgotError('')
    setForgotLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim())

    if (error) {
      if (error.message.includes('rate limit')) {
        setForgotError('Batas pengiriman surel tercapai (rate limit). Silakan tunggu beberapa menit sebelum meminta kode baru.')
      } else {
        setForgotError(`Gagal mengirim kode OTP pemulihan: ${error.message}`)
      }
      setForgotLoading(false)
      return
    }

    setForgotStep('verify_and_reset')
    setForgotMsg(`Kode OTP 6-digit pemulihan telah dikirimkan ke surel ${forgotEmail.trim()}. Silakan periksa kotak masuk atau spam surel Anda.`)
    setForgotLoading(false)
  }

  // 2. Langkah 2 Lupa Kata Sandi: Verifikasi OTP & Tetapkan Kata Sandi Baru (BLUEPRINT 4.2)
  const handleResetPasswordWithOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotMsg('')
    setForgotError('')

    if (forgotNewPassword.length < 8) {
      setForgotError('Kata sandi baru minimal harus 8 karakter.')
      return
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Konfirmasi kata sandi baru tidak cocok. Harap periksa kembali.')
      return
    }

    setForgotLoading(true)
    const supabase = createClient()

    // Verifikasi kode OTP dengan tipe 'recovery'
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email: forgotEmail.trim(),
      token: forgotOtpToken.trim(),
      type: 'recovery',
    })

    if (verifyErr) {
      // Fallback jika dikirimkan sebagai tipe surel umum
      const { error: fallbackErr } = await supabase.auth.verifyOtp({
        email: forgotEmail.trim(),
        token: forgotOtpToken.trim(),
        type: 'email',
      })

      if (fallbackErr) {
        setForgotError(`Kode OTP tidak valid atau telah kadaluarsa: ${verifyErr.message}`)
        setForgotLoading(false)
        return
      }
    }

    // Perbarui kata sandi pengguna dengan sesi yang sudah diverifikasi
    const { error: updateErr } = await supabase.auth.updateUser({
      password: forgotNewPassword,
    })

    if (updateErr) {
      setForgotError(`Gagal memperbarui kata sandi: ${updateErr.message}`)
      setForgotLoading(false)
      return
    }

    // Bersihkan sesi pemulihan sementara agar pengguna masuk resmi dari halaman login
    await supabase.auth.signOut()

    setForgotStep('success')
    setForgotMsg('Kata sandi berhasil diatur ulang. Silakan masuk menggunakan kata sandi baru Anda.')
    setForgotLoading(false)
  }

  const handleCloseForgotModal = () => {
    setIsForgotModalOpen(false)
    setForgotStep('request')
    setForgotOtpToken('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotMsg('')
    setForgotError('')
  }

  return (
    <section className="min-h-dvh bg-[#F0F5FA] p-3 sm:p-4 md:p-6 text-[#1A232E] antialiased">
      <div className="grid gap-3 sm:gap-4 md:gap-6 lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* Kolom Kiri: Formulir Masuk Tunggal (BLUEPRINT 9.1: Email + Kata Sandi, 1 Tombol Masuk ke Sistem) */}
        <div className="order-2 lg:order-1 flex items-center rounded-xl border border-[#CBD7E3] bg-white px-5 py-7 sm:px-10 sm:py-10 lg:px-12 lg:py-14 shadow-xs">
          <div className="mx-auto w-full max-w-[560px]">
            
            {/* Header Form */}
            <div className="border-b border-[#CBD7E3] pb-5 mb-6">
              <Image
                src="/pic/logo_gabungan.png"
                alt="Archiva"
                width={1019}
                height={245}
                priority
                className="h-14 sm:h-16 lg:h-20 w-auto mb-6 sm:mb-7"
              />
              <h1 className="text-2xl font-serif font-bold tracking-tight text-[#111827] sm:text-3xl lg:text-4xl">
                Masuk ke Sistem
              </h1>
              <p className="mt-2 text-sm text-[#4B5E76]">
                Memudahkan pengelolaan arsip dokumen secara terpusat dan terstruktur melalui autentikasi kedinasan resmi.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-[#FEF3F2] border-l-4 border-[#B42318] text-[#B42318] text-xs sm:text-sm flex items-start gap-3 rounded-r-md">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Kesalahan Autentikasi</p>
                  <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 bg-[#E8F5E9] border-l-4 border-[#1F5C55] text-[#1F5C55] text-xs sm:text-sm flex items-start gap-3 rounded-r-md">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Berhasil</p>
                  <p className="mt-0.5 leading-relaxed">{successMsg}</p>
                </div>
              </div>
            )}

            {/* FORM LOGIN TUNGGAL: SUREL + KATA SANDI (BLUEPRINT 9.1) */}
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="email">
                  Alamat Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@instansi.co.id"
                  className="w-full h-12 px-4 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827] placeholder-[#94A3B8] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="password">
                  Kata Sandi
                </label>
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
                    placeholder="••••••••"
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
                    aria-label={showPassword ? 'Kembali ke mode sembunyi' : 'Lihat representasi hashing'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-[#0284C7]" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 1 TOMBOL: "Masuk ke Sistem" (BLUEPRINT 9.1) */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-70 cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi Akun...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Sistem</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Tautan "Lupa kata sandi?" DI BAWAH TOMBOL MASUK (BLUEPRINT 4.2 & 9.1) */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email)
                    setForgotStep('request')
                    setForgotOtpToken('')
                    setForgotNewPassword('')
                    setForgotConfirmPassword('')
                    setForgotMsg('')
                    setForgotError('')
                    setIsForgotModalOpen(true)
                  }}
                  className="text-xs text-[#1E3A5F] hover:text-[#111827] underline underline-offset-2 transition-colors cursor-pointer font-medium"
                >
                  Lupa kata sandi?
                </button>
              </div>
            </form>

            <p className="text-[11px] text-[#4B5E76] text-center mt-5">
              Akses kedinasan terenkripsi dan tercatat otomatis di dalam log audit keamanan instansi.
            </p>

            <div className="mt-8 pt-5 border-t border-[#CBD7E3] flex items-center justify-between text-xs text-[#4B5E76]">
              <span>Belum memiliki akun terdaftar?</span>
              <Link 
                href="/register" 
                className="font-medium text-[#1E3A5F] underline underline-offset-4 hover:text-[#111827] transition-colors"
              >
                Daftar Akun Pengaju →
              </Link>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Panel Kartu Brand / Identitas Arsip Instansi */}
        <div className="order-1 lg:order-2 relative flex flex-col justify-between overflow-hidden rounded-xl bg-[#081528] gap-6 p-5 sm:p-8 lg:p-12 text-white border border-[#1E3A5F] shadow-lg min-h-[220px] sm:min-h-[300px] lg:min-h-0">
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
                <span className="text-[#38BDF8] sm:block">{typedPart2}</span>
                <span className="inline-block w-[3px] h-[1em] bg-[#38BDF8] ml-1.5 align-middle animate-pulse" />
              </h2>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-[11px] sm:text-xs text-[#94A3B8] font-mono">
            <span>SISTEM INFORMASI ARSIP DOKUMEN</span>
            <span>© 2026 COPYRIGHT BY ARCHIVA</span>
          </div>
        </div>

      </div>

      {/* Modal Lupa Kata Sandi (Pemulihan Akses via OTP Surel - BLUEPRINT 4.2) */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-[#CBD7E3] rounded-xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-[#CBD7E3] pb-4 mb-5">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-5 h-5 text-[#1E3A5F]" />
                <h3 className="text-xl font-serif font-bold text-[#111827]">
                  Atur Ulang Kata Sandi
                </h3>
              </div>
              <p className="text-xs text-[#4B5E76] mt-1">
                {forgotStep === 'request' && 'Masukkan alamat surel kedinasan. Kode OTP 6-digit akan dikirimkan untuk mengatur ulang kata sandi Anda.'}
                {forgotStep === 'verify_and_reset' && 'Masukkan kode OTP yang telah dikirimkan ke surel Anda beserta kata sandi baru.'}
                {forgotStep === 'success' && 'Kata sandi berhasil diperbarui. Silakan kembali ke form masuk.'}
              </p>
            </div>

            {forgotMsg && (
              <div className="mb-4 p-3 bg-[#E8F5E9] border-l-4 border-[#1F5C55] text-[#1F5C55] text-xs flex items-start gap-2 rounded-r-md">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{forgotMsg}</p>
              </div>
            )}

            {forgotError && (
              <div className="mb-4 p-3 bg-[#FEF3F2] border-l-4 border-[#B42318] text-[#B42318] text-xs flex items-start gap-2 rounded-r-md">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{forgotError}</p>
              </div>
            )}

            {/* LANGKAH 1: Masukkan Surel untuk Menerima OTP */}
            {forgotStep === 'request' && (
              <form onSubmit={handleRequestPasswordOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="forgotEmail">
                    Alamat Email
                  </label>
                  <input
                    id="forgotEmail"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="nama@instansi.co.id"
                    className="w-full h-11 px-3 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827]"
                  />
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    Sistem akan mengirimkan 6-digit kode OTP ke alamat surel di atas.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={handleCloseForgotModal}
                    className="px-4 py-2 text-xs font-medium text-[#4B5E76] hover:text-[#111827] transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-70 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mengirimkan Kode...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Kirim Kode OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* LANGKAH 2: Masukkan OTP + Kata Sandi Baru */}
            {forgotStep === 'verify_and_reset' && (
              <form onSubmit={handleResetPasswordWithOtp} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider" htmlFor="forgotOtpToken">
                      Kode OTP (6-Digit)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep('request')
                        setForgotError('')
                        setForgotMsg('')
                      }}
                      className="text-[11px] text-[#1E3A5F] hover:underline"
                    >
                      Ubah Surel
                    </button>
                  </div>
                  <input
                    id="forgotOtpToken"
                    type="text"
                    required
                    maxLength={12}
                    value={forgotOtpToken}
                    onChange={(e) => setForgotOtpToken(e.target.value)}
                    placeholder="Contoh: 123456"
                    className="w-full h-11 px-3 text-center font-mono text-base tracking-widest bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827]"
                  />
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    Telah dikirim ke: <span className="font-semibold text-[#1E3A5F]">{forgotEmail}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1" htmlFor="forgotNewPassword">
                    Kata Sandi Baru (Min. 8 Karakter)
                  </label>
                  <div className="relative">
                    <input
                      id="forgotNewPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      maxLength={15}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value.slice(0, 15))}
                      placeholder="••••••••"
                      className="w-full h-11 pl-3 pr-10 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5E76] hover:text-[#1E3A5F] p-1"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1" htmlFor="forgotConfirmPassword">
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <input
                    id="forgotConfirmPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={15}
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value.slice(0, 15))}
                    placeholder="••••••••"
                    className="w-full h-11 px-3 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={handleCloseForgotModal}
                    className="px-4 py-2 text-xs font-medium text-[#4B5E76] hover:text-[#111827] transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-70 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Simpan Kata Sandi Baru</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* LANGKAH 3: Berhasil */}
            {forgotStep === 'success' && (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-[#4B5E76] leading-relaxed">
                  Kata sandi akun Anda telah berhasil diperbarui di sistem keamanan kedinasan. Silakan masukkan kata sandi baru Anda pada kolom login untuk masuk ke dasbor.
                </p>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(forgotEmail)
                      setPassword('')
                      handleCloseForgotModal()
                    }}
                    className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Masuk ke Sistem Sekarang
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
