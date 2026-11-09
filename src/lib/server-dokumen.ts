import { createAdminClient } from '@/lib/supabase/admin'
import { UserRole } from '@/types'

/**
 * Validasi pola kode arsip standar Semen Indonesia Group (SIG):
 * Format: TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
 * Contoh: 2025_2000_1500013765_1900009386 (31 karakter)
 * Token:
 * - TAHUN: 4 digit angka
 * - KODEPERUSAHAAN: 4 digit angka (misal 2000)
 * - NOPAYMENT: 10 digit angka (nomor PPL / Payment)
 * - DOCVOUCHER: 10 digit angka (nomor doc voucher / dokumen)
 *
 * Blueprint 3.2 poin 5: Untuk dokumen tanpa payment (kontrak/sertifikat),
 * nomor dokumen dapat digunakan setelah diverifikasi PIC Arsip.
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
  // Format tetap menggunakan underscore sebagai pemisah segmen
  const flexibleSigRegex = /^[A-Za-z0-9_-]{5,50}$/
  if (flexibleSigRegex.test(trimmed)) {
    return { isValid: true }
  }

  return {
    isValid: false,
    message: 'Format kode arsip tidak valid. Standar SIG: TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER (contoh: 2025_2000_1500013765_1900009386)',
  }
}

/**
 * Parsing nama file atau teks untuk mengekstrak token kode arsip SIG
 */
export function extractSigTokens(filenameOrText: string): {
  tahun?: string
  kodePerusahaan?: string
  noPayment?: string
  docVoucher?: string
} {
  const cleaned = (filenameOrText || '').replace(/\.[^/.]+$/, '') // hilangkan ekstensi

  // Coba cari pola lengkap: 2025_2000_1500013765_1900009386
  const fullMatch = cleaned.match(/(\d{4})_(\d{4})_(\d{10})_(\d{10})/)
  if (fullMatch) {
    return {
      tahun: fullMatch[1],
      kodePerusahaan: fullMatch[2],
      noPayment: fullMatch[3],
      docVoucher: fullMatch[4],
    }
  }

  // Coba cari token 10 digit (No. Payment dan Doc Voucher)
  const tenDigitMatches = cleaned.match(/\b\d{10}\b/g)
  const yearMatch = cleaned.match(/\b(202\d)\b/)
  const companyMatch = cleaned.match(/\b(2000|1000|3000|4000|5000)\b/)

  return {
    tahun: yearMatch ? yearMatch[1] : new Date().getFullYear().toString(),
    kodePerusahaan: companyMatch ? companyMatch[1] : '2000',
    noPayment: tenDigitMatches && tenDigitMatches[0] ? tenDigitMatches[0] : undefined,
    docVoucher: tenDigitMatches && tenDigitMatches[1] ? tenDigitMatches[1] : undefined,
  }
}

/**
 * Mencatat log aktivitas ke tabel log_aktivitas
 */
export async function catatLogAktivitas(params: {
  dokumen_id?: string
  user_id?: string
  aksi: string
  keterangan: string
}) {
  try {
    const admin = createAdminClient()
    await admin.from('log_aktivitas').insert({
      dokumen_id: params.dokumen_id || null,
      user_id: params.user_id || null,
      aksi: params.aksi,
      keterangan: params.keterangan,
    })
  } catch (err) {
    console.error('Gagal mencatat log_aktivitas:', err)
  }
}

/**
 * Mengirim notifikasi ke satu pengguna melalui tabel notifikasi (service role)
 */
export async function kirimNotifikasiKeUser(params: {
  userId: string
  judul: string
  isi: string
  dokumenId?: string
}) {
  try {
    const admin = createAdminClient()
    await admin.rpc('kirim_notifikasi', {
      p_user_id: params.userId,
      p_judul: params.judul,
      p_isi: params.isi,
      p_dokumen_id: params.dokumenId || null,
    })
  } catch (err) {
    console.error('Gagal memanggil rpc kirim_notifikasi, fallback insert langsung:', err)
    try {
      const admin = createAdminClient()
      await admin.from('notifikasi').insert({
        user_id: params.userId,
        judul: params.judul,
        isi: params.isi,
        dokumen_id: params.dokumenId || null,
        dibaca: false,
      })
    } catch (insertErr) {
      console.error('Gagal insert notifikasi:', insertErr)
    }
  }
}

/**
 * Mengirim notifikasi ke semua pengguna dengan peran tertentu (misal: semua pic_arsip, atau semua atasan)
 */
export async function kirimNotifikasiKePeran(params: {
  roles: UserRole[]
  judul: string
  isi: string
  dokumenId?: string
}) {
  try {
    const admin = createAdminClient()
    const { data: users, error } = await admin
      .from('profiles')
      .select('id')
      .in('role', params.roles)

    if (error || !users || users.length === 0) {
      return
    }

    await Promise.all(
      users.map((u) =>
        kirimNotifikasiKeUser({
          userId: u.id,
          judul: params.judul,
          isi: params.isi,
          dokumenId: params.dokumenId,
        })
      )
    )
  } catch (err) {
    console.error('Gagal mengirim notifikasi ke peran:', err)
  }
}

