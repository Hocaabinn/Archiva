'use client'

import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'
import { Copy, Check, FileDown, Loader2 } from 'lucide-react'

interface DocumentQRProps {
  kodeArsip: string
  judul?: string
  nomorDokumen?: string
  nomorPpl?: string
  className?: string
  showActions?: boolean
  size?: number
}

export function DocumentQR({
  kodeArsip,
  judul,
  nomorDokumen,
  nomorPpl,
  className = '',
  showActions = true,
  size = 180,
}: DocumentQRProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!kodeArsip) return
    QRCode.toDataURL(kodeArsip, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#1F2333',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error('Gagal generate QR Code:', err))
  }, [kodeArsip, size])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(kodeArsip)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Unduh Label Stiker sebagai PDF resmi
  const handleDownloadPdf = async () => {
    if (!dataUrl) return
    setIsGeneratingPdf(true)
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.create()
      // Ukuran label stiker persegi (100mm x 120mm = 283.5 x 340.2 pt)
      const page = pdfDoc.addPage([283.5, 340.2])
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold)

      const qrBase64 = dataUrl.split(',')[1]
      const qrImage = await pdfDoc.embedPng(Buffer.from(qrBase64, 'base64'))

      // Header pita warna biru langit (#3BA4E8)
      page.drawRectangle({
        x: 0,
        y: 288,
        width: 283.5,
        height: 52.2,
        color: rgb(0.231, 0.643, 0.91), // #3BA4E8
      })

      page.drawText('SEMEN INDONESIA GROUP', {
        x: 16,
        y: 316,
        size: 11,
        font: fontBold,
        color: rgb(1, 1, 1),
      })

      page.drawText('LABEL RESMI KEARSIPAN ELEKTRONIK', {
        x: 16,
        y: 302,
        size: 7.5,
        font: fontRegular,
        color: rgb(1, 1, 1),
      })

      // Bingkai latar putih bersih untuk QR
      page.drawRectangle({
        x: (283.5 - 170) / 2,
        y: 104,
        width: 170,
        height: 170,
        color: rgb(0.98, 0.99, 1),
        borderColor: rgb(0.73, 0.9, 0.99), // #BAE6FD
        borderWidth: 1,
      })

      // Gambar QR Code
      page.drawImage(qrImage, {
        x: (283.5 - 150) / 2,
        y: 114,
        width: 150,
        height: 150,
      })

      // Teks Kode Arsip SIG
      page.drawText(kodeArsip, {
        x: 16,
        y: 84,
        size: 8.5,
        font: fontMono,
        color: rgb(0.12, 0.14, 0.2),
      })

      // Metadata singkat dokumen
      if (judul) {
        const cleanJudul = judul.length > 44 ? judul.slice(0, 41) + '...' : judul
        page.drawText(`Judul: ${cleanJudul}`, {
          x: 16,
          y: 70,
          size: 7.5,
          font: fontRegular,
          color: rgb(0.3, 0.35, 0.42),
        })
      }

      if (nomorPpl || nomorDokumen) {
        const metaText = [
          nomorDokumen ? `Doc: ${nomorDokumen}` : null,
          nomorPpl ? `PPL: ${nomorPpl}` : null,
        ].filter(Boolean).join(' | ')

        page.drawText(metaText, {
          x: 16,
          y: 58,
          size: 7.5,
          font: fontRegular,
          color: rgb(0.3, 0.35, 0.42),
        })
      }

      // Garis pemisah bawah
      page.drawLine({
        start: { x: 16, y: 46 },
        end: { x: 283.5 - 16, y: 46 },
        thickness: 0.5,
        color: rgb(0.85, 0.88, 0.92),
      })

      page.drawText('Tempelkan label ini pada map fisik berkas arsip dokumen.', {
        x: 16,
        y: 32,
        size: 7,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.52),
      })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Label_QR_${kodeArsip}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Gagal membuat file PDF label:', err)
      window.print()
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div
      ref={printRef}
      className={`rounded-xl border border-[#BAE6FD] bg-[#F0F9FF]/40 p-5 shadow-xs flex flex-col items-center justify-between text-center space-y-4 ${className}`}
    >
      <div>
        <span className="font-sans text-[11px] text-[#0284C7] uppercase tracking-wider block font-bold">
          LABEL QR CODE FISIK
        </span>
        <span className="text-xs text-[#64748B] mt-0.5 block">
          Tempelkan pada Map Berkas
        </span>
      </div>

      <div className="p-3.5 bg-white border border-[#BAE6FD] rounded-xl shadow-xs flex flex-col items-center w-full max-w-[240px]">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR ${kodeArsip}`}
            width={size}
            height={size}
            className="w-auto h-auto max-w-full rounded"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center bg-[#F8FAFC] text-[#64748B] text-xs font-sans rounded"
          >
            Membuat QR...
          </div>
        )}
        <div className="mt-3 text-center w-full">
          <span className="font-mono font-bold text-xs text-[#1F2333] block tracking-wide select-all break-all px-1">
            {kodeArsip}
          </span>
        </div>
      </div>

      <div className="text-[11px] text-[#64748B] leading-relaxed max-w-[240px]">
        <span>Format SIG: TAHUN_PERUSAHAAN_PPL_DOCVOUCHER. Dipindai saat serah terima.</span>
      </div>

      {showActions && (
        <div className="w-full space-y-2 pt-1 font-sans text-xs">
          <button
            type="button"
            onClick={handleCopyCode}
            className="w-full py-2 px-3 bg-white border border-[#CBD7E3] hover:border-[#3BA4E8] hover:bg-[#F8FAFC] text-[#1F2333] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            title="Salin Kode Arsip"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Kode Berhasil Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Salin Kode Arsip</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf || !dataUrl}
            className="w-full py-2.5 px-4 bg-[#3BA4E8] hover:bg-[#2A92D6] active:bg-[#1E80C2] text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            <span>Unduh sebagai PDF</span>
          </button>
        </div>
      )}
    </div>
  )
}
