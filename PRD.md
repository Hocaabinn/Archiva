# PRD — Aplikasi Arsip Dokumen

**Produk:** Aplikasi Arsip Dokumen (Next.js + Supabase)
**Versi PRD:** 1.0 — 3 November 2026
**Stack:** Next.js (App Router), Supabase (Auth, Postgres, Storage), Midtrans Sandbox opsional
**Dokumen pendamping:** `erd.dbml` (dbdiagram.io), `supabase.sql` (skema + RLS)
**Status:** Siap dibangun untuk demo tugas. Pembayaran default v1 = transfer manual + verifikasi, Midtrans Sandbox sebagai opsi.

---

## 1. Ringkasan

Instansi / organisasi menyimpan dokumen fisik dan digital yang terus bertambah, tapi sering tidak ketahuan: dokumen ini milik siapa, sedang dipegang siapa, masih aktif atau sudah waktunya dipindah ke gudang, dan sudah dibayar perpanjangannya atau belum.

Aplikasi ini menyelesaikan itu dengan satu alur yang bisa diaudit:

> Upload → verifikasi PIC Arsip → persetujuan akhir Atasan → Aktif selama 3 tahun → otomatis pindah ke Non-Aktif → bisa diperpanjang / diaktivasi ulang lewat pembayaran.

Setiap dokumen punya kode arsip unik yang dicetak sebagai barcode / QR. Kode itu yang di-scan saat dokumen berpindah tangan, jadi riwayat perpindahannya tercatat seperti struk kasir — bukan dicatat manual di buku tulis.

## 2. Masalah dan tujuan

### Masalah

1. Dokumen hilang jejak saat berpindah dari satu orang / ruangan ke ruangan lain.
2. Tidak ada batas masa aktif yang jelas, dokumen lama menumpuk di tempat aktif.
3. Persetujuan dokumen dan pembayaran tidak tercatat siapa yang menyetujui dan kapan.
4. Pencarian dokumen lambat karena tidak ada kode, kategori, dan status yang konsisten.

### Tujuan produk (v1)

1. Semua dokumen yang masuk harus lewat approval sebelum berstatus Aktif.
2. Masa aktif jelas 3 tahun, setelah itu otomatis Non-Aktif dan pindah storage.
3. Setiap perpindahan tercatat lewat scan barcode / QR dan bisa dibuktikan dengan PDF bukti serah terima.
4. Setiap aksi penting (upload, approve, download, bayar, serah terima, pindah Non-Aktif) tercatat di riwayat.
5. Hak akses ketat per role, tidak ada role yang bisa melakukan semua hal sendirian.

### Ukuran sukses demo

- [ ] User upload → PIC verifikasi → Atasan approve → dokumen Aktif + barcode muncul, dalam satu alur tanpa error.
- [ ] Dokumen yang tanggal kadaluarsanya lewat berubah jadi Non-Aktif lewat cron dan filenya pindah bucket.
- [ ] Scan QR → form serah terima terisi otomatis → penerima konfirmasi → pemegang saat ini berubah.
- [ ] User bayar perpanjangan → status menunggu verifikasi → PIC / Admin verifikasi → tanggal kadaluarsa bertambah.
- [ ] Accounting bisa lihat + download, tapi tombol upload / edit / approve tidak muncul dan API menolaknya.
- [ ] Viewer bisa lihat daftar + detail, tapi tombol download tidak muncul dan API menolak pembuatan signed URL.

## 3. Pengguna dan role — 6 role final

Jangan tambah role lagi di v1. Pembagian tugas di bawah ini yang dipakai di `profiles.role` dan RLS.

