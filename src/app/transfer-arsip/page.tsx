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
  kategori_retensi: 'H-7' | 'H-30' | 'H-90' | 'Lewat Retensi'
  isPendingTransfer: boolean
}

function TransferArsipContent() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<UserRole>('staff')
  const [userName, setUserName] = useState<string>('')
  const [docs, setDocs] = useState<TransferDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

      const now = Date.now()
      const mapped: TransferDoc[] = (rawDocs || [])
        .map((d: any) => {
          let sisaHari = 9999
          if (d.tanggal_kadaluarsa) {
            const expTime = new Date(d.tanggal_kadaluarsa).getTime()
            sisaHari = Math.ceil((expTime - now) / (1000 * 3600 * 24))
          }

          let kategoriRetensi: 'H-7' | 'H-30' | 'H-90' | 'Lewat Retensi' = 'H-90'
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
        // Filter hanya yang mendekati atau sudah kedaluwarsa (<= 90 hari) atau sisaHari <= 90
        .filter((d) => d.sisa_hari <= 90)

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

  // Filter pencarian
  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return docs
    const q = searchQuery.toLowerCase()
    return docs.filter(
      (d) =>
        d.kode_arsip.toLowerCase().includes(q) ||
        d.judul.toLowerCase().includes(q) ||
        d.nomor_dokumen?.toLowerCase().includes(q) ||
        d.kategori_nama.toLowerCase().includes(q)
    )
  }, [docs, searchQuery])

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
              Siklus Hidup Arsip Kedinasan (M8 — R.03)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#ECEEF5] shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A90A2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode arsip, nomor dokumen, atau judul..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-[#D5D9E2] rounded-lg focus:outline-none focus:border-[#3BA4E8] focus:ring-2 focus:ring-[#3BA4E8]/20"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-[#4B5163]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#D64545]" />
            Lewat Retensi / H-7
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E37400]" />
            H-30
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F29900]" />
            H-90
          </span>
          <span className="text-[#8A90A2]">|</span>
          <span className="font-semibold text-[#1F2333]">
            Total: {filteredDocs.length} berkas
          </span>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-[#ECEEF5] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#6B7185]">
            <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
            <p className="text-sm font-medium">Memindai arsip mendekati masa kedaluwarsa...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-16 text-center text-[#6B7185] space-y-2">
            <FileCheck2 className="h-10 w-10 mx-auto text-[#8A90A2] stroke-[1.5]" />
            <p className="text-sm font-semibold text-[#1F2333]">
              Tidak Ada Berkas yang Perlu Ditransfer
            </p>
            <p className="text-xs text-[#8A90A2] max-w-md mx-auto">
              Seluruh dokumen aktif berada dalam masa retensi aman (&gt; 90 hari) atau sudah diajukan ke Gudang Inaktif.
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
                  let badgeClass = 'bg-[#FFF4DE] text-[#C98A1B] border-[#FEEFC3]'
                  if (doc.kategori_retensi === 'Lewat Retensi' || doc.kategori_retensi === 'H-7') {
                    badgeClass = 'bg-[#FDECEC] text-[#D64545] border-[#FAD2CF]'
                  } else if (doc.kategori_retensi === 'H-30') {
                    badgeClass = 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]'
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
                        <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${badgeClass}">
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
