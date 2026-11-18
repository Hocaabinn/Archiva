import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'

export interface ItemDokumenTransfer {
  nomorPayment?: string
  kodeArsip: string
  judul: string
  kategori: string
  jumlahHalaman: number
  tanggalKadaluarsa: string
  sisaHari: number
  nomorBoks?: string
}

export interface BeritaAcaraTransferData {
  nomorBa: string
  tanggalBa: string
  pengirim: {
    nama: string
    email: string
    jabatan?: string
    unit: string
  }
  penerima: {
    nama: string
    email: string
    jabatan?: string
    unit?: string
  }
  dokumenList: ItemDokumenTransfer[]
  catatan?: string
}

/**
 * Membuat dokumen PDF Berita Acara Serah Terima Arsip (BAST)
 * Sesuai Standar PT Semen Indonesia (Persero) Tbk - Archiva R.03
 */
export async function generateBeritaAcaraTransferPDF(data: BeritaAcaraTransferData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 Portrait
  const { width, height } = page.getSize()

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)
  const fontMonoBold = await pdfDoc.embedFont(StandardFonts.CourierBold)

  const navyColor = rgb(0.12, 0.23, 0.37) // #1E3A5F
  const darkGray = rgb(0.1, 0.1, 0.1)
  const mediumGray = rgb(0.35, 0.4, 0.45)
  const lightBorder = rgb(0.75, 0.85, 0.95)

  let y = height - 50

  // 1. KOP RESMI
  page.drawText('PT SEMEN INDONESIA (PERSERO) Tbk', {
    x: 50,
    y,
    size: 13,
    font: fontBold,
    color: navyColor,
  })
  y -= 16
  page.drawText('UNIT KERJA KEARSIPAN & TATA KELOLA DOKUMEN', {
    x: 50,
    y,
    size: 10,
    font: fontBold,
    color: navyColor,
  })
  y -= 12
  page.drawText('Sistem Informasi Manajemen Arsip Dokumen — Archiva (Standar SIG R.03)', {
    x: 50,
    y,
    size: 8.5,
    font: fontRegular,
    color: mediumGray,
  })

  // Garis Pembatas Kop
  y -= 10
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1.5,
    color: navyColor,
  })
  y -= 20

  // 2. JUDUL DOKUMEN BERITA ACARA
  page.drawText('BERITA ACARA SERAH TERIMA ARSIP (BAST)', {
    x: 50,
    y,
    size: 13,
    font: fontBold,
    color: darkGray,
  })
  y -= 14
  page.drawText(`Nomor BAST: ${data.nomorBa}`, {
    x: 50,
    y,
    size: 9.5,
    font: fontMonoBold,
    color: navyColor,
  })
  y -= 22

  // 3. PARAGRAF PEMBUKA
  const tglFormatted = new Date(data.tanggalBa).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const introText = `Pada hari ini, ${tglFormatted}, telah dilakukan penyerahan fisik berkas arsip aktif yang telah atau mendekati batas masa retensi aktif untuk dipindahkan ke pengelolaan Unit Arsip Inaktif (Gudang Inaktif) oleh pihak-pihak di bawah ini:`
  page.drawText(introText, {
    x: 50,
    y,
    size: 8.5,
    font: fontRegular,
    color: darkGray,
    maxWidth: width - 100,
    lineHeight: 12,
  })
  y -= 32

  // 4. KOTAK PIHAK PENYERAH & PENERIMA
  const boxWidth = (width - 110) / 2
  const boxHeight = 72

  // Pihak Penyerah (PIC Arsip Aktif)
  page.drawRectangle({
    x: 50,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1),
  })
  page.drawText('PIHAK PERTAMA (PENYERAH):', {
    x: 58,
    y: y - 14,
    size: 8,
    font: fontBold,
    color: navyColor,
  })
  page.drawText(`Nama       : ${data.pengirim.nama}`, { x: 58, y: y - 28, size: 8, font: fontRegular, color: darkGray })
  page.drawText(`Peran      : PIC Arsip Aktif`, { x: 58, y: y - 40, size: 8, font: fontRegular, color: darkGray })
  page.drawText(`Unit Kerja : ${data.pengirim.unit}`, { x: 58, y: y - 52, size: 8, font: fontRegular, color: darkGray })
  page.drawText(`Surel      : ${data.pengirim.email}`, { x: 58, y: y - 64, size: 7.5, font: fontRegular, color: mediumGray })

  // Pihak Penerima (PIC Arsip Inaktif)
  page.drawRectangle({
    x: 60 + boxWidth,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1),
  })
  page.drawText('PIHAK KEDUA (PENERIMA):', {
    x: 68 + boxWidth,
    y: y - 14,
    size: 8,
    font: fontBold,
    color: navyColor,
  })
  page.drawText(`Nama       : ${data.penerima.nama}`, { x: 68 + boxWidth, y: y - 28, size: 8, font: fontRegular, color: darkGray })
  page.drawText(`Peran      : PIC Arsip Inaktif`, { x: 68 + boxWidth, y: y - 40, size: 8, font: fontRegular, color: darkGray })
  page.drawText(`Unit Kerja : ${data.penerima.unit || 'Gudang Inaktif (Unit Kearsipan Inaktif)'}`, { x: 68 + boxWidth, y: y - 52, size: 8, font: fontRegular, color: darkGray })
  page.drawText(`Surel      : ${data.penerima.email}`, { x: 68 + boxWidth, y: y - 64, size: 7.5, font: fontRegular, color: mediumGray })

  y -= boxHeight + 20

  // 5. TABEL DAFTAR BERKAS DOKUMEN
  page.drawText(`DAFTAR BERKAS ARSIP YANG DISERAHKAN (${data.dokumenList.length} BERKAS):`, {
    x: 50,
    y,
    size: 9,
    font: fontBold,
    color: darkGray,
  })
  y -= 14

  // Header Tabel
  page.drawRectangle({
    x: 50,
    y: y - 18,
    width: width - 100,
    height: 18,
    color: rgb(0.92, 0.95, 0.98),
    borderColor: lightBorder,
    borderWidth: 1,
  })
  page.drawText('NO', { x: 54, y: y - 12, size: 7, font: fontBold, color: navyColor })
  page.drawText('NO. PAYMENT', { x: 74, y: y - 12, size: 7, font: fontBold, color: navyColor })
  page.drawText('KODE ARSIP (SIG)', { x: 145, y: y - 12, size: 7, font: fontBold, color: navyColor })
  page.drawText('JUDUL / PERIHAL', { x: 280, y: y - 12, size: 7, font: fontBold, color: navyColor })
  page.drawText('HAL', { x: 415, y: y - 12, size: 7, font: fontBold, color: navyColor })
  page.drawText('BOKS ASAL', { x: 445, y: y - 12, size: 7, font: fontBold, color: navyColor })
  page.drawText('STATUS', { x: 500, y: y - 12, size: 7, font: fontBold, color: navyColor })

  y -= 18

  // Batasi daftar dokumen yang dirender agar tidak overlap
  const maxDocsToRender = 15
  const renderedDocs = data.dokumenList.slice(0, maxDocsToRender)

  renderedDocs.forEach((doc, idx) => {
    const rowH = 18
    const isEven = idx % 2 === 0
    page.drawRectangle({
      x: 50,
      y: y - rowH,
      width: width - 100,
      height: rowH,
      color: isEven ? rgb(1, 1, 1) : rgb(0.98, 0.99, 1),
      borderColor: lightBorder,
      borderWidth: 0.5,
    })

    page.drawText(String(idx + 1), { x: 54, y: y - 12, size: 7, font: fontRegular, color: darkGray })
    page.drawText(doc.nomorPayment || '-', { x: 74, y: y - 12, size: 6.5, font: fontMonoBold, color: navyColor })

    const kodeTrunc = doc.kodeArsip.length > 22 ? doc.kodeArsip.substring(0, 20) + '..' : doc.kodeArsip
    page.drawText(kodeTrunc, { x: 145, y: y - 12, size: 6.5, font: fontMono, color: navyColor })

    const judulTruncated = doc.judul.length > 25 ? doc.judul.substring(0, 23) + '...' : doc.judul
    page.drawText(judulTruncated, { x: 280, y: y - 12, size: 7, font: fontRegular, color: darkGray })

    page.drawText(`${doc.jumlahHalaman} lbr`, { x: 415, y: y - 12, size: 7, font: fontRegular, color: darkGray })
    page.drawText(doc.nomorBoks || '-', { x: 445, y: y - 12, size: 6.5, font: fontMono, color: navyColor })

    const statusRetensi = doc.sisaHari <= 0 ? 'Kedaluwarsa' : `H-${doc.sisaHari}`
    page.drawText(statusRetensi, { x: 500, y: y - 12, size: 6.5, font: fontBold, color: rgb(0.8, 0.2, 0.2) })

    y -= rowH
  })

  y -= 14

  // 6. CATATAN KETENTUAN
  const catatanKetentuan =
    'Catatan: Penyerahan berkas fisik ini wajib diverifikasi oleh PIC Arsip Inaktif melalui pemindaian QR fisik. Setelah dikonfirmasi diterima, berkas resmi beralih ke status Inaktif, dialokasikan ke Boks Inaktif kapasitas 500 lembar, dan dipindahkan ke Gudang Inaktif.'
  page.drawText(catatanKetentuan, {
    x: 50,
    y,
    size: 7.2,
    font: fontRegular,
    color: mediumGray,
    maxWidth: width - 100,
    lineHeight: 10,
  })

  // 7. FOOTER TANDA TANGAN KEDUA BELAH PIHAK & KODE QR VERIFIKASI
  const ttdY = 95

  // Tanda Tangan Pihak I
  page.drawText('Pihak Pertama (Penyerah),', { x: 50, y: ttdY + 28, size: 8, font: fontRegular, color: darkGray })
  page.drawText('PIC Arsip Aktif Unit Kerja', { x: 50, y: ttdY + 16, size: 7.5, font: fontBold, color: navyColor })
  page.drawLine({ start: { x: 50, y: ttdY - 20 }, end: { x: 190, y: ttdY - 20 }, thickness: 1, color: darkGray })
  page.drawText(data.pengirim.nama, { x: 50, y: ttdY - 32, size: 8, font: fontBold, color: darkGray })

  // Tanda Tangan Pihak II
  page.drawText('Pihak Kedua (Penerima),', { x: width - 190, y: ttdY + 28, size: 8, font: fontRegular, color: darkGray })
  page.drawText('PIC Arsip Inaktif (Gudang)', { x: width - 190, y: ttdY + 16, size: 7.5, font: fontBold, color: navyColor })
  page.drawLine({ start: { x: width - 190, y: ttdY - 20 }, end: { x: width - 50, y: ttdY - 20 }, thickness: 1, color: darkGray })
  page.drawText(data.penerima.nama, { x: width - 190, y: ttdY - 32, size: 8, font: fontBold, color: darkGray })

  // QR Code Verifikasi di Tengah
  try {
    const qrDataUrl = await QRCode.toDataURL(data.nomorBa, {
      margin: 1,
      width: 120,
      color: { dark: '#1E3A5F', light: '#FFFFFF' },
    })
    const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
    const qrImage = await pdfDoc.embedPng(qrImageBytes)
    const qrSize = 54
    const qrX = (width - qrSize) / 2
    const qrY = ttdY - 26

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    })
    page.drawText('QR Validasi BAST', {
      x: qrX - 4,
      y: qrY - 9,
      size: 6.5,
      font: fontBold,
      color: navyColor,
    })
  } catch (qrErr) {
    console.error('Gagal generate QR Code PDF:', qrErr)
  }

  // Footer Dokumen Paling Bawah
  page.drawText(`Archiva — Berita Acara Serah Terima Arsip (BAST) | Dokumen Resmi PT Semen Indonesia (Persero) Tbk | ${data.nomorBa}`, {
    x: 50,
    y: 20,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.55, 0.55, 0.55),
  })

  return await pdfDoc.save()
}

