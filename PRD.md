# PRD — Aplikasi Arsip Dokumen (Archiva)

**Produk:** Aplikasi Manajemen Arsip Dokumen (Next.js + Supabase)  
**Versi PRD:** R.03 (Disinkronkan dengan `BLUEPRINT.md` R.03) — 15 November 2026  
**Stack:** Next.js (App Router), Supabase (Auth, Postgres, Storage), Nodemailer (SMTP Surel)  
**Dokumen pendamping:** `BLUEPRINT.md` R.03, `erd.dbml`, `supabase.sql`  
**Status:** Produksi / Operasional Kedinasan PT Semen Indonesia Group (SIG).
**Verifikasi:** Lolos Uji M0-M8 (Tahap M8: Transfer Dokumen, Verifikasi Fisik Inaktif, dan Dasbor Kapasitas/Okupansi Rak).

---

## 1. Ringkasan Sistem

Instansi menyimpan arsip fisik dan berkas digital kedinasan yang memerlukan kepastian tata kelola: kepemilikan unit, pemegang saat ini, batas masa retensi aktif 3 tahun, alokasi boks fisik dan gudang inaktif, serta pencatatan audit digital yang tidak dapat disangkal.

Aplikasi ini mengimplementasikan alur baku sesuai BLUEPRINT R.03:
> Entri oleh PIC Arsip Aktif per unit → Persetujuan oleh Atasan Arsip Aktif → Status Aktif selama 3 tahun → Otomatis Inaktif (cron harian & migrasi bucket storage) → Peminjaman berkas inaktif melalui PIC Arsip Inaktif (status tetap Inaktif). Pembatalan oleh Atasan Arsip Aktif (alasan wajib) → Dibatalkan.

Setiap dokumen memiliki **Kode Arsip SIG** unik (`TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER`) yang dicetak sebagai label QR. Serah terima fisik dilakukan lewat pemindaian QR gaya kasir dengan penerbitan Berita Acara Serah Terima (BAST) PDF.

---

## 2. Masalah dan Tujuan

### Masalah
1. Dokumen kehilangan jejak pergerakan fisik saat berpindah tangan.
2. Penumpukan arsip tanpa batas retensi yang jelas.
3. Ketiadaan jejak persetujuan digital yang akuntabel dan sah.
4. Pencarian arsip lambat akibat format penomoran yang tidak terstandarisasi.

### Tujuan Produk
1. Standarisasi penomoran arsip berbasis kode Semen Indonesia Group (SIG).
2. Otomasi siklus hidup dokumen: 3 tahun Aktif, otomatis migrasi ke Inaktif via cron harian.
3. Alokasi kapasitas boks fisik otomatis bertingkat (Gedung > Ruangan > Rak > Boks maks 500 lembar).
4. Serah terima fisik berbasis scan QR dan penerbitan PDF BAST resmi.
5. Notifikasi ganda (Dashboard + Surel SMTP) untuk 10 peristiwa penting.
6. Audit log terperinci mencatat setiap aksi dokumen dan pengguna.

---

## 3. Struktur Pengguna & 6 Peran Baku (R.03)

Sesuai BLUEPRINT.md Bab 5, sistem menetapkan 6 role permanen:

| # | Role | Nama Peran | Tanggung Jawab Utama | Batasan Ketat |
|---|------|------------|----------------------|---------------|
| 1 | `superadmin` | Superadmin | Pemeliharaan sistem, master data (organisasi, kategori, lokasi, boks), manajemen akun pengguna. Hapus permanen hanya setelah persetujuan Atasan tercatat di log. | Dilarang membatalkan dokumen aktif; dilarang campur tangan operasional transaksi harian. |
| 2 | `pic_aktif` | PIC Arsip Aktif | Mengentri dokumen unitnya, mengedit metadata saat menunggu persetujuan, klasifikasi, serah terima, cetak label QR. | Tidak mengelola user; dilarang menyetujui entrinya sendiri. |
| 3 | `atasan_aktif` | Atasan Arsip Aktif | Menyetujui/menolak entri dokumen unitnya, membatalkan dokumen aktif (alasan wajib), persetujuan hapus. | Tidak mengunggah dokumen; tidak mengedit isi dokumen; tidak mengelola user. |
| 4 | `pic_inaktif` | PIC Arsip Inaktif | Mengelola arsip inaktif, memproses pengajuan peminjaman berkas inaktif, mengawasi gudang inaktif. | Tidak mengelola user; dokumen dipinjam tetap berstatus inaktif. |
| 5 | `atasan_inaktif` | Atasan Arsip Inaktif | Mengawasi penerimaan berkas inaktif dan retensi lanjutan arsip. | Tidak mengunggah dokumen; tidak mengedit isi dokumen. |
| 6 | `staff` | Staff Kedinasan | Melihat daftar, detail, dan mengunduh berkas arsip yang diizinkan (misal Staff Accounting). | Dilarang entri, edit, hapus, verifikasi, atau membatalkan dokumen (ditolak di level server API). |

---

## 4. Model Data & Database (10 Tabel)

