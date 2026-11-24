# 01 — Asisten AI Archiva

## Tujuan
Asisten percakapan di dalam aplikasi (seperti Grok bot atau Muse): pengguna cukup
bertanya atau memberi perintah dengan bahasa biasa. Bedanya, asisten ini bekerja di atas
data arsip dan alur Archiva, bukan ngobrol bebas.

## Persona
- Nama usulan: **Asisten Archiva** (nama final ditentukan pemilik).
- Gaya: ringkas, sopan, bahasa Indonesia, langsung ke jawaban, selalu menyebut sumber.
- Tampil sebagai panel/tombol melayang di pojok kanan bawah, bisa dibuka dari halaman mana pun.
- Bila tidak yakin: bilang tidak tahu, jangan mengarang.

## Kemampuan
1. **Cari dengan bahasa biasa**: "dokumen payment PT X tahun 2024 yang masih aktif".
   Diterjemahkan ke query terstruktur; hasil tetap mengikuti hak akses role.
2. **Tanya lokasi fisik**: "kode 2025_2000_1500013765_1900009386 ada di boks dan rak mana?"
3. **Entri otomatis (OCR)**: foto/scan dokumen → AI membaca nomor payment, doc voucher,
   tahun → mengisi form. PIC Arsip Aktif wajib memeriksa sebelum kirim.
4. **Ringkas dokumen**: ringkasan bertanda "Ringkasan AI".
5. **Pengingat cerdas**: "12 dokumen akan inaktif bulan depan", "boks 5 hampir penuh (kapasitas 500)".
6. **Bantuan prosedur**: menjelaskan alur (siapa approve, bagaimana pinjam arsip inaktif).

## Batas keras (wajib)
- Agent **hanya membaca** data yang boleh dilihat penggunanya (pakai sesi/role pengguna, bukan service role).
- Agent **tidak boleh** mengubah status, tanggal kadaluarsa, bucket, approve, tolak, batalkan, atau hapus.
  Paling jauh: mengisi draf form atau mengusulkan, lalu manusia yang menekan tombol.
- Role `staff`: hanya view + download, agent mengikuti batas yang sama.
- Setiap jawaban memuat **sumber** (kode arsip / halaman). Tanpa sumber = tidak boleh klaim fakta.
- Semua pemakaian dicatat di `log_aktivitas` (aksi baru, mis. `tanya_agent`), tanpa menyimpan isi dokumen sensitif.
- Instansi dapat **mematikan** fitur AI (pengaturan sistem, Superadmin).
- Isi dokumen tidak dipakai melatih model.

## Arsitektur usulan
- Endpoint server `/api/agent` (cek login + role di server).
- Pola tool-calling: model memanggil fungsi aman yang sudah dibatasi
  (`cari_dokumen`, `lokasi_dokumen`, `statistik_kapasitas`, `draf_entri`), bukan SQL bebas.
- Tiap tool memakai klien Supabase dengan sesi pengguna sehingga RLS/role tetap berlaku.
- Streaming jawaban ke UI; riwayat percakapan opsional, bisa dihapus pengguna.
- OCR: model vision membaca gambar → keluaran JSON terstruktur → divalidasi ke format kode SIG sebelum mengisi form.

## Pilihan model
- Default saran: keluarga **Claude** lewat Anthropic API. Sonnet untuk percakapan dan tool-calling
  harian, Haiku untuk tugas ringan/cepat (klasifikasi, OCR sederhana), model terbesar hanya untuk kasus sulit.
  Cek model dan harga terbaru saat implementasi (jangan hardcode dari dokumen ini).
- Untuk instansi yang melarang data keluar: sediakan opsi model yang dijalankan di server sendiri
  (on-premise / private cloud). Arsitektur tool-calling di atas dibuat agnostik model.
- Catatan: "Grok bot" dan "Muse" dipakai di sini hanya sebagai **acuan pengalaman pengguna**
  (asisten percakapan yang cepat dan santai). Tidak ada ketergantungan pada produk atau model tersebut.

## Risiko dan mitigasi
| Risiko | Mitigasi |
|---|---|
| Halusinasi | Wajib sumber, jawaban hanya dari hasil tool, "tidak ditemukan" bila kosong |
| Kebocoran data antar unit | Tool memakai sesi pengguna + role, uji lintas unit |
| Prompt injection dari isi dokumen | Isi dokumen diperlakukan sebagai data, bukan instruksi; agent tanpa hak tulis |
| Biaya membengkak | Batas pesan per pengguna, model kecil untuk tugas ringan, cache |
| Data keluar ke pihak ketiga | Opsi matikan AI / model on-premise, kebijakan privasi jelas |
