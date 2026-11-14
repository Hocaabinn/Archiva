# BLUEPRINT

## APLIKASI ARSIP DOKUMEN

### Versi R.03

### Kerja Praktik — 2026

> Blueprint Aplikasi Arsip Dokumen untuk Kerja Praktik (KP) di
> PT Semen Indonesia (Persero) Tbk — Departemen Akuntansi. Dokumen ini
> disusun sebagai acuan perancangan dan pengembangan aplikasi, dengan
> ruang lingkup yang disesuaikan dengan kegiatan Kerja Praktik.

---

# KONTROL DOKUMEN

Kontrol Dokumen ini mencatat riwayat perubahan blueprint. Setiap kali
ada perubahan setelah konfirmasi pembimbing / dosen, tambah satu baris
baru, jangan timpa baris lama.

| Versi | Tanggal | Deskripsi | Penyusun |
| --- | --- | --- | --- |
| R.01 | 5 Nov 2026 | Penyusunan awal blueprint: ruang lingkup dan perancangan sistem, aturan penomoran dan masa aktif, skenario sistem dan desain sistem | Miftahul Ilmi (3022410701) |
| R.02 | 6 Nov 2026 | Penyesuaian struktur dokumen: penyempurnaan Kontrol Dokumen dan Daftar Isi; penambahan perusahaan tempat Kerja Praktik pada Latar Belakang; pemisahan Maksud dan Tujuan; serta penyesuaian Ruang Lingkup, Perancangan Sistem, dan Mapping Role dengan kebutuhan aplikasi arsip dokumen | Miftahul Ilmi (3022410701) |
| R.03 | 14 Nov 2026 | Revisi ke-2 dari rekaman diskusi 14 Nov 2026 (Revisi ke2.aac dan Revisi2 (1).aac, diringkas NotebookLM, dikonfirmasi user): menghapus peran Pengaju, mengentri dokumen oleh PIC Arsip Aktif per unit, menyetujui dokumen oleh Atasan Arsip Aktif, memisah PIC dan Atasan menjadi Aktif/Inaktif, melebur Accounting+Viewer menjadi Staff, mengganti Admin Sistem menjadi Superadmin (maintainer), menyederhanakan input nomor menjadi satu nomor payment, menyusun kode arsip otomatis dari Master Organisasi, dan memakai Master Lokasi bertingkat Gedung > Ruangan > Rak dengan Boks di dalam Rak | Miftahul Ilmi (3022410701) |

# LEMBAR PENGESAHAN

Dengan ini dinyatakan bahwa isi dokumen blueprint **Aplikasi Arsip Dokumen**
telah sesuai dengan kebutuhan yang disepakati dan menjadi dasar pengembangan
aplikasi untuk Kerja Praktik.

| Pemilik Proses | Pembimbing Lapangan | Penyusun |
| --- | --- | --- |
| [Nama / Jabatan] | [Nama Pembimbing Lapangan] | Miftahul Ilmi |
| [Unit Kerja] | PT Semen Indonesia (Persero) Tbk — Departemen Akuntansi | Sistem Informasi UISI |

\*Isi nama dan jabatan yang sebenarnya sebelum dicetak. Jangan menyalin
nama pemilik proses / penyusun dari blueprint teman.\*

---

# DAFTAR ISI

Daftar isi ini sengaja dipangkas. Teman punya sekitar 50 entri (10 bab,
12 sub-bab ruang lingkup, 8 flow, 15 layar). Blueprint ini punya sekitar
25 entri — cukup untuk KP, dan setiap entri di bawah ini ada isinya di
PRD / SQL kita, bukan bab kosong.

- Kontrol Dokumen
- Lembar Pengesahan
- Daftar Isi
- Daftar Tabel
- Daftar Gambar
- Daftar Simbol Flowchart
- 1. Latar Belakang
- 2. Maksud dan Tujuan
- 3. Ruang Lingkup
- 3.1 Manajemen Pengguna dan Organisasi
- 3.2 Penomoran dan Kode Arsip
- 3.3 Pengajuan dan Persetujuan Dokumen
- 3.4 Masa Aktif dan Inaktif
- 3.5 Serah Terima
- 3.6 Peminjaman Dokumen Inaktif
- 3.7 Log History dan Pencarian
- 3.8 Notifikasi
- 3.9 Di Luar Lingkup
- 4. Perancangan Sistem
- 4.1 Topology Server (sederhana)
- 4.2 Teknologi
- 4.3 Design Entity Relationship Diagram
    - 4.3.1 Master Pengguna, Organisasi, Kategori, dan Lokasi
    - 4.3.2 Dokumen, Serah Terima, Peminjaman, dan Notifikasi
- 4.4 Kamus Data
- 5. Mapping Role
- 5.1 Role Pengguna
- 5.2 Hak Akses terhadap Dokumen
- 6. Jenis Dokumen, Penomoran, dan Aturan
- 6.1 Jenis Dokumen
- 6.2 Aturan Penomoran
- 6.3 Aturan Persetujuan dan Status
- 6.4 Lampiran Dokumen
- 6.5 Peristiwa Notifikasi
- 6.6 Pembatalan
- 7. Standarisasi Kode
- 8. Skenario Sistem
- 8.1 Flow Entri dan Approval
- 8.2 Flow Aktif → Inaktif
- 8.3 Flow Serah Terima Scan dan Peminjaman
- 9. Desain Sistem
- 9.1 Halaman Login
- 9.2 Dashboard
- 9.3 Entri Dokumen
- 9.4 Detail Dokumen dan Barcode
- 9.5 Serah Terima Scan
- 10. Kebutuhan Non-Fungsional
- Lampiran

# DAFTAR TABEL

- Tabel 1. Teknologi yang Digunakan
- Tabel 2. Mapping Role (6 Role)
- Tabel 3. Hak Akses terhadap Dokumen
- Tabel 4. Jenis Dokumen dan Kategori
- Tabel 5. Status Dokumen
- Tabel 6. Simbol Flowchart
- Tabel 7. Kamus Data `profiles`
- Tabel 8. Kamus Data `kategori_dokumen`
- Tabel 9. Kamus Data `dokumen`
- Tabel 10. Kamus Data `peminjaman`
- Tabel 11. Kamus Data `serah_terima`
- Tabel 12. Kamus Data `log_aktivitas`
- Tabel 13. Kamus Data `notifikasi`
- Tabel 19. Kamus Data `unit_organisasi`
- Tabel 20. Kamus Data `lokasi`
- Tabel 21. Kamus Data `boks`
- Tabel 14. Alur Persetujuan
- Tabel 15. Token Pola Kode Arsip
- Tabel 16. Peristiwa Notifikasi
- Tabel 17. Transisi Status Dokumen
- Tabel 18. Standarisasi Kode

# DAFTAR GAMBAR

- Gambar 1. Topology Server Development
- Gambar 2. Topology Server Production
- Gambar 3. ERD Master Pengguna, Organisasi, Kategori, dan Lokasi
- Gambar 4. ERD Dokumen, Serah Terima, Peminjaman, dan Notifikasi
- Gambar 5. Flow Entri dan Approval
- Gambar 6. Flow Aktif → Inaktif
- Gambar 7. Flow Serah Terima Scan dan Peminjaman
- Gambar 8. Halaman Login
- Gambar 9. Dashboard
- Gambar 10. Entri Dokumen
- Gambar 11. Detail Dokumen dan Barcode
- Gambar 12. Serah Terima Scan
- Gambar 13. Siklus Status Dokumen

\*Gambar ERD dan flow dibuat dari `erd.dbml` / `supabase.sql` di folder ini.
Jangan menyalin gambar ERD, flow, atau mockup dari blueprint e-Surat teman
— sistemnya berbeda (surat vs arsip).\*

---