| # | Role | Intinya | Boleh | Tidak boleh |
|---|------|---------|-------|-------------|
| 1 | `admin` — Admin Sistem | Pegang sistem, bukan isi arsip harian | Kelola user + role, kategori, paket harga, setting. Akses darurat semua dokumen Aktif + Non-Aktif. Eksekusi hapus permanen | Hapus permanen sendirian tanpa approve Atasan yang tercatat di log |
| 2 | `pic_arsip` — PIC Arsip | Penanggung jawab operasional arsip Aktif + Non-Aktif | Verifikasi tahap 1, approve / reject awal, perbaiki klasifikasi, serah terima, pindah Aktif → Non-Aktif, cetak barcode / QR | Kelola user, ubah harga paket |
| 3 | `atasan` — Atasan | Approval akhir | Setujui / tolak akhir dokumen, setujui hapus, reaktivasi, dan perpanjangan sensitif. Lihat semua laporan | Upload dokumen, edit isi dokumen, kelola user |
| 4 | `user` — User / Pengaju | Pemilik dokumen | Upload dokumen sendiri, edit metadata sendiri selagi menunggu, bayar perpanjangan / reaktivasi sendiri, serah terima sebagai penyerah / penerima | Lihat / download dokumen user lain |
| 5 | `accounting` — Accounting | Pemeriksa keuangan | Lihat + download dokumen dan pembayaran, lihat bukti bayar dan laporan | Create, upload, edit, hapus, approve |
| 6 | `viewer` — Viewer | Pengamat saja | Lihat daftar + detail dokumen | Download, create, edit, hapus, approve, lihat detail pembayaran dan serah terima |

Catatan penting:

- **Admin ≠ PIC Arsip.** Admin urus akun dan sistem, PIC urus isi dan pergerakan arsip. Kalau satu orang merangkap keduanya di demo, jelaskan ke dosen bahwa itu dua akun berbeda yang kebetulan dipegang satu orang, bukan satu role.
- **Viewer tidak boleh download.** Ini harus diblok di API Next.js sebelum membuat signed URL Supabase, bukan hanya disembunyikan tombolnya di frontend. RLS `SELECT` saja tidak cukup memblokir signed URL.
- **Accounting bukan approver.** Accounting hanya memeriksa, yang menyetujui tetap PIC (tahap 1) dan Atasan (akhir).

## 4. Ruang lingkup v1

### Masuk (in scope)

- Auth email + password (Supabase Auth), profil + role.
- CRUD dokumen + kategori, upload file ke Storage privat.
- Approval 2 tahap: PIC Arsip → Atasan.
- Siklus Aktif 3 tahun → Non-Aktif otomatis (cron harian).
- Barcode / QR per dokumen, cetak label, scan serah terima (kamera HP + input scanner USB).
- Bukti serah terima PDF dan lembar arsip PDF.
- Pembayaran: paket Perpanjangan 1 Tahun dan Reaktivasi Non-Aktif, metode transfer manual + verifikasi di v1, Midtrans Sandbox sebagai opsi lanjutan.
- Riwayat: log aktivitas per dokumen dan per user.
- Dashboard per role, pencarian, filter status / kategori / tanggal, peringatan dokumen mau kadaluarsa (< 90 hari).
- RLS Supabase + cek role di API server.

### Tidak masuk (out of scope v1)

- OCR isi dokumen, AI klasifikasi otomatis, dan full-text search isi PDF.
- Tanda tangan elektronik tersertifikasi (tanda tangan di PDF bukti cukup tanda tangan basah setelah print di v1).
- Multi-organisasi / multi-tenant, chat internal, dan aplikasi mobile native (web responsif sudah cukup, scan pakai kamera HP lewat browser).
- Integrasi e-office / surat menyurat eksternal.

## 5. Alur utama

### 5.1 Upload dan approval — dokumen baru

