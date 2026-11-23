import { redirect } from 'next/navigation'

/**
 * Rute Alias Master Lokasi -> Master Data
 * Rute: /master-lokasi
 */
export default function MasterLokasiPage() {
  redirect('/master-data')
}

