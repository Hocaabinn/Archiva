import type { UserRole } from '@/types'

/**
 * Peta hak akses halaman per peran (sisi UI). Penegakan data tetap di API;
 * ini hanya untuk mengalihkan pengguna ke /dashboard secara rapi.
 * Rute yang tidak terdaftar dianggap terbuka untuk semua peran yang login.
 * Urutan: awalan yang lebih spesifik harus lebih dulu.
 */
const SEMUA: UserRole[] = ['superadmin', 'pic_aktif', 'atasan_aktif', 'pic_inaktif', 'atasan_inaktif', 'staff']
const OPERASIONAL: UserRole[] = ['pic_aktif', 'atasan_aktif', 'pic_inaktif', 'atasan_inaktif']

const ATURAN: { awalan: string; peran: UserRole[] }[] = [
  { awalan: '/dokumen/upload', peran: ['pic_aktif'] },
  { awalan: '/dokumen', peran: SEMUA },
  { awalan: '/daftar-dokumen', peran: SEMUA },
  { awalan: '/transfer-dokumen', peran: ['pic_aktif', 'pic_inaktif'] },
  { awalan: '/transfer-arsip', peran: ['pic_aktif', 'pic_inaktif'] },
  { awalan: '/persetujuan/verifikasi-transfer', peran: ['pic_inaktif', 'atasan_inaktif', 'superadmin'] },
  { awalan: '/verifikasi-transfer', peran: ['pic_inaktif', 'atasan_inaktif', 'superadmin'] },
  { awalan: '/persetujuan', peran: ['atasan_aktif', 'superadmin'] },
  { awalan: '/serah-terima', peran: ['pic_aktif', 'pic_inaktif', 'atasan_aktif', 'atasan_inaktif', 'superadmin'] },
  { awalan: '/peminjaman-saya', peran: ['staff'] },
  { awalan: '/peminjaman', peran: ['pic_inaktif', 'atasan_inaktif', 'pic_aktif', 'superadmin'] },
  { awalan: '/laporan', peran: ['superadmin', ...OPERASIONAL] },
  { awalan: '/riwayat', peran: ['superadmin', ...OPERASIONAL] },
  { awalan: '/pengaturan', peran: ['superadmin'] },
  { awalan: '/master-data', peran: ['superadmin'] },
]

export function bolehAksesRute(pathname: string, role: UserRole): boolean {
  const aturan = ATURAN.find((a) => pathname === a.awalan || pathname.startsWith(a.awalan + '/'))
  return aturan ? aturan.peran.includes(role) : true
}
