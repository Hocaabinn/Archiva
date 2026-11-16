-- ==============================================================================
-- SEED M10 LOKASI TAMBAHAN DENGAN LANTAI & HIERARKI LENGKAP
-- Menambahkan lokasi baru bertingkat Gedung > Ruangan > Rak dengan penamaan Lantai
-- ==============================================================================

-- 1. Tambah Rak 03 Lt. 01 di bawah Ruang Arsip Aktif
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 03 Lt. 01', 'Rak', 'LOC-RAK-03-L01', 'Aktif', id
FROM public.lokasi
WHERE nama = 'Ruang Arsip Aktif' AND tingkat = 'Ruangan'
ON CONFLICT (kode) DO NOTHING;

-- 2. Tambah Ruang Arsip Keuangan Lt. 02 di bawah Gedung A
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Ruang Arsip Keuangan Lt. 02', 'Ruangan', 'LOC-R-KEU-L02', 'Aktif', id
FROM public.lokasi
WHERE nama = 'Gedung A' AND tingkat = 'Gedung'
ON CONFLICT (kode) DO NOTHING;

-- Turunan Ruang Arsip Keuangan Lt. 02:
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 01 Lt. 02', 'Rak', 'LOC-RAK-01-L02', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-R-KEU-L02'
ON CONFLICT (kode) DO NOTHING;

INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 02 Lt. 02', 'Rak', 'LOC-RAK-02-L02', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-R-KEU-L02'
ON CONFLICT (kode) DO NOTHING;

-- 3. Tambah Gedung B (Pusat Rekod & Legal)
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
VALUES ('Gedung B (Pusat Rekod & Legal)', 'Gedung', 'LOC-G-B', 'Aktif', NULL)
ON CONFLICT (kode) DO NOTHING;

-- 4. Tambah Ruang Arsip Kontrak & Legal Lt. 01 di bawah Gedung B
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Ruang Arsip Kontrak & Legal Lt. 01', 'Ruangan', 'LOC-R-LEGAL-L01', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-G-B'
ON CONFLICT (kode) DO NOTHING;

-- Turunan Ruang Arsip Kontrak & Legal:
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 01 Lt. 01', 'Rak', 'LOC-RAK-01-B-L01', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-R-LEGAL-L01'
ON CONFLICT (kode) DO NOTHING;

INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 02 Lt. 01', 'Rak', 'LOC-RAK-02-B-L01', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-R-LEGAL-L01'
ON CONFLICT (kode) DO NOTHING;

-- 5. Tambah Ruang Arsip SDM & Umum Lt. 02 di bawah Gedung B
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Ruang Arsip SDM & Umum Lt. 02', 'Ruangan', 'LOC-R-SDM-L02', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-G-B'
ON CONFLICT (kode) DO NOTHING;

-- Turunan Ruang Arsip SDM & Umum:
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 01 Lt. 02', 'Rak', 'LOC-RAK-01-B-L02', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-R-SDM-L02'
ON CONFLICT (kode) DO NOTHING;

-- 6. Tambah Rak Inaktif 02 Lt. 01 di bawah Ruang Arsip Inaktif
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak Inaktif 02 Lt. 01', 'Rak', 'LOC-RAK-INAKTIF-02-L01', 'Aktif', id
FROM public.lokasi
WHERE nama = 'Ruang Arsip Inaktif' AND tingkat = 'Ruangan'
ON CONFLICT (kode) DO NOTHING;

-- 7. Tambah Gedung Graha Semen Indonesia & Turunan Berlantai
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
VALUES ('Gedung Graha Semen Indonesia', 'Gedung', 'LOC-G-SEMEN', 'Aktif', NULL)
ON CONFLICT (kode) DO NOTHING;

-- Ruang Arsip Operasional Pabrik Lt. 01
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Ruang Arsip Operasional Pabrik Lt. 01', 'Ruangan', 'LOC-R-PABRIK-L01', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-G-SEMEN'
ON CONFLICT (kode) DO NOTHING;

-- Rak Lt. 01
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 01 Lt. 01', 'Rak', 'LOC-RAK-01-SMN-L01', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-R-PABRIK-L01'
ON CONFLICT (kode) DO NOTHING;

INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 02 Lt. 01', 'Rak', 'LOC-RAK-02-SMN-L01', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-R-PABRIK-L01'
ON CONFLICT (kode) DO NOTHING;

-- Ruang Arsip Distribusi & Logistik Lt. 02
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Ruang Arsip Distribusi & Logistik Lt. 02', 'Ruangan', 'LOC-R-LOGISTIK-L02', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-G-SEMEN'
ON CONFLICT (kode) DO NOTHING;

-- Rak Lt. 02
INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 01 Lt. 02', 'Rak', 'LOC-RAK-01-SMN-L02', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-R-LOGISTIK-L02'
ON CONFLICT (kode) DO NOTHING;

INSERT INTO public.lokasi (nama, tingkat, kode, status, parent_id)
SELECT 'Rak 02 Lt. 02', 'Rak', 'LOC-RAK-02-SMN-L02', 'Aktif', id
FROM public.lokasi
WHERE kode = 'LOC-R-LOGISTIK-L02'
ON CONFLICT (kode) DO NOTHING;

