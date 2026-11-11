-- ============================================================
-- MIGRASI: Cegah pengguna mengubah perannya sendiri
-- ------------------------------------------------------------
-- Masalah: policy "profiles_update_self_or_admin" mengizinkan setiap user
-- meng-UPDATE baris profilnya sendiri, termasuk kolom `role`. Akibatnya
-- Pengaju dapat menjadikan dirinya Admin langsung via Supabase client.
--
-- Perbaikan: trigger BEFORE UPDATE yang menolak perubahan kolom `role`
-- kecuali dilakukan oleh Admin Sistem atau service role (API server).
-- Kolom lain (nama, jabatan, dst.) tetap boleh diubah pemilik profil.
--
-- Cara pakai: tempel & jalankan di Supabase SQL Editor. Aman dijalankan
-- berulang kali (idempotent). Tidak mengubah migrasi Tahap 1, skema tabel,
-- maupun policy RLS yang ada.
-- ============================================================

-- 1. Pastikan current_user_role() ada (sudah dibuat di Tahap 1; dibuat ulang
--    hanya bila belum ada, definisinya identik).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Fungsi pemeriksa
CREATE OR REPLACE FUNCTION public.cegah_ubah_peran_sendiri() RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND COALESCE(public.current_user_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin Sistem yang dapat mengubah peran';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Pasang trigger
DROP TRIGGER IF EXISTS trg_cegah_ubah_peran ON public.profiles;
CREATE TRIGGER trg_cegah_ubah_peran BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.cegah_ubah_peran_sendiri();
