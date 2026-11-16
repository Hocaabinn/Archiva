-- ==============================================================================
-- MIGRASI M9: TABEL JUNCTION DOKUMEN_BOKS (RELASI MULTI-BOKS)
-- Standar Spesifikasi: BLUEPRINT.md 3.5 & 4.3 R.03 (Revisi Client 16 Nov 2026)
--
-- Aturan Baru:
-- 1. Satu dokumen > 500 lembar dipecah ke beberapa boks secara berurutan.
-- 2. Satu dokumen bisa menempati beberapa boks (tabel dokumen_boks).
-- 3. Satu boks bisa memuat lembar dari beberapa dokumen.
-- 4. Kolom dokumen.boks_id tetap dipertahankan sebagai referensi boks pertama (backward compatibility).
-- ==============================================================================

-- 1. Buat Tabel dokumen_boks
CREATE TABLE IF NOT EXISTS public.dokumen_boks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    boks_id UUID NOT NULL REFERENCES public.boks(id) ON DELETE CASCADE,
    jumlah_lembar INT NOT NULL DEFAULT 1 CHECK (jumlah_lembar > 0),
    urutan INT NOT NULL DEFAULT 1 CHECK (urutan > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_dokumen_boks_urutan UNIQUE (dokumen_id, urutan)
);

-- 2. Indeks Performa Query
CREATE INDEX IF NOT EXISTS idx_dokumen_boks_dokumen ON public.dokumen_boks(dokumen_id);
CREATE INDEX IF NOT EXISTS idx_dokumen_boks_boks ON public.dokumen_boks(boks_id);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.dokumen_boks ENABLE ROW LEVEL SECURITY;

-- 4. Kebijakan Keamanan RLS
-- Semua pengguna terautentikasi dapat melihat relasi dokumen dan boks
CREATE POLICY "dokumen_boks_select_all"
    ON public.dokumen_boks
    FOR SELECT
    TO authenticated
    USING (true);

-- Petugas kearsipan (PIC Aktif, PIC Inaktif, Superadmin) dan Service Role dapat mengelola alokasi
CREATE POLICY "dokumen_boks_insert_officer"
    ON public.dokumen_boks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('superadmin', 'pic_aktif', 'pic_inaktif', 'atasan_aktif', 'atasan_inaktif')
        )
    );

CREATE POLICY "dokumen_boks_update_officer"
    ON public.dokumen_boks
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('superadmin', 'pic_aktif', 'pic_inaktif')
        )
    );

CREATE POLICY "dokumen_boks_delete_officer"
    ON public.dokumen_boks
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('superadmin', 'pic_aktif', 'pic_inaktif')
        )
    );

-- 5. Migrasi Data Lama
-- Memasukkan dokumen lama yang sudah memiliki boks_id ke tabel dokumen_boks (1 dokumen = 1 boks, urutan 1)
INSERT INTO public.dokumen_boks (dokumen_id, boks_id, jumlah_lembar, urutan)
SELECT
    d.id AS dokumen_id,
    d.boks_id AS boks_id,
    COALESCE(d.jumlah_halaman, 1) AS jumlah_lembar,
    1 AS urutan
FROM public.dokumen d
WHERE d.boks_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM public.dokumen_boks db WHERE db.dokumen_id = d.id AND db.boks_id = d.boks_id
)
ON CONFLICT (dokumen_id, urutan) DO NOTHING;

COMMENT ON TABLE public.dokumen_boks IS 'Relasi multi-boks dokumen arsip kedinasan (pecah berkas berurutan)';

