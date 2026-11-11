-- =============================================================================
-- KONFIGURASI JOB pg_cron: SIKLUS HIDUP ARSIP KEDALUWARSA & PERINGATAN (SIG)
-- Sesuai BLUEPRINT.md 3.4, 3.8, dan 8.2 (Tahap 4)
-- =============================================================================

-- 1. Mengaktifkan ekstensi pg_cron dan pg_net jika belum aktif
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Hapus job lama jika sudah terdaftar
SELECT cron.unschedule('archiva-cron-kadaluarsa-harian')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'archiva-cron-kadaluarsa-harian'
);

-- 3. Jadwalkan cron harian otomatis setiap pukul 00:00 WIB (17:00 UTC)
-- Job ini memanggil API server /api/cron/kadaluarsa secara idempotent:
-- - Memindahkan berkas dokumen status aktif yang tanggal_kadaluarsa <= hari ini ke arsip-inaktif
-- - Mengirimkan notifikasi peringatan masa retensi H-90, H-30, dan H-7
SELECT cron.schedule(
  'archiva-cron-kadaluarsa-harian',
  '0 17 * * *', -- Setiap hari pukul 17:00 UTC = 00:00 WIB
  $$
  SELECT net.http_get(
    url := 'https://archiva.semenindonesia.com/api/cron/kadaluarsa?key=secret-rahasia-cron-arsip-2026',
    headers := '{"Authorization": "Bearer secret-rahasia-cron-arsip-2026", "Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- 4. Kueri untuk memeriksa status jadwal job yang terdaftar
-- SELECT jobid, jobname, schedule, active, command FROM cron.job;

