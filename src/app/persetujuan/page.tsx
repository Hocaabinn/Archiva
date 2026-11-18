'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { UserRole } from '@/types'
import {
  Search,
  X,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  User,
  MapPin,
  Building2,
  Check,
  Inbox,
  Loader2,
  Calendar,
  Layers,
  AlertCircle,
  Clock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'

interface VerificationDoc {
  id: string
  kode_arsip: string
  nomor_dokumen: string | null
  nomor_ppl: string | null
  judul: string
  kategori_nama: string
  pengaju_nama: string
  tanggal_dokumen: string
  created_at: string
  lokasi_saat_ini: string
  ukuran_file: number | null
  jumlah_halaman: number | null
  unit_id: string | null
  unit_nama: string | null
}

function VerifikasiContent() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('staff')
  const [currentUnitId, setCurrentUnitId] = useState<string | null>(null)
  const [currentUnitNama, setCurrentUnitNama] = useState<string>('Keuangan')
  const [items, setItems] = useState<VerificationDoc[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [processed, setProcessed] = useState({ disahkan: 0, ditolak: 0 })

  // Modal Aksi
  const [modalAction, setModalAction] = useState<{
    item: VerificationDoc
    type: 'approve' | 'reject'
  } | null>(null)
  const [alasan, setAlasan] = useState('')
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'reject'; text: string } | null>(null)

  const showToast = (type: 'success' | 'reject', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  // Load Dokumen dari Supabase Live
  const fetchPendingDocs = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let userRole: UserRole = 'staff'
      let unitId: string | null = null

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, unit_id, unit:unit_organisasi(id, nama)')
          .eq('id', user.id)
          .single()

        if (profile?.role) {
          userRole = profile.role as UserRole
          setCurrentUserRole(userRole)
        }
        if (profile?.unit_id) {
          unitId = profile.unit_id
          setCurrentUnitId(unitId)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = profile?.unit as any
        if (u?.nama) {
          setCurrentUnitNama(u.nama)
        }
      }

      // Query dokumen status 'menunggu_persetujuan'
      let query = supabase
        .from('dokumen')
        .select(`
          id,
          kode_arsip,
          nomor_dokumen,
          nomor_ppl,
          judul,
          tanggal_dokumen,
          created_at,
          lokasi_saat_ini,
          ukuran_file,
          jumlah_halaman,
          unit_id,
          kategori_dokumen:kategori_id(nama),
          unit:unit_id(id, nama),
          pengaju:pemilik_id(nama_lengkap, email)
        `)
        .eq('status', 'menunggu_persetujuan')
        .order('created_at', { ascending: false })

      // Jika role adalah atasan_aktif (bukan superadmin), filter dokumen hanya untuk unit kerjanya
      if (userRole === 'atasan_aktif' && unitId) {
        query = query.eq('unit_id', unitId)
      }

      const { data, error } = await query

      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: VerificationDoc[] = (data || []).map((d: any) => ({
        id: d.id,
        kode_arsip: d.kode_arsip,
        nomor_dokumen: d.nomor_dokumen || null,
        nomor_ppl: d.nomor_ppl || null,
        judul: d.judul,
        kategori_nama: d.kategori_dokumen?.nama || 'Umum',
        pengaju_nama: d.pengaju?.nama_lengkap || d.pengaju?.email || 'PIC Arsip Aktif',
        tanggal_dokumen: d.tanggal_dokumen,
        created_at: d.created_at,
        lokasi_saat_ini: d.lokasi_saat_ini || 'Unit Pengolah',
        ukuran_file: d.ukuran_file,
        jumlah_halaman: d.jumlah_halaman || 1,
        unit_id: d.unit_id,
        unit_nama: d.unit?.nama || 'Unit Kerja',
      }))

      setItems(mapped)
    } catch (err: unknown) {
      console.error('Gagal mengambil daftar dokumen menunggu persetujuan:', err)
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      showToast('reject', msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingDocs()
  }, [fetchPendingDocs])

  // Filter pencarian
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase().trim()
    return items.filter(
      (item) =>
        item.kode_arsip.toLowerCase().includes(q) ||
        item.judul.toLowerCase().includes(q) ||
        item.nomor_ppl?.toLowerCase().includes(q) ||
        item.nomor_dokumen?.toLowerCase().includes(q) ||
        item.pengaju_nama.toLowerCase().includes(q) ||
        item.kategori_nama.toLowerCase().includes(q)
    )
  }, [items, searchQuery])

  // Handler Persetujuan (Approve) & Penolakan (Reject)
  const handleConfirmAction = async () => {
    if (!modalAction) return
    const { item, type } = modalAction
    setIsSubmittingAction(true)

    try {
      if (type === 'approve') {
        const res = await fetch(`/api/dokumen/${item.id}/approve`, {
          method: 'POST',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal mengesahkan dokumen.')

        setItems((prev) => prev.filter((i) => i.id !== item.id))
        setProcessed((p) => ({ ...p, disahkan: p.disahkan + 1 }))
        showToast('success', `Dokumen ${item.kode_arsip} berhasil disahkan menjadi Aktif (+3 Tahun).`)
      } else {
        if (!alasan.trim()) {
          showToast('reject', 'Alasan penolakan wajib diisi.')
          setIsSubmittingAction(false)
          return
        }

        const res = await fetch(`/api/dokumen/${item.id}/tolak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alasan: alasan.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menolak dokumen.')

        setItems((prev) => prev.filter((i) => i.id !== item.id))
        setProcessed((p) => ({ ...p, ditolak: p.ditolak + 1 }))
        showToast('reject', `Dokumen ${item.kode_arsip} telah ditolak dan dikembalikan ke PIC Arsip Aktif.`)
      }

      setModalAction(null)
      setAlasan('')
    } catch (err: unknown) {
      console.error('Error aksi persetujuan:', err)
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      showToast('reject', msg)
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const formatTanggal = (str: string) => {
    try {
      return new Date(str).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return str
    }
  }

  const isAtasanAktif = currentUserRole === 'atasan_aktif'
  const isSuperadmin = currentUserRole === 'superadmin'
  const canApprove = isAtasanAktif || isSuperadmin

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans text-xs">
        {/* Toast Notifikasi */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl animate-in fade-in ${
              toast.type === 'success'
                ? 'border-[#CEEAD6] bg-[#E6F4EA] text-[#137333]'
                : 'border-[#FAD2CF] bg-[#FDECEC] text-[#D64545]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#137333]" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0 text-[#D64545]" />
            )}
            <span className="font-semibold text-sm">{toast.text}</span>
          </div>
        )}

        {/* Modal Konfirmasi Persetujuan / Penolakan */}
        {modalAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-[#BCE1F9] bg-white p-6 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between border-b border-[#ECEEF5] pb-3">
                <div className="space-y-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                      modalAction.type === 'approve'
                        ? 'border border-[#BCE1F9] bg-[#EAF5FD] text-[#0284C7]'
                        : 'border border-[#FAD2CF] bg-[#FFF5F5] text-[#D64545]'
                    }`}
                  >
                    {modalAction.type === 'approve' ? 'PENGESAHAN DOKUMEN AKTIF' : 'PENOLAKAN DOKUMEN'}
                  </span>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    {modalAction.type === 'approve'
                      ? 'Sahkan Dokumen Menjadi Aktif Selama 3 Tahun'
                      : 'Tolak Dokumen & Kembalikan ke PIC Arsip Aktif'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalAction(null)
                    setAlasan('')
                  }}
                  className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Rincian Dokumen */}
              <div className="rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#0369A1] font-medium">Kode Arsip SIG:</span>
                  <span className="font-mono font-bold text-[#0284C7] bg-white px-2 py-0.5 rounded border border-[#BAE6FD]">
                    {modalAction.item.kode_arsip}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0369A1] font-medium">Judul Dokumen:</span>
                  <span className="font-semibold text-[#0F172A] max-w-xs truncate text-right">
                    {modalAction.item.judul}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0369A1] font-medium">Unit Organisasi:</span>
                  <span className="font-semibold text-[#0F172A]">{modalAction.item.unit_nama}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0369A1] font-medium">Jumlah Lembar Fisik:</span>
                  <span className="font-bold text-[#0284C7]">{modalAction.item.jumlah_halaman} lembar</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0369A1] font-medium">PIC Pengentri:</span>
                  <span className="text-[#0F172A] font-semibold">{modalAction.item.pengaju_nama}</span>
                </div>
              </div>

              {modalAction.type === 'approve' ? (
                <div className="space-y-2 text-xs rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] p-3.5">
                  <p className="font-bold text-[#0369A1] flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#0284C7]" />
                    Ketentuan Pengesahan:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[11px] text-[#0284C7]">
                    <li>Dokumen resmi berstatus <strong>AKTIF</strong> selama persis 3 tahun.</li>
                    <li>Tanggal kadaluarsa otomatis dihitung: <strong>hari ini + 3 tahun</strong>.</li>
                    <li>Label barcode / QR code resmi SIG diterbitkan otomatis.</li>
                    <li>PIC Arsip Aktif pengentri akan menerima notifikasi pengesahan.</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#0F172A]">
                    ALASAN PENOLAKAN <span className="text-[#D64545]">* (Wajib Diisi)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    placeholder="Tuliskan catatan perbaikan untuk PIC Arsip Aktif..."
                    className="w-full rounded-xl border border-[#BAE6FD] p-2.5 text-xs text-[#0F172A] focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-none"
                  />
                  <p className="text-[11px] text-[#64748B]">
                    Alasan ini akan dikirimkan kepada PIC Arsip Aktif agar dokumen dapat diperbaiki dan diajukan ulang.
                  </p>
                </div>
              )}

              {/* Tombol Aksi Modal */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#ECEEF5]">
                <button
                  type="button"
                  onClick={() => {
                    setModalAction(null)
                    setAlasan('')
                  }}
                  className="rounded-xl px-4 py-2 border border-[#CBD5E1] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  disabled={isSubmittingAction || (modalAction.type === 'reject' && !alasan.trim())}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 ${
                    modalAction.type === 'approve'
                      ? 'bg-[#0284C7] hover:bg-[#0369A1]'
                      : 'bg-[#DC2626] hover:bg-[#B91C1C]'
                  }`}
                >
                  {isSubmittingAction ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : modalAction.type === 'approve' ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Sahkan Dokumen Aktif</span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      <span>Kirim Penolakan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header Halaman — Nuansa Biru Langit Kedinasan */}
        <div className="rounded-2xl border border-[#BAE6FD] bg-gradient-to-r from-[#F0F9FF] to-[#E0F2FE] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0284C7]/30 bg-white/90 px-3 py-1 text-xs font-bold text-[#0284C7]">
                <ShieldCheck className="h-3.5 w-3.5" />
                ALUR PERSETUJUAN ENTRI &bull; UNIT {currentUnitNama.toUpperCase()}
              </div>
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
                Persetujuan Entri Dokumen Arsip
              </h1>
              <p className="text-sm text-[#475569]">
                {isAtasanAktif
                  ? `Meninjau dan mengesahkan berkas arsip yang dientri oleh PIC Arsip Aktif unit ${currentUnitNama}.`
                  : isSuperadmin
                  ? 'Mode Superadmin: Menampilkan seluruh dokumen menunggu persetujuan lintas unit.'
                  : 'Halaman khusus Atasan Arsip Aktif untuk memeriksa dan mengesahkan dokumen arsip unitnya.'}
              </p>
            </div>

            {/* Quick Counter */}
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl border border-[#BAE6FD] bg-white px-4 py-2 text-center shadow-xs">
                <span className="text-[11px] font-semibold text-[#64748B] block">Antrean</span>
                <span className="font-bold text-lg text-[#0284C7]">{items.length}</span>
              </div>
              <div className="rounded-xl border border-[#BAE6FD] bg-white px-4 py-2 text-center shadow-xs">
                <span className="text-[11px] font-semibold text-[#16A34A] block">Disahkan</span>
                <span className="font-bold text-lg text-[#16A34A]">{processed.disahkan}</span>
              </div>
              <div className="rounded-xl border border-[#BAE6FD] bg-white px-4 py-2 text-center shadow-xs">
                <span className="text-[11px] font-semibold text-[#DC2626] block">Ditolak</span>
                <span className="font-bold text-lg text-[#DC2626]">{processed.ditolak}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Peringatan Hak Akses jika bukan Atasan / Superadmin */}
        {!canApprove && (
          <div className="rounded-xl border border-[#FAD2CF] bg-[#FFF5F5] p-4 text-[#D64545] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
            <div>
              <p className="font-bold">Akses Penyetujuan Khusus Atasan Unit Pengolah</p>
              <p className="mt-0.5 leading-relaxed">
                Halaman ini diperuntukkan bagi <strong>Atasan Arsip Aktif</strong> unit kerja untuk memverifikasi dan mengesahkan dokumen baru. Akun Anda saat ini ({currentUserRole.replace('_', ' ')}) tidak memiliki wewenang untuk menyetujui entri berkas baru.
              </p>
            </div>
          </div>
        )}

        {/* Pencarian Antrean */}
        <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-[#BAE6FD] shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0284C7]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan kode arsip SIG, judul dokumen, nomor payment..."
              className="w-full rounded-lg border border-[#BAE6FD] bg-[#F8FBFE] pl-9 pr-8 py-2 text-xs font-mono text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabel / Daftar Antrean Persetujuan */}
        {isLoading ? (
          <div className="rounded-2xl border border-[#BAE6FD] bg-white p-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0284C7]" />
            <p className="text-sm font-medium text-[#475569]">Memuat antrean persetujuan dokumen...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-[#BAE6FD] bg-[#F0F9FF] p-16 text-center space-y-2">
            <Inbox className="w-10 h-10 mx-auto text-[#0284C7]/60" />
            <p className="font-bold text-base text-[#0F172A]">Antrean Persetujuan Kosong</p>
            <p className="text-xs text-[#64748B] max-w-md mx-auto">
              {searchQuery
                ? 'Tidak ada dokumen yang cocok dengan kata kunci pencarian.'
                : `Saat ini tidak ada dokumen baru yang menunggu persetujuan dari unit ${currentUnitNama}.`}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#BAE6FD] bg-white divide-y divide-[#E0F2FE] shadow-xs overflow-hidden">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-4 sm:p-5 hover:bg-[#F0F9FF]/40 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <KodeArsip kode={item.kode_arsip} className="text-xs" />
                    <span className="px-2.5 py-0.5 rounded-full border border-[#FEEFC3] bg-[#FEF7E0] text-[#B06000] font-bold text-[10px]">
                      MENUNGGU PERSETUJUAN
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full border border-[#BAE6FD] bg-[#E0F2FE] text-[#0369A1] text-[10px] font-semibold">
                      {item.kategori_nama}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full border border-[#CEEAD6] bg-[#E6F4EA] text-[#137333] font-bold text-[10px]">
                      {item.jumlah_halaman} Lembar
                    </span>
                  </div>

                  <div className="text-[11px] text-[#64748B] flex items-center gap-3">
                    <span className="flex items-center gap-1 font-medium text-[#0369A1]">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{item.unit_nama}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span>{formatTanggal(item.created_at)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="space-y-1 max-w-2xl">
                    <h2 className="font-bold text-base text-[#0F172A] leading-snug">
                      {item.judul}
                    </h2>
                    <div className="text-xs text-[#64748B] flex items-center gap-3 flex-wrap">
                      <span>Pengentri: <strong className="text-[#0F172A]">{item.pengaju_nama}</strong></span>
                      {item.nomor_ppl && <span>No. Payment: <strong className="font-mono text-[#0284C7]">{item.nomor_ppl}</strong></span>}
                      {item.nomor_dokumen && <span>Doc Voucher: <strong className="font-mono text-[#0284C7]">{item.nomor_dokumen}</strong></span>}
                      <span>Lokasi: {item.lokasi_saat_ini}</span>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dokumen/${item.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] px-3.5 py-2 text-xs font-semibold text-[#0284C7] hover:bg-[#E0F2FE] transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Detail</span>
                    </Link>

                    {canApprove && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModalAction({ item, type: 'reject' })}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#FAD2CF] bg-[#FFF5F5] px-3.5 py-2 text-xs font-bold text-[#DC2626] hover:bg-[#FDECEC] transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setModalAction({ item, type: 'approve' })}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0369A1] transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Setujui (Aktif 3 Thn)</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default function PersetujuanPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-12 text-center text-xs text-[#0284C7]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0284C7]" />
            Memuat antrean persetujuan...
          </div>
        </AppLayout>
      }
    >
      <VerifikasiContent />
    </Suspense>
  )
}
