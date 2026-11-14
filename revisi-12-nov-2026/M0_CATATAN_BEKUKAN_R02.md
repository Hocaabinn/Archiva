# Catatan Pembekuan R.02 (M0) — 14 November 2026

Dokumen ini mencatat kondisi live sebelum memulai Migrasi R.03 (`BLUEPRINT.md` R.03).
Sesuai instruksi **M0 — Bekukan R.02 dulu** pada `RENCANA-MIGRASI-R03.md`.

---

## 1. Keadaan Kode & Git

- **Branch aktif**: `main`
- **Commit HEAD**: `cf5788f` (*fix(keamanan): migrasi trigger cegah_ubah_peran_sendiri menutup celah ubah peran sendiri*)
- **Riwayat Commit Terakhir**:
  1. `cf5788f` - fix(keamanan): migrasi trigger cegah_ubah_peran_sendiri menutup celah ubah peran sendiri
  2. `9eb5875` - feat(pengguna): halaman Kelola Pengguna dengan pilihan peran
  3. `d404280` - feat(pengguna): API ubah peran khusus Admin dengan log dan notifikasi
  4. `b4d0121` - feat(pengguna): helper requireAdmin dan API daftar pengguna khusus Admin Sistem
  5. `61a42be` - style(persetujuan): modal konfirmasi dan toast bergaya biru langit
- **Status working tree**: Bersih (*clean*). Semua perbaikan login dan kelola peran telah ter-commit.

---

## 2. Backup Database Live Supabase ("App-Documen-Arsip")

- **URL Proyek**: `https://glnfsnkdojlukyhwpjfc.supabase.co`
- **File Dump Backup**: `backup_r02_m0_20261114.json`
- **Jumlah Data per Tabel**:
  - `profiles`: 6 baris
  - `kategori_dokumen`: 3 baris
  - `dokumen`: 4 baris
  - `serah_terima`: 0 baris
  - `log_aktivitas`: 27 baris
  - `notifikasi`: 32 baris
  - `peminjaman`: 0 baris

---

## 3. Daftar Akun Live Saat Ini (Role R.02)

Daftar ini menjadi patokan untuk pemetaan peran baru di tahap **M2**:

| No | Nama | Email | Jabatan | Role R.02 | User ID |
|---|---|---|---|---|---|
| 1 | admin | admin@example.com | - | `admin` | `14cb06f2-2ff5-4c8f-9728-e70efabd9218` |
| 2 | pic.arsip | pic.arsip@example.com | - | `pic_arsip` | `043bf5ac-9690-4333-8448-aa70720a6d1e` |
| 3 | atasan | atasan@example.com | - | `atasan` | `fdb91510-86dc-41e9-a6ae-3515c49c9fab` |
| 4 | pengaju | pengaju@example.com | - | `user` | `3f305ea9-42db-4d48-b483-d27c1c8da7cd` |
| 5 | accounting | accounting@example.com | - | `accounting` | `fc9fc3d0-217f-4988-8465-6c6fe20dcb4b` |
| 6 | viewer | viewer@example.com | - | `viewer` | `e074a6f6-4204-4a88-bf13-87d46bcc665a` |

---

## 4. Daftar Dokumen Live Saat Ini

| No | Kode Arsip | Judul Dokumen | Status R.02 | Pemilik ID | Keterangan / Catatan |
|---|---|---|---|---|---|
| 1 | `2026_2000_1500099001_1900099001` | Dokumen Uji Alur Lengkap Tahap 3 | `aktif` | `3f305ea9...` | Dokumen uji; file fisik hilang di storage, akan dibersihkan di M7 |
| 2 | `2026_2000_1500013465_1900009486` | Dokumen kontrak | `ditolak` | `3f305ea9...` | Alasan penolakan: "kurang lengkap dokumen nya" |
| 3 | `2026_2000__` | laporan keungan | `menunggu_persetujuan` | `3f305ea9...` | **Wajib dijaga**: sedang antre persetujuan, tidak boleh hilang/berubah status saat migrasi |
| 4 | `2026_2000_1524704030_1924704030` | [TEST WARNING] Dokumen Peringatan H-30 | `aktif` | `3f305ea9...` | Dokumen uji peringatan; file fisik hilang di storage, akan dibersihkan di M7 |

---

## 5. Verifikasi M0 Selesai

- [x] File markdown R.03 (`AGENTS.md`, `BLUEPRINT.md`, `GEMINI.md`, `pseudo-code-kapasitas-boks.md`, `RENCANA-MIGRASI-R03.md`) tersimpan di folder `revisi-12-nov-2026/`.
- [x] Backup database Supabase live (`backup_r02_m0_20261114.json`) berhasil diekstrak dan dapat dibaca.
- [x] Git bersih, commit terakhir tercatat (`cf5788f`).
- [x] Daftar seluruh 6 akun live dan 4 dokumen live tercatat lengkap tanpa ada perubahan skema atau modifikasi data.
