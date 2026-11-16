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

## Pengaturan Auth (Wajib untuk Demo)
- **Authentication → Sign In / Providers → Email:** matikan *Confirm email* agar akun baru bisa langsung login.
- **Authentication → URL Configuration:** Site URL `http://localhost:3000`, tambahkan Redirect URL `http://localhost:3000/**` (untuk Lupa Kata Sandi).

## Membuat 6 Akun Demo (lihat `AKUN_DEMO.md`)
1. **Authentication → Users → Add user**, isi email & kata sandi, centang *Auto Confirm User*. Ulangi untuk ke-6 akun.
2. Semua akun baru otomatis ber-role `user`. Tetapkan role lewat **SQL Editor**.
   Pencocokan memakai awalan email (`like 'admin@%'`), jadi domain bebas
   (`@example.com`, `@gmail.com`, atau domain klien nanti) tanpa mengubah SQL:
   ```sql
   update public.profiles set role = 'admin'      where email like 'admin@%';
   update public.profiles set role = 'pic_arsip'  where email like 'pic.arsip@%';
   update public.profiles set role = 'atasan'     where email like 'atasan@%';
   update public.profiles set role = 'accounting' where email like 'accounting@%';
   update public.profiles set role = 'viewer'     where email like 'viewer@%';
   -- pengaju@... tidak perlu diubah, otomatis 'user'
   ```
   > Jangan hapus bagian `where` — tanpa itu SEMUA akun ikut berubah role.
3. Cek hasilnya: `select email, role from public.profiles order by role;`

> Catatan keamanan: pendaftaran publik selalu menghasilkan role `user` (nilai role dari client diabaikan), dan hanya Admin / SQL Editor yang bisa mengubah role.
