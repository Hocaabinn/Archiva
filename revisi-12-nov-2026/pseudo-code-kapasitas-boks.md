# Pseudo-code — Alokasi Boks Otomatis (BLUEPRINT.md R.03, 3.5)

Sumber: jawaban user 14 Nov 2026 dari rekaman Revisi ke2.aac + Revisi2 (1).aac.
Bukan kode produksi — logika untuk dipakai saat coding migrasi R.03.

## Aturan

- Kapasitas maksimal boks: 500 lembar (nilai awal), disetel lewat Master Kapasitas Boks,
  dapat diubah Superadmin — bukan hardcode di kode program.
- Setiap dokumen punya field `jumlah_halaman` (lembar fisik), diinput PIC Arsip Aktif saat entri.
- Nomor boks otomatis berurutan (`01`, `02`, `03`, ...). Superadmin dapat mengedit nomor boks bila diperlukan.
- Dokumen masuk ke boks aktif yang sedang berjalan selama total lembarnya belum melampaui batas;
  bila melampaui batas, dokumen dialihkan ke boks baru bernomor urut berikutnya.

## Pseudo-code

```
fungsi alokasi_boks(jumlah_halaman_baru, rak_id):
    kapasitas = ambil_master_kapasitas_boks()   # default 500
    boks_aktif = cari_boks_aktif(rak_id)        # status = Aktif, nomor terbesar

    jika boks_aktif tidak ada:
        boks_aktif = buat_boks_baru(rak_id, nomor = "01")

    jika boks_aktif.jumlah_lembar_terisi + jumlah_halaman_baru <= kapasitas:
        masukkan_dokumen_ke(boks_aktif)
        boks_aktif.jumlah_lembar_terisi += jumlah_halaman_baru
    else:
        boks_aktif.status = "Penuh"
        simpan(boks_aktif)
        boks_baru = buat_boks_baru(rak_id, nomor = nomor_terakhir + 1)
        masukkan_dokumen_ke(boks_baru)
        boks_baru.jumlah_lembar_terisi = jumlah_halaman_baru

    simpan_perubahan()
```

## Simulasi (dari jawaban user)

| Dokumen masuk | Lembar | Boks 01 (isi) | Keputusan |
| --- | --- | --- | --- |
| Dokumen 1 | 200 | 0 + 200 = 200 | Masuk boks 01 |
| Dokumen 2 | 150 | 200 + 150 = 350 | Tetap boks 01 (350 < 500) |
| Dokumen 3 | 300 | 350 + 300 = 650 | Melebihi 500 → pindah ke boks 02 |

## Catatan — belum diatur di rekaman

- Dokumen yang sendirian sudah melebihi 500 lembar (mis. 600 lembar): apakah tetap
  masuk satu boks baru dan langsung ditandai Penuh, atau dipecah ke dua boks?
  Tanyakan ke client sebelum coding.
