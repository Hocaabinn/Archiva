'use client'

import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'
import { QrCode as QrIcon, Printer, Download, Copy, Check } from 'lucide-react'

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
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!kodeArsip) return
    QRCode.toDataURL(kodeArsip, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#1A1D21',
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

  const handleDownload = () => {
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `QR_${kodeArsip}.png`
    link.click()
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=500,height=600')
    if (!printWindow || !dataUrl) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Label QR Arsip - ${kodeArsip}</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body {
              font-family: 'Courier New', monospace;
              padding: 10px;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-color: #ffffff;
            }
            .label-card {
              border: 2px dashed #1A1D21;
              padding: 18px;
              width: 320px;
              text-align: center;
              background-color: #faf8f5;
            }
            .header {
              font-size: 11px;
              font-weight: bold;
              letter-spacing: 1px;
              border-bottom: 1px solid #1A1D21;
              padding-bottom: 6px;
              margin-bottom: 12px;
            }
            .qr-img {
              width: 180px;
              height: 180px;
              margin: 0 auto;
              border: 1px solid #1A1D21;
              padding: 6px;
              background: #fff;
            }
            .code {
              font-size: 11px;
              font-weight: bold;
              margin-top: 10px;
              word-break: break-all;
              letter-spacing: 0.5px;
            }
            .meta {
              font-size: 10px;
              color: #444;
              margin-top: 8px;
              border-top: 1px dotted #888;
              padding-top: 6px;
              text-align: left;
            }
            .footer {
              font-size: 8px;
              color: #666;
              margin-top: 8px;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="header">SEMEN INDONESIA GROUP · E-ARSIP</div>
            <img class="qr-img" src="${dataUrl}" alt="QR Code" />
            <div class="code">${kodeArsip}</div>
            ${judul ? `<div class="meta"><strong>Judul:</strong> ${judul.slice(0, 60)}</div>` : ''}
            ${nomorPpl ? `<div class="meta" style="border:none;padding-top:2px;"><strong>No. PPL:</strong> ${nomorPpl}</div>` : ''}
            <div class="footer">Tempelkan pada map fisik arsip</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div
      ref={printRef}
      className={`border-2 border-dashed border-[#1E2429] p-5 bg-[#F7F3EB]/70 flex flex-col items-center justify-between text-center space-y-4 ${className}`}
    >
      <div>
        <span className="font-mono text-[10px] text-[#5B6166] uppercase tracking-wider block font-bold">
          LABEL QR CODE FISIK
        </span>
        <span className="font-mono text-xs text-[#8C9399]">
          Tempelkan pada Map Berkas
        </span>
      </div>

      <div className="p-3 bg-white border-2 border-[#1E2429] shadow-xs flex flex-col items-center">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR ${kodeArsip}`}
            width={size}
            height={size}
            className="w-auto h-auto max-w-full"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center bg-[#F7F3EB] text-[#5B6166] text-xs font-mono"
          >
            Membuat QR...
          </div>
        )}
        <div className="mt-2 text-center">
          <span className="font-mono font-bold text-xs text-[#1A1D21] block tracking-wider select-all break-all max-w-[240px]">
            {kodeArsip}
          </span>
        </div>
      </div>

      <div className="text-[10px] font-mono text-[#5B6166] leading-tight">
        <span>Format SIG: TAHUN_PERUSAHAAN_PPL_DOCVOUCHER. Dipindai saat serah terima.</span>
      </div>

      {showActions && (
        <div className="w-full space-y-2 pt-1 font-mono text-xs">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="py-1.5 px-2 bg-white border border-[#D8D2C4] hover:border-[#1E2429] text-[#1A1D21] font-semibold flex items-center justify-center gap-1.5 transition-colors"
              title="Salin Kode Arsip"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="py-1.5 px-2 bg-white border border-[#D8D2C4] hover:border-[#1E2429] text-[#1A1D21] font-semibold flex items-center justify-center gap-1.5 transition-colors"
              title="Unduh Gambar PNG QR"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-1.5 bg-[#1E2429] hover:bg-black text-white font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Label Stiker</span>
          </button>
        </div>
      )}
    </div>
  )
}

