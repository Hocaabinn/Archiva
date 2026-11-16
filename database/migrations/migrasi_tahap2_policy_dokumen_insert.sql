-- ==============================================================================
-- TAHAP 2 — PERBAIKAN POLICY RLS: DOKUMEN_INSERT
-- Patokan: BLUEPRINT.md Bab 5 (Tabel 3 & Tabel 4)
-- Hanya Pengaju (role = 'user') yang berhak mengunggah dokumen baru miliknya sendiri.
-- PIC Arsip, Atasan, Accounting, dan Viewer TIDAK BERHAK mengunggah dokumen.
-- ==============================================================================

DROP POLICY IF EXISTS "dokumen_insert" ON public.dokumen;

CREATE POLICY "dokumen_insert" ON public.dokumen FOR INSERT
  WITH CHECK (
    pemilik_id = auth.uid() AND public.current_user_role() = 'user'
  );

