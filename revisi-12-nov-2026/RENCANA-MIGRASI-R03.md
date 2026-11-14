# Rencana Migrasi R.02 → R.03 — Antigravity

Patokan: `BLUEPRINT.md` R.03 (14 Nov 2026). Aturan project: `AGENTS.md` / `GEMINI.md` (sudah disinkronkan ke R.03).
Kode live + Supabase live masih model R.02. `PRD.md`, `DESIGN.md`, `erd.dbml`, `supabase.sql` masih R.02 — jangan jadikan patokan.

## Cara pakai

1. Kerjakan SATU tahap dalam satu waktu, dengan SATU tool saja (Antigravity — jangan bareng Claude Code di kode yang sama).
2. Setiap tahap: lampirkan `BLUEPRINT.md` + `AGENTS.md` dan paste prompt tahap tersebut.
3. Setelah satu tahap selesai: jalankan aplikasi, cek daftar verifikasi tahap itu, cocokkan dengan blueprint. Kalau lolos, commit. Baru lanjut ke tahap berikut.
4. Jangan loncat tahap. Jangan tambah fitur di luar blueprint. Jangan ubah role, skema, atau alur approval tanpa konfirmasi user.
5. Jangan lanjutkan Tahap 5 / Tahap 6 R.02 dulu — serah terima, notifikasi, dan lampiran R.02 dibangun di atas alur lama (Pengaju + verifikasi PIC) yang sudah diganti R.03. Kerjakan migrasi ini dulu.

---

## M0 — Bekukan R.02 dulu (wajib, sebelum sentuh apa pun)

> Baca `BLUEPRINT.md` R.03 + `AGENTS.md` dulu.
>
> Kerjakan:
> - Backup database live Supabase ("App-Documen-Arsip") sebelum mengubah apa pun.
> - Commit / catat keadaan kode saat ini di git (Tahap 4 + perbaikan login masih belum commit/push — jangan menimpanya dengan migrasi R.03).
> - Catat daftar akun live saat ini beserta role R.02-nya (nama, email, role lama) — daftar ini dipakai di M2 untuk pemetaan role baru.
> - Catat daftar dokumen live beserta statusnya — dokumen `menunggu_persetujuan` yang masih antre verifikasi PIC tidak boleh hilang atau berubah status diam-diam saat migrasi.
>
> Jangan: mengubah skema, role, atau alur di tahap ini; menghapus dokumen / akun.
>
> Verifikasi: backup ada dan bisa dibaca; git bersih / keadaan awal tercatat; daftar akun + dokumen tersimpan.

## M1 — Skema + Master Data R.03

> Baca `BLUEPRINT.md` 3.1, 3.5, 4.3, 4.4 (Tabel 7, 9, 19, 20, 21) dulu.
>
> Kerjakan:
> - Buat tabel baru: `unit_organisasi` (Keuangan, Legal; kode perusahaan 2000), `lokasi` (Gedung > Ruangan > Rak, pakai `parent_id`), `boks` (nomor urut, `rak_id`, kapasitas maks 500 lembar, QR tersendiri, status Aktif/Penuh).
> - Tambah kolom: `profiles.unit_id` (FK ke `unit_organisasi`); `dokumen.unit_id`, `dokumen.boks_id` (FK ke `boks`), `dokumen.jumlah_halaman` (int, diinput PIC saat entri).
> - Hapus kolom `dokumen.verifikasi_pic_oleh` (tahap verifikasi PIC dihapus di R.03).
> - Seed Master Lokasi awal + satu boks aktif 01 per rak yang dipakai. Kapasitas boks disetel lewat Master Kapasitas Boks (nilai awal 500), bukan hardcode.
> - Perbarui `erd-master.dbml` / `erd-dokumen.dbml` agar sama dengan hasil migrasi. Jangan jalankan `supabase.sql` mentah.
>
> Jangan: membuat tabel pembayaran; memakai status `nonaktif`; memakai kode `ARS-2026-0001`; mengubah role di tahap ini.
>
> Verifikasi: 10 tabel sama dengan 4.4; `unit_organisasi` berisi Keuangan + Legal; lokasi bertingkat bisa dipilih Gedung > Ruangan > Rak; boks 01 ada dan berstatus Aktif.

## M2 — Role + RLS + Auth (ini yang pertama di sisi aplikasi)

