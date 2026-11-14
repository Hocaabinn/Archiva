-- ==============================================================================
-- MIGRASI M2 — ROLE + RLS + AUTH R.03 (App-Documen-Arsip)
-- Patokan: BLUEPRINT.md 3.1, Bab 5, Bab 7 (Tabel 2, Tabel 3, Tabel 18)
--
-- Rincian:
-- 1. Ubah tipe kolom profiles.role menjadi TEXT (menghapus enum lama user_role).
-- 2. Petakan 6 akun live ke 6 role baru R.03:
--    - admin@example.com      -> superadmin
--    - pic.arsip@example.com  -> pic_aktif
--    - atasan@example.com     -> atasan_aktif
--    - pengaju@example.com    -> pic_aktif
--    - accounting@example.com -> staff
--    - viewer@example.com     -> staff
-- 3. Sinkronkan profil 2 akun demo inaktif baru:
--    - pic.inaktif@example.com    -> pic_inaktif
--    - atasan.inaktif@example.com -> atasan_inaktif
-- 4. Pasang CHECK constraint 6 role baru R.03 dan DEFAULT 'staff' pada profiles.role.
-- 5. Perbarui trigger handle_new_user() agar pendaftar baru default 'staff'.
-- 6. Perbarui trigger cegah_ubah_peran_sendiri() agar hanya 'superadmin' yang berhak.
-- 7. Hapus kode lama 'admin' dari seluruh policy manage (hanya 'superadmin').
-- 8. Persempit policy boks_update_pic hanya ke 'pic_aktif' dan 'superadmin'.
-- 9. Perbarui RLS pada dokumen, peminjaman, serah_terima, log_aktivitas.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. NONAKTIFKAN TRIGGER CEGAH UBAH PERAN SEMENTARA AGAR MIGRASI DAPAT BERJALAN
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_cegah_ubah_peran ON public.profiles;

-- ------------------------------------------------------------------------------
-- 1. UBAH TIPE PROFILES.ROLE MENJADI TEXT & LEPAS ENUM LAMA
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN role TYPE text USING role::text;

-- ------------------------------------------------------------------------------
-- 2. PEMETAAN AKUN LIVE LAMA KE ROLE BARU R.03
-- ------------------------------------------------------------------------------
UPDATE public.profiles SET role = 'superadmin', updated_at = now() WHERE email = 'admin@example.com';
UPDATE public.profiles SET role = 'pic_aktif', updated_at = now() WHERE email = 'pic.arsip@example.com';
UPDATE public.profiles SET role = 'atasan_aktif', updated_at = now() WHERE email = 'atasan@example.com';
UPDATE public.profiles SET role = 'pic_aktif', updated_at = now() WHERE email = 'pengaju@example.com';
UPDATE public.profiles SET role = 'staff', updated_at = now() WHERE email = 'accounting@example.com';
UPDATE public.profiles SET role = 'staff', updated_at = now() WHERE email = 'viewer@example.com';

-- 3. SINKRONKAN PROFIL 2 AKUN DEMO INAKTIF BARU
UPDATE public.profiles SET role = 'pic_inaktif', updated_at = now() WHERE email = 'pic.inaktif@example.com';
UPDATE public.profiles SET role = 'atasan_inaktif', updated_at = now() WHERE email = 'atasan.inaktif@example.com';

-- Ubah akun tersisa yang mungkin masih berkode peran lama
UPDATE public.profiles SET role = 'staff' WHERE role IN ('user', 'accounting', 'viewer');
UPDATE public.profiles SET role = 'pic_aktif' WHERE role = 'pic_arsip';
UPDATE public.profiles SET role = 'atasan_aktif' WHERE role = 'atasan';
UPDATE public.profiles SET role = 'superadmin' WHERE role = 'admin';

-- Hapus ENUM lama bila sudah tidak dipakai
DROP TYPE IF EXISTS public.user_role CASCADE;

-- ------------------------------------------------------------------------------
-- 4. KUNCI DENGAN CHECK CONSTRAINT 6 ROLE RESMI R.03
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_user_role;
ALTER TABLE public.profiles ADD CONSTRAINT check_user_role 
  CHECK (role IN ('superadmin', 'pic_aktif', 'atasan_aktif', 'pic_inaktif', 'atasan_inaktif', 'staff'));

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'staff';

