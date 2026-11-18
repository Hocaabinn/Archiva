import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BoksLaporanGroup } from '@/app/api/laporan/route'

export interface GenerateLaporanPdfOptions {
  lokasiString: string
  statusFilterLabel: string
  unitFilterLabel: string
  userName: string
  userRoleTitle: string
  statistik: {
    totalBoks: number
    totalDokumen: number
    totalLembar: number
    totalKapasitasLembar: number
    totalTerisiLembar: number
    persentaseOkupansi: number
  }
  boksGroups: BoksLaporanGroup[]
}

/**
 * Mengenerate Laporan Rekapitulasi Arsip per Lokasi Fisik dalam format PDF menggunakan jsPDF + jspdf-autotable
 */
export function exportLaporanToPDF(options: GenerateLaporanPdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // 1. KOP SURAT RESMI
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(30, 58, 95) // #1E3A5F Navy
  doc.text('PT SEMEN INDONESIA (PERSERO) Tbk', 15, 16)

  doc.setFontSize(9)
  doc.setTextColor(75, 85, 99)
  doc.text('UNIT KERJA KEARSIPAN & TATA KELOLA DOKUMEN (ARCHIVA)', 15, 21)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(107, 114, 128)
  doc.text('Sistem Informasi Manajemen Arsip Dokumen — Standar SIG', 15, 25.5)

  // Garis Pembatas Kop
  doc.setDrawColor(30, 58, 95)
  doc.setLineWidth(0.6)
  doc.line(15, 28, pageWidth - 15, 28)

  // 2. JUDUL LAPORAN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(31, 35, 51)
  doc.text('LAPORAN REKAPITULASI ARSIP PER LOKASI', 15, 36)

  // 3. METADATA FILTER & STATISTIK
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(55, 65, 81)

  const printDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  doc.text(`Lokasi Fisik    : ${options.lokasiString || 'Semua Lokasi Master'}`, 15, 42)
  doc.text(`Status Berkas   : ${options.statusFilterLabel}`, 15, 47)
  doc.text(`Unit Kerja      : ${options.unitFilterLabel}`, 15, 52)

  doc.text(`Dicetak Oleh    : ${options.userName} (${options.userRoleTitle})`, 115, 42)
  doc.text(`Waktu Cetak     : ${printDate} WIB`, 115, 47)
  doc.text(
    `Total Terdata   : ${options.statistik.totalDokumen} Berkas (${options.statistik.totalBoks} Boks • ${options.statistik.totalTerisiLembar} Lembar)`,
    115,
    52
  )

  // Garis Tipis Pemisah
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.3)
  doc.line(15, 56, pageWidth - 15, 56)

  let startY = 62

  if (options.boksGroups.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(120, 120, 120)
    doc.text('Tidak ditemukan dokumen arsip untuk lokasi dan filter terpilih.', 15, startY + 10)
    doc.save(`Laporan_Rekapitulasi_Arsip_${Date.now()}.pdf`)
    return
  }

  // 4. TABEL GRUP PER BOKS
  options.boksGroups.forEach((boks, boksIdx) => {
    // Cek apakah halaman sisa cukup untuk header grup boks
    if (startY > pageHeight - 40) {
      doc.addPage()
      startY = 20
    }

    // Header Grup Boks
    doc.setFillColor(240, 248, 255) // #F0F8FF Soft Sky
    doc.setDrawColor(186, 230, 253)
    doc.setLineWidth(0.4)
    doc.roundedRect(15, startY - 4.5, pageWidth - 30, 9, 1.5, 1.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(3, 105, 161)
    const boksLabel = `BOKS: ${boks.nomor_boks.toUpperCase()} (${boks.status_boks.toUpperCase()})`
    doc.text(boksLabel, 18, startY + 1.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(75, 85, 99)
    const rakDesc = `Rak: ${boks.rak_nama} | Ruang: ${boks.ruangan_nama} | Kapasitas: ${boks.jumlah_lembar_terisi} / ${boks.kapasitas_maks_lembar} Lembar (${boks.persentase_terisi}%)`
    doc.text(rakDesc, pageWidth - 18, startY + 1.5, { align: 'right' })

    startY += 8

    // Tabel Dokumen di dalam Boks
    const tableBody = boks.dokumen_list.map((docItem, idx) => {
      const tglFormatted = docItem.tanggal_dokumen
        ? new Date(docItem.tanggal_dokumen).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '-'

      const statusLabel =
        docItem.is_dipinjam
          ? 'Dipinjam'
          : docItem.status === 'aktif'
          ? 'Aktif'
          : docItem.status === 'inaktif'
          ? 'Inaktif'
          : docItem.status.toUpperCase()

      return [
        String(idx + 1),
        docItem.nomor_payment || '-',
        docItem.kode_arsip,
        docItem.judul,
        docItem.kategori_nama,
        `${docItem.jumlah_halaman} lbr`,
        tglFormatted,
        statusLabel,
      ]
    })

    autoTable(doc, {
      startY,
      head: [
        ['No', 'No. Payment', 'Kode Arsip (SIG)', 'Judul Dokumen', 'Kategori', 'Hal', 'Tgl Dok', 'Status'],
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 95], // Navy #1E3A5F
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [31, 35, 51],
        lineColor: [229, 231, 235],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 24, font: 'courier' },
        2: { cellWidth: 38, font: 'courier' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 20 },
        5: { cellWidth: 14, halign: 'right' },
        6: { cellWidth: 20 },
        7: { cellWidth: 18, halign: 'center' },
      },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        // Footer Halaman
        const str = `Halaman ${doc.internal.pages.length - 1}`
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Archiva — Laporan Rekapitulasi Fisik Kearsipan PT Semen Indonesia (Persero) Tbk | ${str}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        )
      },
    })

    // Update startY untuk grup boks berikutnya
    const finalY = (doc as any).lastAutoTable.finalY
    startY = finalY + 8
  })

  // Simpan berkas PDF
  const filename = `Laporan_Rekapitulasi_Arsip_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

/**
 * Mengenerate file CSV untuk kebutuhan inventarisasi fisik di Excel
 */
export function exportLaporanToCSV(options: GenerateLaporanPdfOptions) {
  const headers = [
    'No',
    'Gedung',
    'Ruangan',
    'Rak',
    'Nomor Boks',
    'Status Boks',
    'Kapasitas Maksimal (Lbr)',
    'Terisi (Lbr)',
    'Persentase Boks (%)',
    'No. Payment',
    'Kode Arsip',
    'Judul Dokumen',
    'Kategori',
    'Jumlah Halaman',
    'Tanggal Dokumen',
    'Status Dokumen',
    'Unit Kerja',
  ]

  const rows: string[][] = []
  let globalIndex = 1

  options.boksGroups.forEach((boks) => {
    boks.dokumen_list.forEach((doc) => {
      rows.push([
        String(globalIndex++),
        `"${(boks.gedung_nama || '').replace(/"/g, '""')}"`,
        `"${(boks.ruangan_nama || '').replace(/"/g, '""')}"`,
        `"${(boks.rak_nama || '').replace(/"/g, '""')}"`,
        `"${(boks.nomor_boks || '').replace(/"/g, '""')}"`,
        `"${boks.status_boks}"`,
        String(boks.kapasitas_maks_lembar),
        String(boks.jumlah_lembar_terisi),
        `${boks.persentase_terisi}%`,
        `"${doc.nomor_payment || ''}"`,
        `"${doc.kode_arsip}"`,
        `"${(doc.judul || '').replace(/"/g, '""')}"`,
        `"${(doc.kategori_nama || '').replace(/"/g, '""')}"`,
        String(doc.jumlah_halaman),
        doc.tanggal_dokumen || '',
        doc.is_dipinjam ? 'Dipinjam' : doc.status,
        `"${(doc.unit_nama || '').replace(/"/g, '""')}"`,
      ])
    })
  })

  // Tambahkan BOM agar karakter UTF-8 terbaca dengan sempurna di Microsoft Excel
  const BOM = '\uFEFF'
  const csvContent =
    BOM +
    headers.join(',') +
    '\n' +
    rows.map((row) => row.join(',')).join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    `Inventarisasi_Arsip_${new Date().toISOString().split('T')[0]}.csv`
  )
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

