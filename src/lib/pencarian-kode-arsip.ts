/**
 * Pencarian cerdas kode arsip (Blueprint 3.7 — perbaikan pencarian Tahap 5).
 *
 * Format kode arsip: TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
 *   contoh: 2025_2000_1500013765_1900009386
 *
 * Modul ini murni (tanpa I/O): hanya mencocokkan & memberi skor pada data yang
 * SUDAH lolos RLS di sisi Supabase, sehingga batasan hak akses peran tidak berubah.
 */

export interface DokumenCari {
  kode_arsip: string
  judul: string
  nomor_ppl?: string | null
  nomor_dokumen?: string | null
}

export interface BagianKodeArsip {
  tahun: string
  kodePerusahaan: string
  noPayment: string
  docVoucher: string
}

/** Peringkat kecocokan — makin besar makin relevan. 0 = tidak cocok. */
export const SKOR = {
  KODE_LENGKAP: 100,
  PPL_ATAU_VOUCHER: 80,
  PPL_ATAU_VOUCHER_SEBAGIAN: 70,
  TAHUN_ATAU_PERUSAHAAN: 60,
  AWALAN_KODE: 55,
  JUDUL: 40,
  TEKS_LAIN: 30,
  TIDAK_COCOK: 0,
} as const

const PEMISAH = /[\s_\-./]+/g

/** Buang semua pemisah (garis bawah, strip, spasi, titik, garis miring) dan jadikan huruf kecil. */
export function normalisasiKode(nilai: string | null | undefined): string {
  return (nilai || '').toLowerCase().replace(PEMISAH, '')
}

/** Rapikan teks bebas (judul): huruf kecil, pemisah dijadikan satu spasi. */
function normalisasiTeks(nilai: string | null | undefined): string {
  return (nilai || '').toLowerCase().replace(PEMISAH, ' ').trim()
}

const HANYA_ANGKA = /^\d+$/

/** Pecah kode arsip menjadi 4 bagiannya. Mengembalikan null bila format tidak sesuai. */
export function uraikanKodeArsip(kode: string): BagianKodeArsip | null {
  const bagian = (kode || '').trim().split(/[_\-\s]+/).filter(Boolean)
  if (bagian.length !== 4) return null
  const [tahun, kodePerusahaan, noPayment, docVoucher] = bagian
  return { tahun, kodePerusahaan, noPayment, docVoucher }
}

const MIN_DIGIT_SEBAGIAN = 5

/** Skor satu kata kunci (sudah tunggal, tanpa spasi) terhadap satu dokumen. */
function skorSatuKunci(kunciMentah: string, doc: DokumenCari): number {
  const kunci = normalisasiKode(kunciMentah)
  if (!kunci) return SKOR.TIDAK_COCOK

  const kodeNorm = normalisasiKode(doc.kode_arsip)
  const bagian = uraikanKodeArsip(doc.kode_arsip)
  const ppl = normalisasiKode(bagian?.noPayment || doc.nomor_ppl)
  const voucher = normalisasiKode(bagian?.docVoucher || doc.nomor_dokumen)

  // 1. Kode lengkap persis (pemisah diabaikan)
  if (kodeNorm && kunci === kodeNorm) return SKOR.KODE_LENGKAP

  if (HANYA_ANGKA.test(kunci)) {
    // 2. Nomor PPL / doc voucher persis
    if ((ppl && kunci === ppl) || (voucher && kunci === voucher)) return SKOR.PPL_ATAU_VOUCHER

    // 3. Nomor PPL / doc voucher sebagian (awalan), atau gabungan beberapa bagian
    //    yang ditulis tanpa pemisah (mis. "15000137651900009386").
    if (kunci.length >= MIN_DIGIT_SEBAGIAN) {
      if ((ppl && ppl.startsWith(kunci)) || (voucher && voucher.startsWith(kunci))) {
        return SKOR.PPL_ATAU_VOUCHER_SEBAGIAN
      }
      if (ppl && voucher && kunci.length > ppl.length && (ppl + voucher).startsWith(kunci)) {
        return SKOR.PPL_ATAU_VOUCHER_SEBAGIAN
      }
    }

    // 4. Tahun / kode perusahaan persis
    if (bagian && (kunci === bagian.tahun || kunci === bagian.kodePerusahaan)) {
      return SKOR.TAHUN_ATAU_PERUSAHAAN
    }

    // 5. Awalan kode lengkap tanpa pemisah (mis. "20252000", "202520001500")
    if (kodeNorm && kunci.length > 4 && kodeNorm.startsWith(kunci)) return SKOR.AWALAN_KODE

    // Kata kunci angka yang tidak cocok bagian mana pun TIDAK dicocokkan secara
    // substring bebas, supaya nomor PPL dokumen lain tidak ikut menampilkan dokumen ini.
    // Judul tetap dicek (judul bisa memuat angka, mis. "Laporan 2025").
    if (normalisasiTeks(doc.judul).includes(kunciMentah.toLowerCase())) return SKOR.JUDUL
    return SKOR.TIDAK_COCOK
  }

  // Kata kunci berhuruf: judul, lalu teks kode / nomor dokumen
  if (normalisasiTeks(doc.judul).includes(normalisasiTeks(kunciMentah))) return SKOR.JUDUL
  if (kodeNorm.includes(kunci) || normalisasiKode(doc.nomor_dokumen).includes(kunci)) return SKOR.TEKS_LAIN
  return SKOR.TIDAK_COCOK
}

/**
 * Skor kecocokan kueri terhadap dokumen.
 * - Kueri utuh dinormalisasi lebih dulu, sehingga "2025_2000_1500013765_1900009386",
 *   "2025 2000 1500013765 1900009386", dan "2025200015000137651900009386" setara.
 * - Bila kueri utuh tidak cocok dan terdiri dari beberapa kata, SETIAP kata harus cocok
 *   (mis. "2025 pajak"); skornya mengikuti kata dengan kecocokan terlemah.
 */
export function skorPencarian(kueri: string, doc: DokumenCari): number {
  const bersih = (kueri || '').trim()
  if (!bersih) return SKOR.KODE_LENGKAP

  // Judul dengan frasa utuh (mis. "laporan pajak") tetap cocok sebagai judul.
  const skorUtuh = Math.max(
    skorSatuKunci(bersih, doc),
    normalisasiTeks(doc.judul).includes(normalisasiTeks(bersih)) ? SKOR.JUDUL : SKOR.TIDAK_COCOK,
  )
  if (skorUtuh > SKOR.TIDAK_COCOK) return skorUtuh

  const kata = bersih.split(/\s+/).filter(Boolean)
  if (kata.length < 2) return SKOR.TIDAK_COCOK

  let terlemah: number = SKOR.KODE_LENGKAP
  for (const k of kata) {
    const s = skorSatuKunci(k, doc)
    if (s === SKOR.TIDAK_COCOK) return SKOR.TIDAK_COCOK
    terlemah = Math.min(terlemah, s)
  }
  return terlemah
}