Skema database mengacu penuh pada BLUEPRINT.md 4.3 dan 4.4:
1. `profiles`: Profil kedinasan, unit kerja, nomor pegawai, dan peran akun.
2. `unit_organisasi`: Master unit kerja kedinasan (Keuangan, Legal, dsb.) dengan kode perusahaan SIG (`2000`).
3. `kategori_dokumen`: Master kategori arsip (`KEU`, `SDM`, `KTR`, dsb.).
4. `lokasi`: Struktur hierarki lokasi penyimpanan (`Gedung` > `Ruangan` > `Rak`).
5. `boks`: Wadah fisik arsip berkapasitas 500 lembar dengan nomor urut otomatis dan QR label boks.
6. `dokumen`: Data induk arsip digital dan fisik, kode arsip SIG, bucket storage, dan status retensi.
7. `peminjaman`: Sirkulasi peminjaman berkas arsip inaktif.
8. `serah_terima`: Transaksi serah terima fisik antar pegawai berbasis scan QR dan verifikasi penerima.
9. `log_aktivitas`: Rekam jejak audit keamanan seluruh aktivitas sistem.
10. `notifikasi`: Notifikasi lonceng dasbor bagi pengguna.

---

## 5. Status Dokumen (5 Status Resmi)

Sistem hanya mengenal 5 status dokumen:
- `menunggu_persetujuan`: Dokumen baru dientri oleh PIC Arsip Aktif, menunggu verifikasi Atasan Arsip Aktif.
- `aktif`: Telah disetujui Atasan Arsip Aktif, berlaku selama 3 tahun retensi aktif.
- `ditolak`: Ditolak oleh Atasan Arsip Aktif dengan alasan penolakan wajib; PIC dapat merevisi dan mengajukan ulang.
- `inaktif`: Lewat masa 3 tahun, dipindahkan oleh cron harian ke bucket `arsip-inaktif` dan lokasi Gudang Inaktif.
- `dibatalkan`: Dokumen aktif yang ditarik secara resmi oleh Atasan Arsip Aktif dengan alasan wajib; kode arsip tetap tercatat dan tidak dipakai ulang.

*TIDAK ADA status Non-Aktif, Draft, Final, Terkirim, Diterima, atau fitur pembayaran/reaktivasi berbayar.*

---

## 6. Saluran Notifikasi (Tabel 16 R.03)

Notifikasi dikirimkan melalui dua kanal: **Dashboard (Lonceng)** dan **Surel (SMTP)**:
1. Dokumen baru dientri → Atasan Arsip Aktif.
2. Dokumen disetujui → PIC Arsip Aktif.
3. Dokumen ditolak beserta alasan → PIC Arsip Aktif.
4. Serah terima diajukan → Penerima.
5. Serah terima dikonfirmasi / ditolak → Penyerah.
6. Peminjaman inaktif diajukan → PIC Arsip Inaktif.
7. Peminjaman disetujui / ditolak → Peminjam.
8. Dokumen mendekati kadaluarsa (H-90, H-30, H-7) → PIC Arsip Aktif & PIC Arsip Inaktif.
9. Dokumen pindah ke Inaktif → PIC Arsip Aktif & PIC Arsip Inaktif.
10. Dokumen dibatalkan → PIC Arsip Aktif.
11. Transfer Dokumen diajukan (Berita Acara diterbitkan) → PIC Arsip Inaktif.
12. Transfer Dokumen diverifikasi fisik (diterima / ditolak) → PIC Arsip Aktif & Pemilik Dokumen.

---

## 7. Fitur Kearsipan Lanjutan (Tahap M8)

1. **Transfer Dokumen (PIC Arsip Aktif)**:
   - Menampilkan berkas aktif mendekati/lewat batas retensi (H-90, H-30, H-7, Lewat Retensi).
   - Pengajuan penyerahan tunggal/batch dengan penerbitan Berita Acara Penyerahan Arsip (PDF) resmi.
   - Status serah terima diawali `Menunggu konfirmasi` dengan prefix `TRANSFER_INAKTIF`.
   - Idempotensi: Dokumen dalam proses transfer dilewati (*skip*) oleh cron harian agar tidak terjadi pemrosesan ganda.

2. **Verifikasi Dokumen Fisik Inaktif (PIC Arsip Inaktif)**:
   - Pemindaian fisik QR / Barcode Kode Arsip SIG.
   - Aksi Terima: Pencatatan tanda tangan digital penerima + timestamp, transisi status dokumen ke `inaktif`, pemindahan fisik ke Gudang Inaktif (Rak Inaktif 01), alokasi boks inaktif otomatis berkapasitas 500 lembar dari master boks, dan migrasi file storage dari `arsip-aktif` ke `arsip-inaktif`.
   - Aksi Tolak: Wajib mencantumkan alasan fisik, dokumen tetap berstatus `aktif` di bawah PIC Arsip Aktif.

3. **Dasbor Metrik & Okupansi Kapasitas**:
   - Toggle satuan metrik (Berkas / Lembar vs Boks) pada seluruh kartu statistik dan grafik tren tahunan.
   - Widget Okupansi & Kapasitas per Ruangan & Rak yang membaca kapasitas riil dari master boks/tabel `boks`.
   - Peringatan dokumen dan boks mendekati masa kedaluwarsa.
   - Filter status dinamis menyesuaikan peran login.
