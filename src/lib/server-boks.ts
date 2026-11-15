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
  created_at: string
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
 * Alokasi Boks Otomatis sesuai pseudo-code-kapasitas-boks.md & BLUEPRINT.md 3.5:
 *
 * 1. Ambil kapasitas maksimal dari Master (default 500 lembar).
 * 2. Cek boks aktif yang sedang berjalan di rak ini (status = 'Aktif').
 * 3. Jika dokumen sendirian sudah >= kapasitas (mis. 600 lembar):
 *    - Masuk boks baru dan langsung ditandai 'Penuh', tanpa dipecah.
 * 4. Jika boks aktif + lembar baru <= kapasitas:
 *    - Masuk boks yang sama, jumlah_lembar_terisi bertambah.
 * 5. Jika melampaui batas (mis. 350 + 300 = 650 > 500):
 *    - Tandai boks aktif saat ini menjadi 'Penuh'.
 *    - Buat boks baru bernomor urut berikutnya (mis. '02').
 *    - Masukkan dokumen ke boks baru tersebut.
 * 6. Terbitkan QR tersendiri per boks baru.
 */
export async function alokasiBoks(jumlahHalamanBaru: number, rakId: string): Promise<BoksRecord> {
  const admin = createAdminClient()
  const kapasitasMaks = await getMasterKapasitasBoks()

  // 1. Cari boks aktif di rak ini
  const { data: boksAktifList, error: errCari } = await admin
    .from('boks')
    .select('*')
    .eq('rak_id', rakId)
    .eq('status', 'Aktif')
    .order('created_at', { ascending: false })
    .limit(1)

  if (errCari) {
    console.error('Error mencari boks aktif:', errCari)
  }

  let boksAktif = boksAktifList && boksAktifList.length > 0 ? (boksAktifList[0] as BoksRecord) : null

  // Kasus 1: Belum ada boks aktif sama sekali di rak ini
  if (!boksAktif) {
    const nomorBoks = await getNextNomorBoks(rakId)
    const isOver = jumlahHalamanBaru >= kapasitasMaks
    const statusAwal = isOver ? 'Penuh' : 'Aktif'

    const { data: created, error: createErr } = await admin
      .from('boks')
      .insert({
        nomor_boks: nomorBoks,
        rak_id: rakId,
        kapasitas_maks_lembar: kapasitasMaks,
        jumlah_lembar_terisi: jumlahHalamanBaru,
        status: statusAwal,
      })
      .select()
      .single()

    if (createErr || !created) {
      throw new Error(`Gagal membuat boks baru: ${createErr?.message}`)
    }

    // Terbitkan QR code untuk boks
    const qrPath = await generateAndUploadBoksQR(created.id, nomorBoks)
    if (qrPath) {
      await admin.from('boks').update({ qr_path: qrPath }).eq('id', created.id)
      created.qr_path = qrPath
    }

    return created as BoksRecord
  }

  // Kasus 2: Dokumen sendirian sudah >= kapasitas (misal 600 lembar >= 500)
  if (jumlahHalamanBaru >= kapasitasMaks) {
    if (boksAktif.jumlah_lembar_terisi === 0) {
      // Boks aktif saat ini masih 0 lembar, pakai boks ini dan tandai langsung Penuh
      const { data: updated, error: updateErr } = await admin
        .from('boks')
        .update({
          jumlah_lembar_terisi: jumlahHalamanBaru,
          status: 'Penuh',
        })
        .eq('id', boksAktif.id)
        .select()
        .single()

      if (updateErr) throw new Error(`Gagal mengupdate boks: ${updateErr.message}`)
      return updated as BoksRecord
    } else {
      // Boks aktif sudah ada isinya, tutup boks aktif ini -> Penuh
      await admin.from('boks').update({ status: 'Penuh' }).eq('id', boksAktif.id)

      // Buat boks baru bernomor urut berikutnya, isi dokumen ini, langsung Penuh
      const nextNomor = await getNextNomorBoks(rakId)
      const { data: created, error: createErr } = await admin
        .from('boks')
        .insert({
          nomor_boks: nextNomor,
          rak_id: rakId,
          kapasitas_maks_lembar: kapasitasMaks,
          jumlah_lembar_terisi: jumlahHalamanBaru,
          status: 'Penuh',
        })
        .select()
        .single()

      if (createErr || !created) {
        throw new Error(`Gagal membuat boks baru: ${createErr?.message}`)
      }

      const qrPath = await generateAndUploadBoksQR(created.id, nextNomor)
      if (qrPath) {
        await admin.from('boks').update({ qr_path: qrPath }).eq('id', created.id)
        created.qr_path = qrPath
      }

      return created as BoksRecord
    }
  }

  // Kasus 3: Dokumen normal (< kapasitas)
  const totalBaru = boksAktif.jumlah_lembar_terisi + jumlahHalamanBaru

  if (totalBaru <= kapasitasMaks) {
    // Masuk boks yang sama!
    const statusBaru = totalBaru === kapasitasMaks ? 'Penuh' : 'Aktif'
    const { data: updated, error: updateErr } = await admin
      .from('boks')
      .update({
        jumlah_lembar_terisi: totalBaru,
        status: statusBaru,
      })
      .eq('id', boksAktif.id)
      .select()
      .single()

    if (updateErr) throw new Error(`Gagal mengupdate boks: ${updateErr.message}`)
    return updated as BoksRecord
  } else {
    // Melampaui kapasitas! (misal 350 + 300 = 650 > 500)
    // 1. Tandai boks aktif saat ini menjadi Penuh
    await admin.from('boks').update({ status: 'Penuh' }).eq('id', boksAktif.id)

    // 2. Buat boks baru bernomor urut berikutnya
    const nextNomor = await getNextNomorBoks(rakId)
    const { data: created, error: createErr } = await admin
      .from('boks')
      .insert({
        nomor_boks: nextNomor,
        rak_id: rakId,
        kapasitas_maks_lembar: kapasitasMaks,
        jumlah_lembar_terisi: jumlahHalamanBaru,
        status: 'Aktif',
      })
      .select()
      .single()

    if (createErr || !created) {
      throw new Error(`Gagal membuat boks baru: ${createErr?.message}`)
    }

    const qrPath = await generateAndUploadBoksQR(created.id, nextNomor)
    if (qrPath) {
      await admin.from('boks').update({ qr_path: qrPath }).eq('id', created.id)
      created.qr_path = qrPath
    }

    return created as BoksRecord
  }
}

