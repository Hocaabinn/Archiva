-- ==============================================================================
-- SKEMA SUPABASE: APLIKASI ARSIP DOKUMEN (ARCHIVA)
-- Standar Spesifikasi: BLUEPRINT.md R.02 — PT Semen Indonesia Group (SIG)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM TIPE
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'pic_arsip', 'atasan', 'user', 'accounting', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dokumen_status AS ENUM ('menunggu_persetujuan', 'aktif', 'ditolak', 'inaktif', 'dibatalkan');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE serah_terima_status AS ENUM ('menunggu_konfirmasi', 'diterima', 'ditolak');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABEL PROFILES (Kamus Data 4.4)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    nama_lengkap TEXT,
    nomor_pegawai TEXT,
    nip_nik TEXT,
    jabatan TEXT,
    role user_role NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL KATEGORI DOKUMEN (BLUEPRINT.md Tabel 6 & Tabel 4 - Tepat 3 Kategori)
CREATE TABLE IF NOT EXISTS public.kategori_dokumen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL UNIQUE,
    kode TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Awal Kategori Master Resmi
INSERT INTO public.kategori_dokumen (nama, kode, deskripsi)
VALUES
    ('Keuangan', 'KEU', 'Laporan keuangan, invoice'),
    ('SDM', 'SDM', 'Dokumen kepegawaian'),
    ('Kontrak', 'KTR', 'Kontrak dan perjanjian')
ON CONFLICT (nama) DO UPDATE SET
    kode = EXCLUDED.kode,
    deskripsi = EXCLUDED.deskripsi;

-- 4. TABEL DOKUMEN (Kamus Data 4.4 & 4.3.2)
CREATE TABLE IF NOT EXISTS public.dokumen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_arsip TEXT NOT NULL UNIQUE, -- Format: TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
    judul TEXT NOT NULL,
    nomor_dokumen TEXT, -- Bagian Doc Voucher
    nomor_ppl TEXT, -- Bagian No. Payment / PPL (10 digit)
    penandatangan TEXT,
    kategori_id UUID REFERENCES public.kategori_dokumen(id) ON DELETE RESTRICT,
    pemilik_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    pemegang_saat_ini UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    lokasi_saat_ini TEXT DEFAULT 'Ruang Arsip Aktif',
    tanggal_dokumen DATE DEFAULT CURRENT_DATE,
    tanggal_kadaluarsa DATE, -- Dihitung: tanggal disetujui + 3 tahun
    tanggal_masuk TIMESTAMPTZ DEFAULT NOW(),
    tanggal_disetujui TIMESTAMPTZ,
    status dokumen_status NOT NULL DEFAULT 'menunggu_persetujuan',
    bucket TEXT NOT NULL DEFAULT 'arsip-aktif',
    file_path TEXT NOT NULL,
    file_tipe TEXT,
    ukuran_file BIGINT,
    barcode_path TEXT,
    verifikasi_pic_oleh UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    disetujui_oleh UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    alasan_penolakan TEXT,
    deskripsi TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL PEMINJAMAN (Kamus Data 4.4 - Khusus Dokumen Inaktif)
