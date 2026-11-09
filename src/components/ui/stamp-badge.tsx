import { DokumenStatus } from '@/types'

interface StampProps {
  status: DokumenStatus | 'menunggu_verifikasi' | 'lunas' | 'gagal' | 'menunggu_konfirmasi' | 'diterima'
  className?: string
}

export function StampBadge({ status, className = '' }: StampProps) {
  let badgeClass = 'stamp-badge-gray'
  let label = status.replace(/_/g, ' ')

  switch (status) {
    case 'aktif':
    case 'lunas':
    case 'diterima':
      badgeClass = 'stamp-badge-green'
      label = status === 'aktif' ? 'AKTIF' : status === 'lunas' ? 'LUNAS' : 'DITERIMA'
      break
    case 'menunggu_persetujuan':
      badgeClass = 'stamp-badge-amber'
      label = 'MENUNGGU PERSETUJUAN'
      break
    case 'menunggu_verifikasi':
      badgeClass = 'stamp-badge-amber'
      label = 'MENUNGGU VERIFIKASI'
      break
    case 'menunggu_konfirmasi':
      badgeClass = 'stamp-badge-amber'
      label = 'MENUNGGU KONFIRMASI'
      break
    case 'ditolak':
    case 'gagal':
      badgeClass = 'stamp-badge-red'
      label = status === 'ditolak' ? 'DITOLAK' : 'GAGAL'
      break
    case 'dibatalkan':
      badgeClass = 'stamp-badge-red'
      label = 'DIBATALKAN'
      break
    case 'inaktif':
      badgeClass = 'stamp-badge-gray'
      label = 'INAKTIF'
      break
  }

  return (
    <span className={`stamp-badge ${badgeClass} ${className}`}>
      {label}
    </span>
  )
}
