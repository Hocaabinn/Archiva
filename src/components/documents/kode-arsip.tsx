import { Fragment } from 'react'

/**
 * Menampilkan kode arsip (TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER) yang turun ke baris
 * berikutnya di batas garis bawah, bukan memanjang ke samping. Teks yang disalin tetap utuh
 * karena <wbr> tidak menambah karakter.
 */
export function KodeArsip({
  kode,
  prefix = '',
  className = '',
  title,
}: {
  kode: string | null | undefined
  prefix?: string
  className?: string
  title?: string
}) {
  const value = kode || '-'
  const parts = value.split('_')
  return (
    <span className={`min-w-0 break-words [overflow-wrap:anywhere] ${className}`} title={title ?? value}>
      {prefix}
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 && (
            <>
              _<wbr />
            </>
          )}
        </Fragment>
      ))}
    </span>
  )
}
