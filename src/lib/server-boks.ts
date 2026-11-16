import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'

export interface BoksRecord {
  id: string
  nomor_boks: string
  rak_id: string
  kapasitas_maks_lembar: number
  jumlah_lembar_terisi: number
  qr_path: string | null
  status: 'Aktif' | 'Penuh'
  created_at?: string
}

export interface DetailAlokasiBoks {
  boks: BoksRecord
  jumlah_lembar: number
  urutan: number
}

export interface HasilAlokasiMulti {
  boksUtama: BoksRecord
  detailAlokasi: DetailAlokasiBoks[]
}

/**
 * Mengambil kapasitas maksimal boks dari Master (bukan hardcode)
 * Membaca nilai kapasitas dari boks aktif atau pengaturan master.
 */
export async function getMasterKapasitasBoks(): Promise<number> {
  const admin = createAdminClient()
  try {
    const { data: latestBoks } = await admin
      .from('boks')
      .select('kapasitas_maks_lembar')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestBoks?.kapasitas_maks_lembar && latestBoks.kapasitas_maks_lembar > 0) {
      return latestBoks.kapasitas_maks_lembar
    }
  } catch (err) {
    console.warn('Gagal membaca kapasitas master:', err)
  }

  return 500 // Standar Blueprint 3.5 & 4.4
}

/**
 * Menghasilkan dan mengunggah QR Code tersendiri per boks ke bucket barcode
 * Format QR: Payload resmi identitas BOKS_ARSIP
 */
export async function generateAndUploadBoksQR(boksId: string, nomorBoks: string): Promise<string | null> {
  const admin = createAdminClient()
  try {
    const qrPayload = `BOKS:${nomorBoks}:${boksId}`
    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      width: 300,
      margin: 1,
      color: { dark: '#1A1D21', light: '#FFFFFF' },
    })
    const fileName = `qr-boks/BOKS_${nomorBoks}_${boksId.slice(0, 8)}.png`
    const { error: uploadError } = await admin.storage
      .from('barcode')
      .upload(fileName, qrBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (!uploadError) {
      return fileName
    } else {
      console.warn('Gagal upload QR boks ke storage:', uploadError)
    }
  } catch (err) {
    console.warn('Gagal membuat buffer QR boks:', err)
  }
  return null
}

/**
 * Mencari nomor urut boks berikutnya untuk rak tertentu (01, 02, 03...)
 */
export async function getNextNomorBoks(rakId: string): Promise<string> {
  const admin = createAdminClient()
  const { data: listBoks } = await admin
    .from('boks')
    .select('nomor_boks')
    .eq('rak_id', rakId)

  if (!listBoks || listBoks.length === 0) {
    return '01'
  }

  let maxNum = 0
  for (const b of listBoks) {
    const match = b.nomor_boks.match(/\d+/)
    if (match) {
      const n = parseInt(match[0], 10)
      if (n > maxNum) maxNum = n
    }
  }

  const next = maxNum + 1
  return next < 10 ? `0${next}` : `${next}`
}

/**
 * Alokasi Boks Multi Otomatis (M9 — Aturan Baru 16 Nov 2026):
 *
 * 1. Dokumen > 500 lembar DIPECAH ke beberapa boks secara berurutan.
 * 2. Kapasitas boks dibaca dinamis dari Master Kapasitas Boks (maks 500).
 * 3. Boks aktif diisi hingga 500 lembar (status Penuh).
 * 4. Sisa lembar dokumen berlanjut ke boks berikutnya bernomor urut berurutan.
 * 5. Boks terakhir yang terisi sebagian TETAP TERBUKA (status Aktif) untuk dokumen berikutnya.
 *
 * Contoh:
 * - Dokumen 600 lembar: Boks 02 terisi 500 (Penuh) + Boks 03 terisi 100 (Aktif, sisa 400).
 * - Dokumen 300 lembar berikutnya: Masuk ke Boks 03 yang berisi 100 -> jadi 400/500 (Aktif).
 * - Dokumen 1000 lembar: 2 boks @500, keduanya Penuh.
 * - Dokumen 1001 lembar: 3 boks (500 + 500 + 1).
 */
