'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Inbox, Loader2, X } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Notifikasi } from '@/types'

const BATAS = 20

function waktuRelatif(iso: string) {
  const menit = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (menit < 1) return 'Baru saja'
  if (menit < 60) return `${menit} mnt lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.floor(jam / 24)
  if (hari === 1) return 'Kemarin'
  if (hari < 7) return `${hari} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Lonceng notifikasi di bar atas. Membaca tabel `notifikasi` milik pengguna yang login
 * (dibatasi RLS: user_id = auth.uid()), menandai dibaca, dan ikut terbarui otomatis
 * lewat Supabase Realtime dengan cadangan polling 30 detik.
 */
export function NotificationBell({ supabase }: { supabase: SupabaseClient }) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<Notifikasi[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (uid: string) => {
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from('notifikasi')
        .select('id, user_id, judul, isi, dokumen_id, dibaca, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(BATAS),
      supabase
        .from('notifikasi')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('dibaca', false),
    ])
    setItems((data as Notifikasi[]) || [])
    setUnread(count ?? 0)
    setLoading(false)
  }, [supabase])

  // Ambil pengguna lalu muat notifikasi + langganan realtime
  useEffect(() => {
    let active = true
    let cleanup: (() => void) | undefined

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return
      if (!user) {
        setLoading(false)
        return
      }
      setUserId(user.id)
      load(user.id)

      const channel = supabase
        .channel(`notifikasi-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifikasi', filter: `user_id=eq.${user.id}` },
          () => load(user.id),
        )
        .subscribe()

      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') load(user.id)
      }, 30_000)
      const onVisible = () => {
        if (document.visibilityState === 'visible') load(user.id)
      }
      document.addEventListener('visibilitychange', onVisible)

      cleanup = () => {
        clearInterval(interval)
        document.removeEventListener('visibilitychange', onVisible)
        supabase.removeChannel(channel)
      }
    })

    return () => {
      active = false
      cleanup?.()
    }
  }, [supabase, load])

  // Tutup saat klik di luar / tekan Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && userId) load(userId)
  }

  const markRead = async (n: Notifikasi) => {
    if (!n.dibaca) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, dibaca: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
      await supabase.from('notifikasi').update({ dibaca: true }).eq('id', n.id)
    }
    if (n.dokumen_id) {
      setOpen(false)
      router.push(`/dokumen/${n.dokumen_id}`)
    }
  }

  const markAllRead = async () => {
    if (!userId || unread === 0) return
    setItems((prev) => prev.map((x) => ({ ...x, dibaca: true })))
    setUnread(0)
    await supabase.from('notifikasi').update({ dibaca: true }).eq('user_id', userId).eq('dibaca', false)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={toggle}
        className={`relative rounded-lg p-1.5 transition-colors ${
          open ? 'bg-[#EAF5FD] text-[#1E86C8]' : 'text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1F2333]'
        }`}
        title="Notifikasi"
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E5484D] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[68px] z-50 overflow-hidden rounded-xl border border-[#ECEEF5] bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between gap-2 border-b border-[#ECEEF5] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#1F2333]">Notifikasi</p>
              <p className="text-xs text-[#8A90A2]">
                {unread > 0 ? `${unread} belum dibaca` : 'Semua sudah dibaca'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#1E86C8] hover:bg-[#EAF5FD] disabled:cursor-default disabled:text-[#B5BACB] disabled:hover:bg-transparent"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai dibaca
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-[#8A90A2] hover:bg-[#F4F5FA] sm:hidden"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto sm:max-h-[420px]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#8A90A2]">
                <Loader2 className="h-4 w-4 animate-spin text-[#3BA4E8]" />
                Memuat notifikasi...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF5FD] text-[#3BA4E8]">
                  <Inbox className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-[#1F2333]">Belum ada notifikasi</p>
                <p className="text-xs text-[#8A90A2]">Pemberitahuan persetujuan, serah terima, dan kadaluarsa akan muncul di sini.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F1F3F8]">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => markRead(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F7FBFE] ${
                        n.dibaca ? '' : 'bg-[#F3FAFF]'
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.dibaca ? 'bg-transparent' : 'bg-[#3BA4E8]'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.dibaca ? 'text-[#4B5163]' : 'font-semibold text-[#1F2333]'}`}>
                          {n.judul}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-[#6B7185]">{n.isi}</span>
                        <span className="mt-1 block text-[11px] text-[#9AA0B2]">{waktuRelatif(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
