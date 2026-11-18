'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { UserRole } from '@/types'
import {
  Search,
  Send,
  FileText,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  FileCheck2,
  Download,
  Loader2,
  Layers,
  ArrowRight,
  ShieldAlert,
  Archive,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KodeArsip } from '@/components/documents/kode-arsip'

interface TransferDoc {
  id: string
  kode_arsip: string
  nomor_dokumen: string | null
  judul: string
  kategori_nama: string
  jumlah_halaman: number | null
  tanggal_dokumen: string
  tanggal_kadaluarsa: string | null
  lokasi_saat_ini: string
  sisa_hari: number
  kategori_retensi: 'H-7' | 'H-30' | 'H-90' | 'Lewat Retensi' | 'Aman'
  isPendingTransfer: boolean
}

interface RecentTransferItem {
  id: string
  nomor_ba: string
  status_serah: string
  tanggal_serah: string
  bukti_pdf_path: string | null
  kode_arsip: string
  judul: string
}

function TransferArsipContent() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<UserRole>('staff')
  const [userName, setUserName] = useState<string>('')
  const [docs, setDocs] = useState<TransferDoc[]>([])
  const [recentTransfers, setRecentTransfers] = useState<RecentTransferItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterTab, setFilterTab] = useState<'retensi' | 'semua'>('retensi')

  // Modal Kirim Transfer
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [catatanTransfer, setCatatanTransfer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successResult, setSuccessResult] = useState<{
    nomorBa: string
    totalDokumen: number
    baPdfPath: string
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchExpiringDocs = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setErrorMessage('Silakan masuk untuk mengakses fitur transfer dokumen.')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, nama_lengkap, email')
        .eq('id', user.id)
        .single()

      const role = (profile?.role as UserRole) || 'staff'
      setUserRole(role)
      setUserName(profile?.nama_lengkap || profile?.email || 'PIC Arsip Aktif')

      // Query dokumen aktif
      const { data: rawDocs, error: docError } = await supabase
        .from('dokumen')
        .select(`
          id,
          kode_arsip,
          nomor_dokumen,
          judul,
          jumlah_halaman,
          tanggal_dokumen,
          tanggal_kadaluarsa,
          lokasi_saat_ini,
          kategori_dokumen:kategori_id(nama)
        `)
        .eq('status', 'aktif')
        .order('tanggal_kadaluarsa', { ascending: true, nullsFirst: false })

      if (docError) throw docError

      // Query serah_terima pending transfer inaktif
      const { data: pendingTransfers } = await supabase
        .from('serah_terima')
        .select('dokumen_id')
        .ilike('keterangan', '%TRANSFER_INAKTIF%')
        .eq('status_serah', 'Menunggu konfirmasi')

      const pendingSet = new Set((pendingTransfers || []).map((t) => t.dokumen_id))

      // Query riwayat pengajuan transfer terakhir
      const { data: recentSt } = await supabase
        .from('serah_terima')
        .select(`
          id,
          keterangan,
          status_serah,
          tanggal_serah,
          bukti_pdf_path,
          dokumen:dokumen_id(kode_arsip, judul)
        `)
        .ilike('keterangan', '%TRANSFER_INAKTIF%')
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentSt) {
        const parsedRecent: RecentTransferItem[] = recentSt.map((st: any) => {
          let nomorBa = 'BAST-TRANSFER'
          const parts = (st.keterangan || '').split('|')
          if (parts.length >= 2) {
            nomorBa = parts[1].trim()
          }
          return {
            id: st.id,
            nomor_ba: nomorBa,
            status_serah: st.status_serah,
            tanggal_serah: st.tanggal_serah,
            bukti_pdf_path: st.bukti_pdf_path,
            kode_arsip: st.dokumen?.kode_arsip || '-',
            judul: st.dokumen?.judul || '-',
          }
        })
        setRecentTransfers(parsedRecent)
      }

      const now = Date.now()
      const mapped: TransferDoc[] = (rawDocs || []).map((d: any) => {
        let sisaHari = 9999
        if (d.tanggal_kadaluarsa) {
          const expTime = new Date(d.tanggal_kadaluarsa).getTime()
          sisaHari = Math.ceil((expTime - now) / (1000 * 3600 * 24))
        }

        let kategoriRetensi: 'H-7' | 'H-30' | 'H-90' | 'Lewat Retensi' | 'Aman' = 'Aman'
        if (sisaHari <= 0) {
          kategoriRetensi = 'Lewat Retensi'
        } else if (sisaHari <= 7) {
          kategoriRetensi = 'H-7'
        } else if (sisaHari <= 30) {
          kategoriRetensi = 'H-30'
        } else if (sisaHari <= 90) {
          kategoriRetensi = 'H-90'
        }

        return {
          id: d.id,
          kode_arsip: d.kode_arsip,
          nomor_dokumen: d.nomor_dokumen || '-',
          judul: d.judul,
          kategori_nama: d.kategori_dokumen?.nama || 'Umum',
          jumlah_halaman: d.jumlah_halaman || 1,
          tanggal_dokumen: d.tanggal_dokumen,
          tanggal_kadaluarsa: d.tanggal_kadaluarsa,
          lokasi_saat_ini: d.lokasi_saat_ini || 'Unit Pengolah',
          sisa_hari: sisaHari,
          kategori_retensi: kategoriRetensi,
          isPendingTransfer: pendingSet.has(d.id),
        }
      })

      setDocs(mapped)
      setErrorMessage(null)
    } catch (err: any) {
      console.error('Gagal mengambil daftar dokumen transfer:', err)
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat memuat dokumen.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExpiringDocs()
  }, [fetchExpiringDocs])

  // Filter pencarian dan tab
  const filteredDocs = useMemo(() => {
    let result = docs
    if (filterTab === 'retensi') {
      result = result.filter((d) => d.sisa_hari <= 90)
    }

    if (!searchQuery.trim()) return result
    const q = searchQuery.toLowerCase()
    return result.filter(
      (d) =>
        d.kode_arsip.toLowerCase().includes(q) ||
        d.judul.toLowerCase().includes(q) ||
        d.nomor_dokumen?.toLowerCase().includes(q) ||
        d.kategori_nama.toLowerCase().includes(q)
    )
  }, [docs, filterTab, searchQuery])

  // Checkbox handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    const selectableDocs = filteredDocs.filter((d) => !d.isPendingTransfer)
    if (selectedIds.size === selectableDocs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableDocs.map((d) => d.id)))
    }
  }

  // Submit transfer
  const handleSubmitTransfer = async () => {
    if (selectedIds.size === 0) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/transfer-arsip/ajukan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dokumenIds: Array.from(selectedIds),
          catatan: catatanTransfer.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengajukan transfer dokumen.')
      }

      setSuccessResult({
        nomorBa: data.nomor_ba,
        totalDokumen: data.total_dokumen,
        baPdfPath: data.ba_pdf_path,
      })
      setIsSubmitModalOpen(false)
      setSelectedIds(new Set())
      setCatatanTransfer('')
      await fetchExpiringDocs()
    } catch (err: any) {
      console.error('Error pengajuan transfer:', err)
      setErrorMessage(err.message || 'Gagal mengirim berkas ke Inaktif.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isAllSelected =
    filteredDocs.filter((d) => !d.isPendingTransfer).length > 0 &&
    selectedIds.size === filteredDocs.filter((d) => !d.isPendingTransfer).length

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-[#BCE1F9] bg-gradient-to-r from-[#F0F8FF] to-[#E6F3FD] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3BA4E8]/30 bg-white/80 px-3 py-1 text-xs font-semibold text-[#1E86C8]">
              <Layers className="h-3.5 w-3.5" />
              Siklus Hidup Arsip Kedinasan
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1F2333]">
              Transfer Dokumen ke Gudang Inaktif
            </h1>
            <p className="text-sm text-[#4B5163]">
              Daftar dokumen Aktif yang mendekati atau telah melampaui masa retensi aktif 3 tahun. Centang berkas yang siap diserahkan fisik beserta Berita Acara resmi.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setIsSubmitModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3BA4E8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2A93D7] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Send className="h-4 w-4" />
              Kirim ke Inaktif ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal / Alert */}
      {successResult && (
        <div className="rounded-xl border border-[#CEEAD6] bg-[#E6F4EA] p-5 shadow-xs animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-[#137333] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-[#137333]">
                  Transfer Berhasil Diajukan!
                </h3>
                <p className="text-sm text-[#274E13]">
                  {successResult.totalDokumen} berkas telah dimasukkan ke antrean verifikasi PIC Arsip Inaktif. Nomor Berita Acara: <span className="font-mono font-bold">{successResult.nomorBa}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/transfer-arsip/ba-pdf?path=${encodeURIComponent(successResult.baPdfPath)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[#137333] bg-white px-4 py-2 text-xs font-semibold text-[#137333] hover:bg-[#F3F9F4] transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh Berita Acara (PDF)
              </a>
              <button
                type="button"
                onClick={() => setSuccessResult(null)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-[#274E13] hover:bg-black/5"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-[#FDECEC] bg-[#FFF5F5] p-4 text-sm text-[#D64545] flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter and Stats Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#ECEEF5] shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Tab Filter Mode */}
          <div className="inline-flex rounded-lg bg-[#F0F2F7] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterTab('retensi')}
              className={`rounded-md px-3 py-1.5 transition-all ${
                filterTab === 'retensi'
                  ? 'bg-white text-[#1F2333] shadow-xs'
                  : 'text-[#6B7185] hover:text-[#1F2333]'
              }`}
            >
              Mendekati Retensi (&le; 90 Hari)
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('semua')}
              className={`rounded-md px-3 py-1.5 transition-all ${
                filterTab === 'semua'
                  ? 'bg-white text-[#1F2333] shadow-xs'
                  : 'text-[#6B7185] hover:text-[#1F2333]'
              }`}
            >
              Semua Dokumen Aktif
            </button>
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A90A2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode arsip, nomor, atau judul..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D5D9E2] rounded-lg focus:outline-none focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium text-[#4B5163]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#D64545]" />
            H-7
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#E37400]" />
            H-30
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#F29900]" />
            H-90
          </span>
          <span className="text-[#8A90A2]">|</span>
          <span className="font-semibold text-[#1F2333]">
            {filteredDocs.length} berkas
          </span>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#6B7185]">
            <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
            <p className="text-sm font-medium">Memindai arsip aktif...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-16 text-center text-[#6B7185] space-y-2">
            <FileCheck2 className="h-10 w-10 mx-auto text-[#8A90A2] stroke-[1.5]" />
            <p className="text-sm font-semibold text-[#1F2333]">
              Tidak Ada Berkas yang Perlu Ditransfer
            </p>
            <p className="text-xs text-[#8A90A2] max-w-md mx-auto">
              {filterTab === 'retensi'
                ? 'Seluruh dokumen aktif berada dalam masa retensi aman (> 90 hari). Anda dapat beralih ke tab "Semua Dokumen Aktif" untuk memilih dokumen.'
                : 'Tidak ada dokumen aktif yang terdaftar di unit Anda.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F7F8FC] border-b border-[#ECEEF5] text-xs font-semibold text-[#4B5163] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="rounded border-[#D5D9E2] text-[#3BA4E8] focus:ring-[#3BA4E8]"
                    />
                  </th>
                  <th className="py-3 px-4">Kode Arsip & Judul</th>
                  <th className="py-3 px-4">Kategori & Lembar</th>
                  <th className="py-3 px-4">Tanggal Dokumen</th>
                  <th className="py-3 px-4">Sisa Retensi</th>
                  <th className="py-3 px-4">Status Transfer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {filteredDocs.map((doc) => {
                  const isChecked = selectedIds.has(doc.id)
                  const isPending = doc.isPendingTransfer

                  // Styling badge retensi
                  let badgeClass = 'bg-[#F0F2F7] text-[#4B5163] border-[#D5D9E2]'
                  if (doc.kategori_retensi === 'Lewat Retensi' || doc.kategori_retensi === 'H-7') {
                    badgeClass = 'bg-[#FDECEC] text-[#D64545] border-[#FAD2CF]'
                  } else if (doc.kategori_retensi === 'H-30') {
                    badgeClass = 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]'
                  } else if (doc.kategori_retensi === 'H-90') {
                    badgeClass = 'bg-[#FFF4DE] text-[#C98A1B] border-[#FEEFC3]'
                  }

                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-[#F7F8FC] transition-colors ${
                        isChecked ? 'bg-[#EEF7FD]/40' : ''
                      } ${isPending ? 'opacity-60 bg-gray-50' : ''}`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          disabled={isPending}
                          checked={isChecked}
                          onChange={() => handleToggleSelect(doc.id)}
                          className="rounded border-[#D5D9E2] text-[#3BA4E8] focus:ring-[#3BA4E8] disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <KodeArsip kode={doc.kode_arsip} className="text-xs" />
                          <p className="font-semibold text-[#1F2333] line-clamp-1">
                            {doc.judul}
                          </p>
                          <p className="text-xs text-[#6B7185]">
                            No. Dok: <span className="font-mono">{doc.nomor_dokumen}</span>
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="inline-block rounded-md bg-[#EEF0F4] px-2 py-0.5 text-xs font-medium text-[#4B5163]">
                            {doc.kategori_nama}
                          </span>
                          <p className="text-xs text-[#8A90A2]">
                            {doc.jumlah_halaman} lembar
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#4B5163]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#8A90A2]" />
                          <span>{doc.tanggal_dokumen}</span>
                        </div>
                        {doc.tanggal_kadaluarsa && (
                          <p className="text-[11px] text-[#8A90A2] mt-0.5">
                            Kedaluwarsa: {doc.tanggal_kadaluarsa}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${badgeClass}`}>
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>
                            {doc.sisa_hari <= 0
                              ? 'Kedaluwarsa'
                              : `${doc.sisa_hari} hari (${doc.kategori_retensi})`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF4DE] px-2.5 py-1 text-xs font-medium text-[#C98A1B]">
                            <Clock className="h-3 w-3 animate-pulse" />
                            Menunggu Verifikasi Inaktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#E7F6EC] px-2.5 py-1 text-xs font-medium text-[#2F9E5B]">
                            Siap Ditransfer
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Riwayat Pengajuan & Unduh Berita Acara (BAST) */}
      {recentTransfers.length > 0 && (
        <div className="bg-white rounded-xl border border-[#ECEEF5] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-[#3BA4E8]" />
              <h2 className="text-sm font-bold text-[#1F2333]">
                Riwayat Pengajuan &amp; Berita Acara (BAST)
              </h2>
            </div>
            <Link
              href="/verifikasi-transfer"
              className="text-xs font-semibold text-[#3BA4E8] hover:underline inline-flex items-center gap-1"
            >
              Ke Halaman Verifikasi PIC Inaktif &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8FC] border-b border-[#ECEEF5] text-[#4B5163] font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Nomor BAST</th>
                  <th className="py-2.5 px-3">Dokumen</th>
                  <th className="py-2.5 px-3">Waktu Penyerahan</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {recentTransfers.map((st) => (
                  <tr key={st.id} className="hover:bg-[#F7F8FC]">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#1F2333]">
                      {st.nomor_ba}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-[#1F2333] line-clamp-1">{st.judul}</p>
                      <p className="text-[11px] text-[#8A90A2] font-mono">{st.kode_arsip}</p>
                    </td>
                    <td className="py-2.5 px-3 text-[#6B7185]">
                      {new Date(st.tanggal_serah).toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        st.status_serah === 'Diterima'
                          ? 'bg-[#E7F6EC] text-[#2F9E5B]'
                          : 'bg-[#FFF4DE] text-[#C98A1B]'
                      }`}>
                        {st.status_serah}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {st.bukti_pdf_path ? (
                        <a
                          href={`/api/transfer-arsip/ba-pdf?path=${encodeURIComponent(st.bukti_pdf_path)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#3BA4E8] text-[#3BA4E8] rounded-md hover:bg-[#F0F8FD] font-semibold"
                        >
                          <Download className="h-3 w-3" />
                          Unduh BAST (PDF)
                        </a>
                      ) : (
                        <span className="text-[#8A90A2] italic">Tidak ada berkas PDF</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Pengajuan Transfer */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#ECEEF5] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECEEF5] pb-3">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-[#3BA4E8]" />
                <h3 className="text-lg font-bold text-[#1F2333]">
                  Konfirmasi Penyerahan Berkas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-[#8A90A2] hover:text-[#1F2333]"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm text-[#4B5163]">
              <p>
                Anda akan mengajukan penyerahan <strong className="text-[#1F2333]">{selectedIds.size} berkas arsip</strong> ke Gudang Arsip Inaktif.
              </p>
              <div className="rounded-xl bg-[#F7F8FC] p-3 border border-[#ECEEF5] space-y-1 text-xs text-[#6B7185]">
                <p>• Sistem akan otomatis menerbitkan <strong>Berita Acara Penyerahan Arsip (PDF)</strong> berlogo SIG resmi.</p>
                <p>• Berkas fisik diserahkan ke PIC Arsip Inaktif untuk proses verifikasi barcode/QR.</p>
                <p>• Status berkas akan tetap aktif hingga PIC Arsip Inaktif mengonfirmasi penerimaan.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2333] mb-1">
                  Catatan Tambahan Penyerahan (Opsional)
                </label>
                <textarea
                  value={catatanTransfer}
                  onChange={(e) => setCatatanTransfer(e.target.value)}
                  placeholder="Contoh: Berkas asli dibundel rapi dalam map gantung, kondisi baik..."
                  rows={3}
                  className="w-full rounded-lg border border-[#D5D9E2] p-2.5 text-sm focus:outline-none focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#ECEEF5]">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="rounded-lg border border-[#D5D9E2] px-4 py-2 text-sm font-medium text-[#4B5163] hover:bg-[#F7F8FC]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitTransfer}
                className="inline-flex items-center gap-2 rounded-lg bg-[#3BA4E8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2A93D7] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menerbitkan Berita Acara...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Kirim &amp; Terbitkan BA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TransferArsipPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
          </div>
        }
      >
        <TransferArsipContent />
      </Suspense>
    </AppLayout>
  )
}