1. User login → Upload Dokumen → isi judul, nomor dokumen, kategori, tanggal dokumen, upload file.
2. Sistem generate `kode_arsip` (format `ARS-2026-0001`, berurutan per tahun) dan simpan file di bucket `arsip-aktif` — tapi status masih `menunggu_persetujuan`, belum dihitung masa aktifnya.
3. PIC Arsip buka antrean persetujuan → cek isi dan klasifikasi → Verifikasi (isi `verifikasi_pic_oleh`) atau Tolak + alasan.
4. Atasan buka antrean persetujuan akhir → Setujui atau Tolak + alasan.
5. Kalau disetujui: status → `aktif`, `tanggal_disetujui` = sekarang, `tanggal_kadaluarsa` = `tanggal_disetujui` + 3 tahun, barcode / QR digenerate dan disimpan di bucket `barcode`, log `approve_atasan` tercatat.
6. Kalau ditolak di tahap mana pun: status → `ditolak`, alasan tampil di detail, User perbaiki dan ajukan ulang (dokumen baru atau revisi, diputuskan saat implementasi, jangan ubah kode arsip yang sudah ditolak tanpa jejak).

### 5.2 Siklus Aktif → Non-Aktif

- Dokumen Aktif tampil di tab Aktif dengan sisa hari menuju kadaluarsa.
- H-90, H-30, dan H-7: tampil badge peringatan di daftar dan dashboard pemilik + PIC.
- Cron harian `GET /api/cron/expire-documents` (diamankan dengan secret, bukan endpoint publik bebas):
  - Cari dokumen `status = 'aktif'` dan `tanggal_kadaluarsa < hari ini`.
  - Copy file dari bucket `arsip-aktif` ke `arsip-inaktif`, hapus dari bucket aktif setelah copy terverifikasi.
  - Ubah `status = 'nonaktif'`, `bucket = 'arsip-inaktif'`, `lokasi_saat_ini = 'Gudang Non-Aktif'`.
  - Tulis log `pindah_nonaktif` dan catat serah terima sistem bila perlu.
- Dokumen Non-Aktif tetap bisa dilihat dan didownload oleh yang berhak, tapi tidak bisa di-scan serah terima sebagai dokumen aktif sampai diaktivasi ulang.

### 5.3 Serah terima pakai scan (konsep kasir)

Analogi yang dipakai: di kasir, scan barang → barang ketemu + harga. Di sini, scan dokumen → dokumen ketemu + form serah terima.

1. Pemegang saat ini buka menu Scan Serah Terima.
2. Scan QR / barcode di label fisik dokumen (kamera HP via `html5-qrcode` / ZXing, atau scanner USB yang mengetik kode ke kolom input — keduanya harus didukung, jangan hanya satu).
3. Sistem cocokkan `kode_arsip` → tampilkan judul, status, pemegang saat ini, dan lokasi saat ini. Kalau kode tidak ketemu atau dokumen Non-Aktif / Ditolak, tampilkan error jelas, jangan biarkan lanjut.
4. Penyerah pilih penerima, lokasi baru, dan keterangan (opsional) → klik Serahkan. Status serah terima = `menunggu_konfirmasi`, `pemegang_saat_ini` belum berubah sampai penerima konfirmasi.
5. Penerima buka notifikasi / daftar serah terima masuk → Konfirmasi Terima (boleh scan ulang sebagai bukti) atau Tolak + alasan.
6. Kalau diterima: `pemegang_saat_ini` dan `lokasi_saat_ini` berubah, `tanggal_terima` terisi, sistem generate PDF bukti serah terima (kode, barcode / QR, penyerah, penerima, tanggal, kolom tanda tangan) yang bisa didownload dan di-print.
7. Semua langkah di atas tercatat di `log_aktivitas` dan `serah_terima`.

### 5.4 Pembayaran — perpanjangan dan reaktivasi

Paket v1 (bisa diubah Admin di `paket_pembayaran`):

| Paket | Efek kalau lunas |
|-------|------------------|
| Perpanjangan 1 Tahun | `tanggal_kadaluarsa` lama + 12 bulan. Hanya untuk dokumen Aktif atau mau kadaluarsa. |
| Reaktivasi Non-Aktif | Dokumen Non-Aktif → Aktif lagi 12 bulan, file dipindah balik dari `arsip-inaktif` ke `arsip-aktif`, `lokasi_saat_ini` kembali ke ruang aktif. |

