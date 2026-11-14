# AGENTS.md — Aplikasi Arsip Dokumen (Antigravity)

File ini dibaca Antigravity sebagai aturan project. Isinya sama dengan GEMINI.md,
ditulis ulang di sini supaya Antigravity tidak perlu menebak dari chat.
Disinkronkan 14 Nov 2026 ke BLUEPRINT.md R.03 (patokan: Blueprint).

## Proyek

Next.js (App Router) + Supabase. Alur: entri oleh PIC Arsip Aktif per unit → Atasan Arsip Aktif
approve → Aktif 3 tahun → Inaktif otomatis (cron harian, pindah bucket) →
dipinjam lewat PIC Arsip Inaktif (tetap Inaktif). Pembatalan oleh Atasan Arsip Aktif
(alasan wajib) → Dibatalkan. QR per dokumen, serah terima lewat scan.

## Patokan — baca dulu sebelum coding

- `BLUEPRINT.md` versi R.03 adalah spesifikasi utama. Kalau ada yang bertentangan
  dengan BLUEPRINT.md, ikuti BLUEPRINT.md.
- `PRD.md`, `DESIGN.md`, `erd.dbml`, `supabase.sql` BELUM disinkronkan dengan model
  terbaru — jangan jadikan patokan untuk alur, status, atau kode. DESIGN.md masih
  boleh dipakai untuk token dan layout; abaikan bagian yang menyebut pembayaran,
  Non-Aktif, atau ARS-2026-0001.
- Skema database yang benar ada di `BLUEPRINT.md` 4.3 dan 4.4 (10 tabel: profiles,
  unit_organisasi, kategori_dokumen, lokasi, boks, dokumen, peminjaman, serah_terima, log_aktivitas, notifikasi)
  + `erd-master.dbml` dan `erd-dokumen.dbml`.
- Supabase live (project "App-Documen-Arsip") dimigrasi ke skema blueprint R.02; migrasi ke skema R.03 belum dikerjakan.
  JANGAN jalankan `supabase.sql` mentah di project live.
- Skill: `.agents/skills/anti-slop-design/SKILL.md` di project ini.

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

- Jangan ubah status, tanggal kadaluarsa, atau bucket dari client.
- Download lewat API server + cek role + signed URL pendek. Tolak entri / edit / hapus / approve oleh `staff` di API.
- `kode_arsip` unik, tidak boleh diubah.
- Catat semua aksi penting di `log_aktivitas`: entri, persetujuan Atasan Arsip Aktif, tolak,
  download, pindah_inaktif, peminjaman, serah_terima, pembatalan.
- UI wajib ikut skill anti-slop-design: kertas / tinta / cap, tabel padat,
  tanpa gradien generik, tanpa hero, tanpa data palsu.
- Kerja bertahap: kerjakan satu tahap sesuai prompt, verifikasi sebelum lanjut.
  Jangan tambah fitur di luar BLUEPRINT.md. Jangan ubah role, skema, atau alur
  approval tanpa konfirmasi user.

## Perintah pertama yang disarankan

> Baca BLUEPRINT.md (R.03) di folder arsip-dokumen. Kode live masih model R.02 — jangan coding sebelum user memberi prompt migrasi R.03. Lalu kerjakan Tahap 1: migrasi
> Supabase live ke skema blueprint (4.3 / 4.4). Jangan jalankan supabase.sql mentah.
> Jangan ubah role, skema, atau alur approval tanpa konfirmasi.
