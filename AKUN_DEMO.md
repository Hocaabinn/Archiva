# Akun Pengujian & Demonstrasi 6 Role (PRD)

Dokumen ini adalah lembar panduan bagi penguji / dosen untuk mencoba autentikasi dengan 6 hak akses resmi yang berbeda.

---

### Daftar Akun Demo:

| No | Peran (Role) | Email Terdaftar | Kata Sandi | Deskripsi Hak Akses Utama |
|---|---|---|---|---|
| 1 | **Admin Sistem** (`admin`) | `admin@instansi.go.id` | `Arsip2026!` | Kelola akun, kategori arsip, paket harga, pengaturan sistem |
| 2 | **PIC Arsip** (`pic_arsip`) | `pic.arsip@instansi.go.id` | `Arsip2026!` | Verifikasi Tahap 1, klasifikasi, cetak label barcode/QR, serah terima |
| 3 | **Atasan** (`atasan`) | `atasan@instansi.go.id` | `Arsip2026!` | Approval akhir dokumen, persetujuan reaktivasi & hapus permanen |
| 4 | **Pengaju / User** (`user`) | `pengaju@instansi.go.id` | `Arsip2026!` | Upload berkas mandiri, serah terima dokumen miliknya, bayar retensi |
| 5 | **Accounting** (`accounting`) | `accounting@instansi.go.id` | `Arsip2026!` | View & download berkas + bukti pembayaran (tidak bisa create/approve) |
| 6 | **Viewer** (`viewer`) | `viewer@instansi.go.id` | `Arsip2026!` | Hanya melihat daftar & detail (dilarang download file fisik) |

---

### Cara Pendaftaran Akun Pengaju Mandiri:
Buka `http://localhost:3000/register`, isi NIP, Nama Lengkap, dan Unit Kerja. Akun otomatis terdaftar sebagai Pengaju (User).
