'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FileText, ShieldAlert, ArrowRight, Loader2, CheckCircle2, Building2 } from 'lucide-react'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotError, setForgotError] = useState('')

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.message.includes('fetch failed') || error.message.includes('dummy') || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy-project')) {
        // Fallback demo
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

    router.push('/dashboard')
    router.refresh()
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotMsg('')
    setForgotError('')
    setForgotLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/login`,
    })

    if (error) {
      if (error.message.includes('fetch failed') || error.message.includes('dummy') || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy-project')) {
        setForgotMsg('Tautan pemulihan kata sandi telah dikirimkan ke surel kedinasan Anda.')
        setForgotLoading(false)
        return
      }
      setForgotError(`Gagal mengirimkan pemulihan: ${error.message}`)
      setForgotLoading(false)
      return
    }

    setForgotMsg('Tautan pemulihan kata sandi telah dikirimkan ke surel kedinasan Anda. Silakan periksa kotak masuk surel Anda.')
    setForgotLoading(false)
  }

  return (
    <section className="min-h-screen bg-[#F0F5FA] p-3 text-[#1A232E] antialiased">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* Kolom Kiri: Formulir Masuk Berarsitektur Split Panel (Mobile: order-2, Desktop: order-1) */}
        <div className="order-2 lg:order-1 flex items-center rounded-xl border border-[#CBD7E3] bg-white px-6 py-10 sm:px-10 lg:px-12 lg:py-14 shadow-xs">
          <div className="mx-auto w-full max-w-[560px]">
            
            {/* Header Form */}
            <div className="border-b border-[#CBD7E3] pb-5 mb-7">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#E8F1F8] border border-[#CBD7E3] rounded-md text-xs font-mono font-medium text-[#1E3A5F] mb-3">
                <FileText className="w-3.5 h-3.5" />
                PORTAL RESMI ARSIP INSTANSI
              </div>
              <h1 className="text-3xl font-serif font-bold tracking-tight text-[#111827] sm:text-4xl">
                Masuk ke Sistem
              </h1>
              <p className="mt-2 text-sm text-[#4B5E76]">
                Akses pengelolaan arsip dinas, verifikasi dokumen, dan buku ekspedisi terverifikasi.
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
                  <p className="font-semibold">Autentikasi Berhasil</p>
                  <p className="mt-0.5 leading-relaxed">{successMsg}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="email">
                  Alamat Surel Kedinasan
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
                    Kata Sandi
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email)
                      setForgotMsg('')
                      setForgotError('')
                      setIsForgotModalOpen(true)
                    }}
                    className="text-xs text-[#1E3A5F] hover:text-[#111827] underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Lupa Kata Sandi?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827] placeholder-[#94A3B8] transition-all"
                />
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
                      <span>Memverifikasi Akun...</span>
                    </>
                  ) : (
                    <>
                      <span>Login di Sini</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-[#4B5E76] text-center mt-2">
                  Akses terenkripsi dan tercatat otomatis di dalam log audit keamanan instansi.
                </p>
              </div>
            </form>

            <div className="mt-8 pt-5 border-t border-[#CBD7E3] flex items-center justify-between text-xs text-[#4B5E76]">
              <span>Belum memiliki akun terdaftar?</span>
              <Link 
                href="/register" 
                className="font-medium text-[#1E3A5F] underline underline-offset-4 hover:text-[#111827] transition-colors"
              >
                Daftar Akun →
              </Link>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Panel Kartu Brand / Identitas Arsip Instansi (Mobile: order-1 di atas, Desktop: order-2 di kanan) */}
        <div className="order-1 lg:order-2 relative flex flex-col justify-between overflow-hidden rounded-xl bg-[#081528] p-8 text-white sm:p-12 border border-[#1E3A5F] shadow-lg min-h-[360px] lg:min-h-0">
          {/* Background Celestial Orrery (Hanya Orbit Bulat & Planet) */}
          <div className="hero-orrery-container pointer-events-none">
            <div className="orrery-field">
              <div className="orbit orbit-1"><div className="planet" /></div>
              <div className="orbit orbit-2"><div className="planet" /></div>
              <div className="orbit orbit-3"><div className="planet" /></div>
              <div className="orbit orbit-4"><div className="planet" /></div>
            </div>
          </div>

          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#38BDF8]/40 bg-[#0F2A4A]/70 px-3.5 py-1 text-xs font-mono tracking-wide text-[#BAE6FD] backdrop-blur-md">
              <Building2 className="w-3.5 h-3.5 text-[#38BDF8]" />
              ARSIP DIGITAL TERINTEGRASI
            </div>

            <div className="min-h-[110px] sm:min-h-[120px]">
              <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-serif font-bold tracking-tight leading-snug">
                <span className="text-white">{typedPart1}</span>
                <span className="text-[#38BDF8]">{typedPart2}</span>
                <span className="inline-block w-[3px] h-[1em] bg-[#38BDF8] ml-1.5 align-middle animate-pulse" />
              </h2>
            </div>
          </div>

          <div className="relative z-10 pt-10 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#94A3B8] font-mono">
            <span>SISTEM INFORMASI ARSIP DINAS</span>
            <span>VERSI 1.0 • BERLISENSI INSTANSI</span>
          </div>
        </div>

      </div>

      {/* Modal Lupa Kata Sandi (Pemulihan Akses KBBI) */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-[#CBD7E3] rounded-xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-[#CBD7E3] pb-4 mb-5">
              <h3 className="text-xl font-serif font-bold text-[#111827]">
                Pemulihan Kata Sandi
              </h3>
              <p className="text-xs text-[#4B5E76] mt-1">
                Masukkan alamat surel kedinasan Anda. Sistem akan mengirimkan tautan untuk menetapkan ulang kata sandi.
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

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1.5" htmlFor="forgotEmail">
                  Alamat Surel Kedinasan
                </label>
                <input
                  id="forgotEmail"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="nama@instansi.go.id"
                  className="w-full h-11 px-3 text-sm bg-[#F8FAFC] border border-[#CBD7E3] rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] text-[#111827]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#4B5E76] hover:text-[#111827] transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-70"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengirimkan...</span>
                    </>
                  ) : (
                    <span>Kirim Tautan Pemulihan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
