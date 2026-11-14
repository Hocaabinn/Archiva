'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { UserRole } from '@/types'
import {
  Search,
  X,
  Users,
  ShieldCheck,
  ClipboardCheck,
  BadgeCheck,
  UserRound,
  Calculator,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Info,
  Archive,
  Building2,
} from 'lucide-react'

interface Pengguna {
  id: string
  email: string
  nama_lengkap: string | null
  nama: string | null
  nomor_pegawai: string | null
  jabatan: string | null
  role: UserRole
  created_at: string
}

const PERAN: { id: UserRole; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; pill: string }[] = [
  { id: 'superadmin', label: 'Superadmin', desc: 'Maintainer master data, pengguna & pengaturan sistem', icon: ShieldCheck, pill: 'bg-[#EEF0F4] text-[#374151] border-[#D1D5DB]' },
  { id: 'pic_aktif', label: 'PIC Arsip Aktif', desc: 'Entri dokumen unit, edit metadata, serah terima, cetak QR', icon: ClipboardCheck, pill: 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]' },
  { id: 'atasan_aktif', label: 'Atasan Arsip Aktif', desc: 'Persetujuan entri PIC unit, pembatalan dokumen aktif', icon: BadgeCheck, pill: 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]' },
  { id: 'pic_inaktif', label: 'PIC Arsip Inaktif', desc: 'Kelola gudang inaktif, layanan peminjaman inaktif', icon: Archive, pill: 'bg-[#EAF5FD] text-[#1E86C8] border-[#BCE1F9]' },
  { id: 'atasan_inaktif', label: 'Atasan Arsip Inaktif', desc: 'Pengawasan berkas inaktif & kapasitas gudang inaktif', icon: Building2, pill: 'bg-[#F3E8FD] text-[#7E3FBF] border-[#E2CCF9]' },
  { id: 'staff', label: 'Staff', desc: 'Lihat & unduh dokumen saja (tanpa entri/approve)', icon: Eye, pill: 'bg-[#F1F3F4] text-[#5F6368] border-[#DADCE0]' },
]
const peranById = Object.fromEntries(PERAN.map((p) => [p.id, p])) as Record<UserRole, (typeof PERAN)[number]>

const inputClass =
  'w-full rounded-lg border border-[#E3E6F0] bg-white px-3.5 py-2.5 text-sm text-[#1F2333] placeholder:text-[#A5ABBC] focus:border-[#3BA4E8] focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]/15'