# DAFTAR SIMBOL FLOWCHART

Simbol-simbol flowchart berikut digunakan untuk menjelaskan proses
aplikasi, dari awal sampai akhir proses. Hanya simbol yang dipakai di
Bab 8 (Skenario Sistem) yang dicantumkan di sini.

Tabel 6. Simbol Flowchart

| No | Simbol | Fungsi | Contoh di aplikasi ini |
| --- | --- | --- | --- |
| 1 | Terminator (oval) | Simbol untuk permulaan (start) dan akhir (end) dari suatu kegiatan / proses. | Mulai upload; selesai dokumen menjadi Aktif. |
| 2 | Processing (persegi panjang) | Simbol yang menunjukkan proses yang berhubungan dengan komputer / sistem. | Sistem menyimpan file; sistem mencatat kode arsip dari dokumen; cron memindahkan dokumen ke Inaktif. |
| 3 | Decision (belah ketupat) | Simbol pemilihan proses berdasarkan kondisi yang ada. | Atasan Arsip Aktif setuju / tolak; penerima konfirmasi terima / tidak; peminjaman disetujui / ditolak. |
| 4 | Input / Output Data (jajar genjang) | Simbol yang menyatakan proses input dan output data, tanpa tergantung jenis alat yang digunakan. | Input judul, nomor PPL, dan kode arsip; output daftar dokumen. |
| 5 | Manual Input (jajar genjang dengan sisi miring) | Simbol untuk memasukkan data input melalui keyboard yang terhubung dengan komputer. | Ketik kode arsip atau nomor PPL secara manual sebagai pengganti scan. |
| 6 | Document (persegi dengan sisi bawah bergelombang) | Simbol yang menyatakan input dan output yang berupa dokumen cetak (kertas) / PDF. | Lembar arsip PDF; PDF bukti serah terima. |
| 7 | Display (persegi dengan sisi kanan melengkung) | Simbol untuk menampilkan output dari proses maupun data dalam layar. | Tampilkan detail dokumen, barcode / QR, dan status dokumen. |
| 8 | Direct Access Storage (silinder) | Simbol untuk menyatakan penyimpanan data berasal dan disimpan. | Tabel dokumen dan peminjaman di Supabase; bucket `arsip-aktif` / `arsip-inaktif`. |

Simbol yang tidak dipakai di aplikasi ini dan sengaja tidak dicantumkan:
Predefine Process (tidak ada sub-proses yang dipanggil terpisah),
Manual Process (langkah manual sudah diwakili Decision dan Manual Input),
Connector dan Off Page Connector (ketiga flow di Bab 8 masing-masing
hanya satu halaman, jadi tidak perlu penghubung antar halaman).

---

## 1. Latar Belakang

Departemen Akuntansi PT Semen Indonesia (Persero) Tbk menangani dokumen pembayaran, antara lain Permintaan Pembayaran Langsung (PPL), Payment Register, dan Payment Approval, serta sertifikat dan kontrak. Pada tahun 2025, dokumen pembayaran yang diarsip bermacam-macam, antara lain STP PPN PUT, Biaya SPPD, Biaya Layanan Kendaraan Teknis, dan Reimburse Jamuan Tamu.

Saat ini dokumen-dokumen tersebut masih dicatat dan disimpan secara manual. Pola kerja ini menimbulkan masalah: dokumen sulit dicari dan tidak tercatat dokumen sedang dipegang siapa saat berpindah.

Departemen Akuntansi membutuhkan aplikasi web Arsip Dokumen yang memusatkan pengajuan, persetujuan, penyimpanan, dan perpindahan dokumen. Dokumen dientri PIC Arsip Aktif unitnya lalu disetujui Atasan Arsip Aktif, kemudian berstatus Aktif selama 3 tahun dengan kode arsip mengikuti penomoran SIG untuk label QR. Setelah masa aktif habis, dokumen pindah ke Inaktif; dokumen Inaktif yang masih dibutuhkan dapat dipinjam melalui PIC Arsip Inaktif. Setiap dokumen dapat dicari berdasarkan kode arsipnya.

## 2. Maksud dan Tujuan

### Maksud — kenapa aplikasi ini dibangun

Maksudnya adalah menggantikan pencatatan arsip yang masih manual dengan satu sistem yang bisa menjawab
tiga pertanyaan kapan pun: dokumen ini milik siapa, sedang dipegang
siapa, dan masih aktif atau sudah waktunya dipindah ke gudang.

### Tujuan — apa yang harus tercapai (menurut rancangan ini)

1. Memusatkan pengajuan, persetujuan, penyimpanan, dan perpindahan dokumen dalam satu aplikasi.
2. Menjamin setiap dokumen yang aktif sudah melewati approval dan punya kode arsip unik.
3. Menegakkan masa aktif 3 tahun yang jelas, lalu pindah otomatis ke Inaktif.
4. Mencatat siapa mengentri, siapa menyetujui, siapa memegang, dan siapa mengunduh dokumen, sehingga dapat ditelusuri.
5. Menyediakan peminjaman dokumen Inaktif melalui PIC Arsip Inaktif, tanpa mengubah status dokumen menjadi Aktif.

Kalau satu tujuan di atas tidak bisa dibuktikan saat demo (misal
peminjaman belum jalan), jangan tulis tujuannya seolah sudah tercapai —
tulis sebagai tujuan yang diuji di Bab Pengujian laporan KP.

## 3. Ruang Lingkup

Menjelaskan fitur-fitur aplikasi arsip dalam 9 sub-bab, karena hanya ada 1 jenis alur: arsip.

### 3.1 Manajemen Pengguna dan Organisasi

1. Mendaftarkan pengguna baru melalui pendaftaran publik dengan peran default Staff (melihat dan mengunduh saja). Memberikan dan mengelola peran khusus hanya melalui Superadmin.
2. Mengelola akun pengguna dengan menambah dan mengubah akun serta menetapkan peran pengguna.
3. Mencatat unit/divisi setiap pengguna di Master Organisasi (Keuangan dan Legal). Mengikat dokumen otomatis ke unit PIC Arsip Aktif yang sedang login, tanpa memilih unit manual saat mengentri.
4. Mencatat nomor pegawai dan jabatan sebagai info profil (misal Sekretaris), bukan sebagai penentu peran akun. Menetapkan kenaikan peran hanya melalui Superadmin, bukan otomatis dari jabatan.

### 3.2 Penomoran dan Kode Arsip

1. Mengikuti penomoran SIG untuk kode arsip, dengan format `TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER`, contoh `2025_2000_1500013765_1900009386`.
2. Menginput nomor payment / PPL saja saat mengentri, pada satu field yang sama, dengan mengetik, memindai barcode / QR, atau memakai voice typing. Menyusun kode arsip otomatis dari Master Organisasi dan nomor payment yang diinput: memakai tahun pada tanggal dokumen, memakai kode perusahaan dan divisi dari unit PIC Arsip Aktif yang sedang login, dan menerbitkan nomor doc voucher otomatis dari sistem.
3. Memakai kode arsip sebagai QR (utama) pada label dokumen. Menyediakan barcode hanya sebagai opsi, karena kodenya panjang (31 karakter).
4. Melarang perubahan kode setelah dibuat dan melarang pemakaian ulang kode yang sama.
5. Menggunakan nomor dokumennya sendiri untuk penomoran dokumen arsip yang tidak memiliki nomor payment / doc voucher, misalnya nomor sertifikat atau nomor kontrak. Mencatat nomor tersebut sebagai kode arsip setelah Atasan Arsip Aktif menyetujuinya.

### 3.3 Pengajuan dan Persetujuan Dokumen

