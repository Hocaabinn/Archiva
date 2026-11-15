'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { MapPin, Loader2, AlertCircle } from 'lucide-react'

export interface LokasiItem {
  id: string
  nama: string
  tingkat: 'Gedung' | 'Ruangan' | 'Rak'
  parent_id: string | null
}

export interface LokasiCascadeValue {
  rakId: string
  lokasiString: string
  gedungNama: string
  ruanganNama: string
  rakNama: string
}

interface LokasiCascadeSelectProps {
  valueRakId?: string
  onChange: (val: LokasiCascadeValue | null) => void
  disabled?: boolean
  required?: boolean
  className?: string
  label?: string
}

export function LokasiCascadeSelect({
  valueRakId = '',
  onChange,
  disabled = false,
  required = true,
  className = '',
  label = 'LOKASI FISIK DARI MASTER LOKASI (GEDUNG > RUANGAN > RAK)',
}: LokasiCascadeSelectProps) {
  const [allLokasi, setAllLokasi] = useState<LokasiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [selectedGedungId, setSelectedGedungId] = useState<string>('')
  const [selectedRuanganId, setSelectedRuanganId] = useState<string>('')
  const [selectedRakId, setSelectedRakId] = useState<string>(valueRakId)

  // 1. Fetch data Master Lokasi
  useEffect(() => {
    let active = true
    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/lokasi')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal memuat Master Lokasi')
        if (active) {
          setAllLokasi(data.raw || [])
          setFetchError(null)
        }
      } catch (err: unknown) {
        if (active) {
          setFetchError(err instanceof Error ? err.message : 'Gagal memuat lokasi')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  // Pisahkan berdasarkan tingkat
  const gedungOptions = useMemo(() => {
    return allLokasi.filter((l) => l.tingkat === 'Gedung')
  }, [allLokasi])

  const ruanganOptions = useMemo(() => {
    if (!selectedGedungId) return []
    return allLokasi.filter((l) => l.tingkat === 'Ruangan' && l.parent_id === selectedGedungId)
  }, [allLokasi, selectedGedungId])

  const rakOptions = useMemo(() => {
    if (!selectedRuanganId) return []
    return allLokasi.filter((l) => l.tingkat === 'Rak' && l.parent_id === selectedRuanganId)
  }, [allLokasi, selectedRuanganId])

  // Inisialisasi awal bila valueRakId sudah ada
  useEffect(() => {
    if (valueRakId && allLokasi.length > 0) {
      const rak = allLokasi.find((l) => l.id === valueRakId && l.tingkat === 'Rak')
      if (rak && rak.parent_id) {
        const ruangan = allLokasi.find((l) => l.id === rak.parent_id && l.tingkat === 'Ruangan')
        if (ruangan && ruangan.parent_id) {
          const gedung = allLokasi.find((l) => l.id === ruangan.parent_id && l.tingkat === 'Gedung')
          if (gedung) {
            setSelectedGedungId(gedung.id)
            setSelectedRuanganId(ruangan.id)
            setSelectedRakId(rak.id)
            return
          }
        }
      }
    }
    // Default: jika belum ada pilihan, pilih otomatis tingkat pertama bila tersedia
    if (!selectedGedungId && gedungOptions.length > 0) {
      const firstG = gedungOptions[0]
      setSelectedGedungId(firstG.id)
      const firstR = allLokasi.find((l) => l.tingkat === 'Ruangan' && l.parent_id === firstG.id)
      if (firstR) {
        setSelectedRuanganId(firstR.id)
        const firstK = allLokasi.find((l) => l.tingkat === 'Rak' && l.parent_id === firstR.id)
        if (firstK) {
          setSelectedRakId(firstK.id)
          const locStr = `${firstG.nama} > ${firstR.nama} > ${firstK.nama}`
          onChange({
            rakId: firstK.id,
            lokasiString: locStr,
            gedungNama: firstG.nama,
            ruanganNama: firstR.nama,
            rakNama: firstK.nama,
          })
        }
      }
    }
  }, [allLokasi, valueRakId, gedungOptions])

  // Handler pergantian Gedung
  const handleGedungChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const gid = e.target.value
    setSelectedGedungId(gid)
    setSelectedRuanganId('')
    setSelectedRakId('')

    // Reset pilihan anak
    const availableR = allLokasi.filter((l) => l.tingkat === 'Ruangan' && l.parent_id === gid)
    if (availableR.length > 0) {
      const firstR = availableR[0]
      setSelectedRuanganId(firstR.id)
      const availableK = allLokasi.filter((l) => l.tingkat === 'Rak' && l.parent_id === firstR.id)
      if (availableK.length > 0) {
        const firstK = availableK[0]
        setSelectedRakId(firstK.id)
        const g = allLokasi.find((l) => l.id === gid)
        const locStr = `${g?.nama || ''} > ${firstR.nama} > ${firstK.nama}`
        onChange({
          rakId: firstK.id,
          lokasiString: locStr,
          gedungNama: g?.nama || '',
          ruanganNama: firstR.nama,
          rakNama: firstK.nama,
        })
        return
      }
    }
    onChange(null)
  }

  // Handler pergantian Ruangan
  const handleRuanganChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rid = e.target.value
    setSelectedRuanganId(rid)
    setSelectedRakId('')

    const availableK = allLokasi.filter((l) => l.tingkat === 'Rak' && l.parent_id === rid)
    if (availableK.length > 0) {
      const firstK = availableK[0]
      setSelectedRakId(firstK.id)
      const g = allLokasi.find((l) => l.id === selectedGedungId)
      const r = allLokasi.find((l) => l.id === rid)
      const locStr = `${g?.nama || ''} > ${r?.nama || ''} > ${firstK.nama}`
      onChange({
        rakId: firstK.id,
        lokasiString: locStr,
        gedungNama: g?.nama || '',
        ruanganNama: r?.nama || '',
        rakNama: firstK.nama,
      })
      return
    }
    onChange(null)
  }

  // Handler pergantian Rak
  const handleRakChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const kid = e.target.value
    setSelectedRakId(kid)

    if (!kid) {
      onChange(null)
      return
    }

    const g = allLokasi.find((l) => l.id === selectedGedungId)
    const r = allLokasi.find((l) => l.id === selectedRuanganId)
    const k = allLokasi.find((l) => l.id === kid)

    if (g && r && k) {
      const locStr = `${g.nama} > ${r.nama} > ${k.nama}`
      onChange({
        rakId: k.id,
        lokasiString: locStr,
        gedungNama: g.nama,
        ruanganNama: r.nama,
        rakNama: k.nama,
      })
    } else {
      onChange(null)
    }
  }

  const selectedLocString = useMemo(() => {
    if (!selectedGedungId || !selectedRuanganId || !selectedRakId) return ''
    const g = allLokasi.find((l) => l.id === selectedGedungId)
    const r = allLokasi.find((l) => l.id === selectedRuanganId)
    const k = allLokasi.find((l) => l.id === selectedRakId)
    if (g && r && k) {
      return `${g.nama} > ${r.nama} > ${k.nama}`
    }
    return ''
  }, [allLokasi, selectedGedungId, selectedRuanganId, selectedRakId])

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#1E3A5F]" />
          <span>{label}</span>
          {required && <span className="text-red-500">*</span>}
        </label>
        {loading && (
          <span className="text-[11px] text-[#64748B] flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Memuat master lokasi...
          </span>
        )}
      </div>

      {fetchError ? (
        <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] rounded text-xs text-[#991B1B] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Grid 3 Dropdown Bertingkat */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* 1. GEDUNG */}
            <div>
              <span className="block text-[10px] font-mono text-[#64748B] mb-1">1. TINGKAT GEDUNG</span>
              <select
                required={required}
                disabled={disabled || loading}
                value={selectedGedungId}
                onChange={handleGedungChange}
                className="w-full h-10 px-2.5 text-xs font-mono bg-white border border-[#CBD7E3] rounded-md focus:outline-none focus:border-[#1E3A5F] text-[#111827] disabled:bg-[#F1F5F9]"
              >
                <option value="">-- Pilih Gedung --</option>
                {gedungOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. RUANGAN */}
            <div>
              <span className="block text-[10px] font-mono text-[#64748B] mb-1">2. TINGKAT RUANGAN</span>
              <select
                required={required}
                disabled={disabled || loading || !selectedGedungId}
                value={selectedRuanganId}
                onChange={handleRuanganChange}
                className="w-full h-10 px-2.5 text-xs font-mono bg-white border border-[#CBD7E3] rounded-md focus:outline-none focus:border-[#1E3A5F] text-[#111827] disabled:bg-[#F1F5F9]"
              >
                <option value="">-- Pilih Ruangan --</option>
                {ruanganOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. RAK */}
            <div>
              <span className="block text-[10px] font-mono text-[#64748B] mb-1">3. TINGKAT RAK (WADAH BOKS)</span>
              <select
                required={required}
                disabled={disabled || loading || !selectedRuanganId}
                value={selectedRakId}
                onChange={handleRakChange}
                className="w-full h-10 px-2.5 text-xs font-mono bg-white border border-[#CBD7E3] rounded-md focus:outline-none focus:border-[#1E3A5F] text-[#111827] disabled:bg-[#F1F5F9]"
              >
                <option value="">-- Pilih Rak --</option>
                {rakOptions.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Konfirmasi Hirarki Lokasi Resmi */}
          {selectedLocString ? (
            <div className="p-2 bg-[#F0F7FF] border border-[#BAE6FD] rounded-md flex items-center justify-between text-xs font-mono">
              <span className="text-[#0369A1] font-semibold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0284C7]" />
                {selectedLocString}
              </span>
              <span className="text-[10px] bg-[#E0F2FE] text-[#0369A1] px-2 py-0.5 rounded font-bold">
                TERDAFTAR DI MASTER
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-[#E11D48] italic font-mono">
              * Wajib memilih hingga tingkat Rak dari Master Lokasi (bukan ketik bebas).
            </p>
          )}
        </div>
      )}
    </div>
  )
}