CREATE TABLE IF NOT EXISTS public.peminjaman (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    peminjam_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    pic_inaktif_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tanggal_pinjam TIMESTAMPTZ DEFAULT NOW(),
    tanggal_kembali TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Diajukan' CHECK (status IN ('Diajukan', 'Disetujui', 'Dipinjam', 'Dikembalikan', 'Ditolak')),
    keperluan TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL SERAH TERIMA (Kamus Data 4.4)
CREATE TABLE IF NOT EXISTS public.serah_terima (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    dari_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ke_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    dari_lokasi TEXT,
    ke_lokasi TEXT,
    tanggal_serah TIMESTAMPTZ DEFAULT NOW(),
    tanggal_terima TIMESTAMPTZ,
    status_serah TEXT NOT NULL DEFAULT 'Menunggu konfirmasi' CHECK (status_serah IN ('Menunggu konfirmasi', 'Diterima', 'Ditolak')),
    keterangan TEXT,
    bukti_pdf_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL LOG AKTIVITAS (Kamus Data 4.4)
CREATE TABLE IF NOT EXISTS public.log_aktivitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokumen_id UUID REFERENCES public.dokumen(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    aksi TEXT NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABEL NOTIFIKASI (Kamus Data 4.4)
CREATE TABLE IF NOT EXISTS public.notifikasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    judul TEXT NOT NULL,
    isi TEXT NOT NULL,
    dokumen_id UUID REFERENCES public.dokumen(id) ON DELETE SET NULL,
    dibaca BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABEL LAMPIRAN (Blueprint 6.4)
CREATE TABLE IF NOT EXISTS public.lampiran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    nama_file TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    diunggah_oleh UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategori_dokumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peminjaman ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serah_terima ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_aktivitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lampiran ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function pengiriman notifikasi resmi terpusat (SECURITY DEFINER dengan validasi ketat)
CREATE OR REPLACE FUNCTION public.kirim_notifikasi(
  p_user_id UUID,
  p_judul TEXT,
  p_isi TEXT,
  p_dokumen_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_user_exists BOOLEAN;
  v_doc_exists BOOLEAN;
BEGIN
  -- 1. Validasi penerima (user_id)
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ID penerima notifikasi (user_id) tidak boleh null';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'Penerima dengan ID % tidak terdaftar di profiles', p_user_id;
  END IF;

  -- 2. Validasi judul & isi
  IF p_judul IS NULL OR length(trim(p_judul)) = 0 THEN
    RAISE EXCEPTION 'Judul notifikasi tidak boleh kosong';
  END IF;

  IF p_isi IS NULL OR length(trim(p_isi)) = 0 THEN
    RAISE EXCEPTION 'Isi notifikasi tidak boleh kosong';
  END IF;

  -- 3. Validasi dokumen terkait (jika diisi)
  IF p_dokumen_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.dokumen WHERE id = p_dokumen_id) INTO v_doc_exists;
    IF NOT v_doc_exists THEN
      RAISE EXCEPTION 'Dokumen terkait dengan ID % tidak ditemukan', p_dokumen_id;
    END IF;
  END IF;

  -- 4. Insert notifikasi resmi
  INSERT INTO public.notifikasi (user_id, judul, isi, dokumen_id, dibaca, created_at)
  VALUES (p_user_id, trim(p_judul), trim(p_isi), p_dokumen_id, false, NOW())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Hak Akses: Cabut hak INSERT langsung dan EXECUTE dari publik/authenticated
REVOKE INSERT ON public.notifikasi FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.kirim_notifikasi(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
-- Notifikasi hanya boleh dibuat oleh server/trigger lewat service_role
GRANT EXECUTE ON FUNCTION public.kirim_notifikasi(UUID, TEXT, TEXT, UUID) TO service_role;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.current_user_role() = 'admin');

-- Kategori Policies
DROP POLICY IF EXISTS "kategori_select" ON public.kategori_dokumen;
CREATE POLICY "kategori_select" ON public.kategori_dokumen FOR SELECT USING (true);

DROP POLICY IF EXISTS "kategori_admin_modify" ON public.kategori_dokumen;
CREATE POLICY "kategori_admin_modify" ON public.kategori_dokumen FOR ALL
  USING (public.current_user_role() = 'admin');

-- Dokumen Policies
DROP POLICY IF EXISTS "dokumen_select" ON public.dokumen;
CREATE POLICY "dokumen_select" ON public.dokumen FOR SELECT
  USING (
    public.current_user_role() IN ('admin', 'pic_arsip', 'atasan', 'accounting', 'viewer')
    OR pemilik_id = auth.uid()
    OR pemegang_saat_ini = auth.uid()
  );

DROP POLICY IF EXISTS "dokumen_insert" ON public.dokumen;
CREATE POLICY "dokumen_insert" ON public.dokumen FOR INSERT
  WITH CHECK (
    pemilik_id = auth.uid() AND public.current_user_role() = 'user'
  );

DROP POLICY IF EXISTS "dokumen_update" ON public.dokumen;
CREATE POLICY "dokumen_update" ON public.dokumen FOR UPDATE
  USING (
    public.current_user_role() IN ('admin', 'pic_arsip', 'atasan')
    OR (pemilik_id = auth.uid() AND status = 'menunggu_persetujuan')
  );

DROP POLICY IF EXISTS "dokumen_delete" ON public.dokumen;
CREATE POLICY "dokumen_delete" ON public.dokumen FOR DELETE
  USING (public.current_user_role() = 'admin');

-- Peminjaman Policies
DROP POLICY IF EXISTS "peminjaman_select" ON public.peminjaman;
CREATE POLICY "peminjaman_select" ON public.peminjaman FOR SELECT
  USING (
    peminjam_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'pic_arsip', 'atasan')
  );

DROP POLICY IF EXISTS "peminjaman_insert" ON public.peminjaman;
CREATE POLICY "peminjaman_insert" ON public.peminjaman FOR INSERT
  WITH CHECK (peminjam_id = auth.uid());

DROP POLICY IF EXISTS "peminjaman_update" ON public.peminjaman;
CREATE POLICY "peminjaman_update" ON public.peminjaman FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'pic_arsip'));

