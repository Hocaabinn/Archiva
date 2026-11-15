'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Waktu timeout: 30 Menit tidak ada aktivitas
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
const STORAGE_KEY = 'archiva_last_active'

export function SessionTimeoutListener() {
  const router = useRouter()
  const pathname = usePathname()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isLoggingOutRef = useRef(false)

  useEffect(() => {
    // Jangan jalankan timer di halaman login, register, atau halaman awal public
    const isPublicPage = pathname === '/login' || pathname === '/register' || pathname === '/'
    if (isPublicPage) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    const supabase = createClient()

    const performLogout = async () => {
      if (isLoggingOutRef.current) return
      isLoggingOutRef.current = true

      try {
        await supabase.auth.signOut()
      } catch (err) {
        console.error('Gagal signOut saat session timeout:', err)
      } finally {
        localStorage.removeItem(STORAGE_KEY)
        // Arahkan ke halaman login dengan query param expired
        router.push('/login?expired=1')
        router.refresh()
      }
    }

    const resetTimer = () => {
      if (isLoggingOutRef.current) return
      const now = Date.now()
      localStorage.setItem(STORAGE_KEY, now.toString())

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        performLogout()
      }, INACTIVITY_TIMEOUT_MS)
    }

    // Periksa apakah waktu timeout sudah terlewati (misal tab baru dibuka setelah lama ditinggalkan)
    const checkExistingTimeout = () => {
      const lastActiveStr = localStorage.getItem(STORAGE_KEY)
      if (lastActiveStr) {
        const lastActive = parseInt(lastActiveStr, 10)
        const elapsed = Date.now() - lastActive
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          performLogout()
          return true
        } else {
          // Jadwalkan sisa waktu
          const remaining = INACTIVITY_TIMEOUT_MS - elapsed
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            performLogout()
          }, remaining)
          return false
        }
      }
      resetTimer()
      return false
    }

    // Inisialisasi awal
    const isTimedOut = checkExistingTimeout()
    if (isTimedOut) return

    // Sinkronisasi lintas tab jika ada aktivitas di tab lain
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const lastActive = parseInt(e.newValue, 10)
        const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActive)
        if (remaining <= 0) {
          performLogout()
        } else {
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            performLogout()
          }, remaining)
        }
      }
    }

    // Event listener interaksi pengguna
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    
    // Throttling pembaruan timestamp agar tidak membebani performa
    let lastThrottled = 0
    const handleUserActivity = () => {
      const now = Date.now()
      if (now - lastThrottled > 2000) {
        lastThrottled = now
        resetTimer()
      }
    }

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true })
    })
    window.addEventListener('storage', handleStorageChange)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity)
      })
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [pathname, router])

  return null
}