1. Mengentri dokumen oleh PIC Arsip Aktif unitnya melalui upload beserta metadata dan kategori. Menetapkan status dokumen menjadi `menunggu_persetujuan` saat dientri.
2. Meminta persetujuan dari Atasan Arsip Aktif unit yang sama. Menghapus tahap verifikasi PIC terpisah, karena PIC Arsip Aktif adalah pengentri dokumennya sendiri dan tidak dapat memverifikasi entrinya sendiri.
3. Mengembalikan dokumen yang ditolak Atasan Arsip Aktif kepada PIC Arsip Aktif beserta alasan, untuk diperbaiki dan diajukan ulang.
4. Mengaktifkan dokumen yang disetujui selama 3 tahun, dengan tanggal kadaluarsa = tanggal disetujui + 3 tahun, dan menerbitkan QR / barcode label dari kode arsip yang sudah disusun otomatis saat entri.
5. Menyediakan hasil akhir berupa file dokumen asli dan lembar arsip PDF (metadata, kode arsip, QR, dan riwayat singkat) yang dapat diunduh oleh yang berhak.

### 3.4 Masa Aktif dan Inaktif

1. Menyimpan dokumen Aktif di bucket `arsip-aktif`.
2. Memeriksa tanggal kadaluarsa setiap hari melalui cron. Memindahkan dokumen yang lewat tanggalnya ke Inaktif, filenya ke bucket `arsip-inaktif`, pemegangnya ke PIC Arsip Inaktif, dan lokasinya menjadi Gudang Inaktif.
3. Memperbolehkan dokumen Inaktif dilihat dan diunduh oleh yang berhak, tetapi melarang serah terima dokumen tersebut sebagai dokumen aktif. Meminjamkan dokumen Inaktif yang masih dibutuhkan melalui fitur peminjaman kepada PIC Arsip Inaktif.

### 3.5 Serah Terima

1. Mencatat serah terima lewat scan barcode / QR (kamera HP atau scanner USB), atau mengetik kode manual sebagai fallback.
2. Mengubah pemegang dan lokasi hanya setelah penerima mengonfirmasi terima. Memilih lokasi baru dari Master Lokasi, bukan mengetik bebas.
3. Menghasilkan PDF bukti serah terima (penyerah, penerima, tanggal, kode, barcode / QR, kolom tanda tangan) melalui sistem.
4. Mengelola lokasi fisik dari Master Lokasi bertingkat Gedung > Ruangan > Rak, tanpa mengetik bebas. Menolak penyimpanan dokumen di lokasi yang belum terdaftar di Master. Menempatkan Boks di dalam Rak sebagai wadah fisik: memberi nomor urut otomatis (01, 02, dan seterusnya), membatasi kapasitas maksimal 500 lembar per boks melalui Master Kapasitas Boks yang dapat diubah Superadmin (bukan hardcode di kode program), menerbitkan QR tersendiri per boks, menginput jumlah halaman/lembar setiap dokumen saat entri, dan memasukkan dokumen otomatis ke boks aktif yang sedang berjalan selama total lembarnya belum melampaui batas, lalu ke boks berikutnya bila melampaui batas. Mengizinkan Superadmin mengedit nomor boks bila diperlukan.

### 3.6 Peminjaman Dokumen Inaktif

1. Mengajukan peminjaman dokumen Inaktif oleh pengguna yang membutuhkan melalui fitur peminjaman kepada PIC Arsip Inaktif.
2. Menyetujui atau menolak pengajuan peminjaman oleh PIC Arsip Inaktif.
3. Mencatat peminjaman yang disetujui (peminjam, dokumen, tanggal pinjam) dan mengubah status peminjaman menjadi dipinjam.
4. Mengembalikan dokumen kepada PIC Arsip Inaktif setelah selesai digunakan dan mencatat tanggal kembali.
5. Menjaga status dokumen tetap Inaktif selama masa peminjaman; dokumen tidak berpindah ke Aktif dan filenya tetap di bucket `arsip-inaktif`.

### 3.7 Log History dan Pencarian

1. Menampilkan daftar dokumen dengan filter status, kategori, tanggal, pemegang, dan lokasi, plus pencarian utama berdasarkan kode arsip. Menemukan dokumen yang sama dengan mencari `1500013765`, `1900009386`, atau kode lengkapnya, karena nomor payment / PPL dan doc voucher sudah ada di dalam kode arsip. Menyediakan pencarian tambahan berdasarkan judul.
2. Mencatat log aktivitas per dokumen dan per user (entri, persetujuan Atasan Arsip Aktif, tolak, lihat, download, pindah Inaktif, peminjaman, serah terima, pembatalan).
3. Melarang penghapusan log oleh user biasa.

### 3.8 Notifikasi

1. Mengirim notifikasi lewat surel dan menampilkannya di dashboard saat ada hal yang menunggu pengguna.
2. Memberi tahu Atasan Arsip Aktif lewat surel dan dashboard saat ada dokumen baru yang menunggu persetujuan.
3. Memberi tahu PIC Arsip Aktif lewat surel dan dashboard saat Atasan Arsip Aktif menyetujui atau menolak entrinya.
4. Memberi tahu penerima lewat surel dan dashboard saat ada serah terima masuk yang menunggu konfirmasi; memberi tahu penyerah saat penerima mengonfirmasi atau menolak.
5. Memberi tahu PIC Arsip Inaktif lewat surel dan dashboard saat ada pengajuan peminjaman baru; memberi tahu peminjam saat pengajuan disetujui atau ditolak.
6. Memberi tahu PIC Arsip Aktif dan PIC Arsip Inaktif lewat surel dan dashboard saat dokumen mendekati kadaluarsa (H-90, H-30, H-7) dan saat dokumen pindah ke Inaktif.
7. Menandai notifikasi dashboard sebagai sudah dibaca saat pengguna membukanya; menyimpan notifikasi di tabel `notifikasi` (lihat 4.3.2).
8. Mengirim surel notifikasi melalui layanan surel (SMTP) yang sama dengan OTP; menampilkan notifikasi di dashboard walau surel gagal terkirim.
9. Memberi tahu PIC Arsip Aktif lewat surel dan dashboard saat Atasan Arsip Aktif membatalkan dokumen Aktif.

### 3.9 Di Luar Lingkup

1. Mengecualikan OCR isi dokumen, klasifikasi otomatis, dan full-text search isi PDF.
2. Mengecualikan tanda tangan digital tersertifikasi dan kode QR verifikasi resmi.
3. Mengecualikan disposisi berantai, Surat Pengantar Tagihan, dan Ambil Nomor dengan Berkas, karena ketiganya bukan fitur arsip.
4. Mengecualikan integrasi SAP, aplikasi mobile native, dan multi-perusahaan.
5. Mengecualikan pembayaran, termasuk transfer manual, Midtrans, dan paket perpanjangan / reaktivasi. Dokumen Inaktif dipinjam melalui fitur peminjaman, bukan diaktifkan ulang.

---

## 4. Perancangan Sistem

### 4.1 Topology Server (sederhana)

Gambar 1. Topology Server Development — Aplikasi Arsip Dokumen. Lihat `topology-server-development.png` di folder ini.

Gambar 2. Topology Server Production — Aplikasi Arsip Dokumen. Lihat `topology-server-production.png` di folder ini.

Menghubungkan pengguna (browser / HP) ke aplikasi Next.js (App Router), lalu ke Supabase (Auth + PostgreSQL + Storage privat), kemudian cron harian memanggil `/api/cron/expire-documents`.

Memakai project Supabase yang sama untuk Development dan Production pada KP, dengan data demo yang terpisah dari data produksi. Development menjalankan aplikasi di laptop (`npm run dev`, localhost:3000) dan menguji cron secara manual; Production menjalankan aplikasi di hosting dengan cron harian terjadwal.

Meniadakan server terpisah, SAP, dan layanan push terpisah di v1.

### 4.2 Teknologi

Tabel 1. Teknologi yang Digunakan

