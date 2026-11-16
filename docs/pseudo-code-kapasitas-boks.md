# PSEUDO-CODE: ALOKASI KAPASITAS BOKS ARSIP (M9 — ATURAN REVISI 16 NOV 2026)

## Konteks & Latar Belakang Perubahan
Aturan lama (R.03): dokumen >500 lembar dimasukkan ke satu boks baru dan langsung ditandai `Penuh` tanpa dipecah (satu dokumen = satu boks_id).
Client menyatakan aturan tersebut salah: secara fisik, berkas 600 lembar tidak muat dalam boks berkapasitas 500 lembar. Dokumen >500 lembar **HARUS DIPECAH** ke beberapa boks bernomor urut berurutan.

## Prinsip Aturan Baru (M9)
1. **Kapasitas Maksimal Boks**: Maksimal 500 lembar per boks (dibaca dinamis dari Master Kapasitas Boks / kolom `kapasitas_maks_lembar`, bukan hardcode).
2. **Alokasi Berurutan & Pecah Lembar**:
   - Boks aktif diisi hingga batas kapasitas (500 lembar).
   - Sisa lembar dokumen berlanjut ke boks bernomor urut berikutnya.
   - Jumlah boks yang dipakai: `ceil(jumlah_halaman / kapasitas_maks_lembar)`.
3. **Boks Terbuka (Tidak Terkunci Prematur)**:
   - Boks terakhir yang terisi sebagian **TETAP TERBUKA** (status `Aktif`) untuk dokumen berikutnya.
   - Status `Penuh` **HANYA** diberikan jika `jumlah_lembar_terisi == kapasitas_maks_lembar`.
4. **Relasi Dokumen-Boks**:
   - Satu dokumen dapat menempati beberapa boks (tabel relasi `dokumen_boks`).
   - Satu boks dapat berisi bagian dari beberapa dokumen.

---

## Contoh Kasus Alokasi
- **Dokumen 600 lembar** (misal boks kosong kapasitas 500):
  - Boks 02: terisi 500 lembar (Status: **Penuh**, 500/500)
  - Boks 03: terisi 100 lembar (Status: **Aktif**, 100/500, sisa kapasitas 400)
- **Dokumen 300 lembar berikutnya**:
  - Masuk ke Boks 03 yang masih aktif (100 + 300 = 400 lembar, Status: **Aktif**, sisa 100)
- **Dokumen 1000 lembar**:
  - Boks A: terisi 500 lembar (**Penuh**)
  - Boks B: terisi 500 lembar (**Penuh**)
- **Dokumen 1001 lembar**:
  - Boks A: terisi 500 lembar (**Penuh**)
  - Boks B: terisi 500 lembar (**Penuh**)
  - Boks C: terisi 1 lembar (**Aktif**, sisa 499)

---

## Pseudo-Code Algoritma

```text
FUNCTION alokasiBoksMulti(dokumen_id, jumlah_halaman, rak_id):
    kapasitas_maks = getMasterKapasitasBoks() // default 500 dari DB
    sisa_lembar = jumlah_halaman
    urutan = 1
    hasil_alokasi = []

    WHILE sisa_lembar > 0 DO:
        // 1. Cari boks berstatus 'Aktif' di rak terkait
        boks_aktif = querySingle("SELECT * FROM boks WHERE rak_id = ? AND status = 'Aktif' ORDER BY nomor_boks ASC")

        IF boks_aktif IS NULL THEN:
            // 2. Buat boks baru bernomor urut berikutnya (mis. '01', '02', ...)
            nomor_baru = getNextNomorBoks(rak_id)
            boks_baru = insert("boks", {
                nomor_boks: nomor_baru,
                rak_id: rak_id,
                kapasitas_maks_lembar: kapasitas_maks,
                jumlah_lembar_terisi: 0,
                status: 'Aktif'
            })
            generateAndUploadBoksQR(boks_baru.id, nomor_baru)
            boks_aktif = boks_baru
        END IF

        // 3. Hitung sisa ruang boks aktif
        sisa_kapasitas = boks_aktif.kapasitas_maks_lembar - boks_aktif.jumlah_lembar_terisi

        IF sisa_kapasitas <= 0 THEN:
            // Tandai penuh jika sebelumnya belum ditandai
            update("boks", boks_aktif.id, { status: 'Penuh' })
            CONTINUE // Ulangi pencarian boks berikutnya
        END IF

        // 4. Hitung lembar yang masuk ke boks ini
        lembar_masuk = MIN(sisa_lembar, sisa_kapasitas)
        terisi_baru = boks_aktif.jumlah_lembar_terisi + lembar_masuk
        status_baru = (terisi_baru >= boks_aktif.kapasitas_maks_lembar) ? 'Penuh' : 'Aktif'

        // 5. Update boks
        update("boks", boks_aktif.id, {
            jumlah_lembar_terisi: terisi_baru,
            status: status_baru
        })

        // 6. Simpan detail alokasi
        hasil_alokasi.append({
            dokumen_id: dokumen_id,
            boks_id: boks_aktif.id,
            nomor_boks: boks_aktif.nomor_boks,
            jumlah_lembar: lembar_masuk,
            urutan: urutan
        })

        sisa_lembar = sisa_lembar - lembarMasuk
        urutan = urutan + 1
    END WHILE

    // 7. Simpan seluruh baris relasi ke tabel dokumen_boks
    FOR EACH item IN hasil_alokasi DO:
        insert("dokumen_boks", {
            dokumen_id: item.dokumen_id,
            boks_id: item.boks_id,
            jumlah_lembar: item.jumlah_lembar,
            urutan: item.urutan
        })
    END FOR

    RETURN hasil_alokasi
END FUNCTION
```