> Baca `BLUEPRINT.md` 3.1, Bab 5, Bab 7 dulu.
>
> Kerjakan:
> - Ganti 6 role lama menjadi 6 role baru R.03 dengan kode baru: `superadmin`, `pic_aktif`, `atasan_aktif`, `pic_inaktif`, `atasan_inaktif`, `staff`. Hapus kode lama (`admin`, `pic_arsip`, `atasan`, `user`, `accounting`, `viewer`) dari kode + RLS + UI.
> - Pendaftaran baru default `staff`. Hanya Superadmin yang mengubah role. Terapkan trigger cegah-ubah-peran-sendiri (perbaikan RLS 12 Nov 2026) untuk kode peran baru.
> - Petakan akun live lama ke role baru BERDASARKAN daftar M0 — jangan ditebak otomatis: Admin Sistem → Superadmin; PIC Arsip lama → PIC Arsip Aktif ATAU PIC Arsip Inaktif (tanya user per akun); Pengaju lama → PIC Arsip Aktif unitnya ATAU Staff (tanya user per akun); Accounting / Viewer lama → Staff. Tampilkan daftar pemetaan ke user sebelum mengeksekusi, dan minta user mengonfirmasi daftar itu.
> - Terapkan RLS + cek role di API sesuai Bab 5: Staff hanya lihat + unduh, tolak entri / edit / hapus / approve di API (bukan cuma sembunyikan tombol); Superadmin maintainer, tidak ikut operasional normal; PIC Aktif hanya dokumen unitnya.
>
> Jangan: dropdown pilih role di registrasi publik; membiarkan akun lama tetap berkode role lama; memberi Staff akses entri.
>
> Verifikasi: daftar baru → otomatis Staff; login tiap role baru hanya membuka yang diizinkan Bab 5; Staff ditolak 403 saat mencoba entri / approve lewat API; Superadmin bisa ubah role di Kelola Pengguna; user tidak bisa mengubah role sendiri via Supabase client.

## M3 — Entri + Kode Arsip Otomatis

> Baca `BLUEPRINT.md` 3.2, 3.3, 6.2, 6.3 dulu.
>
> Kerjakan:
> - Form entri baru: hanya PIC Arsip Aktif (per unit) yang bisa mengentri. Satu field nomor payment saja — bisa diketik, di-scan barcode/QR, atau voice typing.
> - Susun kode arsip otomatis: tahun dari tanggal dokumen, kode perusahaan + divisi dari Master Organisasi mengikuti unit PIC yang login, nomor doc voucher diterbitkan otomatis sistem. Tampilkan kode arsip hasil susunan sebelum simpan, untuk dicek PIC.
> - Tambah field `jumlah_halaman` (lembar fisik) di form entri — wajib diisi, dipakai alokasi boks M5.
> - Status awal `menunggu_persetujuan`. Hapus form / parser kode arsip lama (catat kode lengkap dari dokumen / nama file + verifikasi PIC).
>
> Jangan: membiarkan Staff / Superadmin mengentri; membiarkan user mengetik kode arsip lengkap manual; membuat nomor urut dokumen sendiri di luar doc voucher otomatis.
>
> Verifikasi: PIC Keuangan mengentri dengan nomor payment saja → kode arsip terbentuk `TAHUN_2000_NOPAYMENT_DOCVOUCHER` dengan unit Keuangan; Staff ditolak 403 saat mengentri; dokumen baru berstatus `menunggu_persetujuan`.

## M4 — Approval Baru (Atasan Arsip Aktif)

> Baca `BLUEPRINT.md` 3.3, 6.3, 8.1 dulu.
>
> Kerjakan:
> - Alur baru: PIC Arsip Aktif entri → Atasan Arsip Aktif unit yang sama menyetujui / menolak. Hapus tahap verifikasi PIC tahap 1 dari kode + UI + API (PIC tidak memverifikasi entrinya sendiri).
> - Saat disetujui: isi `disetujui_oleh` (Atasan Arsip Aktif), `tanggal_disetujui`, hitung `tanggal_kadaluarsa` = tanggal disetujui + 3 tahun, terbitkan QR / barcode label, status → `aktif`.
> - Saat ditolak: status → `ditolak` + alasan wajib, kembali ke PIC Arsip Aktif untuk diperbaiki dan diajukan ulang → status kembali `menunggu_persetujuan`.
>
> Jangan: mengaktifkan dokumen tanpa Atasan Arsip Aktif; mengembalikan dokumen ditolak ke Staff / Pengaju lama.
>
> Verifikasi: satu dokumen lewat alur lengkap sampai Aktif; tanggal kadaluarsa tepat +3 tahun; dokumen ditolak bisa diperbaiki PIC Aktif dan diajukan ulang; antrean persetujuan hanya tampil untuk Atasan Arsip Aktif unit yang sama.

## M5 — Master Lokasi + Boks + Serah Terima