Alur transfer manual (default v1):

1. User pilih dokumen → pilih paket → buat pembayaran → status `menunggu_verifikasi`, tampil instruksi transfer + upload bukti.
2. PIC Arsip / Admin cek bukti → verifikasi (isi `diverifikasi_oleh`, `paid_at`, `berlaku_sampai`).
3. Untuk reaktivasi, Atasan approve akhir sebelum status dokumen berubah.
4. Kalau lunas: tanggal kadaluarsa diperbarui, log `bayar` tercatat, User dapat notifikasi di dashboard.
5. Kalau bukti tidak valid: status `gagal` + alasan, User bisa upload ulang bukti tanpa membuat pembayaran baru yang duplikatif (diputuskan saat implementasi).

Alur Midtrans Sandbox (opsi, bukan wajib demo): buat order via API server → redirect Snap / QRIS → webhook verifikasi signature → langkah 2–4 sama, tanpa upload bukti manual. Jangan campur dua alur dalam satu pembayaran.

### 5.5 Download dan PDF

Ada 2 jenis download, dan keduanya harus lewat API server yang cek role + kepemilikan, bukan link Storage langsung:

1. **File asli dokumen** — signed URL Supabase berumur pendek. Viewer ditolak di API ini.
2. **Lembar arsip PDF** — dibuat dengan jsPDF di server / client dari data yang sudah terverifikasi: cover, metadata (judul, kode, kategori, tanggal, pemilik, pemegang, lokasi, status, tanggal kadaluarsa), gambar barcode / QR, dan ringkasan riwayat singkat. PDF ini juga yang dipakai sebagai label cetak.

Setiap download tercatat di log (`download`, siapa, dokumen apa, kapan).

### 5.6 Riwayat

Satu tabel `log_aktivitas` melayani dua tampilan:

- **Riwayat dokumen:** filter `dokumen_id` → timeline lengkap dari upload sampai pindah Non-Aktif.
- **Riwayat user:** filter `user_id` → semua aksi user itu (login dicatat terpisah bila perlu, tapi aksi dokumen wajib ada).

Aksi yang wajib dicatat: `upload`, `verifikasi_pic`, `approve_atasan`, `reject`, `lihat` (opsional, bisa dimatikan kalau terlalu ramai — putuskan saat implementasi, tapi `download` wajib), `download`, `pindah_nonaktif`, `bayar`, `serah_terima`.

## 6. Kebutuhan fungsional (ringkas)

