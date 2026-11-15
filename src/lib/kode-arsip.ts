/**
 * Utilitas validasi & parsing kode arsip SIG murni (dapat digunakan di Client & Server)
 * Format: TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER (contoh: 2025_2000_1500013765_1900009386)
 */

export function validateKodeArsipSIG(code: string): { isValid: boolean; message?: string } {
  const trimmed = (code || '').trim()
  if (!trimmed) {
    return { isValid: false, message: 'Kode arsip tidak boleh kosong' }
  }

  // Pola standar 31 karakter: 4_4_10_10
  const sigStandardRegex = /^\d{4}_\d{4}_\d{10}_\d{10}$/
  if (sigStandardRegex.test(trimmed)) {
    return { isValid: true }
  }

  // Blueprint 3.2 poin 5: Pola alternatif untuk dokumen khusus (kontrak/sertifikat)
  const flexibleSigRegex = /^[A-Za-z0-9_-]{5,50}$/
  if (flexibleSigRegex.test(trimmed)) {
    return { isValid: true }
  }

  return {
    isValid: false,
    message: 'Format kode arsip tidak valid. Standar SIG: TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER (contoh: 2025_2000_1500013765_1900009386)',
  }
}

export function extractSigTokens(filenameOrText: string): {
  tahun?: string
  kodePerusahaan?: string
  noPayment?: string
  docVoucher?: string
} {
  const cleaned = (filenameOrText || '').replace(/\.[^/.]+$/, '')
  const fullMatch = cleaned.match(/(\d{4})_(\d{4})_(\d{10})_(\d{10})/)
  if (fullMatch) {
    return {
      tahun: fullMatch[1],
      kodePerusahaan: fullMatch[2],
      noPayment: fullMatch[3],
      docVoucher: fullMatch[4],
    }
  }
  return {}
}