| Layer | Teknologi | Fungsi |
| --- | --- | --- |
| Aplikasi web | Next.js (App Router, TypeScript) | Menyediakan antarmuka dan logika server dalam satu basis kode |
| Basis data | Supabase (PostgreSQL) | Menyimpan data dan menerapkan Row Level Security |
| Autentikasi | Supabase Auth (JWT, OTP surel) | Mengelola login email + kata sandi, sesi, dan role di `profiles`; mengatur ulang kata sandi melalui kode OTP yang dikirim ke surel |
| Notifikasi | SMTP (surel) dan tabel `notifikasi` | Mengirim notifikasi ke surel pengguna dan menampilkannya di dashboard saat ada hal yang menunggu mereka |
| Penyimpanan file | Supabase Storage (bucket privat) | Menyimpan dokumen aktif / inaktif, bukti serah terima, barcode |
| Pembuatan PDF | jsPDF (server / client) | Membuat lembar arsip PDF dan PDF bukti serah terima |
| Barcode / QR | JsBarcode / QR generator | Membuat label kode arsip yang bisa dipindai |
| Scan | Kamera HP (html5-qrcode / ZXing) atau scanner USB | Membaca kode arsip saat serah terima |
| UI | Tailwind CSS | Menyediakan komponen tampilan, mengikuti panduan anti-slop di `DESIGN.md` |
| Validasi | Zod dan React Hook Form | Memvalidasi input di client dan server |

### 4.3 Design Entity Relationship Diagram

Membagi diagram menjadi 2 bagian berdasarkan modulnya. Mengecualikan modul pembayaran dari diagram; dokumen Inaktif dipinjam melalui tabel `peminjaman` pada Gambar 4.

#### 4.3.1 Master Pengguna, Organisasi, Kategori, dan Lokasi

Gambar 3. ERD Master Pengguna, Organisasi, Kategori, dan Lokasi — dibuat dari `erd-master.dbml` (dbdiagram.io).

Memuat 5 tabel master (lihat `supabase.sql` untuk skema lengkap):

- `profiles` — Menyimpan akun pengguna (nama, surel, nomor pegawai, jabatan, unit, peran 6 role baru).
- `unit_organisasi` — Menyimpan master unit/divisi dan kode perusahaannya.
- `kategori_dokumen` — Menyimpan master kategori.
- `lokasi` — Menyimpan master lokasi bertingkat Gedung > Ruangan > Rak.
- `boks` — Menyimpan wadah fisik di dalam Rak (nomor urut otomatis, kapasitas maksimal 500 lembar lewat Master Kapasitas Boks, QR tersendiri).

Menetapkan `id` sebagai primary key pada kelima tabel. Menghubungkan 1 unit dengan banyak profiles dan banyak dokumen, 1 lokasi Rak dengan banyak boks, dan 1 boks dengan banyak dokumen; foreign key yang menunjuk ke tabel-tabel ini berada di tabel `dokumen` pada Gambar 4.

Menghubungkan 1 profiles dengan banyak dokumen yang dientri / dipegang / disetujui, dan 1 kategori dengan banyak dokumen.

#### 4.3.2 Dokumen, Serah Terima, Peminjaman, dan Notifikasi

Gambar 4. ERD Dokumen, Serah Terima, Peminjaman, dan Notifikasi — dibuat dari `erd-dokumen.dbml` (script `erd_dokumen.py` di folder ini, hasil `erd-dokumen.png`).

Menyimpan dokumen utama beserta kode arsip mengikuti penomoran SIG, judul, nomor dokumen dan nomor PPL, kategori, unit, status, masa aktif, bucket, pemegang, boks, penyetuju, dan penandatangan. Menghubungkan langkah persetujuan, serah terima, peminjaman, dan riwayat ke dokumen. Memindahkan dokumen dari satu pemegang ke pemegang berikutnya melalui serah terima, dan meminjamkan dokumen Inaktif berulang kali melalui peminjaman. Memberi tahu pengguna lewat surel dan dashboard saat ada dokumen yang menunggu persetujuan, konfirmasi serah terima, keputusan peminjaman, pembatalan, atau peringatan kadaluarsa.

Memuat 5 tabel inti arsip (lihat `supabase.sql` untuk skema lengkap):

- `dokumen` — Menyimpan dokumen utama, kode arsip, status, masa aktif, bucket, pemegang, boks, penyetuju, dan penandatangan. Menetapkan `id` sebagai primary key. Mencatat foreign key ke Gambar 3: `kategori_id` ke `kategori_dokumen`, `unit_id` ke `unit_organisasi`, `boks_id` ke `boks`, serta `pemilik_id`, `pemegang_saat_ini`, dan `disetujui_oleh` ke `profiles`.
- `peminjaman` — Menyimpan riwayat peminjaman dokumen Inaktif. Menetapkan `id` sebagai primary key. Mencatat `dokumen_id` sebagai foreign key ke `dokumen`, serta `peminjam_id` dan `pic_inaktif_id` sebagai foreign key ke `profiles` (Gambar 3).
- `serah_terima` — Menyimpan riwayat perpindahan dokumen. Menetapkan `id` sebagai primary key. Mencatat `dokumen_id` sebagai foreign key ke `dokumen`, serta `dari_user_id` dan `ke_user_id` sebagai foreign key ke `profiles` (Gambar 3).
- `log_aktivitas` — Menyimpan riwayat user dan riwayat dokumen dalam satu tabel. Menetapkan `id` sebagai primary key. Mencatat `dokumen_id` sebagai foreign key ke `dokumen` (boleh kosong) dan `user_id` sebagai foreign key ke `profiles` (Gambar 3).
- `notifikasi` — Menyimpan notifikasi untuk pengguna (surel dan dashboard). Menetapkan `id` sebagai primary key. Mencatat `user_id` sebagai foreign key ke `profiles` dan `dokumen_id` sebagai foreign key ke `dokumen` (boleh kosong) (Gambar 3).

Menghubungkan 1 dokumen dengan banyak peminjaman, banyak serah terima, banyak log aktivitas, dan banyak notifikasi; 1 profiles dengan banyak dokumen sebagai pengentri, pemegang, atau penyetuju, banyak peminjaman sebagai peminjam atau PIC Arsip Inaktif, banyak serah terima sebagai penyerah atau penerima, banyak log aktivitas sebagai pelaku, dan banyak notifikasi sebagai penerima; serta 1 kategori dengan banyak dokumen.

### 4.4 Kamus Data

Menampilkan kolom setiap entitas. Menetapkan semua kunci utama bertipe uuid kecuali dinyatakan lain, dan menyimpan waktu dengan zona waktu (tampilan WIB).

Tabel 7. Kamus Data `profiles`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap akun, sama dengan ID akun login |
| nama | text | Menyimpan nama pengguna |
| email | text | Menyimpan alamat surel pengguna yang tidak boleh sama dengan akun lain |
| nomor_pegawai | text | Menyimpan nomor pegawai |
| jabatan | text | Menyimpan jabatan, mis. Sekretaris |
| unit_id | uuid | Menyimpan unit/divisi pengguna, mengacu ke `unit_organisasi` |
| role | text | Menyimpan peran akun (Superadmin, PIC Arsip Aktif, Atasan Arsip Aktif, PIC Arsip Inaktif, Atasan Arsip Inaktif, Staff); memberikan peran Staff kepada pendaftar baru |
| created_at | timestamptz | Mencatat waktu akun dibuat |
| updated_at | timestamptz | Mencatat waktu akun terakhir diubah |

Menyimpan akun pengguna (nama, surel, nomor pegawai, jabatan, unit, peran); peran hanya diatur Superadmin, pendaftar baru otomatis Staff.

