-- ==============================================================================
-- MIGRASI M1 — SKEMA + MASTER DATA R.03 (App-Documen-Arsip)
-- Patokan: BLUEPRINT.md 3.1, 3.5, 4.3, 4.4 (Tabel 7, 9, 19, 20, 21)
-- 
-- Rincian:
-- 1. Tabel baru: unit_organisasi (Keuangan, Legal; kode perusahaan 2000)
-- 2. Tabel baru: lokasi (Gedung > Ruangan > Rak, hierarkis parent_id)
-- 3. Tabel baru: boks (nomor urut, rak_id, kapasitas maks 500 lembar, status Aktif/Penuh)
-- 4. Tambah kolom: profiles.unit_id (FK ke unit_organisasi)
-- 5. Tambah kolom: dokumen.unit_id (FK ke unit_organisasi), dokumen.boks_id (FK ke boks),
--    dokumen.jumlah_halaman (int, default 1)
-- 6. Hapus kolom: dokumen.verifikasi_pic_oleh (tahap verifikasi PIC dihapus di R.03)
-- 7. Seed data awal: Unit Organisasi, Lokasi bertingkat, dan Boks 01 Aktif
-- 8. Aktifkan Row Level Security (RLS) pada tabel-tabel master baru
--
-- CARA EKSEKUSI:
-- Salin dan jalankan seluruh isi file ini di Supabase SQL Editor.
-- Skrip ini idempotent (aman dijalankan berulang kali).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABEL: unit_organisasi (Tabel 19 BLUEPRINT.md)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unit_organisasi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL UNIQUE,
  kode_perusahaan TEXT NOT NULL DEFAULT '2000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. TABEL: lokasi (Tabel 20 BLUEPRINT.md) — Gedung > Ruangan > Rak
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lokasi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  tingkat TEXT NOT NULL CHECK (tingkat IN ('Gedung', 'Ruangan', 'Rak')),
  parent_id UUID REFERENCES public.lokasi(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk hierarki pencarian lokasi
CREATE INDEX IF NOT EXISTS idx_lokasi_parent_id ON public.lokasi(parent_id);
CREATE INDEX IF NOT EXISTS idx_lokasi_tingkat ON public.lokasi(tingkat);

-- ------------------------------------------------------------------------------
-- 3. TABEL: boks (Tabel 21 BLUEPRINT.md)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_boks TEXT NOT NULL,
  rak_id UUID NOT NULL REFERENCES public.lokasi(id) ON DELETE RESTRICT,
  kapasitas_maks_lembar INT NOT NULL DEFAULT 500,
  jumlah_lembar_terisi INT NOT NULL DEFAULT 0,
  qr_path TEXT,
  status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Penuh')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_boks_nomor_rak UNIQUE (rak_id, nomor_boks)
);

CREATE INDEX IF NOT EXISTS idx_boks_rak_id ON public.boks(rak_id);
CREATE INDEX IF NOT EXISTS idx_boks_status ON public.boks(status);