| ID | Fitur | Kriteria terima |
|----|-------|-----------------|
| FR-01 | Register / login / logout | Hanya user terdaftar bisa masuk. Role diambil dari `profiles`, bukan dari input client. |
| FR-02 | Kelola profil + ganti role (Admin) | Admin ubah role, perubahan langsung berlaku di login berikutnya dan tercatat di log. |
| FR-03 | Kelola kategori + paket (Admin) | Kategori dan paket bisa tambah / nonaktifkan tanpa ubah kode. |
| FR-04 | Upload dokumen (User) | File tersimpan privat, kode arsip unik, status awal selalu `menunggu_persetujuan` walau client mengirim status lain. |
| FR-05 | Antrean approval PIC | PIC hanya lihat antrean menunggu, bisa verifikasi / tolak + alasan. |
| FR-06 | Antrean approval Atasan | Atasan hanya bisa approve akhir dokumen yang sudah diverifikasi PIC, kecuali ditolak PIC. |
| FR-07 | Dashboard per role | Angka dan daftar yang tampil sudah terfilter role, bukan semua data lalu disembunyikan di frontend. |
| FR-08 | Daftar + pencarian dokumen | Cari berdasarkan kode arsip, judul, nomor dokumen. Filter status, kategori, tanggal, pemegang, lokasi. |
| FR-09 | Detail dokumen + barcode / QR | Detail tampilkan metadata, status, sisa hari aktif, barcode / QR, pemegang, lokasi, dan timeline riwayat. |
| FR-10 | Scan serah terima | Scan kode yang salah / dokumen tidak aktif menampilkan error dan tidak membuat baris serah terima. |
| FR-11 | Konfirmasi serah terima | Pemegang hanya berubah setelah penerima konfirmasi, bukan saat penyerah klik Serahkan. |
| FR-12 | Cron kadaluarsa | Cron idempotent: dokumen yang sudah Non-Aktif tidak diproses ulang dan tidak membuat log duplikat. |
| FR-13 | Pembayaran + verifikasi | Pembayaran lunas mengubah tanggal kadaluarsa / status dokumen sesuai paket, dan hanya sekali (webhook / verifikasi ganda tidak menggandakan durasi). |
| FR-14 | Download aman | Viewer ditolak, Accounting boleh download dokumen + bukti, User hanya dokumen sendiri / yang dipegangnya. |
| FR-15 | PDF lembar arsip + bukti serah terima | PDF bisa dibuka, berisi kode + barcode / QR yang bisa dipindai ulang dari hasil print. |
| FR-16 | Log aktivitas | Setiap aksi FR-04 s.d. FR-15 yang berhasil / ditolak tercatat dengan pelaku dan waktu. |
| FR-17 | Peringatan kadaluarsa | Dokumen H-90 / H-30 / H-7 tampil badge dan masuk daftar peringatan dashboard pemilik + PIC. |

## 7. Halaman dan rute (Next.js App Router)

```
/login, /register
/dashboard                    → ringkasan per role
/dokumen                      → daftar + filter + pencarian
/dokumen/upload               → form upload (User)
/dokumen/[id]                 → detail + barcode + timeline riwayat
/dokumen/[id]/edit            → edit metadata (terbatas role + status)
/persetujuan                  → antrean PIC dan antrean Atasan (terpisah tab)
/serah-terima                 → scan + daftar masuk / keluar
/serah-terima/[id]            → detail + PDF bukti
/pembayaran                   → daftar pembayaran + buat pembayaran
/pembayaran/[id]              → detail + upload bukti + verifikasi
/riwayat                      → log aktivitas (filter user / dokumen)
/pengaturan/kategori          → Admin
/pengaturan/paket             → Admin
/pengaturan/pengguna          → Admin
/api/cron/expire-documents    → cron harian, pakai secret
/api/dokumen/[id]/download    → cek role, lalu signed URL
/api/pembayaran/webhook       → hanya untuk Midtrans, verifikasi signature
```

Middleware Next.js wajib cek sesi + role untuk rute di atas. Menyembunyikan menu di sidebar saja tidak cukup.

## 8. Data

- Skema lengkap: `supabase.sql`. Diagram: `erd.dbml`.
- Tabel: `profiles`, `kategori_dokumen`, `dokumen`, `paket_pembayaran`, `pembayaran`, `serah_terima`, `log_aktivitas`.
- Bucket Storage privat: `arsip-aktif`, `arsip-inaktif`, `bukti-pembayaran`, `barcode`.
- Aturan emas:
  - `kode_arsip` unik dan tidak boleh diubah setelah dibuat.
  - `status`, `tanggal_kadaluarsa`, dan `bucket` tidak boleh diubah langsung dari client — hanya lewat API server / cron / proses approval dan pembayaran yang sudah dicek rolenya.
  - `pemilik_id` selalu = user yang login saat upload, jangan percaya `pemilik_id` dari body request.

## 9. Kebutuhan non-fungsional

