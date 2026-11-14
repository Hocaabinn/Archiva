# Akun Pengujian & Demonstrasi 6 Role R.03 (BLUEPRINT.md)

Dokumen ini adalah lembar panduan bagi penguji / dosen untuk mencoba autentikasi dengan 6 hak akses resmi R.03.

---

### Daftar Akun Demo R.03:

| No | Peran (Role) | Email Terdaftar | Kata Sandi | Deskripsi Hak Akses Utama |
|---|---|---|---|---|
| 1 | **Superadmin** (`superadmin`) | `admin@example.com` | `Arsip2026!` | Kelola akun/role, unit, kategori, lokasi, boks, pengaturan sistem sebagai maintainer |
| 2 | **PIC Arsip Aktif** (`pic_aktif`) | `pic.arsip@example.com` | `Arsip2026!` | Entri dokumen unitnya, edit metadata selagi menunggu, serah terima, cetak QR/barcode |
| 3 | **Atasan Arsip Aktif** (`atasan_aktif`) | `atasan@example.com` | `Arsip2026!` | Persetujuan entri PIC unitnya, pembatalan dokumen aktif (alasan wajib), persetujuan hapus |
| 4 | **PIC Arsip Inaktif** (`pic_inaktif`) | `pic.inaktif@example.com` | `Arsip2026!` | Kelola gudang inaktif, layanan peminjaman inaktif, pantau kapasitas gudang |
| 5 | **Atasan Arsip Inaktif** (`atasan_inaktif`) | `atasan.inaktif@example.com` | `Arsip2026!` | Pengawasan berkas inaktif, kapasitas gudang inaktif, tindak lanjut retensi |
| 6 | **Staff** (`staff`) | `accounting@example.com` | `Arsip2026!` | Melihat dan mengunduh seluruh dokumen resmi (tidak bisa entri, edit, hapus, approve) |
| 7 | **Staff (Alternatif)** (`staff`) | `viewer@example.com` | `Arsip2026!` | Melihat dan mengunduh seluruh dokumen resmi |
| 8 | **PIC Arsip Aktif (Pengaju)** (`pic_aktif`) | `pengaju@example.com` | `Arsip2026!` | Entri dokumen unit Keuangan |

---

### Aturan Pendaftaran Akun Mandiri:
Buka `/register`, isi Nomor Pegawai, Nama Lengkap, dan Jabatan. Akun baru secara otomatis terdaftar dengan peran **Staff** (view + download saja). Kenaikan peran ke peran operasional hanya dapat ditetapkan oleh **Superadmin** melalui menu Kelola Pengguna.