Tabel 8. Kamus Data `kategori_dokumen`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap kategori |
| nama | text | Menyimpan nama kategori yang tidak boleh sama dengan kategori lain |
| kode | text | Menyimpan kode kategori, mis. KEU, SDM, KTR |
| deskripsi | text | Menyimpan penjelasan kategori |
| created_at | timestamptz | Mencatat waktu kategori dibuat |

Menyimpan master kategori dokumen (nama, kode, deskripsi); kategori dikelola Superadmin tanpa pengembangan baru.

Tabel 9. Kamus Data `dokumen`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap dokumen |
| kode_arsip | text | Menyimpan kode arsip unik mengikuti penomoran SIG; memakai kode ini sebagai QR untuk scan serah terima |
| judul | text | Menyimpan judul dokumen |
| nomor_dokumen | text | Menyimpan nomor doc voucher, bagian dari kode arsip |
| nomor_ppl | text | Menyimpan nomor payment / PPL, bagian dari kode arsip |
| kategori_id | uuid | Menyimpan kategori dokumen ini |
| unit_id | uuid | Menyimpan unit/divisi dokumen ini, mengikuti unit PIC Arsip Aktif pengentri |
| pemilik_id | uuid | Menyimpan PIC Arsip Aktif yang mengentri dokumen ini |
| pemegang_saat_ini | uuid | Menyimpan pengguna yang memegang dokumen saat ini; mengubah isinya tiap serah terima |
| boks_id | uuid | Menyimpan boks tempat dokumen fisik disimpan, mengacu ke `boks` |
| lokasi_saat_ini | text | Menyimpan lokasi fisik dokumen dari Master Lokasi, mis. Gedung A / Ruangan Arsip / Rak 1 |
| tanggal_dokumen | date | Menyimpan tanggal dokumen |
| tanggal_masuk | timestamptz | Mencatat waktu dokumen dientri |
| tanggal_disetujui | timestamptz | Mencatat waktu Atasan Arsip Aktif menyetujui |
| tanggal_kadaluarsa | date | Menyimpan tanggal kadaluarsa (tanggal disetujui + 3 tahun) |
| status | text | Menyimpan status dokumen (Menunggu persetujuan, Aktif, Ditolak, Inaktif, atau Dibatalkan); memakai Menunggu persetujuan sebagai status awal |
| bucket | text | Menyimpan tempat penyimpanan file (arsip aktif atau arsip inaktif); memakai arsip aktif sebagai tempat awal |
| file_path | text | Menyimpan letak file di penyimpanan Supabase, bukan alamat web publik |
| file_tipe | text | Menyimpan jenis file, mis. PDF |
| ukuran_file | bigint | Menyimpan ukuran file dalam byte |
| jumlah_halaman | int | Menyimpan jumlah halaman/lembar dokumen fisik, diinput PIC Arsip Aktif saat entri |
| barcode_path | text | Menyimpan letak gambar barcode / QR di penyimpanan |
| disetujui_oleh | uuid | Menyimpan Atasan Arsip Aktif yang menyetujui |
| penandatangan | text | Menyimpan nama penandatangan dokumen sumber |
| alasan_penolakan | text | Menyimpan alasan penolakan dari Atasan Arsip Aktif saat menolak |
| created_at | timestamptz | Mencatat waktu baris dibuat |
| updated_at | timestamptz | Mencatat waktu baris terakhir diubah |

Menyimpan dokumen utama beserta kode arsip, status, masa aktif, dan pemegangnya.

Tabel 10. Kamus Data `peminjaman`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap peminjaman |
| dokumen_id | uuid | Menyimpan dokumen yang dipinjam (hanya dokumen Inaktif) |
| peminjam_id | uuid | Menyimpan pengguna yang meminjam |
| pic_inaktif_id | uuid | Menyimpan PIC Arsip Inaktif yang menyetujui |
| tanggal_pinjam | timestamptz | Mencatat waktu peminjaman diajukan |
| tanggal_kembali | timestamptz | Mencatat waktu pengembalian dokumen |
| status | text | Menyimpan status peminjaman (Diajukan, Disetujui, Dipinjam, Dikembalikan, atau Ditolak); memakai Diajukan sebagai status awal |
| keperluan | text | Menyimpan keperluan peminjaman |
| created_at | timestamptz | Mencatat waktu baris dibuat |

Mencatat peminjaman dokumen Inaktif; status dokumen tetap Inaktif selama dipinjam.

Tabel 11. Kamus Data `serah_terima`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap serah terima |
| dokumen_id | uuid | Menyimpan dokumen yang diserahterimakan |
| dari_user_id | uuid | Menyimpan pengguna yang menyerahkan |
| ke_user_id | uuid | Menyimpan pengguna yang menerima |
| dari_lokasi | text | Menyimpan lokasi asal dokumen |
| ke_lokasi | text | Menyimpan lokasi tujuan dokumen |
| tanggal_serah | timestamptz | Mencatat waktu dokumen diserahkan |
| tanggal_terima | timestamptz | Mencatat waktu penerima mengonfirmasi terima |
| status_serah | text | Menyimpan status serah terima (Menunggu konfirmasi, Diterima, atau Ditolak); memakai Menunggu konfirmasi sebagai status awal |
| keterangan | text | Menyimpan catatan serah terima |
| bukti_pdf_path | text | Menyimpan letak PDF bukti serah terima di penyimpanan yang dapat diunduh / dicetak |
| created_at | timestamptz | Mencatat waktu baris dibuat |

Mencatat serah terima dokumen antar pemegang; pemegang hanya berubah setelah penerima mengonfirmasi.

Tabel 12. Kamus Data `log_aktivitas`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap catatan |
| dokumen_id | uuid | Menyimpan dokumen yang terkait; mengosongkan kolom ini untuk aktivitas umum (mis. login) |
| user_id | uuid | Menyimpan pengguna yang melakukan aktivitas |
| aksi | text | Menyimpan jenis aktivitas (entri, persetujuan Atasan Arsip Aktif, tolak, lihat, download, pindah Inaktif, peminjaman, serah terima, pembatalan) |
| keterangan | text | Menyimpan catatan aktivitas |
| created_at | timestamptz | Mencatat waktu aktivitas terjadi |

Mencatat riwayat pengguna dan riwayat dokumen dalam satu tabel.

Tabel 13. Kamus Data `notifikasi`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap notifikasi |
| user_id | uuid | Menyimpan pengguna yang menerima notifikasi |
| judul | text | Menyimpan judul notifikasi |
| isi | text | Menyimpan isi notifikasi |
| dokumen_id | uuid | Menyimpan dokumen yang terkait; mengosongkan kolom ini bila notifikasi tidak terkait dokumen |
| dibaca | boolean | Menyimpan penanda sudah dibaca (benar) atau belum (salah); memakai salah sebagai nilai awal |
| created_at | timestamptz | Mencatat waktu notifikasi dibuat |

Menyimpan notifikasi pengguna untuk surel dan dashboard; menandai notifikasi sebagai sudah dibaca saat pengguna membukanya.

Tabel 19. Kamus Data `unit_organisasi`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap unit |
| nama | text | Menyimpan nama unit/divisi, mis. Keuangan, Legal |
| kode_perusahaan | text | Menyimpan kode perusahaan unit ini, mis. 2000 |
| created_at | timestamptz | Mencatat waktu baris dibuat |

Menyimpan master unit/divisi dan kode perusahaannya; unit dikelola Superadmin dan mengikat dokumen otomatis ke unit PIC pengentri.

Tabel 20. Kamus Data `lokasi`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap lokasi |
| nama | text | Menyimpan nama lokasi, mis. Gedung A, Ruangan Arsip, Rak 1 |
| tingkat | text | Menyimpan tingkat lokasi (Gedung, Ruangan, atau Rak) |
| parent_id | uuid | Menyimpan lokasi induk tingkat di atasnya, mengacu ke `lokasi`; mengosongkan kolom ini untuk Gedung |
| created_at | timestamptz | Mencatat waktu baris dibuat |

