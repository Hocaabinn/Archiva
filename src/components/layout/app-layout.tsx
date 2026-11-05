'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { 
  FileText, 
  FolderArchive, 
  CheckSquare, 
  QrCode, 
  CreditCard, 
  History, 
  Settings, 
  LogOut,
  UserCheck
} from 'lucide-react'
import { UserRole } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface AppLayoutProps {
  children: React.ReactNode
  currentRole?: UserRole
}

export function AppLayout({ children, currentRole: initialRole }: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [currentRole, setCurrentRole] = useState<UserRole>(initialRole || 'user')
  const [userName, setUserName] = useState<string>('Memuat...')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (initialRole) {
      setCurrentRole(initialRole)
    }

    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nama_lengkap, role')
            .eq('id', user.id)
            .single()

          if (profile) {
            if (!initialRole) {
              setCurrentRole((profile.role as UserRole) || 'user')
            }
            setUserName(profile.nama_lengkap || user.email?.split('@')[0] || 'Pengguna')
          } else {
            setUserName(user.email?.split('@')[0] || 'Pengguna')
          }
        } else {
          setUserName('Tamu')
        }
      } catch (err) {
        console.error('Error fetching user profile:', err)
      }
    }

    loadUser()
  }, [initialRole, supabase])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      window.location.href = '/login'
    }
  }

  const roleLabels: Record<UserRole, { title: string; color: string }> = {
    admin: { title: 'Admin Sistem', color: 'bg-red-800 text-white' },
    pic_arsip: { title: 'PIC Arsip', color: 'bg-[#1F5C55] text-white' },
    atasan: { title: 'Atasan / Approval', color: 'bg-[#9A6700] text-white' },
    user: { title: 'Pengaju (User)', color: 'bg-[#1E2429] text-white' },
    accounting: { title: 'Accounting', color: 'bg-emerald-800 text-white' },
    viewer: { title: 'Viewer (Hanya Lihat)', color: 'bg-stone-600 text-white' },
  }

  const navItems = [
    { label: 'Meja Kerja (Ringkasan)', href: '/dashboard', icon: FileText, roles: ['admin', 'pic_arsip', 'atasan', 'user', 'accounting', 'viewer'] },
    { label: 'Katalog Dokumen', href: '/dokumen', icon: FolderArchive, roles: ['admin', 'pic_arsip', 'atasan', 'user', 'accounting', 'viewer'] },
    { label: 'Antrean Persetujuan', href: '/persetujuan', icon: CheckSquare, roles: ['admin', 'pic_arsip', 'atasan'] },
    { label: 'Serah Terima (Scan)', href: '/serah-terima', icon: QrCode, roles: ['admin', 'pic_arsip', 'user'] },
    { label: 'Kas & Pembayaran', href: '/pembayaran', icon: CreditCard, roles: ['admin', 'pic_arsip', 'accounting', 'user'] },
    { label: 'Buku Log Riwayat', href: '/riwayat', icon: History, roles: ['admin', 'pic_arsip', 'atasan', 'accounting'] },
    { label: 'Pengaturan Sistem', href: '/pengaturan/pengguna', icon: Settings, roles: ['admin'] },
  ]

  const accessibleNavs = navItems.filter(item => item.roles.includes(currentRole))

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F7F3EB]">
      {/* Sidebar Anti-Slop (Tema Berkas Arsip Klasik Tegas) */}
      <aside className="w-full md:w-64 bg-[#1E2429] text-[#F7F3EB] flex flex-col shrink-0 border-r border-[#D8D2C4]">
        {/* Brand Header */}
        <div className="p-4 border-b border-[#2D353C] flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <Image
              src="/pic/logo_gabungan.png"
              alt="Archiva"
              width={1019}
              height={245}
              priority
              className="h-13 sm:h-14 w-auto -ml-1 object-contain"
            />
            <span className="font-mono text-[10px] text-[#8C9399] tracking-wider uppercase">
              v1.0 • Standar 3 Thn
            </span>
          </div>
        </div>

        {/* Info Pemegang Sesi */}
        <div className="p-3.5 bg-[#171C20] border-b border-[#2D353C] text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#8C9399] font-mono text-[10px] uppercase">Akses Peran:</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-none uppercase ${roleLabels[currentRole]?.color || 'bg-stone-600 text-white'}`}>
              {roleLabels[currentRole]?.title || currentRole}
            </span>
          </div>
          <div className="flex items-center gap-2 text-stone-200 mt-1">
            <UserCheck className="w-3.5 h-3.5 text-[#8C9399]" />
            <span className="truncate font-medium">{userName}</span>
          </div>
        </div>

        {/* Navigasi Kerja */}
        <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
          {accessibleNavs.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#F7F3EB] text-[#1E2429] font-semibold'
                    : 'text-[#D8D2C4] hover:bg-[#2D353C] hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#1E2429]' : 'text-[#8C9399]'}`} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-3 border-t border-[#2D353C] text-xs">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-stone-400 hover:text-white hover:bg-[#2D353C] text-left transition-colors font-medium disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? 'Mengakhiri Sesi...' : 'Keluar Sesi'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Arsip */}
        <header className="bg-white border-b border-[#D8D2C4] px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 bg-[#F7F3EB] border border-[#D8D2C4] text-[#1A1D21]">
              INSTANSI ARSIP NASIONAL
            </span>
            <span className="hidden sm:inline text-xs text-[#5B6166]">
              • Ruang Simpan Aktif & Inaktif
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#5B6166] font-mono hidden sm:inline">
              3 Nov 2026
            </span>
            <Link
              href="/dokumen/upload"
              className="px-3 py-1.5 bg-[#1F5C55] hover:bg-[#184843] text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <span>+ Upload Dokumen</span>
            </Link>
          </div>
        </header>

        {/* Konten Halaman */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