function inisial(nama: string) {
  return nama
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function RoleBadge({ role }: { role: UserRole }) {
  const p = peranById[role] || peranById.staff
  const Icon = p.icon
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${p.pill}`}>
      <Icon className="h-3.5 w-3.5" />
      {p.label}
    </span>
  )
}

function KelolaPenggunaContent() {
  const [users, setUsers] = useState<Pengguna[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPeran, setFilterPeran] = useState<'semua' | UserRole>('semua')
  const [editing, setEditing] = useState<Pengguna | null>(null)
  const [peranBaru, setPeranBaru] = useState<UserRole>('staff')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4500)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pengguna')
      const json = await res.json()
      if (res.status === 403) {
        setForbidden(true)
        return
      }
      if (!res.ok) throw new Error(json.error || 'Gagal memuat daftar pengguna')
      setUsers(json.data)
      setCurrentUserId(json.currentUserId)
      setErrorMsg(null)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar pengguna')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c = { semua: users.length } as Record<string, number>
    PERAN.forEach((p) => (c[p.id] = users.filter((u) => u.role === p.id).length))
    return c
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filterPeran !== 'semua' && u.role !== filterPeran) return false
      if (!q) return true
      return [u.nama_lengkap, u.nama, u.email, u.nomor_pegawai, u.jabatan].some((v) => v?.toLowerCase().includes(q))
    })
  }, [users, search, filterPeran])

  const openEdit = (u: Pengguna) => {
    setEditing(u)
    setPeranBaru(u.role)
  }

  const simpanPeran = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/pengguna/${editing.id}/peran`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: peranBaru }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah peran')
      setUsers((prev) => prev.map((u) => (u.id === editing.id ? { ...u, role: peranBaru } : u)))
      showToast('success', `${json.message || 'Peran berhasil diubah.'} Berlaku saat pengguna masuk kembali.`)
      setEditing(null)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengubah peran')
    } finally {
      setSaving(false)
    }
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FDECEC] text-[#D64545]">
          <Lock className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-semibold text-[#1F2333]">Akses ditolak</p>
        <p className="mt-1 text-xs text-[#6B7185]">Halaman Kelola Pengguna hanya dapat diakses oleh Admin Sistem.</p>
      </div>
    )
  }

  const isSelf = editing?.id === currentUserId

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed left-4 right-4 top-20 z-50 flex items-start gap-3 rounded-xl border p-4 shadow-lg sm:left-auto sm:right-6 sm:max-w-md animate-in fade-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success' ? 'border-[#2F9E5B]/30 bg-[#E7F6EC] text-[#1E6B3E]' : 'border-[#D64545]/30 bg-[#FDECEC] text-[#A82828]'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2F9E5B]" /> : <AlertCircle className="h-5 w-5 shrink-0 text-[#D64545]" />}
          <p className="flex-1 text-sm font-medium">{toast.text}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-md p-1 hover:bg-black/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1F2333] sm:text-[28px]">Kelola Pengguna</h1>
        <p className="mt-1 text-sm text-[#4B5163]">
          Atur peran setiap akun. Pendaftar baru otomatis menjadi Staff; perubahan peran berlaku saat pengguna masuk kembali.
        </p>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PERAN.map((p) => {
          const Icon = p.icon
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-[#ECEEF5] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${p.pill}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs text-[#64748B]">{p.label}</p>
                <p className="text-xl font-bold text-[#1F2333]">{loading ? '–' : counts[p.id]}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Daftar */}
      <div className="rounded-xl border border-[#ECEEF5] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="space-y-4 border-b border-[#ECEEF5] p-4 sm:p-5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA0B2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, email, NIP, jabatan..."
              className={`${inputClass} pl-10 pr-9`}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA0B2] hover:text-[#1F2333]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {[{ id: 'semua' as const, label: 'Semua' }, ...PERAN.map((p) => ({ id: p.id, label: p.label }))].map((t) => {
              const active = filterPeran === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterPeran(t.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active ? 'bg-[#3BA4E8] text-white' : 'bg-[#F4F5FA] text-[#4B5163] hover:bg-[#EEF7FD] hover:text-[#1E86C8]'
                  }`}
                >
                  {t.label}
                  <span className={`rounded-md px-1.5 text-xs ${active ? 'bg-white/25' : 'bg-white text-[#6B7185]'}`}>{counts[t.id] ?? 0}</span>
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#6B7185]">
            <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
            <p className="text-sm font-medium">Memuat daftar pengguna...</p>
          </div>
        ) : errorMsg ? (
          <div className="m-4 flex items-start gap-3 rounded-xl border border-[#FDECEC] bg-[#FFF5F5] px-4 py-3 text-sm text-[#D64545] sm:m-5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-20 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF5FD] text-[#3BA4E8]">
              <Users className="h-6 w-6" />
            </span>
            <p className="mt-1 text-sm font-semibold text-[#1F2333]">Tidak ada pengguna</p>
            <p className="text-xs text-[#8A90A2]">Tidak ada pengguna yang cocok dengan filter atau pencarian.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#ECEEF5]">
            {filtered.map((u) => {
              const nama = u.nama_lengkap || u.nama || u.email
              const self = u.id === currentUserId
              return (
                <li key={u.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-[#F7FBFE] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF5FD] text-sm font-semibold text-[#1E86C8]">
                      {inisial(nama)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-[#1F2333]">
                        <span className="truncate">{nama}</span>
                        {self && <span className="shrink-0 rounded-full bg-[#F4F5FA] px-2 py-0.5 text-[10px] font-medium text-[#6B7185]">Anda</span>}
                      </p>
                      <p className="truncate text-xs text-[#6B7185]">{u.email}</p>
                      {(u.jabatan || u.nomor_pegawai) && (
                        <p className="truncate text-xs text-[#9AA0B2]">
                          {u.jabatan}
                          {u.jabatan && u.nomor_pegawai ? ' · ' : ''}
                          {u.nomor_pegawai ? `NIP ${u.nomor_pegawai}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <RoleBadge role={u.role} />
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="rounded-lg border border-[#E3E6F0] bg-white px-3.5 py-1.5 text-sm font-medium text-[#4B5163] transition-colors hover:border-[#3BA4E8] hover:text-[#1E86C8]"
                    >
                      Ubah Peran
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Modal ubah peran */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => !saving && setEditing(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#ECEEF5] p-5">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#1F2333]">Ubah Peran Pengguna</h3>
                <p className="mt-0.5 truncate text-xs text-[#6B7185]">
                  {editing.nama_lengkap || editing.nama || editing.email} · {editing.email}
                </p>
              </div>
              <button type="button" onClick={() => !saving && setEditing(null)} className="rounded-lg p-1.5 text-[#6B7185] hover:bg-[#F4F5FA] hover:text-[#1F2333]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 p-5" role="radiogroup" aria-label="Pilih peran">
              {isSelf && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#FEEFC3] bg-[#FFFBEF] p-3 text-xs text-[#8A5A00]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  Anda tidak dapat mengubah peran akun Anda sendiri.
                </div>
              )}
              {PERAN.map((p) => {
                const Icon = p.icon
                const selected = peranBaru === p.id
                const disabled = isSelf && p.id !== 'superadmin'
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => setPeranBaru(p.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected ? 'border-[#3BA4E8] bg-[#F3FAFF] ring-2 ring-[#3BA4E8]/15' : 'border-[#ECEEF5] hover:border-[#BCE1F9] hover:bg-[#F8FBFE]'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${p.pill}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#1F2333]">
                        {p.label}
                        {editing.role === p.id && <span className="ml-2 text-xs font-normal text-[#9AA0B2]">(saat ini)</span>}
                      </span>
                      <span className="block text-xs text-[#6B7185]">{p.desc}</span>
                    </span>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-[#3BA4E8]' : 'border-[#D5D9E3]'}`}>
                      {selected && <span className="h-2.5 w-2.5 rounded-full bg-[#3BA4E8]" />}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#ECEEF5] p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
                className="rounded-lg border border-[#E3E6F0] bg-white px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F7F8FC]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={saving || peranBaru === editing.role}
                onClick={simpanPeran}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#3BA4E8] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2A92D6] disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan Peran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function KelolaPenggunaPage() {
  return (
    <AppLayout>
      <KelolaPenggunaContent />
    </AppLayout>
  )
}