export async function alokasiBoksMulti(
  jumlahHalamanBaru: number,
  rakId: string
): Promise<HasilAlokasiMulti> {
  const admin = createAdminClient()
  const kapasitasMaks = await getMasterKapasitasBoks()

  let sisaLembar = Math.max(1, jumlahHalamanBaru)
  let urutan = 1
  const detailAlokasi: DetailAlokasiBoks[] = []

  while (sisaLembar > 0) {
    // 1. Cari boks aktif di rak ini
    const { data: boksAktifList, error: errCari } = await admin
      .from('boks')
      .select('*')
      .eq('rak_id', rakId)
      .eq('status', 'Aktif')
      .order('nomor_boks', { ascending: true })
      .limit(1)

    if (errCari) {
      console.error('Error mencari boks aktif:', errCari)
    }

    let boksAktif: BoksRecord | null =
      boksAktifList && boksAktifList.length > 0 ? (boksAktifList[0] as BoksRecord) : null

    // 2. Jika tidak ada boks aktif, buat boks baru bernomor urut berikutnya
    if (!boksAktif) {
      const nextNomor = await getNextNomorBoks(rakId)
      const lembarMasuk = Math.min(sisaLembar, kapasitasMaks)
      const statusAwal: 'Aktif' | 'Penuh' = lembarMasuk >= kapasitasMaks ? 'Penuh' : 'Aktif'

      const { data: created, error: createErr } = await admin
        .from('boks')
        .insert({
          nomor_boks: nextNomor,
          rak_id: rakId,
          kapasitas_maks_lembar: kapasitasMaks,
          jumlah_lembar_terisi: lembarMasuk,
          status: statusAwal,
        })
        .select()
        .single()

      if (createErr || !created) {
        throw new Error(`Gagal membuat boks baru: ${createErr?.message}`)
      }

      // Generate QR Code untuk boks baru
      const qrPath = await generateAndUploadBoksQR(created.id, nextNomor)
      if (qrPath) {
        await admin.from('boks').update({ qr_path: qrPath }).eq('id', created.id)
        created.qr_path = qrPath
      }

      detailAlokasi.push({
        boks: created as BoksRecord,
        jumlah_lembar: lembarMasuk,
        urutan,
      })

      sisaLembar -= lembarMasuk
      urutan++
      continue
    }

    // 3. Jika ada boks aktif, cek sisa ruangnya
    const sisaKapasitas = boksAktif.kapasitas_maks_lembar - boksAktif.jumlah_lembar_terisi

    // Jika boks aktif ternyata sudah penuh (sisaKapasitas <= 0), kunci statusnya dan cari lagi
    if (sisaKapasitas <= 0) {
      await admin.from('boks').update({ status: 'Penuh' }).eq('id', boksAktif.id)
      continue
    }

    // 4. Masukkan lembar ke boks aktif ini
    const lembarMasuk = Math.min(sisaLembar, sisaKapasitas)
    const terisiBaru = boksAktif.jumlah_lembar_terisi + lembarMasuk
    const statusBaru: 'Aktif' | 'Penuh' =
      terisiBaru >= boksAktif.kapasitas_maks_lembar ? 'Penuh' : 'Aktif'

    const { data: updated, error: updateErr } = await admin
      .from('boks')
      .update({
        jumlah_lembar_terisi: terisiBaru,
        status: statusBaru,
      })
      .eq('id', boksAktif.id)
      .select()
      .single()

    if (updateErr || !updated) {
      throw new Error(`Gagal mengupdate boks: ${updateErr?.message}`)
    }

    detailAlokasi.push({
      boks: updated as BoksRecord,
      jumlah_lembar: lembarMasuk,
      urutan,
    })

    sisaLembar -= lembarMasuk
    urutan++
  }

  return {
    boksUtama: detailAlokasi[0].boks,
    detailAlokasi,
  }
}

/**
 * Menyimpan relasi multi-boks ke tabel junction `dokumen_boks`
 */
export async function simpanDokumenBoks(
  dokumenId: string,
  detailAlokasi: DetailAlokasiBoks[]
): Promise<void> {
  const admin = createAdminClient()

  // Hapus relasi lama jika ada (untuk re-alokasi atau pindah inaktif)
  try {
    await admin.from('dokumen_boks').delete().eq('dokumen_id', dokumenId)
  } catch (err) {
    console.warn('Gagal membersihkan dokumen_boks lama:', err)
  }

  const rows = detailAlokasi.map((item) => ({
    dokumen_id: dokumenId,
    boks_id: item.boks.id,
    jumlah_lembar: item.jumlah_lembar,
    urutan: item.urutan,
  }))

  const { error } = await admin.from('dokumen_boks').insert(rows)
  if (error) {
    console.error('Error insert dokumen_boks:', error)
    // Jangan hentikan seluruh request jika tabel belum dimigrasi di remote
  }
}

/**
 * Wrapper alokasi boks untuk kompatibilitas fungsi lama
 * Mengembalikan boks utama (boks pertama) dengan properti multi-boks tambahan
 */
export async function alokasiBoks(
  jumlahHalamanBaru: number,
  rakId: string
): Promise<BoksRecord & { detailAlokasi?: DetailAlokasiBoks[] }> {
  const hasil = await alokasiBoksMulti(jumlahHalamanBaru, rakId)
  const boksRecord = {
    ...hasil.boksUtama,
    detailAlokasi: hasil.detailAlokasi,
  }
  return boksRecord
}
