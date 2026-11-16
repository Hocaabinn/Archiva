import fs from 'fs'
import path from 'path'

const LOKASI_META_PATH = path.join(process.cwd(), 'src/config/lokasi-metadata.json')

export interface LokasiMetaItem {
  kode?: string
  status?: 'Aktif' | 'Nonaktif'
}

export function getLokasiMetadataMap(): Record<string, LokasiMetaItem> {
  try {
    if (fs.existsSync(LOKASI_META_PATH)) {
      const data = fs.readFileSync(LOKASI_META_PATH, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Gagal membaca lokasi-metadata.json:', err)
  }
  return {}
}

export function saveLokasiMetadata(id: string, meta: LokasiMetaItem) {
  try {
    const dir = path.dirname(LOKASI_META_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const current = getLokasiMetadataMap()
    current[id] = {
      ...(current[id] || {}),
      ...meta,
    }
    fs.writeFileSync(LOKASI_META_PATH, JSON.stringify(current, null, 2), 'utf-8')
    return current[id]
  } catch (err) {
    console.error('Gagal menulis lokasi-metadata.json:', err)
    return null
  }
}

export function deleteLokasiMetadata(id: string) {
  try {
    if (fs.existsSync(LOKASI_META_PATH)) {
      const current = getLokasiMetadataMap()
      if (current[id]) {
        delete current[id]
        fs.writeFileSync(LOKASI_META_PATH, JSON.stringify(current, null, 2), 'utf-8')
      }
    }
  } catch (err) {
    console.error('Gagal menghapus entri dari lokasi-metadata.json:', err)
  }
}

