'use client'

import { useRef, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { UserRole } from '@/types'
import { RoleAvatar } from './role-avatar'

interface Props {
  role: UserRole
  initials: string
  userName: string
  fotoUrl: string | null
  onClose: () => void
  onChanged: (url: string | null) => void
}

/** Perkecil ke persegi 256px (potong tengah) lalu jadikan data URL JPEG. */
async function perkecil(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const sisi = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, (bitmap.width - sisi) / 2, (bitmap.height - sisi) / 2, sisi, sisi, 0, 0, 256, 256)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function FotoProfilDialog({ role, initials, userName, fotoUrl, onClose, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)

  async function pilih(file?: File) {
    if (!file) return
    setPesan(null)
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setPesan('Gunakan gambar JPG, PNG, atau WebP.')
    if (file.size > 10 * 1024 * 1024) return setPesan('Ukuran gambar maksimal 10 MB.')
    setSibuk(true)
    try {
      const foto = await perkecil(file)
      const res = await fetch('/api/pengguna/foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan foto.')
      onChanged(json.data.avatar_url)
      onClose()
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal menyimpan foto.')
    } finally {
      setSibuk(false)
    }
  }

  async function hapus() {
    setSibuk(true)
    setPesan(null)
    try {
      const res = await fetch('/api/pengguna/foto', { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus foto.')
      onChanged(null)
      onClose()
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal menghapus foto.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ubah foto profil"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1F2333]">Foto Profil</h2>
            <p className="text-xs text-[#8A90A2]">{userName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-[#6B7185] hover:text-[#1F2333]" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex justify-center py-3">
          <RoleAvatar role={role} initials={initials} size={112} fotoUrl={fotoUrl} />
        </div>
        <p className="mb-5 text-center text-xs text-[#8A90A2]">
          {fotoUrl ? 'Foto kustom' : 'Foto bawaan role'} · JPG, PNG, atau WebP
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            pilih(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={sibuk}
            onClick={() => inputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E86C8] disabled:opacity-60"
          >
            <Camera className="h-4 w-4" />
            {sibuk ? 'Menyimpan...' : 'Pilih foto'}
          </button>
          {fotoUrl && (
            <button
              type="button"
              disabled={sibuk}
              onClick={hapus}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#E3E6F0] px-4 py-2.5 text-sm font-semibold text-[#5F6368] transition hover:bg-[#F8FBFE] disabled:opacity-60"
              title="Kembali ke foto bawaan"
            >
              <Trash2 className="h-4 w-4" />
              Hapus
            </button>
          )}
        </div>
        {pesan && <p className="mt-3 text-xs text-[#C5221F]">{pesan}</p>}
      </div>
    </div>
  )
}
