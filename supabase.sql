-- Skema Supabase untuk Aplikasi Arsip Dokumen
-- Sesuai dengan PRD.md dan DESIGN.md

-- 1. Ekstensi
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM Tipe
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'pic_arsip', 'atasan', 'user', 'accounting', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dokumen_status AS ENUM ('menunggu_persetujuan', 'aktif', 'nonaktif', 'ditolak');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE serah_terima_status AS ENUM ('menunggu_konfirmasi', 'diterima', 'ditolak');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pembayaran_status AS ENUM ('menunggu_verifikasi', 'lunas', 'gagal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tabel Profiles (User Role)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nama_lengkap TEXT NOT NULL,
    nip_nik TEXT,
    jabatan TEXT,
    role user_role NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Kategori Dokumen
CREATE TABLE IF NOT EXISTS public.kategori_dokumen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama TEXT NOT NULL UNIQUE,
    kode_kategori TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Awal Kategori
INSERT INTO public.kategori_dokumen (nama, kode_kategori, deskripsi)
VALUES 
    ('Keuangan', 'KEU', 'Dokumen transaksi, laporan laba rugi, dan perpajakan'),
    ('SDM & Kepegawaian', 'SDM', 'Kontrak pegawai, berkas rekrutmen, dan SK direksi'),
    ('Kontrak & Legal', 'LGL', 'Perjanjian vendor, MoU, dan perizinan resmi'),
    ('Operasional & Logistik', 'OPS', 'Berita acara serah terima gudang dan inventaris')
ON CONFLICT (kode_kategori) DO NOTHING;

-- 5. Paket Pembayaran (Perpanjangan / Reaktivasi)
CREATE TABLE IF NOT EXISTS public.paket_pembayaran (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_paket TEXT NOT NULL,
    kode_paket TEXT NOT NULL UNIQUE,
    harga NUMERIC NOT NULL,
    durasi_bulan INT NOT NULL DEFAULT 12,
    deskripsi TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.paket_pembayaran (nama_paket, kode_paket, harga, durasi_bulan, deskripsi)
VALUES 
    ('Perpanjangan 1 Tahun', 'EXT_1Y', 50000, 12, 'Memperpanjang masa aktif dokumen aktif selama 12 bulan'),
    ('Reaktivasi Non-Aktif', 'REACT_1Y', 75000, 12, 'Mengaktifkan kembali dokumen dari gudang non-aktif selama 12 bulan')
ON CONFLICT (kode_paket) DO NOTHING;

-- 6. Tabel Dokumen Arsip
CREATE TABLE IF NOT EXISTS public.dokumen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_arsip TEXT NOT NULL UNIQUE,
    nomor_dokumen TEXT,
    judul TEXT NOT NULL,
    kategori_id UUID REFERENCES public.kategori_dokumen(id),
    deskripsi TEXT,
    status dokumen_status NOT NULL DEFAULT 'menunggu_persetujuan',
    
    file_path TEXT NOT NULL,
    bucket TEXT NOT NULL DEFAULT 'arsip-aktif',
    file_size BIGINT,
    mime_type TEXT,
    
    qr_code_path TEXT,
    
    pemilik_id UUID NOT NULL REFERENCES public.profiles(id),
    pemegang_saat_ini UUID NOT NULL REFERENCES public.profiles(id),
    lokasi_saat_ini TEXT NOT NULL DEFAULT 'Meja Pengaju',
    
    tanggal_dokumen DATE NOT NULL DEFAULT CURRENT_DATE,
    tanggal_diajukan TIMESTAMPTZ DEFAULT NOW(),
    tanggal_disetujui TIMESTAMPTZ,
    tanggal_kadaluarsa DATE,
    
    verifikasi_pic_oleh UUID REFERENCES public.profiles(id),
    verifikasi_pic_at TIMESTAMPTZ,
    catatan_pic TEXT,
    
    approval_atasan_oleh UUID REFERENCES public.profiles(id),
    approval_atasan_at TIMESTAMPTZ,
    catatan_atasan TEXT,
    
    alasan_penolakan TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index Dokumen
CREATE INDEX IF NOT EXISTS idx_dokumen_kode_arsip ON public.dokumen(kode_arsip);
CREATE INDEX IF NOT EXISTS idx_dokumen_pemilik ON public.dokumen(pemilik_id);
CREATE INDEX IF NOT EXISTS idx_dokumen_status ON public.dokumen(status);
CREATE INDEX IF NOT EXISTS idx_dokumen_kadaluarsa ON public.dokumen(tanggal_kadaluarsa);

-- 7. Tabel Serah Terima
CREATE TABLE IF NOT EXISTS public.serah_terima (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    penyerah_id UUID NOT NULL REFERENCES public.profiles(id),
    penerima_id UUID NOT NULL REFERENCES public.profiles(id),
    lokasi_tujuan TEXT NOT NULL,
    status serah_terima_status NOT NULL DEFAULT 'menunggu_konfirmasi',
    keterangan TEXT,
    tanggal_serah TIMESTAMPTZ DEFAULT NOW(),
    tanggal_terima TIMESTAMPTZ,
    alasan_tolak TEXT,
    pdf_bukti_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabel Pembayaran
CREATE TABLE IF NOT EXISTS public.pembayaran (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    paket_id UUID NOT NULL REFERENCES public.paket_pembayaran(id),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    jumlah NUMERIC NOT NULL,
    metode_pembayaran TEXT DEFAULT 'transfer_manual',
    status pembayaran_status NOT NULL DEFAULT 'menunggu_verifikasi',
    bukti_transfer_path TEXT,
    diverifikasi_oleh UUID REFERENCES public.profiles(id),
    paid_at TIMESTAMPTZ,
    berlaku_sampai DATE,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabel Log Aktivitas (Audit Trail)
CREATE TABLE IF NOT EXISTS public.log_aktivitas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dokumen_id UUID REFERENCES public.dokumen(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    aksi TEXT NOT NULL,
    detail JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_dokumen ON public.log_aktivitas(dokumen_id);
CREATE INDEX IF NOT EXISTS idx_log_user ON public.log_aktivitas(user_id);

-- 10. Sequence Generator Kode Arsip (ARS-YYYY-XXXX)
CREATE SEQUENCE IF NOT EXISTS arsip_seq_2026 START 1;

CREATE OR REPLACE FUNCTION public.generate_kode_arsip()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
    current_yr TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
    seq_val INT;
BEGIN
    IF NEW.kode_arsip IS NULL OR NEW.kode_arsip = '' THEN
        EXECUTE 'CREATE SEQUENCE IF NOT EXISTS arsip_seq_' || current_yr || ' START 1;';
        EXECUTE 'SELECT nextval(''arsip_seq_' || current_yr || ''')' INTO seq_val;
        NEW.kode_arsip := 'ARS-' || current_yr || '-' || LPAD(seq_val::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_generate_kode_arsip
BEFORE INSERT ON public.dokumen
FOR EACH ROW
EXECUTE FUNCTION public.generate_kode_arsip();

-- 11. Trigger Auto Profile saat Register Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
-- Role SELALU 'user' untuk pendaftaran. Nilai 'role' dari metadata client
-- sengaja diabaikan (PRD FR-01) — role lain hanya diberikan oleh Admin
-- atau lewat SQL Editor.
    INSERT INTO public.profiles (id, email, nama_lengkap, nip_nik, jabatan, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'nama_lengkap', ''), split_part(NEW.email, '@', 1)),
        NULLIF(NEW.raw_user_meta_data->>'nip_nik', ''),
        NULLIF(NEW.raw_user_meta_data->>'jabatan', ''),
        'user'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategori_dokumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paket_pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serah_terima ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_aktivitas ENABLE ROW LEVEL SECURITY;

-- Helper Function Role Check
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Profiles readable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Profiles updatable by admin or self"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.get_auth_role() = 'admin');

-- Kategori & Paket Policies
CREATE POLICY "Kategori readable by all authenticated"
    ON public.kategori_dokumen FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Kategori manageable by admin"
    ON public.kategori_dokumen FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'admin');

CREATE POLICY "Paket readable by all authenticated"
    ON public.paket_pembayaran FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Paket manageable by admin"
    ON public.paket_pembayaran FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'admin');

-- Dokumen Policies
CREATE POLICY "Dokumen visible to authorized roles"
    ON public.dokumen FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('admin', 'pic_arsip', 'atasan', 'accounting', 'viewer')
        OR pemilik_id = auth.uid()
        OR pemegang_saat_ini = auth.uid()
    );

CREATE POLICY "User can insert own document with pending status"
    ON public.dokumen FOR INSERT
    TO authenticated
    WITH CHECK (
        pemilik_id = auth.uid()
        AND status = 'menunggu_persetujuan'
    );

CREATE POLICY "Dokumen update restricted by role"
    ON public.dokumen FOR UPDATE
    TO authenticated
    USING (
        public.get_auth_role() IN ('admin', 'pic_arsip', 'atasan')
        OR (pemilik_id = auth.uid() AND status = 'menunggu_persetujuan')
    );

-- Storage Buckets Creation (Script)
-- Jalankan di SQL Editor Supabase untuk membuat bucket privat:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('arsip-aktif', 'arsip-aktif', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('arsip-inaktif', 'arsip-inaktif', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('bukti-pembayaran', 'bukti-pembayaran', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('barcode', 'barcode', false) ON CONFLICT DO NOTHING;
