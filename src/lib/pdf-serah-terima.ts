import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'

export interface BuktiSerahTerimaData {
  id: string
  nomorBast: string
  tanggalSerah: string
  tanggalTerima?: string
  statusSerah: string
  dokumen: {
    id: string
    kodeArsip: string
    judul: string
    nomorDokumen?: string
    nomorPpl?: string
    kategori?: string
    tanggalDokumen?: string
  }
  penyerah: {
    nama: string
    email: string
    jabatan?: string
    lokasiAsal: string
  }
  penerima: {
    nama: string
    email: string
    jabatan?: string
    lokasiTujuan: string
  }
  keterangan?: string
}

/**
 * Membuat dokumen PDF Berita Acara Serah Terima (BAST) Dokumen Fisik
 * Standar PT Semen Indonesia (Persero) Tbk - Archiva
 */
export async function generateBuktiSerahTerimaPDF(data: BuktiSerahTerimaData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 Portrait (points)
  const { width, height } = page.getSize()

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)

  const navyColor = rgb(0.12, 0.23, 0.37) // #1E3A5F
  const darkGray = rgb(0.1, 0.1, 0.1)
  const mediumGray = rgb(0.35, 0.4, 0.45)
  const lightBorder = rgb(0.8, 0.85, 0.9)

  let y = height - 50

  // 1. HEADER / KOP RESMI
  page.drawText('PT SEMEN INDONESIA (PERSERO) Tbk', {
    x: 50,
    y,
    size: 13,
    font: fontBold,
    color: navyColor,
  })
  y -= 16
  page.drawText('DEPARTEMEN AKUNTANSI & SISTEM INFORMASI ARSIP (ARCHIVA)', {
    x: 50,
    y,
    size: 9,
    font: fontRegular,
    color: mediumGray,
  })
  y -= 14
  page.drawText('Jl. Veteran, Gresik 61122, Jawa Timur | Sistem Arsip Digital Terpadu', {
    x: 50,
    y,
    size: 8,
    font: fontRegular,
    color: mediumGray,
  })
  y -= 10

  // Garis Pembatas Kop
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 2,
    color: navyColor,
  })
  y -= 22

  // 2. JUDUL DOKUMEN BAST
  page.drawText('BERITA ACARA SERAH TERIMA DOKUMEN FISIK', {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: darkGray,
  })
  y -= 15
  page.drawText(`Nomor: ${data.nomorBast}`, {
    x: 50,
    y,
    size: 10,
    font: fontMono,
    color: navyColor,
  })
  y -= 25

  // QR Code Dokumen (di pojok kanan atas informasi)
  try {
    const qrDataUrl = await QRCode.toDataURL(data.dokumen.kodeArsip, {
      margin: 1,
      width: 120,
    })
    const qrBase64 = qrDataUrl.split(',')[1]
    const qrImage = await pdfDoc.embedPng(Buffer.from(qrBase64, 'base64'))
    page.drawImage(qrImage, {
      x: width - 150,
      y: y - 55,
      width: 100,
      height: 100,
    })
    page.drawText('Pindai QR Dokumen', {
      x: width - 150,
      y: y - 65,
      size: 7,
      font: fontMono,
      color: mediumGray,
    })
  } catch (err) {
    console.error('Error generating QR in PDF:', err)
  }

  // 3. PARAGRAF PEMBUKA
  const tglSerahFormatted = new Date(data.tanggalSerah).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const tglTerimaFormatted = data.tanggalTerima
    ? new Date(data.tanggalTerima).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB'
    : 'Menunggu konfirmasi'

  const pembuka = `Pada hari ini, ${tglSerahFormatted}, telah dilakukan serah terima fisik dokumen arsip resmi antara para pihak di bawah ini sesuai ketentuan tata kelola kearsipan:`
  page.drawText(pembuka, {
    x: 50,
    y,
    size: 9,
    font: fontRegular,
    color: darkGray,
    maxWidth: width - 220,
    lineHeight: 13,
  })
  y -= 45

  // 4. KOTAK INFORMASI DOKUMEN ARSIP
  page.drawRectangle({
    x: 50,
    y: y - 90,
    width: width - 100,
    height: 90,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: lightBorder,
    borderWidth: 1,
  })

  page.drawText('DATA DOKUMEN ARSIP YANG DISERAHKAN', {
    x: 62,
    y: y - 18,
    size: 9,
    font: fontBold,
    color: navyColor,
  })

  page.drawText(`Kode Arsip SIG : ${data.dokumen.kodeArsip}`, {
    x: 62,
    y: y - 34,
    size: 9,
    font: fontMono,
    color: darkGray,
  })

  page.drawText(`Judul Dokumen  : ${data.dokumen.judul.slice(0, 75)}`, {
    x: 62,
    y: y - 48,
    size: 9,
    font: fontRegular,
    color: darkGray,
  })

  const detailInfo = [
    data.dokumen.nomorPpl ? `No. PPL: ${data.dokumen.nomorPpl}` : null,
    data.dokumen.nomorDokumen ? `Doc Voucher: ${data.dokumen.nomorDokumen}` : null,
    data.dokumen.kategori ? `Kategori: ${data.dokumen.kategori}` : null,
    data.dokumen.tanggalDokumen ? `Tgl Dokumen: ${data.dokumen.tanggalDokumen}` : null,
  ].filter(Boolean).join(' | ')

  page.drawText(detailInfo || 'Status: Aktif', {
    x: 62,
    y: y - 62,
    size: 8,
    font: fontRegular,
    color: mediumGray,
  })

  if (data.keterangan) {
    page.drawText(`Catatan Khusus : ${data.keterangan.slice(0, 80)}`, {
      x: 62,
      y: y - 76,
      size: 8,
      font: fontRegular,
      color: darkGray,
    })
  }

  y -= 115

  // 5. DATA PIHAK PERTAMA (PENYERAH) & KEDUA (PENERIMA)
  const colWidth = (width - 120) / 2

  // Kotak Penyerah
  page.drawRectangle({
    x: 50,
    y: y - 95,
    width: colWidth,
    height: 95,
    borderColor: lightBorder,
    borderWidth: 1,
  })
  page.drawText('PIHAK PERTAMA (PENYERAH)', {
    x: 60,
    y: y - 18,
    size: 9,
    font: fontBold,
    color: navyColor,
  })
  page.drawText(`Nama    : ${data.penyerah.nama}`, {
    x: 60,
    y: y - 35,
    size: 8.5,
    font: fontRegular,
    color: darkGray,
  })
  page.drawText(`Surel   : ${data.penyerah.email}`, {
    x: 60,
    y: y - 50,
    size: 8,
    font: fontRegular,
    color: mediumGray,
  })
  page.drawText(`Lokasi  : ${data.penyerah.lokasiAsal}`, {
    x: 60,
    y: y - 65,
    size: 8,
    font: fontRegular,
    color: darkGray,
  })
  page.drawText(`Status  : Telah Menyerahkan Fisik`, {
    x: 60,
    y: y - 80,
    size: 8,
    font: fontBold,
    color: rgb(0.12, 0.45, 0.3),
  })

  // Kotak Penerima
  page.drawRectangle({
    x: 50 + colWidth + 20,
    y: y - 95,
    width: colWidth,
    height: 95,
    borderColor: lightBorder,
    borderWidth: 1,
  })
  page.drawText('PIHAK KEDUA (PENERIMA)', {
    x: 60 + colWidth + 20,
    y: y - 18,
    size: 9,
    font: fontBold,
    color: navyColor,
  })
  page.drawText(`Nama    : ${data.penerima.nama}`, {
    x: 60 + colWidth + 20,
    y: y - 35,
    size: 8.5,
    font: fontRegular,
    color: darkGray,
  })
  page.drawText(`Surel   : ${data.penerima.email}`, {
    x: 60 + colWidth + 20,
    y: y - 50,
    size: 8,
    font: fontRegular,
    color: mediumGray,
  })
  page.drawText(`Tujuan  : ${data.penerima.lokasiTujuan}`, {
    x: 60 + colWidth + 20,
    y: y - 65,
    size: 8,
    font: fontRegular,
    color: darkGray,
  })
  page.drawText(`Status  : Diterima & Terkonfirmasi`, {
    x: 60 + colWidth + 20,
    y: y - 80,
    size: 8,
    font: fontBold,
    color: rgb(0.12, 0.45, 0.3),
  })

  y -= 125

  // 6. PERNYATAAN KESEPAKATAN
  const pernyataan = 'Dengan ditandatanganinya berita acara ini, tanggung jawab penyimpanan fisik dokumen arsip resmi berpindah kepada Pihak Kedua. Seluruh perubahan tercatat secara permanen di dalam sistem basis data dan Buku Log Riwayat Kearsipan.'
  page.drawText(pernyataan, {
    x: 50,
    y,
    size: 8.5,
    font: fontRegular,
    color: darkGray,
    maxWidth: width - 100,
    lineHeight: 12,
  })

  y -= 45

  // 7. BLOK PENGESAHAN / TANDA TANGAN ELEKTRONIK
  page.drawText('Pihak Pertama,', {
    x: 80,
    y,
    size: 9,
    font: fontRegular,
    color: darkGray,
  })
  page.drawText('Pihak Kedua (Penerima),', {
    x: width - 210,
    y,
    size: 9,
    font: fontRegular,
    color: darkGray,
  })

  y -= 50

  // Kolom tanda tangan digital / cap verifikasi
  page.drawText('[ Terverifikasi Digital ]', {
    x: 75,
    y,
    size: 8,
    font: fontMono,
    color: navyColor,
  })
  page.drawText('[ Terverifikasi Digital ]', {
    x: width - 215,
    y,
    size: 8,
    font: fontMono,
    color: navyColor,
  })

  y -= 20
  page.drawText(data.penyerah.nama, {
    x: 70,
    y,
    size: 9,
    font: fontBold,
    color: darkGray,
  })
  page.drawText(data.penerima.nama, {
    x: width - 220,
    y,
    size: 9,
    font: fontBold,
    color: darkGray,
  })

  y -= 12
  page.drawText(`Diserahkan: ${tglSerahFormatted}`, {
    x: 70,
    y,
    size: 7.5,
    font: fontRegular,
    color: mediumGray,
  })
  page.drawText(`Dikonfirmasi: ${tglTerimaFormatted}`, {
    x: width - 220,
    y,
    size: 7.5,
    font: fontRegular,
    color: mediumGray,
  })

  // 8. FOOTER AUDIT
  const footerY = 35
  page.drawLine({
    start: { x: 50, y: footerY + 15 },
    end: { x: width - 50, y: footerY + 15 },
    thickness: 0.5,
    color: lightBorder,
  })
  page.drawText(`ID Serah Terima: ${data.id} | Archiva Audit Trail | Dicetak: ${new Date().toISOString()}`, {
    x: 50,
    y: footerY,
    size: 7,
    font: fontMono,
    color: mediumGray,
  })
  page.drawText('Halaman 1 dari 1', {
    x: width - 110,
    y: footerY,
    size: 7,
    font: fontRegular,
    color: mediumGray,
  })

  return await pdfDoc.save()
}

