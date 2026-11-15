# Panduan Desain — Aplikasi Arsip Dokumen (Anti-Slop)

Aturan lengkap merujuk pada skill `anti-slop-design` (`custom-skills/anti-slop-design/SKILL.md`) dan disinkronkan dengan `BLUEPRINT.md` R.03.

## Identitas Sistem

Aplikasi ini adalah **alat kerja administrasi kearsipan kedinasan**, bukan landing page atau SaaS komersial.
Metafora visual: **kertas kerja kedinasan, tinta stempel, cap status dokumen, map arsip fisik, dan kode arsip SIG monospace**.

**Dilarang digunakan:**
- Gradien ungu-biru generic web3/AI.
- Hero marketing, gambar 3D kartun, atau panel ilustrasi kosong.
- Glassmorphism yang mengaburkan kejelasan teks kearsipan.
- Emoji sebagai ikon status formal.
- Data palsu / lorem ipsum / dummy generic.

---

## Token Desain (Archiva Kearsipan)

- **Latar Kertas Kedinasan:** `#F0F5FA` / `#F7F8FC`
- **Permukaan Kartu/Tabel:** `#FFFFFF`
- **Tinta Teks Utama:** `#111827` / `#1A232E`
- **Tinta Redup / Keterangan:** `#4B5E76` / `#6B7185`
- **Border Dokumen:** `#CBD7E3` / `#ECEEF5`
- **Biru Kedinasan (Primary):** `#1E3A5F` (Hover: `#162A45`)
- **Aksen Arsip:** `#3BA4E8` / `#1E86C8`

### Status Cap Dokumen (Cap Border Kotak Monospace / Semibold)
- `MENUNGGU PERSETUJUAN`: Amber cap (`#B06000`, latar `#FEF7E0`, border `#FEEFC3`)
- `AKTIF`: Hijau cap kedinasan (`#137333`, latar `#E6F4EA`, border `#CEEAD6`)
- `DITOLAK`: Merah cap penolakan (`#B42318`, latar `#FEF3F2`, border `#FECDCA`)
- `INAKTIF`: Biru abu-abu retensi (`#1E86C8`, latar `#EAF5FD`, border `#BCE1F9`)
- `DIBATALKAN`: Merah bata tebal cap pembatalan (`#7F1D1D`, latar `#FEE2E2`, border `#F87171`)

---

## Layout & Tata Kelola Layar

1. **Halaman Masuk (Login):**
   - Satu kartu formulir kedinasan tunggal (Email + Kata Sandi + 1 Tombol Masuk).
   - Tanpa panel promosi/marketing dan tanpa tab pilihan OTP terpisah.
   - Opsi pemulihan akses via surel kedinasan resmi.

2. **Tata Letak Navigasi (Sidebar & Topbar):**
   - **Topbar:** Bersih tanpa kotak pencarian utama (pencarian diletakkan langsung di atas tabel dokumen). Menampilkan lonceng notifikasi dan profil pengguna.
   - **Sidebar:** Menampilkan peran aktif dengan lencana hierarki, menu disesuaikan menurut 6 peran R.03 (`superadmin`, `pic_aktif`, `atasan_aktif`, `pic_inaktif`, `atasan_inaktif`, `staff`).

3. **Daftar Dokumen:**
   - Satu kotak pencarian terpadu yang memfilter nomor payment (PPL), doc voucher, kode lengkap SIG, maupun judul dokumen.
   - Filter dropdown status, kategori, tanggal, pemegang, dan lokasi master.
   - Tabel padat menampilkan kode SIG monospace, judul, status cap, pemegang saat ini, lokasi rak/boks, dan batas retensi (dengan penanda 'Akan Kadaluarsa' untuk masa < 90 hari).

4. **Serah Terima & Peminjaman:**
   - Scan barcode/QR kamera beresolusi tinggi + kolom input scanner USB.
   - Bukti Berita Acara Serah Terima (BAST) otomatis diterbitkan dalam format PDF kedinasan.
   - Perpindahan pemegang fisik hanya sah setelah penerima mengonfirmasi scan.

<!-- Catatan verifikasi anti-slop design R.03: Seluruh komponen telah divalidasi -->