> Baca `BLUEPRINT.md` 3.5, 8.3 + `pseudo-code-kapasitas-boks.md` dulu.
>
> Kerjakan:
> - Lokasi di semua form (entri, serah terima) memakai dropdown bertingkat dari Master Lokasi (Gedung > Ruangan > Rak) — bukan free text. Tolak simpan bila lokasi belum terdaftar di Master.
> - Alokasi boks otomatis mengikuti pseudo-code: cek boks aktif + sisa kapasitas (500 lembar, dari Master Kapasitas Boks) → masuk boks yang sama bila muat, pindah ke boks baru bernomor urut berikutnya bila melampaui batas. Terbitkan QR tersendiri per boks. Superadmin bisa mengedit nomor boks.
> - Serah terima: scan QR / barcode → penerima konfirmasi → pemegang + lokasi berubah, PDF bukti diterbitkan. Hanya dokumen Aktif. Lokasi baru dipilih dari Master Lokasi.
>
> Jangan: free text lokasi; serah terima dokumen Inaktif sebagai dokumen aktif; mengubah pemegang sebelum penerima konfirmasi.
>
> Verifikasi: simulasi boks lolos (200 + 150 = 350 tetap boks 01; +300 = 650 pindah boks 02); lokasi free text ditolak; serah terima lengkap dari scan sampai PDF bukti, pemegang berubah hanya setelah konfirmasi.

## M6 — Siklus Hidup + Peminjaman + Pembatalan (disesuaikan R.03)

> Baca `BLUEPRINT.md` 3.4, 3.6, 3.8, 6.6, 8.2 dulu.
>
> Kerjakan:
> - Cron harian: dokumen lewat tanggal kadaluarsa pindah ke Inaktif — file ke bucket `arsip-inaktif`, status + bucket berubah, pemegang → PIC Arsip Inaktif, lokasi → Gudang Inaktif, catat di log. Cron idempotent.
> - Peringatan H-90 / H-30 / H-7 ke PIC Arsip Aktif + PIC Arsip Inaktif (dashboard + surel).
> - Peminjaman Inaktif (3.6): ajukan → PIC Arsip Inaktif setujui / tolak → catat → kembalikan. Status dokumen tetap Inaktif.
> - Pembatalan (6.6): hanya Atasan Arsip Aktif, alasan wajib. Dokumen tetap terlihat dengan penanda DIBATALKAN; kode arsip tidak dipakai ulang. Hapus permanen hanya Superadmin setelah Atasan menyetujui.
> - Perbaiki Admin yang masih terselip sebagai penyetuju peminjaman / pembatalan di API (temuan Tahap 4, 10 Nov 2026).
>
> Jangan: reaktivasi Inaktif lewat bayar / pengajuan ulang; mengubah status dokumen saat dipinjam; membiarkan Superadmin membatalkan dokumen.
>
> Verifikasi: cron memindahkan dokumen lewat tanggal; peringatan H-90 / H-30 / H-7 tampil; peminjaman lengkap ajukan → dipinjam → dikembalikan tanpa mengubah status; pembatalan oleh Atasan Arsip Aktif tercatat, Superadmin ditolak membatalkan lewat API.

## M7 — Notifikasi + Log + Pencarian + UI per Role (penutup)

> Baca `BLUEPRINT.md` 3.7, 3.8, 6.5, Bab 9, Bab 10 dulu.
>
> Kerjakan:
> - Notifikasi dashboard + surel untuk 10 peristiwa Tabel 16 R.03 (bukan 11 peristiwa R.02). Dashboard tetap tampil walau surel gagal.
> - `log_aktivitas`: entri, persetujuan Atasan Arsip Aktif, tolak, lihat, download, pindah Inaktif, peminjaman, serah terima, pembatalan. Riwayat per dokumen dan per user.
> - Pencarian utama kode arsip (nomor payment / doc voucher / kode lengkap) + judul; filter status, kategori, tanggal, pemegang, lokasi. Satu kotak pencarian di area daftar (keputusan 11 Nov 2026 — hapus kotak bar atas bila masih ada).
> - UI per role baru: menu + dashboard + antrean sesuai Bab 5 / Bab 9; label 'Akan Kadaluarsa' (bukan 'Kritis'); login satu kartu tanpa panel marketing dan tanpa tab OTP (perbaikan login 11 Nov 2026 — cek ulang di model R.03).
> - Data demo: 6 akun demo role baru + dokumen contoh bertanda `[DEMO]`; pastikan data demo bisa dihapus bersih. Bersihkan 2 dokumen test yang filenya hilang (500 Object not found): `2026_2000_1500099001_1900099001` dan `2026_2000_1524704030_1924704030`.
> - Perbarui `PRD.md`, `DESIGN.md`, `erd.dbml`, `supabase.sql` agar sama dengan R.03 (jangan jalankan `supabase.sql` mentah di live).
>
> Jangan: push notification; menghapus log; data demo bercampur data real.
>
> Verifikasi: tiap peristiwa Tabel 16 memunculkan notifikasi; riwayat dokumen + user tampil benar; pencarian menemukan dokumen dari payment / voucher / kode lengkap; tiap role baru melihat menu yang benar; build lolos.