Menyimpan master lokasi bertingkat Gedung > Ruangan > Rak; lokasi dikelola Superadmin dan dipilih dari dropdown, bukan diketik bebas.

Tabel 21. Kamus Data `boks`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid | Menyimpan pengenal unik setiap boks |
| nomor_boks | text | Menyimpan nomor urut boks, mis. 01, 02 |
| rak_id | uuid | Menyimpan rak tempat boks ditaruh, mengacu ke `lokasi` |
| kapasitas_maks_lembar | int | Menyimpan kapasitas maksimal lembar per boks, memakai 500 sebagai nilai awal dan disetel lewat Master Kapasitas Boks (bukan hardcode) |
| jumlah_lembar_terisi | int | Menyimpan jumlah lembar yang sudah terisi di boks ini, dihitung dari akumulasi jumlah_halaman dokumen di dalamnya |
| qr_path | text | Menyimpan letak gambar QR boks di penyimpanan |
| status | text | Menyimpan status boks (Aktif atau Penuh); memakai Aktif sebagai nilai awal |
| created_at | timestamptz | Mencatat waktu baris dibuat |

Menyimpan wadah fisik dokumen di dalam Rak; sistem memasukkan dokumen ke boks aktif yang sedang berjalan selama total lembarnya belum melampaui batas, lalu ke boks berikutnya bila melampaui batas; Superadmin dapat mengedit nomor boks bila diperlukan.

Membatasi kamus data pada 10 tabel, sesuai scope KP yang memang lebih kecil.

---

## 5. Mapping Role

### 5.1 Role Pengguna

Tabel 2. Mapping Role (6 Role)

| No | Role | Create | Read | Update | Delete | Catatan |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Superadmin | ✓ | ✓ | ✓ | ✓\* | Mengelola user/role, unit, kategori, lokasi, boks, dan setting sebagai maintainer sistem. Mengakses semua dokumen dalam keadaan darurat. Tidak ikut campur operasional transaksi harian normal. \*Menghapus permanen hanya setelah Atasan menyetujui |
| 2 | PIC Arsip Aktif | ✓ (dokumen unitnya) | ✓ (dokumen unitnya) | ✓ (dokumen unitnya) | — | Mengentri dokumen unitnya, mengklasifikasi, melakukan serah terima, dan mencetak barcode / QR. Mengecualikan pengelolaan user |
| 3 | Atasan Arsip Aktif | — | ✓ (dokumen unitnya) | ✓ (approval) | — | Memberikan persetujuan akhir entri PIC Arsip Aktif unitnya, membatalkan dokumen Aktif, dan menyetujui hapus dokumen sensitif. Mengecualikan upload, pengeditan isi, dan pengelolaan user |
| 4 | PIC Arsip Inaktif | ✓ | ✓ | ✓ | — | Mengelola arsip Inaktif, melayani peminjaman Inaktif, dan mengawasi kapasitas gudang Inaktif. Mengecualikan pengelolaan user |
| 5 | Atasan Arsip Inaktif | — | ✓ | ✓ (approval) | — | Mengawasi penerimaan berkas Inaktif, kapasitas gudang Inaktif, dan proses lanjutan arsip setelah masa retensi aktif. Mengecualikan upload, pengeditan isi, dan pengelolaan user |
| 6 | Staff | — | ✓ | — | — | Melihat dan mengunduh dokumen saja, mis. Staff Accounting. Tidak mengentri, mengedit, menghapus, atau menyetujui dokumen |

Catatan penting: teman hanya punya 3 role sistem (Super Admin, Pegawai,
Approver) plus kewenangan yang melekat pada jabatan. Kita punya 6 role
yang eksplisit, karena itu yang diminta di PRD kita. Jangan samakan
Super Admin teman dengan Superadmin kita — Super Admin teman bisa
membatalkan dokumen dan membuka Log History, Superadmin kita tidak bisa
membatalkan dokumen dan tidak bisa approve isi arsip, itu tugas Atasan Arsip Aktif.

### 5.2 Hak Akses terhadap Dokumen

Tabel 3. Hak Akses terhadap Dokumen

| Pihak | Melihat isi dan lampiran | Tindakan |
| --- | --- | --- |
| PIC Arsip Aktif (pengentri) | Dokumen unitnya, seluruh status | Mengentri, mengedit metadata selagi menunggu, mengunduh sendiri, dan meminjam dokumen Inaktif |
| Atasan Arsip Aktif | Dokumen unitnya | Menyetujui / menolak entri dan membatalkan dokumen Aktif |
| PIC Arsip Inaktif | Semua dokumen Inaktif | Melayani peminjaman Inaktif dan mengelola gudang Inaktif |
| Atasan Arsip Inaktif | Semua dokumen Inaktif | Mengawasi penerimaan berkas Inaktif dan kapasitas gudang Inaktif |
| Superadmin | Semua dokumen | Mengelola akun dan master, mengeksekusi hapus setelah Atasan menyetujui |
| Staff | Semua dokumen | Melihat dan mengunduh, tanpa mengubah |

---

## 6. Jenis Dokumen, Penomoran, dan Aturan

### 6.1 Jenis Dokumen

Tabel 4. Jenis Dokumen dan Kategori

| Kategori | Contoh | Keterangan |
| --- | --- | --- |
| Keuangan | Laporan keuangan, invoice | Kategori master, dikelola Superadmin |
| SDM | Dokumen kepegawaian | Kategori master, dikelola Superadmin |
| Kontrak | Kontrak dan perjanjian | Kategori master, dikelola Superadmin |

Kategori dapat ditambah Superadmin tanpa pengembangan baru. Jenis dokumen di
sini adalah kategori arsip, bukan jenis surat (internal / eksternal /
tagihan) seperti di e-Surat teman.

### 6.2 Aturan Penomoran

Membentuk kode arsip dari pola penomoran SIG: `TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER`, contoh `2025_2000_1500013765_1900009386` (lihat 3.2). Menyusun kode arsip otomatis dari Master Organisasi dan nomor payment yang diinput. Menggunakan token berikut:

Tabel 15. Token Pola Kode Arsip

| Token | Arti | Contoh |
| --- | --- | --- |
| {TAHUN} | Menyatakan tahun dokumen, 4 digit | 2025 |
| {KODEPERUSAHAAN} | Menyatakan kode perusahaan | 2000 |
| {NOPAYMENT} | Menyatakan nomor payment / nomor PPL (Permintaan Pembayaran Langsung), 10 digit | 1500013765 |
| {DOCVOUCHER} | Menyatakan nomor doc voucher / nomor dokumen, 10 digit | 1900009386 |

Catatan: Memakai nomor dokumennya sendiri untuk dokumen arsip yang tidak memiliki nomor payment / doc voucher, misalnya nomor sertifikat atau nomor kontrak; mencatat nomor tersebut sebagai kode arsip setelah Atasan Arsip Aktif menyetujuinya. Menetapkan kode arsip sebagai kode yang unik, tidak dapat diubah, dan tidak dipakai ulang.

### 6.3 Aturan Persetujuan dan Status

Mendefinisikan istilah yang dipakai sebagai berikut. Menyebut PIC Arsip Aktif sebagai pengguna yang mengentri dokumen dan menjadi pengentrinya. Menyebut Atasan Arsip Aktif sebagai pemberi persetujuan akhir. Menyebut Pemegang saat ini sebagai pengguna yang memegang dokumen saat ini, yang berubah tiap serah terima. Mencatat Penandatangan sebagai nama penandatangan dokumen sumber. Mengecualikan atasan langsung dan garis atasan karena persetujuan tidak memakai rantai hierarki; semua dokumen memakai alur yang sama (lihat Tabel 14).

