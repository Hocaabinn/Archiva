# Panduan Desain — Aplikasi Arsip Dokumen (Anti-Slop)

Aturan lengkap ada di skill `anti-slop-design` (`workspace/custom-skills/anti-slop-design/SKILL.md`).
File ini adalah ringkasan token yang bisa langsung dipakai saat coding, supaya tidak
kembali ke tampilan SaaS generik.

## Identitas

Aplikasi ini adalah **alat kerja arsip**, bukan landing page. Bayangkan: kertas, tinta,
cap stempel, map folder, dan kode arsip. Kalau logonya dihapus, layarnya tetap harus
kelihatan seperti aplikasi arsip, bukan aplikasi apa pun.

**Jangan dipakai:** gradien ungu-biru, hero marketing, 3 kartu fitur identik,
glassmorphism, ilustrasi AI, emoji sebagai ikon, badge warna-warni tanpa arti.

## Token

- Kertas: `#F7F3EB`, permukaan: `#FFFFFF`, tinta: `#1A1D21`, tinta redup: `#5B6166`
- Border: `#D8D2C4`, sidebar: `#1E2429` atau `#F0EBDD`
- Cap merah (Ditolak): `#B42318`, amber (Menunggu): `#9A6700`
- Aktif: `#1F5C55`, Lunas: `#276749`, Non-Aktif: abu-abu cap
- Judul: serif (formal arsip), isi: system sans, kode: monospace
- Status: huruf kapital, ada border, isi datar, tanpa gradien. Contoh: `AKTIF`, `MENUNGGU PERSETUJUAN`, `NON-AKTIF`

## Layout

- Desktop: sidebar tetap + topbar (pencarian + role) + konten utama.
- Dashboard = tabel kerja padat, bukan kartu-kartu besar.
- Di daftar dokumen, langsung tampil: kode arsip (monospace), judul, status cap,
  pemegang, lokasi, dan tanggal kadaluarsa. Jangan paksa klik detail hanya untuk tahu itu.
- Satu aksi utama per layar, tombol solid tanpa gradien. Aksi hapus: teks / outline merah.

## Komponen kunci

- **Tabel dokumen:** teks rata kiri, angka dan tanggal rata kanan, kode monospace, hover baris saja.
- **Detail dokumen:** dua kolom — kiri metadata + barcode/QR besar yang bisa di-scan dari print,
  kanan timeline riwayat.
- **Form:** label selalu di atas field, bukan placeholder saja. Error menyebut field dan solusinya.
- **Scan serah terima:** area kamera besar + kolom ketik kode manual sebagai fallback (scanner USB).
- **Empty state:** jelaskan yang kosong dan satu aksi berikutnya, bukan ilustrasi kosong.
  Contoh: “Belum ada dokumen menunggu persetujuan.” + tombol “Upload dokumen”.

## Data contoh (pakai ini di demo, jangan data generik)

- Kode: `ARS-2026-0001`, `ARS-2026-0002`
- Kategori: Keuangan, SDM, Kontrak
- Judul contoh: “Kontrak Kerja Sama Vendor 2026”, “Laporan Keuangan Triwulan III 2026”
- Harga: `Rp50.000` (Perpanjangan 1 Tahun), `Rp75.000` (Reaktivasi Non-Aktif)
- Jangan pakai: Dokumen 1, John Doe, lorem ipsum, angka dashboard palsu.

## Cek cepat sebelum demo

1. Tanpa logo, masih kelihatan seperti aplikasi arsip?
2. Ada gradien / hero / ilustrasi AI yang bisa dihapus tanpa kehilangan info? Hapus.
3. Dalam 5 detik, user tahu aksi berikutnya di layar itu?
4. Barcode hasil print masih bisa di-scan?
5. Viewer benar-benar tidak melihat tombol download, bukan cuma tombolnya disembunyikan dengan CSS?
