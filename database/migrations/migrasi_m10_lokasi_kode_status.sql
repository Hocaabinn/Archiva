-- ==============================================================================
-- MIGRASI M10 — MASTER LOKASI ENHANCEMENT: KODE, STATUS & SEED IDEMPOTEN R.03
-- Patokan: BLUEPRINT.md 3.5, 4.3, 4.4 (Tabel 20) & Permintaan User
--
-- Rincian:
-- 1. Tambah kolom 'kode' (TEXT, UNIQUE) pada tabel lokasi
-- 2. Tambah kolom 'status' (TEXT, default 'Aktif' CHECK in ('Aktif', 'Nonaktif')) pada tabel lokasi
-- 3. Isi kode dan status untuk baris lokasi yang sudah ada (Gedung A, Ruang Arsip Aktif, Rak 01, Gudang Inaktif, Ruang Arsip Inaktif, Rak Inaktif 01)
-- 4. Tambah Rak 02 di bawah Ruang Arsip Aktif jika belum ada (idempoten)
-- 5. Perbarui / pasang RLS: SELECT untuk pengguna terautentikasi, INSERT/UPDATE/DELETE hanya Superadmin
--
-- CARA EKSEKUSI:
-- Jalankan file ini di SQL Editor dashboard Supabase project (App-Documen-Arsip).
-- ==============================================================================

DO $$
BEGIN
  -- 1. Tambah kolom kode jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lokasi' AND column_name = 'kode'
  ) THEN
    ALTER TABLE public.lokasi ADD COLUMN kode TEXT;
  END IF;

  -- 2. Tambah kolom status jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lokasi' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.lokasi ADD COLUMN status TEXT NOT NULL DEFAULT 'Aktif';
  END IF;
END $$;

-- Pastikan constraint status check valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lokasi_status_check'
  ) THEN
    ALTER TABLE public.lokasi ADD CONSTRAINT lokasi_status_check CHECK (status IN ('Aktif', 'Nonaktif'));
  END IF;
END $$;

-- 3. Update kode lokasi eksisting (idempoten)
UPDATE public.lokasi SET kode = 'LOC-G-A', status = COALESCE(status, 'Aktif')
WHERE nama = 'Gedung A' AND tingkat = 'Gedung' AND (kode IS NULL OR kode = '');

UPDATE public.lokasi SET kode = 'LOC-R-AKTIF', status = COALESCE(status, 'Aktif')
WHERE nama = 'Ruang Arsip Aktif' AND tingkat = 'Ruangan' AND (kode IS NULL OR kode = '');

UPDATE public.lokasi SET kode = 'LOC-RAK-01', status = COALESCE(status, 'Aktif')
WHERE nama = 'Rak 01' AND tingkat = 'Rak' AND (kode IS NULL OR kode = '');

UPDATE public.lokasi SET kode = 'LOC-G-INAKTIF', status = COALESCE(status, 'Aktif')
WHERE nama = 'Gudang Inaktif' AND tingkat = 'Gedung' AND (kode IS NULL OR kode = '');

UPDATE public.lokasi SET kode = 'LOC-R-INAKTIF', status = COALESCE(status, 'Aktif')
WHERE nama = 'Ruang Arsip Inaktif' AND tingkat = 'Ruangan' AND (kode IS NULL OR kode = '');

UPDATE public.lokasi SET kode = 'LOC-RAK-INAKTIF-01', status = COALESCE(status, 'Aktif')
WHERE nama = 'Rak Inaktif 01' AND tingkat = 'Rak' AND (kode IS NULL OR kode = '');

-- Berikan fallback kode unik untuk baris lokasi lain jika ada yang belum terisi
UPDATE public.lokasi 
SET kode = 'LOC-' || UPPER(SUBSTRING(REPLACE(nama, ' ', '-') FROM 1 FOR 15)) || '-' || SUBSTRING(id::text FROM 1 FOR 4)
WHERE kode IS NULL OR kode = '';

-- Tambah UNIQUE constraint pada kolom kode jika belum ada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lokasi_kode_unique'
  ) THEN
    ALTER TABLE public.lokasi ADD CONSTRAINT lokasi_kode_unique UNIQUE (kode);
  END IF;
END $$;

-- 4. Seed Rak 02 di bawah Ruang Arsip Aktif jika belum ada (idempoten)
DO $$
DECLARE
  v_ruang_aktif_id UUID;
BEGIN
  SELECT id INTO v_ruang_aktif_id 
  FROM public.lokasi 
  WHERE nama = 'Ruang Arsip Aktif' AND tingkat = 'Ruangan' 
  LIMIT 1;

  IF v_ruang_aktif_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.lokasi 
      WHERE nama = 'Rak 02' AND tingkat = 'Rak' AND parent_id = v_ruang_aktif_id
    ) THEN
      INSERT INTO public.lokasi (nama, tingkat, parent_id, kode, status)
      VALUES ('Rak 02', 'Rak', v_ruang_aktif_id, 'LOC-RAK-02', 'Aktif');
    ELSE
      UPDATE public.lokasi 
      SET kode = 'LOC-RAK-02', status = 'Aktif'
      WHERE nama = 'Rak 02' AND tingkat = 'Rak' AND parent_id = v_ruang_aktif_id AND (kode IS NULL OR kode = '');
    END IF;
  END IF;
END $$;

-- 5. Kebijakan RLS (Row Level Security)
ALTER TABLE public.lokasi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Semua pengguna terautentikasi dapat membaca lokasi" ON public.lokasi;
CREATE POLICY "Semua pengguna terautentikasi dapat membaca lokasi"
  ON public.lokasi FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Hanya superadmin yang dapat menambah lokasi" ON public.lokasi;
CREATE POLICY "Hanya superadmin yang dapat menambah lokasi"
  ON public.lokasi FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS "Hanya superadmin yang dapat mengubah lokasi" ON public.lokasi;
CREATE POLICY "Hanya superadmin yang dapat mengubah lokasi"
  ON public.lokasi FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS "Hanya superadmin yang dapat menghapus lokasi" ON public.lokasi;
CREATE POLICY "Hanya superadmin yang dapat menghapus lokasi"
  ON public.lokasi FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    )
  );

