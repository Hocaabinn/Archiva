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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'
import { skorPencarian } from '@/lib/pencarian-kode-arsip'

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

      // Query dokumen status menunggu_persetujuan
      let query = supabase
        .from('dokumen')
        .select(`
          id, kode_arsip, nomor_dokumen, nomor_ppl, judul,
          lokasi_saat_ini, ukuran_file, tanggal_dokumen, created_at,
          jumlah_halaman, unit_id,
          unit:unit_organisasi ( id, nama ),
          kategori_dokumen ( nama ),
          pemilik:profiles!dokumen_pemilik_id_fkey ( nama_lengkap, email )
        `)
        .eq('status', 'menunggu_persetujuan')
        .order('created_at', { ascending: false })

      // Blueprint 3.3 poin 2: Atasan Arsip Aktif hanya melihat antrean dari unitnya sendiri
      if (userRole === 'atasan_aktif' && unitId) {
        query = query.eq('unit_id', unitId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error load pending docs:', error)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: VerificationDoc[] = (data || []).map((d: any) => ({
        id: d.id,
        kode_arsip: d.kode_arsip,
        nomor_dokumen: d.nomor_dokumen,
        nomor_ppl: d.nomor_ppl,
        judul: d.judul,
        kategori_nama: d.kategori_dokumen?.nama || 'Umum',
        pengaju_nama: d.pemilik?.nama_lengkap || d.pemilik?.email || 'PIC Arsip Aktif',
        tanggal_dokumen: d.tanggal_dokumen,
        created_at: d.created_at,
        lokasi_saat_ini: d.lokasi_saat_ini || 'Ruang Arsip Aktif',
        ukuran_file: d.ukuran_file,
        jumlah_halaman: d.jumlah_halaman || 1,
        unit_id: d.unit_id,
        unit_nama: d.unit?.nama || 'Keuangan',
      }))

      setItems(mapped)
    } catch (err) {
      console.error('Error fetch pending docs:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingDocs()
  }, [fetchPendingDocs])

  // Filter & Search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items

    const q = searchQuery.toLowerCase().trim()
    return items
      .map((item) => {
        const scoreKode = skorPencarian(q, item)
        const matchJudul = item.judul.toLowerCase().includes(q)
        const matchKategori = item.kategori_nama.toLowerCase().includes(q)
        const matchPengaju = item.pengaju_nama.toLowerCase().includes(q)
        const matchPpl = item.nomor_ppl ? item.nomor_ppl.toLowerCase().includes(q) : false
        const matchDoc = item.nomor_dokumen ? item.nomor_dokumen.toLowerCase().includes(q) : false

        let totalScore = scoreKode
        if (matchJudul) totalScore += 50
        if (matchPpl || matchDoc) totalScore += 40
        if (matchKategori || matchPengaju) totalScore += 20

        return { item, totalScore }
      })
      .filter((x) => x.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((x) => x.item)
  }, [items, searchQuery])

  // Eksekusi Aksi: Approve / Reject
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
      <div className="space-y-6 max-w-6xl mx-auto pb-16 font-mono text-xs">
        {/* Toast Notifikasi */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 border px-4 py-3 shadow-lg ${
              toast.type === 'success'
                ? 'border-[#16A34A] bg-[#F0FDF4] text-[#166534]'
                : 'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
            )}
            <span className="font-semibold">{toast.text}</span>
          </div>
        )}

        {/* Modal Konfirmasi Persetujuan / Penolakan */}
        {modalAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono">
            <div className="w-full max-w-lg border-2 border-[#1A1A1A] bg-white p-6 space-y-4 shadow-xl">
              <div className="flex items-start justify-between border-b border-[#E5E5E5] pb-3">
                <div className="space-y-1">
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] font-bold ${
                      modalAction.type === 'approve'
                        ? 'border border-[#16A34A] bg-[#F0FDF4] text-[#166534]'
                        : 'border border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'
                    }`}
                  >
                    {modalAction.type === 'approve' ? 'PENGESAHAN DOKUMEN AKTIF' : 'PENOLAKAN DOKUMEN'}
                  </span>
                  <h3 className="text-sm font-bold text-[#1A1A1A]">
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
                  className="text-[#888] hover:text-[#1A1A1A]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Rincian Dokumen */}
              <div className="border border-[#E5E5E5] bg-[#FAFAFA] p-3 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#666]">Kode Arsip SIG:</span>
                  <span className="font-bold text-[#1A1A1A]">{modalAction.item.kode_arsip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">Judul Dokumen:</span>
                  <span className="font-semibold text-[#1A1A1A] max-w-xs truncate text-right">
                    {modalAction.item.judul}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">Unit Organisasi:</span>
                  <span className="font-semibold text-[#1A1A1A]">{modalAction.item.unit_nama}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">Jumlah Lembar Fisik:</span>
                  <span className="font-bold text-[#15803D]">{modalAction.item.jumlah_halaman} lembar</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">PIC Pengentri:</span>
                  <span className="text-[#1A1A1A]">{modalAction.item.pengaju_nama}</span>
                </div>
              </div>

              {modalAction.type === 'approve' ? (
                <div className="space-y-2 text-xs font-sans text-[#444] bg-[#FFFBEB] border border-amber-200 p-3">
                  <p className="font-semibold text-amber-900">Ketentuan Pengesahan (Blueprint 3.3 poin 4):</p>
                  <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800">
                    <li>Dokumen resmi berstatus <strong>AKTIF</strong> selama persis 3 tahun.</li>
                    <li>Tanggal kadaluarsa otomatis dihitung: <strong>hari ini + 3 tahun</strong>.</li>
                    <li>Label barcode / QR code resmi SIG diterbitkan otomatis.</li>
                    <li>PIC Arsip Aktif pengentri akan menerima notifikasi pengesahan.</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#1A1A1A]">
                    ALASAN PENOLAKAN <span className="text-red-600">* (Wajib Diisi)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    placeholder="Tuliskan catatan perbaikan untuk PIC Arsip Aktif..."
                    className="w-full border border-[#C5BFB0] p-2.5 text-xs font-mono focus:border-[#DC2626] focus:outline-none"
                  />
                  <p className="text-[10px] text-[#666] font-sans">
                    Alasan ini akan dikirimkan kepada PIC Arsip Aktif agar dokumen dapat diperbaiki dan diajukan ulang.
                  </p>
                </div>
              )}

              {/* Tombol Aksi Modal */}
              <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => {
                    setModalAction(null)
                    setAlasan('')
                  }}
                  className="px-4 py-2 border border-[#C5BFB0] text-xs font-semibold hover:bg-[#F5F5F5]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  disabled={isSubmittingAction || (modalAction.type === 'reject' && !alasan.trim())}
                  className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50 ${
                    modalAction.type === 'approve'
                      ? 'border-2 border-[#16A34A] bg-[#16A34A] hover:bg-[#15803D]'
                      : 'border-2 border-[#DC2626] bg-[#DC2626] hover:bg-[#B91C1C]'
                  }`}
                >
                  {isSubmittingAction ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : modalAction.type === 'approve' ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Sahkan Dokumen Aktif</span>
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5" />
                      <span>Kirim Penolakan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header Halaman */}
        <div className="border-b border-[#D9D4C7] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 border border-[#9A3412] bg-[#FFF7ED] text-[#9A3412] font-bold text-[10px]">
                ALUR PERSETUJUAN R.03
              </span>
              <span className="text-[#666] text-[11px]">
                Unit Kerja: <strong>{currentUnitNama}</strong>
              </span>
            </div>
            <h1 className="text-lg font-bold text-[#1A1A1A] tracking-tight">
              Antrean Persetujuan Dokumen Arsip
            </h1>
            <p className="text-[11px] text-[#666] font-sans mt-0.5">
              {isAtasanAktif
                ? `Menampilkan seluruh berkas arsip yang baru dientri oleh PIC Arsip Aktif unit ${currentUnitNama} dan menunggu persetujuan Anda.`
                : isSuperadmin
                ? 'Mode Superadmin: Menampilkan seluruh dokumen menunggu persetujuan lintas unit.'
                : 'Halaman ini khusus untuk Atasan Arsip Aktif dalam meninjau dan mengesahkan dokumen arsip unitnya.'}
            </p>
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-2">
            <div className="border border-[#D9D4C7] bg-[#FDFCF7] px-3 py-1.5 text-center">
              <span className="text-[10px] text-[#777] block">Antrean</span>
              <span className="font-bold text-sm text-[#1A1A1A]">{items.length}</span>
            </div>
            <div className="border border-[#D9D4C7] bg-[#FDFCF7] px-3 py-1.5 text-center">
              <span className="text-[10px] text-[#166534] block">Disahkan</span>
              <span className="font-bold text-sm text-[#16A34A]">{processed.disahkan}</span>
            </div>
            <div className="border border-[#D9D4C7] bg-[#FDFCF7] px-3 py-1.5 text-center">
              <span className="text-[10px] text-[#991B1B] block">Ditolak</span>
              <span className="font-bold text-sm text-[#DC2626]">{processed.ditolak}</span>
            </div>
          </div>
        </div>

        {/* Peringatan Hak Akses jika bukan Atasan / Superadmin */}
        {!canApprove && (
          <div className="border border-[#DC2626] bg-[#FEF2F2] p-4 text-[#991B1B] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
            <div>
              <p className="font-bold">Akses Penyetujuan Terbatas</p>
              <p className="mt-0.5 font-sans leading-relaxed">
                Anda masuk sebagai peran <strong>{currentUserRole}</strong>. Sesuai Blueprint Bab 5, hak persetujuan dan pengesahan dokumen arsip baru berada di bawah kewenangan <strong>Atasan Arsip Aktif (atasan_aktif)</strong> unit terkait.
              </p>
            </div>
          </div>
        )}

        {/* Pencarian Antrean */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#888]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan kode arsip SIG, judul dokumen, nomor payment..."
              className="w-full border border-[#C5BFB0] bg-white pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#1A1A1A]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-[#888] hover:text-[#1A1A1A]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tabel / Daftar Antrean Persetujuan */}
        {isLoading ? (
          <div className="border border-[#D9D4C7] bg-white p-12 text-center space-y-2">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#9A3412]" />
            <p className="text-xs text-[#666]">Memuat antrean persetujuan dokumen...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="border border-[#D9D4C7] bg-[#FAF9F5] p-12 text-center space-y-2">
            <Inbox className="w-8 h-8 mx-auto text-[#999]" />
            <p className="font-bold text-sm text-[#1A1A1A]">Antrean Persetujuan Kosong</p>
            <p className="text-xs text-[#666] font-sans max-w-md mx-auto">
              {searchQuery
                ? 'Tidak ada dokumen yang cocok dengan kata kunci pencarian.'
                : `Saat ini tidak ada dokumen baru yang menunggu persetujuan dari unit ${currentUnitNama}.`}
            </p>
          </div>
        ) : (
          <div className="border border-[#D9D4C7] bg-white divide-y divide-[#E5E5E5]">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-4 sm:p-5 hover:bg-[#FDFCF7] transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#1A1A1A] tracking-wider">
                      {item.kode_arsip}
                    </span>
                    <span className="px-2 py-0.5 border border-[#B45309] bg-[#FFFBEB] text-[#B45309] font-bold text-[10px]">
                      MENUNGGU PERSETUJUAN
                    </span>
                    <span className="px-2 py-0.5 border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] text-[10px]">
                      {item.kategori_nama}
                    </span>
                    <span className="px-2 py-0.5 border border-[#D9D4C7] bg-[#FAF9F5] text-[#15803D] font-bold text-[10px]">
                      {item.jumlah_halaman} Lembar
                    </span>
                  </div>

                  <div className="text-[11px] text-[#666] flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{item.unit_nama}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTanggal(item.created_at)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="space-y-0.5 max-w-2xl">
                    <h2 className="font-bold text-sm text-[#1A1A1A]">
                      {item.judul}
                    </h2>
                    <div className="text-[11px] text-[#666] font-sans flex items-center gap-4 flex-wrap">
                      <span>Pengentri: <strong>{item.pengaju_nama}</strong></span>
                      {item.nomor_ppl && <span>No. Payment: <strong className="font-mono">{item.nomor_ppl}</strong></span>}
                      {item.nomor_dokumen && <span>Doc Voucher: <strong className="font-mono">{item.nomor_dokumen}</strong></span>}
                      <span>Lokasi Awal: {item.lokasi_saat_ini}</span>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dokumen/${item.id}`}
                      className="inline-flex items-center gap-1.5 border border-[#C5BFB0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Detail</span>
                    </Link>

                    {canApprove && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModalAction({ item, type: 'reject' })}
                          className="inline-flex items-center gap-1.5 border border-[#DC2626] bg-white px-3 py-1.5 text-xs font-bold text-[#DC2626] hover:bg-red-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setModalAction({ item, type: 'approve' })}
                          className="inline-flex items-center gap-1.5 border border-[#16A34A] bg-[#16A34A] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#15803D]"
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
          <div className="p-8 text-center text-xs font-mono text-[#666]">
            Memuat antrean persetujuan...
          </div>
        </AppLayout>
      }
    >
      <VerifikasiContent />
    </Suspense>
  )
}
