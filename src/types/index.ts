export type UserRole = 'admin' | 'pic_arsip' | 'atasan' | 'user' | 'accounting' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  nama_lengkap: string;
  nip_nik?: string;
  jabatan?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
}

export type DokumenStatus = 'menunggu_persetujuan' | 'aktif' | 'nonaktif' | 'ditolak';

export interface Dokumen {
  id: string;
  kode_arsip: string;
  nomor_dokumen: string;
  judul: string;
  kategori_id: string;
  kategori_nama?: string;
  deskripsi?: string;
  status: DokumenStatus;
  file_path: string;
  bucket: string;
  file_size?: number;
  mime_type?: string;
  qr_code_path?: string;
  pemilik_id: string;
  pemilik_nama?: string;
  pemegang_saat_ini: string;
  pemegang_nama?: string;
  lokasi_saat_ini: string;
  tanggal_dokumen: string;
  tanggal_diajukan: string;
  tanggal_disetujui?: string;
  tanggal_kadaluarsa?: string;
  verifikasi_pic_oleh?: string;
  verifikasi_pic_at?: string;
  catatan_pic?: string;
  approval_atasan_oleh?: string;
  approval_atasan_at?: string;
  catatan_atasan?: string;
  alasan_penolakan?: string;
  created_at: string;
}

export interface KategoriDokumen {
  id: string;
  nama: string;
  kode_kategori: string;
  deskripsi?: string;
  is_active: boolean;
}