Tabel 5. Status Dokumen

| Status | Arti | Yang bisa dilakukan |
| --- | --- | --- |
| `menunggu_persetujuan` | Baru dientri, menunggu Atasan Arsip Aktif | PIC Arsip Aktif bisa edit metadata; Atasan Arsip Aktif bisa menyetujui / menolak |
| `aktif` | Sudah disetujui, masa 3 tahun berjalan | Bisa dilihat, diunduh, diserahterimakan |
| `ditolak` | Ditolak Atasan Arsip Aktif beserta alasan | PIC Arsip Aktif perbaiki dan ajukan ulang |
| `inaktif` | Masa aktif habis (cron) | Bisa dilihat / diunduh yang berhak; dipinjam melalui fitur peminjaman, tetap Inaktif |
| `dibatalkan` | Dibatalkan Atasan Arsip Aktif beserta alasan | Bisa dilihat dengan penanda DIBATALKAN; tidak bisa diserahterimakan atau dipinjam |

Melarang pengiriman langsung tanpa persetujuan untuk dokumen baru. Mewajibkan semua dokumen baru dientri PIC Arsip Aktif lalu disetujui Atasan Arsip Aktif.

Tabel 14. Alur Persetujuan

| Tahap | Pelaku | Tindakan | Hasil |
| --- | --- | --- | --- |
| 1. Entri | PIC Arsip Aktif | Mengentri dokumen beserta metadata dan kategori | Menetapkan status dokumen menjadi `menunggu_persetujuan` |
| 2. Persetujuan | Atasan Arsip Aktif | Memberikan persetujuan | Mengaktifkan dokumen selama 3 tahun bila disetujui (mengisi tanggal disetujui dan tanggal kadaluarsa, menerbitkan QR / barcode); mengembalikan dokumen ke PIC Arsip Aktif beserta alasan bila ditolak |

| 3. Perbaikan dan pengajuan ulang | PIC Arsip Aktif | Memperbaiki dokumen yang ditolak dan mengajukannya ulang | Mengubah status kembali menjadi `menunggu_persetujuan` dan mengulang alur dari tahap persetujuan |

Catatan: Mengembalikan dokumen yang ditolak Atasan Arsip Aktif kepada PIC Arsip Aktif beserta alasan penolakan; mengulang alur dari tahap persetujuan setelah PIC Arsip Aktif memperbaiki dan mengajukan ulang dokumennya.

Menampilkan transisi tiap status pada Tabel 17 dan siklusnya pada Gambar 13.

Tabel 17. Transisi Status Dokumen

| Status | Arti | Transisi berikutnya |
| --- | --- | --- |
| `menunggu_persetujuan` | Baru dientri, menunggu Atasan Arsip Aktif | Aktif (persetujuan Atasan Arsip Aktif); Ditolak (ditolak Atasan Arsip Aktif beserta alasan) |
| `aktif` | Sudah disetujui, masa 3 tahun berjalan | Inaktif (masa 3 tahun habis, otomatis lewat cron harian) |
| `ditolak` | Ditolak Atasan Arsip Aktif beserta alasan | Menunggu Persetujuan (diperbaiki dan diajukan ulang oleh PIC Arsip Aktif) |
| `inaktif` | Masa aktif habis (cron) | Tetap Inaktif (dipinjam lewat fitur peminjaman; tidak kembali Aktif) |
| `dibatalkan` | Dibatalkan Atasan Arsip Aktif beserta alasan | Tetap Dibatalkan (tidak ada transisi berikutnya) |

Gambar 13. Siklus Status Dokumen. Lihat `siklus-status-dokumen.png` di folder ini.

### 6.4 Lampiran Dokumen

Menetapkan lampiran sebagai berkas pendukung yang tertaut pada satu dokumen arsip.

1. Menerima format PDF, XLSX, DOCX, JPG, dan PNG; memeriksa tipe dan ukuran berkas saat diunggah.
2. Membatasi ukuran total lampiran 25 MB per dokumen sebagai nilai awal; Superadmin dapat mengubahnya pada Pengaturan Sistem.
3. Menetapkan lampiran bersifat opsional untuk semua kategori dokumen; mewajibkan berkas utama dokumen diunggah.
4. Menyimpan lampiran terpisah dari berkas dokumen utama dan tidak menggabungkannya ke dalam lembar arsip PDF; menautkan lampiran pada dokumen yang sama dan memungkinkan lampiran diunduh bersamaan.
5. Menambah atau menghapus lampiran selama dokumen berstatus `menunggu_persetujuan` atau `ditolak`.
6. Menyimpan berkas pada penyimpanan privat dan mengaksesnya melalui tautan bertanda waktu.

### 6.5 Peristiwa Notifikasi

Menetapkan kanal notifikasi sebagai dashboard (selalu aktif) dan surel; memuat notifikasi hanya jenis peristiwa, perihal, dan pihak terkait, tanpa isi dokumen.

Tabel 16. Peristiwa Notifikasi

| No | Peristiwa | Penerima notifikasi | Kanal |
| --- | --- | --- | --- |
| 1 | Dokumen baru dientri | Atasan Arsip Aktif | Dashboard, surel |
| 2 | Dokumen disetujui dan menjadi Aktif | PIC Arsip Aktif | Dashboard, surel |
| 3 | Dokumen ditolak beserta alasan | PIC Arsip Aktif | Dashboard, surel |
| 4 | Serah terima diajukan | Penerima | Dashboard, surel |
| 5 | Serah terima dikonfirmasi atau ditolak | Penyerah | Dashboard, surel |
| 6 | Peminjaman diajukan | PIC Arsip Inaktif | Dashboard, surel |
| 7 | Peminjaman disetujui atau ditolak | Peminjam | Dashboard, surel |
| 8 | Dokumen mendekati kadaluarsa (H-90, H-30, H-7) | PIC Arsip Aktif dan PIC Arsip Inaktif | Dashboard, surel |
| 9 | Dokumen pindah ke Inaktif | PIC Arsip Aktif dan PIC Arsip Inaktif | Dashboard, surel |
| 10 | Dokumen dibatalkan | PIC Arsip Aktif | Dashboard, surel |

### 6.6 Pembatalan

Mendefinisikan pembatalan sebagai penarikan dokumen Aktif yang sudah tidak berlaku, tanpa menghapus dokumennya.

1. Membatalkan dokumen Aktif hanya oleh Atasan Arsip Aktif, dengan alasan wajib.
2. Menyimpan kode arsip dan tidak memakainya ulang; menampilkan dokumen yang dibatalkan tetap dapat dilihat dengan penanda DIBATALKAN; memberi tahu PIC Arsip Aktif.
3. Mengecualikan dokumen yang belum Aktif dari pembatalan; Atasan Arsip Aktif menolak dokumen menunggu_persetujuan, dan PIC Arsip Aktif memperbaiki lalu mengajukan ulang dokumen ditolak.

---

## 7. Standarisasi Kode

Mengelola master kategori oleh Superadmin melalui tabel `kategori_dokumen`: Superadmin menambah kategori baru beserta kodenya, mengubah nama atau kode kategori yang sudah ada, dan menghapus kategori yang sudah tidak dipakai, tanpa mengubah kode program. Menyusun kode arsip otomatis dari Master Organisasi dan nomor payment yang diinput, mengikuti pola penomoran SIG pada 6.2. Menetapkan satu kode perusahaan (`2000`), enam kode peran (`superadmin`, `pic_aktif`, `atasan_aktif`, `pic_inaktif`, `atasan_inaktif`, `staff`), dan lima kode status dokumen (`menunggu_persetujuan`, `aktif`, `ditolak`, `inaktif`, `dibatalkan`) sebagai kode tetap sistem: Superadmin tidak dapat menambah, mengubah, atau menghapus kode-kode tersebut melalui menu master, dan mengubahnya hanya dapat dilakukan dengan mengubah skema dan kode program. Menampilkan Tabel 18 lima belas kode yang berlaku saat ini, yaitu 3 kode kategori, 1 kode perusahaan, 5 kode status dokumen, dan 6 kode peran; Tabel 18 tidak memuat kode arsip, karena kode arsip berbeda untuk setiap dokumen dan polanya dijelaskan pada Tabel 15 di 6.2.