-- Serah Terima Policies
DROP POLICY IF EXISTS "serah_terima_select" ON public.serah_terima;
CREATE POLICY "serah_terima_select" ON public.serah_terima FOR SELECT
  USING (
    dari_user_id = auth.uid() 
    OR ke_user_id = auth.uid() 
    OR public.current_user_role() IN ('admin', 'pic_arsip', 'atasan')
  );

DROP POLICY IF EXISTS "serah_terima_insert" ON public.serah_terima;
CREATE POLICY "serah_terima_insert" ON public.serah_terima FOR INSERT
  WITH CHECK (
    dari_user_id = auth.uid() OR public.current_user_role() IN ('admin', 'pic_arsip')
  );

DROP POLICY IF EXISTS "serah_terima_update" ON public.serah_terima;
CREATE POLICY "serah_terima_update" ON public.serah_terima FOR UPDATE
  USING (
    ke_user_id = auth.uid() OR public.current_user_role() IN ('admin', 'pic_arsip')
  );

-- Log Aktivitas Policies
DROP POLICY IF EXISTS "log_select" ON public.log_aktivitas;
CREATE POLICY "log_select" ON public.log_aktivitas FOR SELECT
  USING (
    public.current_user_role() IN ('admin', 'pic_arsip', 'atasan', 'accounting')
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "log_insert" ON public.log_aktivitas;
CREATE POLICY "log_insert" ON public.log_aktivitas FOR INSERT WITH CHECK (true);

-- Notifikasi Policies
DROP POLICY IF EXISTS "notifikasi_select" ON public.notifikasi;
CREATE POLICY "notifikasi_select" ON public.notifikasi FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifikasi_update" ON public.notifikasi;
CREATE POLICY "notifikasi_update" ON public.notifikasi FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifikasi_insert" ON public.notifikasi;

-- Lampiran Policies
DROP POLICY IF EXISTS "lampiran_select" ON public.lampiran;
CREATE POLICY "lampiran_select" ON public.lampiran FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dokumen d
      WHERE d.id = lampiran.dokumen_id
      AND (
        public.current_user_role() IN ('admin', 'pic_arsip', 'atasan', 'accounting', 'viewer')
        OR d.pemilik_id = auth.uid()
        OR d.pemegang_saat_ini = auth.uid()
      )
    )
    OR diunggah_oleh = auth.uid()
  );

DROP POLICY IF EXISTS "lampiran_insert" ON public.lampiran;
CREATE POLICY "lampiran_insert" ON public.lampiran FOR INSERT
  WITH CHECK (
    diunggah_oleh = auth.uid() OR public.current_user_role() IN ('admin', 'pic_arsip')
  );

DROP POLICY IF EXISTS "lampiran_delete" ON public.lampiran;
CREATE POLICY "lampiran_delete" ON public.lampiran FOR DELETE
  USING (
    diunggah_oleh = auth.uid() OR public.current_user_role() IN ('admin')
  );

-- Trigger Otomatis User Baru
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nama, nama_lengkap, nomor_pegawai, jabatan, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'nomor_pegawai',
    NEW.raw_user_meta_data->>'jabatan',
    'user'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
