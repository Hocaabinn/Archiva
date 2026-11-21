'use client'

import { useState } from 'react'
import { UserRole } from '@/types'

/** Warna cincin + cahaya per role (selaras dengan lencana peran di sidebar). */
const ringColor: Record<UserRole, string> = {
  superadmin: '#64748B',
  pic_aktif: '#137333',
  atasan_aktif: '#B06000',
  pic_inaktif: '#1E86C8',
  atasan_inaktif: '#7E3FBF',
  staff: '#5F6368',
}

interface RoleAvatarProps {
  role: UserRole
  initials: string
  size?: number
  /** Foto kustom (data URL). Bila kosong, pakai video bawaan role. */
  fotoUrl?: string | null
}

/**
 * Foto profil animasi per role (public/pic/profile/<role>.mp4).
 * Cadangan: inisial nama bila video belum termuat / gagal.
 */
export function RoleAvatar({ role, initials, size = 40, fotoUrl }: RoleAvatarProps) {
  const [gagal, setGagal] = useState(false)
  const [siap, setSiap] = useState(false)
  const warna = ringColor[role] || ringColor.staff

  return (
    <div
      className="role-avatar group relative shrink-0"
      style={{ width: size, height: size, ['--ring' as string]: warna }}
      suppressHydrationWarning
    >
      {/* cahaya lembut berdenyut di belakang */}
      <span className="role-avatar-glow absolute -inset-1 rounded-full" aria-hidden />
      <div className="relative h-full w-full overflow-hidden rounded-full bg-white ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-white shadow-sm transition-transform duration-300 ease-out group-hover:scale-110">
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoUrl} alt="Foto profil" className="absolute inset-0 h-full w-full object-cover" />
        ) : !gagal && (
          <video
            key={role}
            src={`/pic/profile/${role}.mp4`}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden
            onLoadedData={() => setSiap(true)}
            onError={() => setGagal(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${siap ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {!fotoUrl && (!siap || gagal) && (
          <span
            className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white"
            style={{ background: warna }}
          >
            {initials || '?'}
          </span>
        )}
      </div>
      {/* titik status daring */}
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#34A853]" aria-hidden />
      <style>{`
        .role-avatar-glow {
          background: var(--ring);
          opacity: .18;
          filter: blur(6px);
          animation: role-avatar-pulse 3s ease-in-out infinite;
        }
        .role-avatar:hover .role-avatar-glow { opacity: .4; }
        @keyframes role-avatar-pulse {
          0%, 100% { transform: scale(.92); opacity: .14; }
          50% { transform: scale(1.12); opacity: .32; }
        }
        @media (prefers-reduced-motion: reduce) {
          .role-avatar-glow { animation: none; }
        }
      `}</style>
    </div>
  )
}