Tabel 18. Standarisasi Kode

| No | Kode | Arti | Jenis kode |
| --- | --- | --- | --- |
| 1 | KEU | Laporan keuangan, invoice | Kode kategori |
| 2 | SDM | Dokumen kepegawaian | Kode kategori |
| 3 | KTR | Kontrak dan perjanjian | Kode kategori |
| 4 | 2000 | PT Semen Indonesia (Persero) Tbk | Kode perusahaan |
| 5 | menunggu_persetujuan | Baru dientri, menunggu Atasan Arsip Aktif | Kode status dokumen |
| 6 | aktif | Sudah disetujui, masa 3 tahun berjalan | Kode status dokumen |
| 7 | ditolak | Ditolak Atasan Arsip Aktif beserta alasan | Kode status dokumen |
| 8 | inaktif | Masa aktif habis (cron) | Kode status dokumen |
| 9 | dibatalkan | Dibatalkan Atasan Arsip Aktif beserta alasan | Kode status dokumen |
| 10 | superadmin | Superadmin | Kode peran |
| 11 | pic_aktif | PIC Arsip Aktif | Kode peran |
| 12 | atasan_aktif | Atasan Arsip Aktif | Kode peran |
| 13 | pic_inaktif | PIC Arsip Inaktif | Kode peran |
| 14 | atasan_inaktif | Atasan Arsip Inaktif | Kode peran |
| 15 | staff | Staff | Kode peran |

1. Menampilkan nama peran di UI, bukan kode: PIC Arsip Aktif (bukan `pic_aktif`), Atasan Arsip Aktif, Staff, dan seterusnya; memakai kode hanya untuk database dan PRD.
2. Memakai nilai status pada Tabel 5 (dokumen) dan Tabel 10 (peminjaman); melarang pembuatan status baru tanpa mengubah skema dan RLS.
3. Menerbitkan QR dari `kode_arsip` sebagai media utama label; menerbitkan barcode Code128 dari `kode_arsip` hanya sebagai opsional karena kodenya panjang; menampilkan kode dalam huruf monospace di bawah label.

---

## 8. Skenario Sistem

Cukup 3 flow untuk KP. Jangan menambah flow Disposisi, Tagihan, atau Ambil
Nomor seperti blueprint teman.

### 8.1 Flow Entri dan Approval

Gambar 5. Flow Entri dan Approval.

1. PIC Arsip Aktif mengentri dokumen → status `menunggu_persetujuan`.
2. Atasan Arsip Aktif menyetujui → status `aktif`, tanggal kadaluarsa = +3 tahun, QR / barcode label diterbitkan dari kode arsip; atau menolak + alasan → status `ditolak`.
3. PIC Arsip Aktif memperbaiki dokumen yang ditolak dan mengajukan ulang → status kembali `menunggu_persetujuan`.

### 8.2 Flow Aktif → Inaktif

Gambar 6. Flow Aktif → Inaktif.

1. Cron harian memeriksa `tanggal_kadaluarsa < hari ini` dan status `aktif`.
2. File dicopy dari `arsip-aktif` ke `arsip-inaktif`, lalu dihapus dari bucket aktif setelah copy terverifikasi.
3. Status → `inaktif`, bucket → `arsip-inaktif`, pemegang → PIC Arsip Inaktif, lokasi → Gudang Inaktif, log `pindah_inaktif` tercatat.
4. Cron bersifat idempotent: dokumen yang sudah Inaktif tidak diproses ulang.

### 8.3 Flow Serah Terima Scan dan Peminjaman

Gambar 7. Flow Serah Terima Scan dan Peminjaman.

Serah terima:

1. Pemegang scan QR (utama) / barcode → sistem cocokkan `kode_arsip`.
2. Penyerah pilih penerima dan lokasi baru dari Master Lokasi → status serah terima `menunggu_konfirmasi`.
3. Penerima konfirmasi → pemegang dan lokasi berubah, PDF bukti diterbitkan.

Peminjaman:

1. Pengguna mengajukan peminjaman dokumen Inaktif → status peminjaman `diajukan`.
2. PIC Arsip Inaktif menyetujui → status peminjaman `dipinjam` dan peminjam tercatat; atau menolak beserta alasan.
3. Peminjam mengembalikan dokumen → status peminjaman `dikembalikan`, tanggal kembali tercatat. Status dokumen tetap `inaktif`.

---

## 9. Desain Sistem

Cukup 5 layar untuk KP. Desain mengikuti `DESIGN.md` dan skill
`anti-slop-design`: kertas, tinta, cap status, tabel padat, tanpa gradien
ungu-biru, tanpa hero marketing, tanpa ilustrasi AI.

- Gambar 8. Halaman Login — email, kata sandi, 1 tombol Masuk ke Sistem. Tanpa kotak Akses Cepat Demo di versi produksi.
- Gambar 9. Dashboard — ringkasan per role, daftar dokumen mau kadaluarsa, antrean persetujuan (Atasan Arsip Aktif).
- Gambar 10. Entri Dokumen — judul, nomor payment, kategori, tanggal dokumen, upload file, lalu status menunggu.
- Gambar 11. Detail Dokumen dan Barcode — metadata, status cap, barcode / QR, pemegang, lokasi, tanggal kadaluarsa, timeline riwayat, tombol download.
- Gambar 12. Serah Terima Scan — area kamera / kolom kode manual, data dokumen hasil scan, pilih penerima dan lokasi dari Master Lokasi, konfirmasi terima.

\*Screenshot di atas diganti dengan screenshot sistemmu sendiri saat
implementasi. Jangan memakai screenshot e-Surat teman.\*

---

## 10. Kebutuhan Non-Fungsional

1. Keamanan: RLS aktif di semua tabel, Storage privat, download lewat API server + cek role + signed URL pendek. Staff hanya boleh melihat dan mengunduh, tidak boleh mengentri / mengedit / menghapus / menyetujui di API. Secret cron / webhook tidak disimpan di repo.
2. Audit: log aktivitas tidak dapat dihapus user biasa. Hapus permanen hanya Superadmin setelah approve Atasan + alasan tercatat.
3. Kinerja: daftar paginasi, index di `kode_arsip`, `pemilik_id`, `status`, `tanggal_kadaluarsa`. Batas upload v1: maks 20 MB (sesuaikan dengan dosen).
4. Keterbacaan: tabel padat untuk kerja, label form di atas field, semua aksi penting bisa dipakai keyboard, scan tetap bisa fallback ketik kode manual.
5. Aksesibilitas dasar: kontras cukup, error menyebut field dan solusinya dengan bahasa yang jelas.

---

# LAMPIRAN

- Lampiran 1. PRD (`PRD.md`) dan skema (`supabase.sql`, `erd.dbml`) sebagai dokumen pendukung.
- Lampiran 2. Logbook magang KP (format kampus).
- Lampiran 3. Daftar akun demo 6 role baru R.03 untuk presentasi (email demo + peran; password demo hanya untuk presentasi, jangan disebar di laporan yang dicetak).

---

\*Catatan penutup untuk penyusun: blueprint ini sengaja dipangkas. Kalau
dosen meminta tambahan, tambahkan bab / fitur itu beserta alasannya, jangan
menyalin bab dari blueprint teman hanya supaya terlihat tebal.\*