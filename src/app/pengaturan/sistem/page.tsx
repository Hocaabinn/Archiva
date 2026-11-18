'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import {
  Settings,
  HardDrive,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Clock,
  FileCheck2,
  Lock,
} from 'lucide-react'

export default function PengaturanSistemPage() {
  const [batasLampiran, setBatasLampiran] = useState<number>(25)
  const [retensiAktif, setRetensiAktif] = useState<number>(3)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4500)
  }

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/pengaturan/sistem')
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat pengaturan sistem.')
      }
      setBatasLampiran(json.data.batas_lampiran_mb || 25)
      setRetensiAktif(json.data.retensi_aktif_tahun || 3)
      setUpdatedAt(json.data.updated_at || null)
    } catch (err: any) {
      showToast('error', err.message || 'Terjadi kesalahan saat memuat pengaturan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (batasLampiran < 1 || batasLampiran > 200) {
      showToast('error', 'Batas ukuran lampiran harus di antara 1 MB hingga 200 MB.')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/pengaturan/sistem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batas_lampiran_mb: batasLampiran }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menyimpan pengaturan sistem.')
      }
      showToast('success', json.message || 'Pengaturan batas lampiran berhasil disimpan.')
      setUpdatedAt(json.data.updated_at)
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memperbarui pengaturan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout currentRole="superadmin">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Banner Header */}
        <div className="rounded-2xl border border-[#BCE1F9] bg-gradient-to-r from-[#F0F8FF] to-[#E6F3FD] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#3BA4E8]/30 bg-white/80 px-3 py-1 text-xs font-semibold text-[#1E86C8]">
                <Settings className="h-3.5 w-3.5" />
                Konfigurasi Parameter Sistem Kearsipan
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1F2333]">
                Pengaturan Sistem Arsip
              </h1>
              <p className="text-sm text-[#4B5163]">
                Kelola parameter global sistem penyimpanan dokumen, batas kuota lampiran, serta audit keamanan server.
              </p>
            </div>
          </div>
        </div>

        {/* Toast Notifikasi */}
        {toast && (
          <div
            className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm animate-in fade-in ${
              toast.type === 'success'
                ? 'border-[#CEEAD6] bg-[#E6F4EA] text-[#137333]'
                : 'border-[#FDECEC] bg-[#FFF5F5] text-[#D64545]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#137333]" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-[#D64545]" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#6B7185] bg-white rounded-2xl border border-[#ECEEF5]">
            <Loader2 className="h-8 w-8 animate-spin text-[#3BA4E8]" />
            <p className="text-sm font-medium">Memuat konfigurasi sistem...</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Form Batas Lampiran Dokumen */}
            <form onSubmit={handleSave} className="rounded-2xl border border-[#ECEEF5] bg-white p-6 shadow-xs space-y-6">
              <div className="flex items-start gap-3.5 border-b border-[#ECEEF5] pb-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FD] text-[#1E86C8]">
                  <HardDrive className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#1F2333]">Batas Ukuran Berkas Lampiran</h2>
                  <p className="text-xs text-[#6B7185] mt-0.5">
                    Mengatur batas maksimal total ukuran berkas pendukung (PDF, XLSX, DOCX, JPG, PNG) per dokumen arsip.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="batas-lampiran" className="block text-sm font-semibold text-[#1F2333] mb-1.5">
                    Kapasitas Maksimal Lampiran (MB) <span className="text-[#D64545]">*</span>
                  </label>
                  <div className="flex items-center gap-3 max-w-xs">
                    <input
                      id="batas-lampiran"
                      type="number"
                      min="1"
                      max="200"
                      value={batasLampiran}
                      onChange={(e) => setBatasLampiran(parseInt(e.target.value, 10) || 0)}
                      required
                      className="w-full rounded-xl border border-[#D5D9E2] px-4 py-2.5 text-sm font-semibold text-[#1F2333] focus:border-[#3BA4E8] focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]/20"
                    />
                    <span className="text-sm font-bold text-[#6B7185]">MB / Dokumen</span>
                  </div>
                  <p className="text-xs text-[#8A90A2] mt-2">
                    Nilai awal acuan BLUEPRINT.md adalah <strong>25 MB</strong> per dokumen. Anda dapat menyesuaikannya bila instansi memerlukan berkas lampiran berukuran lebih besar.
                  </p>
                </div>

                <div className="rounded-xl bg-[#F8FBFE] border border-[#BCE1F9] p-4 text-xs text-[#1E86C8] flex items-start gap-3">
                  <FileCheck2 className="h-4 w-4 shrink-0 mt-0.5 text-[#3BA4E8]" />
                  <div>
                    <p className="font-semibold">Ketentuan Penyimpanan Berkas Kedinasan:</p>
                    <p className="mt-0.5 text-[#4B5163]">
                      Setiap lampiran tersimpan secara privat dan terisolasi di Supabase Storage, dapat diakses hanya oleh pemegang peran berwenang melalui signed URL bertanda waktu singkat (expired otomatis).
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#ECEEF5]">
                <span className="text-xs text-[#8A90A2]">
                  {updatedAt ? `Terakhir diperbarui: ${new Date(updatedAt).toLocaleString('id-ID')}` : 'Konfigurasi bawaan sistem'}
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#3BA4E8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2A93D7] disabled:opacity-50 transition-all"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan Pengaturan
                </button>
              </div>
            </form>

            {/* Informasi Pengaturan SMTP & Surel */}
            <div className="rounded-2xl border border-[#ECEEF5] bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-start gap-3.5 border-b border-[#ECEEF5] pb-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FEF7E0] text-[#B06000]">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#1F2333]">Konfigurasi Surel &amp; Notifikasi (SMTP)</h2>
                  <p className="text-xs text-[#6B7185] mt-0.5">
                    Protokol pengiriman notifikasi otomatis dan surat tanda terima kearsipan via surel.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#E3E6F0] bg-[#FAFAFC] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#137333]" />
                  <span className="text-xs font-bold text-[#137333] uppercase tracking-wide">
                    Terkonfigurasi Aman di Server (Environment Variables)
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#4B5163]">
                  Sesuai ketentuan keamanan kedinasan, seluruh kredensial SMTP (<code className="bg-white px-1.5 py-0.5 rounded border border-[#D5D9E2] font-mono text-[#1F2333]">SMTP_HOST</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-[#D5D9E2] font-mono text-[#1F2333]">SMTP_PORT</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-[#D5D9E2] font-mono text-[#1F2333]">SMTP_USER</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-[#D5D9E2] font-mono text-[#1F2333]">SMTP_PASS</code>) dikelola langsung via variabel lingkungan server dan <strong>tidak ditampilkan pada antarmuka grafis UI</strong> guna mencegah kebocoran data rahasia.
                </p>
                <div className="text-[11px] text-[#8A90A2]">
                  Status Koneksi: <strong className="text-[#137333]">Aktif (Siap Kirim Notifikasi)</strong> &bull; Protokol Keamanan: TLS / STARTTLS
                </div>
              </div>
            </div>

            {/* Informasi Parameter Retensi Otomatis */}
            <div className="rounded-2xl border border-[#ECEEF5] bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-start gap-3.5 border-b border-[#ECEEF5] pb-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E8FD] text-[#7E3FBF]">
                  <Clock className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#1F2333]">Parameter Siklus Hidup Arsip</h2>
                  <p className="text-xs text-[#6B7185] mt-0.5">
                    Masa retensi aktif standar dan mekanisme pemindahan otomatis ke gudang inaktif.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl border border-[#ECEEF5] bg-[#F7F8FC] space-y-1">
                  <span className="text-[#8A90A2]">Masa Retensi Dokumen Aktif:</span>
                  <p className="text-base font-bold text-[#1F2333]">{retensiAktif} Tahun Sejak Pengesahan</p>
                  <p className="text-[11px] text-[#6B7185]">Dihitung otomatis saat Atasan mengesahkan berkas menjadi Aktif.</p>
                </div>
                <div className="p-3.5 rounded-xl border border-[#ECEEF5] bg-[#F7F8FC] space-y-1">
                  <span className="text-[#8A90A2]">Jadwal Cron Pemindahan Inaktif:</span>
                  <p className="text-base font-bold text-[#1F2333]">Setiap Hari (Pukul 01:00 WIB)</p>
                  <p className="text-[11px] text-[#6B7185]">Mengecek masa retensi dan memindahkan berkas secara otomatis.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