-- ------------------------------------------------------------------------------
-- 5. PERBAARUI current_user_role()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 6. TRIGGER BARU: PENGGUNA BARU OTOMATIS BERPERAN 'staff'
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_default_unit UUID;
BEGIN
  SELECT id INTO v_default_unit FROM public.unit_organisasi WHERE nama = 'Keuangan' LIMIT 1;

  INSERT INTO public.profiles (id, email, nama, nama_lengkap, nomor_pegawai, jabatan, role, unit_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'nomor_pegawai',
    NEW.raw_user_meta_data->>'jabatan',
    'staff',
    v_default_unit
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

-- ------------------------------------------------------------------------------
-- 7. TRIGGER CEGAH UBAH PERAN SENDIRI (HANYA SUPERADMIN & SERVICE ROLE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cegah_ubah_peran_sendiri() RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(current_user, '') NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND COALESCE(public.current_user_role(), '') <> 'superadmin' THEN
    RAISE EXCEPTION 'Hanya Superadmin yang dapat mengubah peran akun';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cegah_ubah_peran ON public.profiles;
CREATE TRIGGER trg_cegah_ubah_peran BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.cegah_ubah_peran_sendiri();

-- ------------------------------------------------------------------------------
-- 8. PERBARUI ROW LEVEL SECURITY MASTER (HANYA 'superadmin')
-- ------------------------------------------------------------------------------

-- 8.1 profiles
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_superadmin" ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.current_user_role() = 'superadmin');

-- 8.2 unit_organisasi
DROP POLICY IF EXISTS "unit_organisasi_manage_admin" ON public.unit_organisasi;
DROP POLICY IF EXISTS "unit_organisasi_manage_superadmin" ON public.unit_organisasi;
CREATE POLICY "unit_organisasi_manage_superadmin" ON public.unit_organisasi
  FOR ALL TO authenticated
  USING (COALESCE(public.current_user_role(), '') = 'superadmin')
  WITH CHECK (COALESCE(public.current_user_role(), '') = 'superadmin');

-- 8.3 lokasi
DROP POLICY IF EXISTS "lokasi_manage_admin" ON public.lokasi;
DROP POLICY IF EXISTS "lokasi_manage_superadmin" ON public.lokasi;
CREATE POLICY "lokasi_manage_superadmin" ON public.lokasi
  FOR ALL TO authenticated
  USING (COALESCE(public.current_user_role(), '') = 'superadmin')
  WITH CHECK (COALESCE(public.current_user_role(), '') = 'superadmin');

-- 8.4 boks (persempit update hanya superadmin + pic_aktif)
DROP POLICY IF EXISTS "boks_manage_admin" ON public.boks;
DROP POLICY IF EXISTS "boks_manage_superadmin" ON public.boks;
CREATE POLICY "boks_manage_superadmin" ON public.boks
  FOR ALL TO authenticated
  USING (COALESCE(public.current_user_role(), '') = 'superadmin')
  WITH CHECK (COALESCE(public.current_user_role(), '') = 'superadmin');

DROP POLICY IF EXISTS "boks_update_pic" ON public.boks;
CREATE POLICY "boks_update_pic" ON public.boks
  FOR UPDATE TO authenticated
  USING (COALESCE(public.current_user_role(), '') IN ('superadmin', 'pic_aktif'))
  WITH CHECK (COALESCE(public.current_user_role(), '') IN ('superadmin', 'pic_aktif'));

-- 8.5 kategori_dokumen
DROP POLICY IF EXISTS "kategori_admin_modify" ON public.kategori_dokumen;
DROP POLICY IF EXISTS "kategori_superadmin_modify" ON public.kategori_dokumen;
CREATE POLICY "kategori_superadmin_modify" ON public.kategori_dokumen
  FOR ALL TO authenticated
  USING (COALESCE(public.current_user_role(), '') = 'superadmin')
  WITH CHECK (COALESCE(public.current_user_role(), '') = 'superadmin');

-- ------------------------------------------------------------------------------
-- 9. PERBARUI ROW LEVEL SECURITY TRANSAKSI & ARSIP (BLUEPRINT BAB 5)
-- ------------------------------------------------------------------------------

-- 9.1 dokumen
DROP POLICY IF EXISTS "dokumen_select" ON public.dokumen;
CREATE POLICY "dokumen_select" ON public.dokumen FOR SELECT
  USING (
    -- Dokumen aktif / inaktif / dibatalkan dapat dibaca semua peran authenticated
    status IN ('aktif', 'inaktif', 'dibatalkan')
    -- Pemilik atau pemegang selalu bisa melihat dokumennya
    OR pemilik_id = auth.uid()
    OR pemegang_saat_ini = auth.uid()
    -- PIC Aktif / Atasan Aktif / Superadmin / Inaktif dapat melihat antrean unitnya
    OR public.current_user_role() IN ('superadmin', 'pic_aktif', 'atasan_aktif', 'pic_inaktif', 'atasan_inaktif')
  );

DROP POLICY IF EXISTS "dokumen_insert" ON public.dokumen;
CREATE POLICY "dokumen_insert" ON public.dokumen FOR INSERT
  WITH CHECK (
    -- Sesuai Bab 5: HANYA PIC Arsip Aktif (dan Superadmin maintainer) yang boleh entri
    public.current_user_role() IN ('pic_aktif', 'superadmin')
  );

DROP POLICY IF EXISTS "dokumen_update" ON public.dokumen;
CREATE POLICY "dokumen_update" ON public.dokumen FOR UPDATE
  USING (
    public.current_user_role() IN ('superadmin', 'pic_aktif', 'atasan_aktif', 'pic_inaktif', 'atasan_inaktif')
  );

DROP POLICY IF EXISTS "dokumen_delete" ON public.dokumen;
CREATE POLICY "dokumen_delete" ON public.dokumen FOR DELETE
  USING (public.current_user_role() = 'superadmin');

-- 9.2 peminjaman
DROP POLICY IF EXISTS "peminjaman_select" ON public.peminjaman;
CREATE POLICY "peminjaman_select" ON public.peminjaman FOR SELECT
  USING (
    peminjam_id = auth.uid()
    OR public.current_user_role() IN ('superadmin', 'pic_inaktif', 'atasan_inaktif')
  );

DROP POLICY IF EXISTS "peminjaman_insert" ON public.peminjaman;
CREATE POLICY "peminjaman_insert" ON public.peminjaman FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "peminjaman_update" ON public.peminjaman;
CREATE POLICY "peminjaman_update" ON public.peminjaman FOR UPDATE
  USING (public.current_user_role() IN ('superadmin', 'pic_inaktif'));

-- 9.3 serah_terima
DROP POLICY IF EXISTS "serah_terima_select" ON public.serah_terima;
CREATE POLICY "serah_terima_select" ON public.serah_terima FOR SELECT
  USING (
    dari_user_id = auth.uid() 
    OR ke_user_id = auth.uid() 
    OR public.current_user_role() IN ('superadmin', 'pic_aktif', 'pic_inaktif', 'atasan_aktif')
  );

DROP POLICY IF EXISTS "serah_terima_insert" ON public.serah_terima;
CREATE POLICY "serah_terima_insert" ON public.serah_terima FOR INSERT
  WITH CHECK (
    dari_user_id = auth.uid() OR public.current_user_role() IN ('superadmin', 'pic_aktif')
  );

DROP POLICY IF EXISTS "serah_terima_update" ON public.serah_terima;
CREATE POLICY "serah_terima_update" ON public.serah_terima FOR UPDATE
  USING (
    ke_user_id = auth.uid() OR public.current_user_role() IN ('superadmin', 'pic_aktif')
  );

-- 9.4 log_aktivitas
DROP POLICY IF EXISTS "log_select" ON public.log_aktivitas;
CREATE POLICY "log_select" ON public.log_aktivitas FOR SELECT
  USING (
    public.current_user_role() IN ('superadmin', 'pic_aktif', 'atasan_aktif', 'pic_inaktif', 'atasan_inaktif')
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "log_insert" ON public.log_aktivitas;
CREATE POLICY "log_insert" ON public.log_aktivitas FOR INSERT WITH CHECK (true);

