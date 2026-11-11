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
  PanelLeftClose,
  PanelLeftOpen,
  MoreVertical,
  Menu,
  X,
  ShieldCheck,
  ClipboardCheck,
  BadgeCheck,
  UserRound,
  Calculator,
  Eye,
} from 'lucide-react'
import { UserRole } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from './notification-bell'

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

const roleBadgeStyles: Record<UserRole, { icon: React.ComponentType<{ className?: string }>; pill: string; iconBox: string }> = {
  admin: { icon: ShieldCheck, pill: 'bg-[#EEF0F4] text-[#374151] border-[#D1D5DB]', iconBox: 'bg-[#374151] text-white' },
  pic_arsip: { icon: ClipboardCheck, pill: 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]', iconBox: 'bg-[#34A853] text-white' },
  atasan: { icon: BadgeCheck, pill: 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]', iconBox: 'bg-[#F29900] text-white' },
  user: { icon: UserRound, pill: 'bg-[#EAF5FD] text-[#1E86C8] border-[#BCE1F9]', iconBox: 'bg-[#3BA4E8] text-white' },
  accounting: { icon: Calculator, pill: 'bg-[#F3E8FD] text-[#7E3FBF] border-[#E2CCF9]', iconBox: 'bg-[#9D5CE0] text-white' },
  viewer: { icon: Eye, pill: 'bg-[#F1F3F4] text-[#5F6368] border-[#DADCE0]', iconBox: 'bg-[#80868B] text-white' },
}

/** Kartu identitas workspace + lencana peran aktif di sidebar. */
function RoleCard({ role, roleTitle, compact = false }: { role: UserRole; roleTitle: string; compact?: boolean }) {
  const style = roleBadgeStyles[role] || roleBadgeStyles.user
  const Icon = style.icon
  if (compact) {
    return (
      <div className="flex justify-center pt-4" title={`Arsip Instansi — ${roleTitle}`}>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg shadow-sm ${style.iconBox}`} suppressHydrationWarning>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#ECEEF5] bg-[#F8FBFE] p-2.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ${style.iconBox}`} suppressHydrationWarning>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-tight text-[#1F2333]">Arsip Instansi</p>
        <span
          className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.pill}`}
          suppressHydrationWarning
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          <span className="truncate">{roleTitle}</span>
        </span>
      </div>
    </div>
  )
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Otomatis tutup menu mobile saat rute berpindah
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

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
        {/* ================= DRAWER MOBILE ================= */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-10 shadow-2xl">
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#ECEEF5]">
                <Image
                  src="/pic/Logo-gabungan-gelap.png"
                  alt="Archiva"
                  width={838}
                  height={132}
                  priority
                  className="h-6 w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg border border-[#E3E6F0] text-[#6B7185] hover:text-[#1F2333] hover:bg-[#EEF7FD]"
                  title="Tutup menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-4 pt-4 pb-3">
                <RoleCard role={currentRole} roleTitle={roleTitle} />
              </div>

              <nav className="px-3 pb-4 space-y-1 flex-1 overflow-y-auto">
                {accessibleNavs.map((item) => {
                  const Icon = item.icon
                  if (item.children) {
                    const isChildActive = item.children.some((child) => pathname === child.href)
                    return (
                      <div key={item.label} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setIsKatalogOpen((prev) => !prev)}
                          className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            isChildActive
                              ? 'text-[#1E86C8] bg-[#EAF5FD]'
                              : 'text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1F2333]'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <Icon className="w-[18px] h-[18px] shrink-0" />
                            <span>{item.label}</span>
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${isKatalogOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {isKatalogOpen && (
                          <div className="ml-[22px] pl-4 border-l border-[#E3E6F0] space-y-0.5 py-1">
                            {item.children.map((subItem) => {
                              const isSubActive = pathname === subItem.href
                              return (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  onClick={() => setIsMobileMenuOpen(false)}
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
                    <Link
                      key={item.href}
                      href={item.href!}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#3BA4E8] text-white shadow-sm shadow-[#3BA4E8]/30'
                          : 'text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1F2333]'
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>

              <div className="px-3 py-4 border-t border-[#ECEEF5] space-y-1">
                {currentRole === 'admin' && (
                  <Link
                    href="/pengaturan/pengguna"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      pathname.startsWith('/pengaturan')
                        ? 'bg-[#3BA4E8] text-white'
                        : 'text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1F2333]'
                    }`}
                  >
                    <Settings className="w-[18px] h-[18px] shrink-0" />
                    <span>Pengaturan</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1F2333] disabled:opacity-50"
                >
                  <LogOut className="w-[18px] h-[18px] shrink-0" />
                  <span>{isLoggingOut ? 'Mengakhiri Sesi...' : 'Keluar'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SIDEBAR DESKTOP ================= */}
        <aside
          className={`hidden md:flex md:flex-col ${isCollapsed ? 'md:w-20' : 'md:w-64'} bg-white shrink-0 border-r border-[#ECEEF5] md:sticky md:top-0 md:h-screen transition-[width] duration-200`}
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
          {isCollapsed ? (
            <RoleCard role={currentRole} roleTitle={roleTitle} compact />
          ) : (
            <div className="px-4 pt-4 pb-3">
              <RoleCard role={currentRole} roleTitle={roleTitle} />
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
              title="Keluar"
              className={`w-full ${navLinkClass(false)} disabled:opacity-50`}
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              {!isCollapsed && <span>{isLoggingOut ? 'Mengakhiri Sesi...' : 'Keluar'}</span>}
            </button>
          </div>
        </aside>

        {/* ================= KONTEN ================= */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-16 bg-white border-b border-[#ECEEF5] px-4 sm:px-8 flex items-center justify-between gap-3 md:sticky md:top-0 z-20">
            {/* Pencarian hanya ada di halaman Daftar Dokumen (Blueprint 3.7), bukan di bar atas */}
            <div className="flex items-center gap-2.5 min-w-0 md:hidden">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 rounded-lg text-[#4B5163] hover:text-[#1F2333] hover:bg-[#EEF7FD]"
                title="Buka menu navigasi"
              >
                <Menu className="w-5 h-5" />
              </button>
              <Image
                src="/pic/Logo-gabungan-gelap.png"
                alt="Archiva"
                width={838}
                height={132}
                className="h-5 w-auto object-contain"
              />
            </div>
            <div className="hidden md:block" />

            <div className="flex items-center gap-4 shrink-0">
              <NotificationBell supabase={supabase} />
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
