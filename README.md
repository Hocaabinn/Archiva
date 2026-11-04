# Sistem Informasi Tata Kelola Dokumen & Arsip Instansi Terintegrasi

[![Lisensi](https://img.shields.io/badge/Lisensi-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Basis%20Data-Supabase%20Postgres-3ECF8E.svg?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Gaya-Tailwind%20CSS%20v4-38BDF8.svg?logo=tailwindcss)](https://tailwindcss.com/)

Aplikasi berbasis web modern untuk pengelolaan, retensi, verifikasi bertingkat, serta serah terima fisik dan digital arsip dokumen dinas instansi pemerintah maupun korporasi secara tertib, sahih, dan berkekuatan hukum.

---

## 📌 Daftar Isi

- [Tentang Aplikasi](#-tentang-aplikasi)
- [Fitur Utama](#-fitur-utama)
- [Peran Pengguna & Hak Akses (6 Tingkatan)](#-peran-pengguna--hak-akses-6-tingkatan)
- [Arsitektur & Tumpukan Teknologi](#-arsitektur--tumpukan-teknologi)
- [Struktur Direktori Proyek](#-struktur-direktori-proyek)
- [Panduan Instalasi & Menjalankan Aplikasi](#-panduan-instalasi--menjalankan-aplikasi)
- [Logbook Rekam Jejak Pengembangan Proyek](#-logbook-rekam-jejak-pengembangan-proyek)
- [Lisensi](#-lisensi)

---

## 🏛️ Tentang Aplikasi

Sistem Informasi Tata Kelola Dokumen & Arsip dirancang khusus untuk menjawab tantangan pengelolaan arsip konvensional:
1. **Keamanan & Validitas:** Memastikan setiap arsip terindeks dengan kode arsip unik (`kode_arsip`), berbarcode fisik, dan terverifikasi secara berjenjang.
2. **Kepatuhan Masa Retensi:** Dokumen berstatus **Aktif selama 3 tahun**, yang secara otomatis bertransisi ke status **In-Aktif/Non-Aktif** dengan pemindahan bucket penyimpanan terisolasi.
3. **Pencatatan Rantai Kustodi:** Setiap perpindahan dokumen fisik diwajibkan melalui proses serah terima terotentikasi gaya kasir/ekspedisi dengan pemindaian barcode.
4. **Antarmuka Elegan & Anti-Distraksi:** Mengadopsi palet biru kedinasan berpadu dengan animasi orbital mekanik (*Celestial Orrery*) untuk pengalaman autentikasi yang profesional.

---

## 🚀 Fitur Utama

- **Autentikasi Terintegrasi & Aman:**
  - Pendaftaran mandiri akun pegawai dengan jabatan instansi (Sekretaris, Keuangan, SDM, maupun jabatan lainnya).
  - Pembangkit kata sandi kukuh otomatis berbasis kosakata baku Kamus Besar Bahasa Indonesia (KBBI).
  - Fitur pemulihan kata sandi kedinasan (*Lupa Kata Sandi*) terenkripsi.
- **Verifikasi & Persetujuan Dokumen 2 Tingkat:**
  - Verifikasi kelengkapan berkas fisik & digital oleh **PIC Arsip**.
  - Persetujuan akhir (*Approval*) dokumen sensitif, retensi, dan pemusnahan oleh **Atasan**.
- **Pelacakan Fisik (Barcode & Serah Terima):**
  - Pembuatan barcode & kode QR otomatis untuk label sampul berkas fisik.
  - Modul serah terima dokumen fisik dengan buku ekspedisi digital.
- **Log Audit & Jejak Rekam (Audit Trail):**
  - Seluruh mutasi berkas (unggah, periksa, setujui, tolak, unduh, serah terima, reaktivasi) tercatat abadi pada tabel `log_aktivitas`.

---

## 👥 Peran Pengguna & Hak Akses (6 Tingkatan)

Sistem membedakan hak akses secara ketat melalui Kebijakan Keamanan Tingkat Baris (*Row Level Security / RLS*):

| Peran (*Role*) | Sebutan Jabatan | Cakupan Kewenangan & Hak Akses |
|---|---|---|
| `admin` | **Administrator Sistem** | Mengelola pengguna, hak akses, kategori arsip, master tarif retensi, serta akses darurat ke seluruh dokumen. Pemusnahan permanen wajib persetujuan Atasan. |
| `pic_arsip` | **Petugas / PIC Arsip** | Verifikasi tahap pertama, klasifikasi berkas, pemindahan status aktif ke in-aktif, cetak barcode/QR, dan validasi serah terima fisik. |
| `atasan` | **Pimpinan / Pejabat Penyetuju** | Otoritas persetujuan akhir dokumen sensitif, perpanjangan masa retensi, reaktivasi dokumen non-aktif, dan disposisi pemusnahan berkas. |
| `user` | **Pengaju / Pegawai Instansi** | Mengunggah dokumen milik unit kerja sendiri, memantau disposisi, serta mengajukan perpanjangan masa aktif dokumen. |
| `accounting` | **Bagian Keuangan** | Memeriksa dan mengunduh rekapan dokumen berbayar, faktur perpanjangan retensi, serta status transaksi kas masuk. |
| `viewer` | **Peninjau Tamu** | Penelusuran dan pratinjau metadata daftar dokumen saja. Dilarang mengunduh berkas fisik/digital maupun mengakses informasi serah terima. |

---

## 🛠️ Arsitektur & Tumpukan Teknologi

- **Kerangka Kerja Antarmuka:** [Next.js 16](https://nextjs.org/) (App Router & React 19) dengan kompilator kilat [Turbopack](https://turbo.build/).
- **Bahasa Pemrograman:** [TypeScript](https://www.typescriptlang.org/) dengan pengetikan tipe data ketat (*strict type-safety*).
- **Penataan Gaya UI:** [Tailwind CSS v4](https://tailwindcss.com/) dengan palet biru kedinasan dan efek animasi Celestial Orrery.
- **Ikonografi:** [Lucide React](https://lucide.dev/).
- **Basis Data & Autentikasi:** [Supabase](https://supabase.com/) (PostgreSQL 15, Supabase Auth SSR, Storage Bucket Privat, serta Row Level Security).

---

## 📂 Struktur Direktori Proyek

```plaintext
Aplikasi-Dokumen-Arsip/
├── src/
│   ├── app/                      # Rute halaman Next.js App Router
│   │   ├── dashboard/            # Dasbor kerja dan lembar kendali arsip
│   │   ├── login/                # Halaman autentikasi masuk sistem
│   │   ├── register/             # Halaman pendaftaran akun pengaju
│   │   ├── globals.css           # Konfigurasi gaya CSS & animasi orrery
│   │   ├── layout.tsx            # Tata letak utama aplikasi
│   │   └── page.tsx              # Rute gerbang pengalihan (redirect)
│   ├── components/               # Komponen antarmuka modular
│   │   ├── auth/                 # Formulir masuk, daftar, dan pemulihan
│   │   ├── common/               # Komponen pelindung hidrasi DOM
│   │   ├── layout/               # Navigasi bilah samping & kepala halaman
│   │   └── ui/                   # Lencana status cap, stempel, dan tombol
│   ├── lib/
│   │   └── supabase/             # Klien Supabase (Browser, Server, Middleware)
│   ├── middleware.ts             # Lapisan pengaman sesi & pembatasan rute
│   └── types/                    # Definisi antarmuka TypeScript
├── supabase.sql                  # Skema basis data, trigger relasi, dan RLS
├── DESIGN.md                     # Pedoman desain visual anti-slop
├── PRD.md                        # Dokumen Persyaratan Produk (PRD) resmi
└── README.md                     # Dokumentasi komprehensif proyek
```

---

## ⚡ Panduan Instalasi & Menjalankan Aplikasi

### 1. Pra-syarat Perangkat Lunak
- **Node.js**: Versi `>= 20.x` (disarankan LTS 22.x).
- **NPM**: Versi `>= 10.x`.
- **Proyek Supabase**: URL dan Kunci Anonim (*Supabase Anon Key*).

### 2. Kloning Repositori
```bash
git clone https://github.com/Hocaabinn/Aplikasi-Dokumen-Arsip.git
cd Aplikasi-Dokumen-Arsip
```

### 3. Pasang Dependensi
```bash
npm install
```

### 4. Konfigurasi Variabel Lingkungan
Salin file `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```
Lalu lengkapi kredensial basis data Supabase Anda di dalam `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://nama-proyek-anda.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Inisialisasi Basis Data Supabase
Jalankan seluruh skrip SQL yang ada pada berkas [`supabase.sql`](supabase.sql) pada menu **SQL Editor** di dasbor Supabase Anda.

### 6. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka peramban (*browser*) Anda pada tautan [http://localhost:3000](http://localhost:3000).

---

## 📝 Logbook Rekam Jejak Pengembangan Proyek

Berikut adalah tabel rekam jejak (*logbook*) kegiatan teknis yang telah diselesaikan untuk pelaporan kerja atau dokumentasi portofolio:

| No. | Tanggal | Tahapan Pengembangan | Rincian Aktivitas Teknis | Status |
|:---:|:---:|:---|:---|:---:|
| 1 | 03 Nov 2026 | **Inisialisasi Fondasi & Kerangka Proyek** | Penyiapan kerangka kerja Next.js 16 (App Router), konfigurasi TypeScript ketat, pemasangan Tailwind CSS v4, dan penyiapan berkas konfigurasi middleware proksi. | Selesai |
| 2 | 03 Nov 2026 | **Desain Skema Basis Data & Keamanan RLS** | Penyusunan skema relasional tabel arsip, kategori, riwayat mutasi, penetapan 6 tingkatan peran, fungsi trigger PostgreSQL, dan berkas `supabase.sql`. | Selesai |
| 3 | 03 Nov 2026 | **Penanganan Kesalahan Hidrasi DOM Browser** | Pembuatan komponen `HydrationErrorSuppressor` untuk menangani interferensi atribut ekstensi peramban (`bis_skin_checked`) pada Next.js. | Selesai |
| 4 | 03 Nov 2026 | **Pembangunan Antarmuka Otentikasi Registrasi** | Pembuatan formulir pendaftaran akun pengaju dengan pembagian 2 kolom (*split-panel*), dropdown jabatan instansi dinamis, dan penyesuaian teks penjelasan hak akses. | Selesai |
| 5 | 03 Nov 2026 | **Modernisasi Gaya Desain & Palet Warna** | Transformasi palet warna antarmuka dari krem kertas menjadi biru kedinasan modern (`#F0F5FA` dan `#1E3A5F`) dengan aksen garis formal. | Selesai |
| 6 | 03 Nov 2026 | **Implementasi Animasi Latar Celestial Orrery** | Pembuatan efek latar belakang lintasan orbital melingkar murni (*celestial orrery*) berserta titik planet bercahaya biru menggunakan CSS keyframes modern. | Selesai |
| 7 | 03 Nov 2026 | **Pembuatan Efek Teks Ketik Bergantian** | Implementasi animasi ketik huruf berulang (*looping typewriter*) dengan kombinasi warna putih dan biru terang pada panel informasi instansi. | Selesai |
| 8 | 03 Nov 2026 | **Penyelarasan Antarmuka Masuk (Login)** | Menyelaraskan tata letak halaman masuk agar identik dengan halaman daftar, serta menambahkan modal layanan *Lupa Kata Sandi*. | Selesai |
| 9 | 03 Nov 2026 | **Pembangkit Kata Sandi Berbahasa Baku KBBI** | Penyematan generator kata sandi kukuh otomatis yang memanfaatkan kosakata resmi arsip berbahasa Indonesia baku (*Warkat, Sahih, Naskah, dsb.*). | Selesai |
| 10 | 03 Nov 2026 | **Optimalisasi Tata Letak Responsif Ponsel Pintar** | Pembalikan urutan elemen (*flex/grid order*) pada layar seluler agar panel identitas instansi tampil di atas formulir pengisian data. | Selesai |
| 11 | 04 Nov 2026 | **Integrasi Animasi Interaktif Alur Dokumen** | Penggantian latar orbital menjadi simulasi siklus hidup dokumen arsip: pemindaian berkas, stempel terverifikasi, dan penghitung dinamis. | Selesai |
| 12 | 04 Nov 2026 | **Modul Simulasi Pencarian dan Tindakan Arsip** | Implementasi outro animasi dengan jendela Cari Arsip, unduh file aktif, hapus file inaktif, aktivasi status, dan tombol simpan. | Selesai |
| 13 | 04 Nov 2026 | **Penyusunan Slogan Zigzag dan Efek Fokus** | Penataan 6 butir slogan kearsipan dinas dengan bingkai sudut HUD dinamis dan pergeseran fokus bersiklus zigzag. | Selesai |
| 14 | 04 Nov 2026 | **Penyelarasan Ruang Bebas Vertikal Footer** | Penyesuaian ketinggian slogan nomor 05 dan 06 serta pengurangan jarak padding border footer agar terbebas dari tabrakan garis. | Selesai |
| 15 | 04 Nov 2026 | **Penskalaan Responsif Multi-Resolusi Layar** | Implementasi ResizeObserver dinamis 0.48x hingga 1.4x serta media query penyembunyian slogan samping pada layar ponsel sempit. | Selesai |
| 16 | 05 Nov 2026 | **Fitur Toggle Intip Sandi dengan Hashing Simbolik** | Penambahan tombol interaktif ikon mata dengan masking hashing unik (kombinasi angka & simbol acak 1:1) tanpa membocorkan teks mentah. | Selesai |
| 17 | 05 Nov 2026 | **Validasi Panjang Kata Sandi Ketat** | Penegakan atribut minLength 8 dan maxLength 15 serta penyesuaian generator kata sandi KBBI agar selalu tepat 8-15 karakter. | Selesai |
| 18 | 05 Nov 2026 | **Pemasangan Pustaka Bcryptjs & Aset Logo** | Instalasi dependensi bcryptjs, integrasi aset grafis logo1 dan logo gabungan Archiva pada folder pic dan public/pic. | Selesai |

---

## 📄 Lisensi

Proyek ini dilindungi di bawah lisensi terbuka [MIT License](LICENSE).
Hak Cipta (c) 2026 **Hocaabinn**. Seluruh hak cipta dilindungi undang-undang.