- **Keamanan:** RLS aktif di semua tabel, Storage privat, signed URL pendek, secret cron dan webhook tidak disimpan di repo, tidak ada password / API key di file `.env` contoh yang di-commit.
- **Audit:** tidak ada hapus log. Hapus dokumen permanen hanya soft-delete dulu bila memungkinkan, atau hapus permanen hanya oleh Admin setelah approve Atasan + alasan tercatat.
- **Kinerja:** daftar dokumen paginasi, index di `kode_arsip`, `pemilik_id`, `status`, `tanggal_kadaluarsa`. File upload dibatasi (misal maks 20 MB di v1, sesuaikan dengan kebutuhan dosen).
- **Keterbacaan:** tabel padat untuk kerja, bukan landing page. Lihat panduan desain anti-slop di skill `anti-slop-design`.
- **Aksesibilitas dasar:** label form jelas, kontras cukup, semua aksi penting bisa dipakai dengan keyboard, scan tetap bisa fallback ketik kode manual.

## 10. Desain — anti-slop

Desain aplikasi ini adalah alat kerja arsip, bukan landing page SaaS. Ikuti skill `anti-slop-design` (file `custom-skills/anti-slop-design/SKILL.md`):

- Identitas visual dari dunia arsip: kertas, tinta, cap / stempel, map folder, kode monospace — bukan gradien ungu-biru generik.
- Dashboard = tabel kerja yang padat, status berbentuk cap (border + huruf kapital), bukan badge gradien.
- Tidak ada hero, tidak ada 3 kartu fitur identik, tidak ada ilustrasi AI, tidak ada teks lorem.
- Setiap layar demo harus pakai data contoh yang nyata (`ARS-2026-0001`, nama kategori sungguhan, tanggal sungguhan), bukan `Dokumen 1`, `Dokumen 2`.

## 11. Asumsi dan risiko

| Asumsi / risiko | Mitigasi |
|-----------------|----------|
| Dosen belum menentukan gateway pembayaran | Default v1 transfer manual + verifikasi. Midtrans Sandbox hanya opsi, tidak memblokir demo. |
| Scanner fisik tidak tersedia saat demo | Scan kamera HP + ketik kode manual sebagai fallback wajib. |
| Cron Vercel / Supabase tidak jalan saat demo | Sediakan tombol manual “Jalankan pengecekan kadaluarsa” khusus PIC / Admin yang memanggil logika cron yang sama, supaya demo tidak bergantung pada jadwal. |
| File besar / format aneh | Batasi tipe dan ukuran di upload, tampilkan error yang jelas, jangan gagal diam-diam. |
| Role rangkap di demo | Pakai 6 akun contoh berbeda saat demo, satu akun satu role, supaya RLS kelihatan bekerja. |

## 12. Rencana pengerjaan (saran)

1. **Minggu 1 — fondasi:** Supabase Auth + `supabase.sql`, RLS, upload + daftar + detail dokumen, role dasar.
2. **Minggu 2 — alur inti:** approval PIC → Atasan, barcode / QR, scan serah terima + PDF bukti, log aktivitas.
3. **Minggu 3 — siklus dan uang:** cron kadaluarsa + pindah bucket, pembayaran manual + verifikasi, perpanjangan / reaktivasi, dashboard per role, polish desain anti-slop, uji 6 akun.

## 13. Checklist demo ke dosen

- [ ] Login sebagai 6 role berbeda, tunjukkan menu dan data yang berbeda.
- [ ] Upload 1 dokumen → PIC verifikasi → Atasan approve → barcode muncul.
- [ ] Scan QR dokumen itu → serah terima ke user lain → penerima konfirmasi → pemegang berubah.
- [ ] Tunjukkan dokumen mau kadaluarsa (badge H-90) dan satu dokumen Non-Aktif di gudang.
- [ ] Bayar perpanjangan 1 dokumen → verifikasi → tanggal kadaluarsa bertambah.
- [ ] Login sebagai Accounting: bisa download, tidak ada tombol upload / approve.
- [ ] Login sebagai Viewer: bisa lihat, tombol download tidak ada dan API menolak.
- [ ] Buka riwayat satu dokumen: semua langkah di atas tercatat berurutan.
