# GEMINI.md — Aplikasi Arsip Dokumen

File ini dibaca otomatis oleh Gemini CLI / Antigravity kalau diletakkan di root
project. Jangan hapus file PRD dan desain di bawah ini, file ini hanya penunjuknya.
Disinkronkan 14 Nov 2026 ke BLUEPRINT.md R.03 (patokan: Blueprint).

## Proyek ini apa

Aplikasi Arsip Dokumen dengan Next.js (App Router) + Supabase (Auth, Postgres, Storage).
Dokumen: entri oleh PIC Arsip Aktif per unit → persetujuan Atasan Arsip Aktif → Aktif 3 tahun →
otomatis Inaktif (cron harian, pindah bucket) → dipinjam lewat PIC Arsip Inaktif
(tetap Inaktif). Pembatalan oleh Atasan Arsip Aktif (alasan wajib) → Dibatalkan.
Setiap dokumen punya kode arsip untuk QR, dan setiap perpindahan dicatat
lewat scan serah terima gaya kasir.

## Patokan — baca dulu sebelum coding

1. `BLUEPRINT.md` versi R.03 adalah spesifikasi utama. Kalau ada yang bertentangan
   dengan BLUEPRINT.md, ikuti BLUEPRINT.md.
2. `PRD.md`, `DESIGN.md`, `erd.dbml`, `supabase.sql` BELUM disinkronkan dengan model
   terbaru — jangan jadikan patokan untuk alur, status, atau kode. DESIGN.md masih
   boleh dipakai untuk token dan layout; abaikan bagian yang menyebut pembayaran,
   Non-Aktif, atau ARS-2026-0001.
3. Skema database yang benar ada di `BLUEPRINT.md` 4.3 dan 4.4 (10 tabel: profiles,
   unit_organisasi, kategori_dokumen, lokasi, boks, dokumen, peminjaman, serah_terima, log_aktivitas, notifikasi)
   + `erd-master.dbml` dan `erd-dokumen.dbml`.
4. Supabase live (project "App-Documen-Arsip") dimigrasi ke skema blueprint R.02; migrasi ke skema R.03 belum dikerjakan.
   JANGAN jalankan `supabase.sql` mentah di project live.
5. Skill anti-slop: `.agents/skills/anti-slop-design/SKILL.md` (workspace) atau
   `~/.gemini/skills/anti-slop-design/SKILL.md` (global). Kalau skill belum terpasang,
   baca langsung file `custom-skills/anti-slop-design/SKILL.md` dari paket ini dan
   ikuti aturannya.

## Model yang berlaku — jangan pakai model lama

- Kode arsip = kode SIG: `TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER`, contoh
  `2025_2000_1500013765_1900009386`. Disusun otomatis dari Master Organisasi dan nomor payment yang diinput
  (satu input saja, bisa diketik / di-scan barcode-QR / voice typing). Unik, tidak diubah, tidak dipakai ulang. QR label utama; barcode opsional.
  TIDAK ADA kode internal `ARS-2026-0001`.
- PPL = Permintaan Pembayaran Langsung; nomor PPL = No. Payment (sama, 10 digit).
- Profil: nama, email, nomor pegawai, jabatan, unit (+ role).
- Status dokumen (5): `menunggu_persetujuan`, `aktif`, `ditolak`, `inaktif`,
  `dibatalkan`. TIDAK ADA `nonaktif`, Draft, Final, Terkirim, Diterima.
- TIDAK ADA pembayaran di aplikasi: tidak ada tabel paket_pembayaran / pembayaran,
  tidak ada bayar, tidak ada perpanjangan / reaktivasi lewat bayar. Dokumen Inaktif
  yang masih dibutuhkan DIPINJAM ke PIC Arsip Inaktif lewat fitur peminjaman dan
  TETAP Inaktif.
- Notifikasi: dashboard + surel (SMTP sama dengan OTP). BUKAN push.
- Lampiran: PDF, XLSX, DOCX, JPG, PNG; total maks 25 MB per dokumen (Superadmin
  dapat mengubah di Pengaturan Sistem); opsional semua kategori; terpisah dari berkas
  utama; tambah / hapus hanya saat menunggu_persetujuan / ditolak; penyimpanan privat
  + tautan bertanda waktu; mengikuti bucket dokumennya.