-- ------------------------------------------------------------------------------
-- 4. KOLOM BARU PADA PROFILES (Tabel 7 BLUEPRINT.md)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.unit_organisasi(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_unit_id ON public.profiles(unit_id);

-- ------------------------------------------------------------------------------
-- 5. PERUBAHAN KOLOM PADA DOKUMEN (Tabel 9 BLUEPRINT.md)
-- ------------------------------------------------------------------------------
ALTER TABLE public.dokumen
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.unit_organisasi(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS boks_id UUID REFERENCES public.boks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jumlah_halaman INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_dokumen_unit_id ON public.dokumen(unit_id);
CREATE INDEX IF NOT EXISTS idx_dokumen_boks_id ON public.dokumen(boks_id);

-- 6. HAPUS verifikasi_pic_oleh (Tahap verifikasi PIC dihapus pada alur R.03)
ALTER TABLE public.dokumen
  DROP COLUMN IF EXISTS verifikasi_pic_oleh;

-- ------------------------------------------------------------------------------
-- 7. SEED DATA AWAL MASTER DATA R.03
-- ------------------------------------------------------------------------------

-- 7.1 Seed Unit Organisasi (Keuangan dan Legal, Kode Perusahaan 2000)
INSERT INTO public.unit_organisasi (nama, kode_perusahaan)
VALUES 
  ('Keuangan', '2000'),
  ('Legal', '2000')
ON CONFLICT (nama) DO UPDATE 
SET kode_perusahaan = EXCLUDED.kode_perusahaan;

-- 7.2 Seed Master Lokasi Bertingkat (Gedung > Ruangan > Rak)
DO $$
DECLARE
  v_gedung_a UUID;
  v_ruang_aktif UUID;
  v_rak_01 UUID;
  
  v_gudang_inaktif UUID;
  v_ruang_inaktif UUID;
  v_rak_inaktif_01 UUID;

  v_unit_keuangan UUID;
  v_boks_01 UUID;
BEGIN
  -- Gedung A
  SELECT id INTO v_gedung_a FROM public.lokasi WHERE nama = 'Gedung A' AND tingkat = 'Gedung' LIMIT 1;
  IF v_gedung_a IS NULL THEN
    INSERT INTO public.lokasi (nama, tingkat, parent_id)
    VALUES ('Gedung A', 'Gedung', NULL) RETURNING id INTO v_gedung_a;
  END IF;

  -- Ruang Arsip Aktif
  SELECT id INTO v_ruang_aktif FROM public.lokasi WHERE nama = 'Ruang Arsip Aktif' AND parent_id = v_gedung_a LIMIT 1;
  IF v_ruang_aktif IS NULL THEN
    INSERT INTO public.lokasi (nama, tingkat, parent_id)
    VALUES ('Ruang Arsip Aktif', 'Ruangan', v_gedung_a) RETURNING id INTO v_ruang_aktif;
  END IF;

  -- Rak 01
  SELECT id INTO v_rak_01 FROM public.lokasi WHERE nama = 'Rak 01' AND parent_id = v_ruang_aktif LIMIT 1;
  IF v_rak_01 IS NULL THEN
    INSERT INTO public.lokasi (nama, tingkat, parent_id)
    VALUES ('Rak 01', 'Rak', v_ruang_aktif) RETURNING id INTO v_rak_01;
  END IF;

  -- Gudang Inaktif
  SELECT id INTO v_gudang_inaktif FROM public.lokasi WHERE nama = 'Gudang Inaktif' AND tingkat = 'Gedung' LIMIT 1;
  IF v_gudang_inaktif IS NULL THEN
    INSERT INTO public.lokasi (nama, tingkat, parent_id)
    VALUES ('Gudang Inaktif', 'Gedung', NULL) RETURNING id INTO v_gudang_inaktif;
  END IF;

  -- Ruang Arsip Inaktif
  SELECT id INTO v_ruang_inaktif FROM public.lokasi WHERE nama = 'Ruang Arsip Inaktif' AND parent_id = v_gudang_inaktif LIMIT 1;
  IF v_ruang_inaktif IS NULL THEN
    INSERT INTO public.lokasi (nama, tingkat, parent_id)
    VALUES ('Ruang Arsip Inaktif', 'Ruangan', v_gudang_inaktif) RETURNING id INTO v_ruang_inaktif;
  END IF;

  -- Rak Inaktif 01
  SELECT id INTO v_rak_inaktif_01 FROM public.lokasi WHERE nama = 'Rak Inaktif 01' AND parent_id = v_ruang_inaktif LIMIT 1;
  IF v_rak_inaktif_01 IS NULL THEN
    INSERT INTO public.lokasi (nama, tingkat, parent_id)
    VALUES ('Rak Inaktif 01', 'Rak', v_ruang_inaktif) RETURNING id INTO v_rak_inaktif_01;
  END IF;

  -- 7.3 Seed Boks 01 pada Rak 01 (Kapasitas 500 lembar, Status Aktif)
  SELECT id INTO v_boks_01 FROM public.boks WHERE rak_id = v_rak_01 AND nomor_boks = '01' LIMIT 1;
  IF v_boks_01 IS NULL THEN
    INSERT INTO public.boks (nomor_boks, rak_id, kapasitas_maks_lembar, jumlah_lembar_terisi, status)
    VALUES ('01', v_rak_01, 500, 0, 'Aktif') RETURNING id INTO v_boks_01;
  END IF;

  -- 7.4 Tautkan profil & dokumen yang sudah ada ke Unit Keuangan & Boks 01 secara aman
  SELECT id INTO v_unit_keuangan FROM public.unit_organisasi WHERE nama = 'Keuangan' LIMIT 1;

  IF v_unit_keuangan IS NOT NULL THEN
    UPDATE public.profiles 
    SET unit_id = v_unit_keuangan 
    WHERE unit_id IS NULL;

    UPDATE public.dokumen 
    SET unit_id = v_unit_keuangan 
    WHERE unit_id IS NULL;
  END IF;

  IF v_boks_01 IS NOT NULL THEN
    UPDATE public.dokumen
    SET boks_id = v_boks_01
    WHERE boks_id IS NULL;
  END IF;

END $$;

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) UNTUK TABEL MASTER BARU
-- ------------------------------------------------------------------------------

-- 8.1 unit_organisasi
ALTER TABLE public.unit_organisasi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unit_organisasi_select_auth" ON public.unit_organisasi;
CREATE POLICY "unit_organisasi_select_auth" ON public.unit_organisasi
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "unit_organisasi_manage_admin" ON public.unit_organisasi;
CREATE POLICY "unit_organisasi_manage_admin" ON public.unit_organisasi
  FOR ALL TO authenticated
  USING (COALESCE(public.current_user_role(), '') IN ('admin', 'superadmin'))
  WITH CHECK (COALESCE(public.current_user_role(), '') IN ('admin', 'superadmin'));

-- 8.2 lokasi
ALTER TABLE public.lokasi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lokasi_select_auth" ON public.lokasi;
CREATE POLICY "lokasi_select_auth" ON public.lokasi
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lokasi_manage_admin" ON public.lokasi;
CREATE POLICY "lokasi_manage_admin" ON public.lokasi
  FOR ALL TO authenticated
  USING (COALESCE(public.current_user_role(), '') IN ('admin', 'superadmin'))
  WITH CHECK (COALESCE(public.current_user_role(), '') IN ('admin', 'superadmin'));

-- 8.3 boks
ALTER TABLE public.boks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boks_select_auth" ON public.boks;
CREATE POLICY "boks_select_auth" ON public.boks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "boks_manage_admin" ON public.boks;
CREATE POLICY "boks_manage_admin" ON public.boks
  FOR ALL TO authenticated
  USING (COALESCE(public.current_user_role(), '') IN ('admin', 'superadmin'))
  WITH CHECK (COALESCE(public.current_user_role(), '') IN ('admin', 'superadmin'));

-- Izinkan PIC/service role mengupdate jumlah_lembar_terisi boks saat entri dokumen
DROP POLICY IF EXISTS "boks_update_pic" ON public.boks;
CREATE POLICY "boks_update_pic" ON public.boks
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

