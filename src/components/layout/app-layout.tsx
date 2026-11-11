'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderArchive,
  BookOpenCheck,
  History,
  Settings,
  LogOut,
  ChevronDown,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  MoreVertical,
} from 'lucide-react'
import { UserRole } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface SubNavItem {
  label: string
  href: string
  roles: UserRole[]
}

interface NavItem {
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
  children?: SubNavItem[]
}

interface AppLayoutProps {
  children: React.ReactNode
  currentRole?: UserRole
}

interface AppUser {
  name: string
  role: UserRole
  roleTitle: string
}

const roleTitles: Record<UserRole, string> = {
  admin: 'Admin Sistem',
  pic_arsip: 'PIC Arsip',
  atasan: 'Atasan',
  user: 'Pengaju',
  accounting: 'Accounting',
  viewer: 'Viewer',
}

const AppUserContext = createContext<AppUser>({
  name: 'Pengguna',
  role: 'user',
  roleTitle: roleTitles.user,
})

/** Data pengguna yang sedang login, tersedia untuk semua halaman di dalam AppLayout. */
export function useAppUser() {
  return useContext(AppUserContext)
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export function AppLayout({ children, currentRole: initialRole }: AppLayoutProps) {
  const pathname = usePathname()
  const [supabase] = useState(() => createClient())

  const [profileRole, setProfileRole] = useState<UserRole>('user')
  const currentRole: UserRole = initialRole || profileRole
  const [userName, setUserName] = useState<string>('Memuat...')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isKatalogOpen, setIsKatalogOpen] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Baca cache dari localStorage setelah mount di client agar tidak menyebabkan hydration mismatch SSR
  useEffect(() => {
    const savedRole = localStorage.getItem('archiva_user_role') as UserRole | null
    if (savedRole) setProfileRole(savedRole)
    const savedName = localStorage.getItem('archiva_user_name')
    if (savedName) setUserName(savedName)
  }, [])

  useEffect(() => {
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
            const role = (profile.role as UserRole) || 'user'
            const name = profile.nama_lengkap || user.email?.split('@')[0] || 'Pengguna'
            setProfileRole(role)
            setUserName(name)
            if (typeof window !== 'undefined') {
              localStorage.setItem('archiva_user_role', role)
              localStorage.setItem('archiva_user_name', name)
            }
          } else {
            const name = user.email?.split('@')[0] || 'Pengguna'
            setUserName(name)
            if (typeof window !== 'undefined') {
              localStorage.setItem('archiva_user_name', name)
            }
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
      if (typeof window !== 'undefined') {
        localStorage.removeItem('archiva_user_role')
        localStorage.removeItem('archiva_user_name')
      }
      window.location.href = '/login'
    }
  }

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'pic_arsip', 'atasan', 'user', 'accounting', 'viewer'],
    },
    {
      label: 'Katalog Dokumen',
      icon: FolderArchive,
      roles: ['admin', 'pic_arsip', 'atasan', 'user', 'accounting', 'viewer'],
      children: [
        { label: 'Daftar Dokumen', href: '/dokumen', roles: ['admin', 'pic_arsip', 'atasan', 'user', 'accounting', 'viewer'] },
        { label: 'Verifikasi Dokumen', href: '/persetujuan', roles: ['admin', 'pic_arsip', 'atasan'] },
        { label: 'Penyimpanan Dokumen', href: '/serah-terima', roles: ['admin', 'pic_arsip', 'user'] },
      ],
    },
    {
      label: 'Peminjaman Inaktif',
      href: '/peminjaman',
      icon: BookOpenCheck,
      roles: ['admin', 'pic_arsip', 'user', 'atasan', 'accounting'],
    },
    {
      label: 'Buku Log Riwayat',
      href: '/riwayat',
      icon: History,
      roles: ['admin', 'pic_arsip', 'atasan', 'accounting'],
    },
  ]

  const accessibleNavs = navItems
    .map((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter((child) => child.roles.includes(currentRole))
        if (filteredChildren.length === 0) return null
        return { ...item, children: filteredChildren }
      }
      return item.roles.includes(currentRole) ? item : null
    })
    .filter(Boolean) as NavItem[]

  const roleTitle = roleTitles[currentRole] || currentRole

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-[#3BA4E8] text-white shadow-sm shadow-[#3BA4E8]/30'
        : 'text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1F2333]'
    } ${isCollapsed ? 'md:justify-center md:px-0' : ''}`

  return (
    <AppUserContext.Provider value={{ name: userName, role: currentRole, roleTitle }}>
      <div className="min-h-screen flex flex-col md:flex-row bg-[#F7F8FC] text-[#1F2333]">
        {/* ================= SIDEBAR ================= */}
        <aside
          className={`w-full ${isCollapsed ? 'md:w-20' : 'md:w-64'} bg-white flex flex-col shrink-0 border-r border-[#ECEEF5] md:sticky md:top-0 md:h-screen transition-[width] duration-200`}
        >
          {/* Brand */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-[#ECEEF5]">
            {!isCollapsed && (
              <Image
                src="/pic/Logo-gabungan-gelap.png"
                alt="Archiva"
                width={838}
                height={132}
                priority
                className="h-6 w-auto object-contain"
              />
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              className="hidden md:inline-flex p-1.5 rounded-md border border-[#E3E6F0] text-[#6B7185] hover:text-[#1F2333] hover:bg-[#EEF7FD] transition-colors mx-auto md:mx-0"
              title={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* Workspace / Peran aktif */}
          {!isCollapsed && (
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between rounded-lg px-1 py-1">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[#1F2333] truncate">Arsip Instansi</p>
                  <p className="text-xs text-[#8A90A2] truncate" suppressHydrationWarning>{roleTitle}</p>
                </div>
                <ChevronsUpDown className="w-4 h-4 text-[#6B7185] shrink-0" />
              </div>
            </div>
          )}

          {/* Navigasi utama */}
          <nav className={`px-3 pb-4 space-y-1 flex-1 overflow-y-auto ${isCollapsed ? 'pt-4' : ''}`}>
            {accessibleNavs.map((item) => {
              const Icon = item.icon

              if (item.children) {
                const isChildActive = item.children.some((child) => pathname === child.href)
                return (
                  <div key={item.label} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsKatalogOpen((prev) => !prev)}
                      title={item.label}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isChildActive
                          ? 'text-[#1E86C8] bg-[#EAF5FD]'
                          : 'text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1F2333]'
                      } ${isCollapsed ? 'md:justify-center md:px-0' : ''}`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </span>
                      {!isCollapsed && (
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${isKatalogOpen ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>
                    {isKatalogOpen && !isCollapsed && (
                      <div className="ml-[22px] pl-4 border-l border-[#E3E6F0] space-y-0.5 py-1">
                        {item.children.map((subItem) => {
                          const isSubActive = pathname === subItem.href
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                                isSubActive
                                  ? 'bg-[#3BA4E8] text-white'
                                  : 'text-[#6B7185] hover:text-[#1F2333] hover:bg-[#EEF7FD]'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isSubActive ? 'bg-white' : 'bg-[#C3C8D8]'
                                }`}
                              />
                              <span>{subItem.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href!} title={item.label} className={navLinkClass(isActive)}>
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </nav>

          {/* Bagian bawah sidebar */}
          <div className="px-3 py-4 border-t border-[#ECEEF5] space-y-1">
            {currentRole === 'admin' && (
              <Link
                href="/pengaturan/pengguna"
                title="Pengaturan Sistem"
                className={navLinkClass(pathname.startsWith('/pengaturan'))}
              >
                <Settings className="w-[18px] h-[18px] shrink-0" />
                {!isCollapsed && <span>Pengaturan</span>}
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Keluar Sesi"
              className={`w-full ${navLinkClass(false)} disabled:opacity-50`}
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              {!isCollapsed && <span>{isLoggingOut ? 'Mengakhiri Sesi...' : 'Keluar Sesi'}</span>}
            </button>
          </div>
        </aside>

        {/* ================= KONTEN ================= */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-16 bg-white border-b border-[#ECEEF5] px-4 sm:px-8 flex items-center justify-between gap-4 md:sticky md:top-0 z-20">
            <div className="relative w-full max-w-xs">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA0B2]" />
              <input
                type="search"
                placeholder="Cari dokumen, kode arsip, dll..."
                className="w-full rounded-lg border border-[#E3E6F0] bg-white pl-10 pr-3 py-2 text-sm placeholder:text-[#A5ABBC] focus:outline-none focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/15 transition"
              />
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <button
                type="button"
                className="relative p-1.5 text-[#4B5163] hover:text-[#1F2333] transition-colors"
                title="Notifikasi"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#E5484D] ring-2 ring-white" />
              </button>
              <span className="hidden sm:block w-px h-7 bg-[#E3E6F0]" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#3BA4E8] text-white text-sm font-semibold flex items-center justify-center" suppressHydrationWarning>
                  {getInitials(userName) || '?'}
                </div>
                <div className="hidden sm:block leading-tight" suppressHydrationWarning>
                  <p className="text-sm font-semibold text-[#1F2333] max-w-[160px] truncate" suppressHydrationWarning>{userName}</p>
                  <p className="text-xs text-[#8A90A2]" suppressHydrationWarning>{roleTitle}</p>
                </div>
              </div>
              <button type="button" className="p-1 text-[#6B7185] hover:text-[#1F2333]" title="Menu lainnya">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8 flex-1">{children}</main>
        </div>
      </div>
    </AppUserContext.Provider>
  )
}
