# GEMINI.md — Aplikasi Arsip Dokumen

File ini dibaca otomatis oleh Gemini CLI / Antigravity kalau diletakkan di root
project. Jangan hapus file PRD dan desain di bawah ini, file ini hanya penunjuknya.

## Proyek ini apa

Aplikasi Arsip Dokumen dengan Next.js (App Router) + Supabase (Auth, Postgres, Storage).
Dokumen: upload → verifikasi PIC Arsip → persetujuan akhir Atasan → Aktif 3 tahun →
otomatis Non-Aktif (pindah bucket) → bisa diperpanjang / diaktivasi ulang lewat pembayaran.
Setiap dokumen punya kode arsip untuk barcode / QR, dan setiap perpindahan dicatat
lewat scan serah terima gaya kasir.

## Dokumen yang wajib dibaca dulu sebelum coding

1. `arsip-dokumen/PRD.md` — PRD lengkap, 6 role, alur, dan kriteria terima.
   Kalau file-file ini sudah dipindah ke root project, sesuaikan path-nya, tapi isinya
   tetap yang jadi acuan, bukan tebakan dari chat.
2. `arsip-dokumen/DESIGN.md` — token desain dan layout.
3. `arsip-dokumen/erd.dbml` dan `arsip-dokumen/supabase.sql` — skema dan RLS.
4. Skill anti-slop: `.agents/skills/anti-slop-design/SKILL.md` (workspace) atau
   `~/.gemini/skills/anti-slop-design/SKILL.md` (global). Kalau skill belum terpasang,
   baca langsung file `custom-skills/anti-slop-design/SKILL.md` dari paket ini dan
   ikuti aturannya.

## 6 role — jangan diubah tanpa persetujuan user

- `admin` — Admin Sistem: kelola user/role, kategori, paket, setting. Akses darurat
  semua dokumen. Hapus permanen hanya setelah Atasan approve (dicatat di log).
- `pic_arsip` — PIC Arsip: verifikasi tahap 1, klasifikasi, serah terima,
  pindah Aktif → In-Aktif, cetak barcode/QR. Tidak kelola user / harga.
- `atasan` — Approval akhir: dokumen sensitif, hapus, reaktivasi, perpanjangan.
  Tidak upload, tidak edit isi, tidak kelola user.
- `user` — Upload dan kelola dokumen sendiri, bayar perpanjangan / reaktivasi sendiri.
- `accounting` — View + download dokumen dan pembayaran saja. Tidak create / edit /
  hapus / approve.
- `viewer` — View daftar + detail saja. Tidak download, tidak create / edit / approve,
  tidak lihat detail pembayaran dan serah terima.

## Aturan keras

- Status, tanggal kadaluarsa, dan bucket dokumen tidak boleh diubah dari client.
  Hanya lewat API server / cron / proses approval dan pembayaran yang sudah dicek rolenya.
- Download file harus lewat API server yang cek role dulu, lalu signed URL Supabase
  berumur pendek. Khusus `viewer`: tolak pembuatan signed URL di API, jangan hanya
  sembunyikan tombol di frontend.
- `kode_arsip` unik dan tidak boleh diubah setelah dibuat.
- Setiap aksi penting wajib tercatat di `log_aktivitas`: upload, verifikasi PIC,
  approve Atasan, reject, download, pindah Non-Aktif, bayar, serah terima.
- Ikuti skill anti-slop-design untuk semua UI: identitas kertas / tinta / cap,
  tabel kerja padat, status berbentuk cap, kode monospace, tanpa gradien ungu-biru,
  tanpa hero marketing, tanpa ilustrasi AI, tanpa data palsu.

## Perintah pertama yang disarankan

> Baca PRD.md dan DESIGN.md di folder arsip-dokumen, lalu kerjakan sesuai milestone
> di PRD. Jangan ubah role, skema, atau alur approval tanpa konfirmasi.