- Serah terima: scan QR / barcode → penerima konfirmasi → pemegang berubah.
  Hanya dokumen Aktif.
- Pembatalan: hanya Atasan Arsip Aktif, alasan wajib. Dokumen tetap dapat dilihat dengan penanda
  DIBATALKAN; kode arsip tidak dipakai ulang.
- Storage privat: bucket `arsip-aktif` dan `arsip-inaktif`.

## Role (6, baru R.03) — jangan diubah tanpa persetujuan user

`superadmin` (Superadmin), `pic_aktif` (PIC Arsip Aktif per unit), `atasan_aktif` (Atasan Arsip Aktif),
`pic_inaktif` (PIC Arsip Inaktif), `atasan_inaktif` (Atasan Arsip Inaktif), `staff` (Staff, view + download saja).
Detail boleh / tidak boleh tiap role ada di BLUEPRINT.md Bab 5.

- `superadmin` — kelola user / role, unit, kategori, lokasi, boks, setting sebagai maintainer. Akses darurat semua dokumen Aktif + Inaktif. Hapus permanen hanya setelah persetujuan Atasan tercatat di log. TIDAK ikut campur operasional transaksi harian normal. TIDAK BISA aktivasi / deaktivasi akun user (aktivasi / deaktivasi hanya berlaku untuk dokumen).
- `pic_aktif` — mengentri dokumen unitnya, mengedit metadata sendiri saat menunggu_persetujuan, klasifikasi, serah terima, cetak QR / barcode. Tidak kelola user. TIDAK memverifikasi entrinya sendiri.
- `atasan_aktif` — persetujuan entri PIC Arsip Aktif unitnya, pembatalan dokumen Aktif, persetujuan hapus. Tidak upload, tidak edit isi dokumen, tidak kelola user.
- `pic_inaktif` — mengelola arsip Inaktif, melayani peminjaman Inaktif, mengawasi kapasitas gudang Inaktif. Tidak kelola user.
- `atasan_inaktif` — mengawasi penerimaan berkas Inaktif, kapasitas gudang Inaktif, proses lanjutan arsip setelah retensi aktif. Tidak upload, tidak edit isi dokumen, tidak kelola user.
- `staff` — view + download saja (mis. Staff Accounting). Tidak entri / edit / hapus / approve.
- Registrasi baru default Staff. Hanya Superadmin yang mengubah role.
- Master Organisasi: dokumen otomatis terikat ke unit PIC yang sedang login, tanpa memilih unit manual.
- Master Lokasi: Gedung > Ruangan > Rak, dipilih dari dropdown (bukan free text); Boks ada di dalam Rak, nomor urut otomatis, kapasitas maks 500 lembar, QR tersendiri per boks.


## Aturan keras

- Status, tanggal kadaluarsa, dan bucket dokumen tidak boleh diubah dari client.
  Hanya lewat API server / cron / proses approval yang sudah dicek rolenya.
- Download file harus lewat API server yang cek role dulu, lalu signed URL Supabase
  berumur pendek. Khusus `staff`: tolak entri / edit / hapus / approve di API, jangan hanya
  sembunyikan tombol di frontend.
- `kode_arsip` unik dan tidak boleh diubah setelah dibuat.
- Setiap aksi penting wajib tercatat di `log_aktivitas`: entri, persetujuan Atasan Arsip Aktif,
  tolak, download, pindah Inaktif, peminjaman, serah terima, pembatalan.
- Ikuti skill anti-slop-design untuk semua UI: identitas kertas / tinta / cap,
  tabel kerja padat, status berbentuk cap, kode monospace, tanpa gradien ungu-biru,
  tanpa hero marketing, tanpa ilustrasi AI, tanpa data palsu.
- Kerja bertahap: kerjakan satu tahap sesuai prompt, verifikasi sebelum lanjut.
  Jangan tambah fitur di luar BLUEPRINT.md. Jangan ubah role, skema, atau alur
  approval tanpa konfirmasi user.

## Perintah pertama yang disarankan

> Baca BLUEPRINT.md (R.03) di folder arsip-dokumen. Kode live masih model R.02 — jangan coding sebelum user memberi prompt migrasi R.03. Lalu kerjakan Tahap 1: migrasi
> Supabase live ke skema blueprint (4.3 / 4.4). Jangan jalankan supabase.sql mentah.
> Jangan ubah role, skema, atau alur approval tanpa konfirmasi.
