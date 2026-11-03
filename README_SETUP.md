# Skema Supabase & Panduan Konfigurasi

File skema SQL telah disiapkan di `supabase.sql`.

## Cara Menyiapkan Database Supabase:
1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Buat project baru (atau gunakan project yang ada).
3. Buka menu **SQL Editor**, buat Query baru, lalu paste seluruh isi file `supabase.sql` dan jalankan (**Run**).
4. Buat Storage Buckets (privat):
   - `arsip-aktif`
   - `arsip-inaktif`
   - `bukti-pembayaran`
   - `barcode`
5. Salin Project URL dan Anon Key ke file `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   CRON_SECRET=secret-rahasia-cron-arsip-2026
   ```
