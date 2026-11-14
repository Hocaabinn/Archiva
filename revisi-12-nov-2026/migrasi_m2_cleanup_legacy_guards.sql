-- ==============================================================================
-- PEMBERSIHAN TRIGGER PENGAMAN LAMA (R.01/R.02) YANG MEMANGGIL get_auth_role()
-- ==============================================================================

-- 1. Lepas trigger lama di profiles dan dokumen
DROP TRIGGER IF EXISTS trg_guard_profiles_update ON public.profiles;
DROP TRIGGER IF EXISTS trg_dokumen_guard_insert ON public.dokumen;
DROP TRIGGER IF EXISTS trg_dokumen_guard_update ON public.dokumen;

-- 2. Hapus fungsi trigger lama
DROP FUNCTION IF EXISTS public.guard_profiles_update() CASCADE;
DROP FUNCTION IF EXISTS public.guard_dokumen_insert() CASCADE;
DROP FUNCTION IF EXISTS public.guard_dokumen_update() CASCADE;

-- 3. Buat alias get_auth_role() -> current_user_role() untuk keamanan backward-compatibility
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT public.current_user_role();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
