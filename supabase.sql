-- ==============================================================================
-- SKEMA SUPABASE: APLIKASI MANAJEMEN ARSIP DOKUMEN (ARCHIVA)
-- Standar Spesifikasi: BLUEPRINT.md R.03 — PT Semen Indonesia Group (SIG)
-- 10 Tabel: profiles, unit_organisasi, kategori_dokumen, lokasi, boks, dokumen,
-- peminjaman, serah_terima, log_aktivitas, notifikasi.
-- PERINGATAN: File ini adalah referensi skema sinkron R.03.
-- JANGAN JALANKAN FILE INI MENTAH-MENTAH DI DATABASE LIVE SUPABASE.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM TIPE R.03
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'superadmin',
        'pic_aktif',
        'atasan_aktif',
        'pic_inaktif',
        'atasan_inaktif',
        'staff'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dokumen_status AS ENUM (
        'menunggu_persetujuan',
        'aktif',
        'ditolak',
        'inaktif',
        'dibatalkan'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE serah_terima_status AS ENUM (
        'Menunggu konfirmasi',
        'Diterima',
        'Ditolak'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE peminjaman_status AS ENUM (
        'Diajukan',
        'Disetujui',
        'Dipinjam',
        'Dikembalikan',
        'Ditolak'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABEL UNIT ORGANISASI (Master Unit Organisasi)
CREATE TABLE IF NOT EXISTS public.unit_organisasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL UNIQUE,
    kode_perusahaan TEXT NOT NULL DEFAULT '2000',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL PROFILES (Kamus Data 4.4 R.03)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    nama_lengkap TEXT,
    nomor_pegawai TEXT,
    nip_nik TEXT,
    jabatan TEXT,
    unit_id UUID REFERENCES public.unit_organisasi(id) ON DELETE SET NULL,
    role user_role NOT NULL DEFAULT 'staff',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL KATEGORI DOKUMEN (3 Kategori Master Tetap)
CREATE TABLE IF NOT EXISTS public.kategori_dokumen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL UNIQUE,
    kode TEXT NOT NULL UNIQUE,
    kode_kategori TEXT,
    deskripsi TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL LOKASI (Hierarki Bertingkat: Gedung > Ruangan > Rak)
CREATE TABLE IF NOT EXISTS public.lokasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    tingkat TEXT NOT NULL CHECK (tingkat IN ('Gedung', 'Ruangan', 'Rak')),
    parent_id UUID REFERENCES public.lokasi(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL BOKS (Kapasitas Maks 500 Lembar)
CREATE TABLE IF NOT EXISTS public.boks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_boks TEXT NOT NULL,
    rak_id UUID NOT NULL REFERENCES public.lokasi(id) ON DELETE CASCADE,
    kapasitas_maks_lembar INT NOT NULL DEFAULT 500,
    jumlah_lembar_terisi INT NOT NULL DEFAULT 0,
    qr_path TEXT,
    status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Penuh')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL DOKUMEN (Data Induk Arsip SIG)
CREATE TABLE IF NOT EXISTS public.dokumen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_arsip TEXT NOT NULL UNIQUE,
    judul TEXT NOT NULL,
    nomor_dokumen TEXT, -- Doc Voucher
    nomor_ppl TEXT, -- No. Payment / PPL (10 digit)
    kategori_id UUID REFERENCES public.kategori_dokumen(id) ON DELETE RESTRICT,
    unit_id UUID REFERENCES public.unit_organisasi(id) ON DELETE RESTRICT,
    pemilik_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    pemegang_saat_ini UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    boks_id UUID REFERENCES public.boks(id) ON DELETE SET NULL,
    lokasi_saat_ini TEXT,
    tanggal_dokumen DATE DEFAULT CURRENT_DATE,
    tanggal_masuk TIMESTAMPTZ DEFAULT NOW(),
    tanggal_disetujui TIMESTAMPTZ,
    tanggal_kadaluarsa DATE, -- tanggal_disetujui + 3 tahun
    status dokumen_status NOT NULL DEFAULT 'menunggu_persetujuan',
    bucket TEXT NOT NULL DEFAULT 'arsip-aktif' CHECK (bucket IN ('arsip-aktif', 'arsip-inaktif')),
    file_path TEXT NOT NULL,
    file_tipe TEXT,
    ukuran_file BIGINT,
    jumlah_halaman INT NOT NULL DEFAULT 1,
    barcode_path TEXT,
    disetujui_oleh UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    penandatangan TEXT,
    alasan_penolakan TEXT,
    deskripsi TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABEL PEMINJAMAN (Hanya untuk Dokumen Inaktif)
CREATE TABLE IF NOT EXISTS public.peminjaman (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    peminjam_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    pic_inaktif_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tanggal_pinjam TIMESTAMPTZ DEFAULT NOW(),
    tanggal_kembali TIMESTAMPTZ,
    status peminjaman_status NOT NULL DEFAULT 'Diajukan',
    keperluan TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABEL SERAH TERIMA (Serah Terima Fisik Berbasis Scan QR)
CREATE TABLE IF NOT EXISTS public.serah_terima (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    dari_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ke_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    dari_lokasi TEXT NOT NULL,
    ke_lokasi TEXT NOT NULL,
    tanggal_serah TIMESTAMPTZ DEFAULT NOW(),
    tanggal_terima TIMESTAMPTZ,
    status_serah serah_terima_status NOT NULL DEFAULT 'Menunggu konfirmasi',
    keterangan TEXT,
    bukti_pdf_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABEL LOG AKTIVITAS (Audit Keamanan)
CREATE TABLE IF NOT EXISTS public.log_aktivitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokumen_id UUID REFERENCES public.dokumen(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    aksi TEXT NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABEL NOTIFIKASI (Kanal Dashboard Pengguna)
CREATE TABLE IF NOT EXISTS public.notifikasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dokumen_id UUID REFERENCES public.dokumen(id) ON DELETE SET NULL,
    judul TEXT NOT NULL,
    isi TEXT,
    pesan TEXT,
    dibaca BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks Pencarian Kunci
CREATE INDEX IF NOT EXISTS idx_dokumen_kode_arsip ON public.dokumen(kode_arsip);
CREATE INDEX IF NOT EXISTS idx_dokumen_status ON public.dokumen(status);
CREATE INDEX IF NOT EXISTS idx_dokumen_pemegang ON public.dokumen(pemegang_saat_ini);
CREATE INDEX IF NOT EXISTS idx_dokumen_boks ON public.dokumen(boks_id);
CREATE INDEX IF NOT EXISTS idx_log_aktivitas_dokumen ON public.log_aktivitas(dokumen_id);
CREATE INDEX IF NOT EXISTS idx_log_aktivitas_user ON public.log_aktivitas(user_id);
CREATE INDEX IF NOT EXISTS idx_notifikasi_user_unread ON public.notifikasi(user_id) WHERE dibaca = FALSE;
