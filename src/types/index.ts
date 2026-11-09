export type UserRole = 'admin' | 'pic_arsip' | 'atasan' | 'user' | 'accounting' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  nama?: string;
  nama_lengkap: string;
  nomor_pegawai?: string;
  nip_nik?: string;
  jabatan?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

// 5 Status Dokumen Standar Blueprint R.02 (SIG)
export type DokumenStatus = 'menunggu_persetujuan' | 'aktif' | 'ditolak' | 'inaktif' | 'dibatalkan';

export interface Dokumen {
  id: string;
  kode_arsip: string; // TAHUN_KODEPERUSAHAAN_NOPAYMENT_DOCVOUCHER
  judul: string;
  nomor_dokumen?: string; // Bagian Doc Voucher
  nomor_ppl?: string; // Bagian No. Payment / PPL
  penandatangan?: string;
  kategori_id: string;
  kategori_nama?: string;
  deskripsi?: string;
  status: DokumenStatus;
  bucket: string; // 'arsip-aktif' | 'arsip-inaktif'
  file_path: string;
  file_tipe?: string;
  ukuran_file?: number;
  file_size?: number; // fallback alias
  mime_type?: string; // fallback alias
  barcode_path?: string;
  qr_code_path?: string; // fallback alias
  pemilik_id: string;
  pemilik_nama?: string;
  pemegang_saat_ini?: string;
  pemegang_nama?: string;
  lokasi_saat_ini?: string;
  tanggal_dokumen?: string;
  tanggal_masuk?: string;
  tanggal_diajukan?: string; // fallback alias
  tanggal_disetujui?: string;
  tanggal_kadaluarsa?: string; // tanggal_disetujui + 3 tahun
  verifikasi_pic?: string;
  verifikasi_pic_oleh?: string; // fallback alias
  disetujui_oleh?: string;
  approval_atasan_oleh?: string; // fallback alias
  alasan_penolakan?: string;
  created_at: string;
  updated_at?: string;
}

export interface KategoriDokumen {
  id: string;
  nama: string;
  kode: string;
  kode_kategori?: string; // fallback alias
  deskripsi?: string;
  is_active?: boolean;
}

export type PeminjamanStatus = 'Diajukan' | 'Disetujui' | 'Dipinjam' | 'Dikembalikan' | 'Ditolak';

export interface Peminjaman {
  id: string;
  dokumen_id: string;
  dokumen?: Dokumen;
  peminjam_id: string;
  peminjam?: Profile;
  pic_inaktif_id?: string;
  tanggal_pinjam: string;
  tanggal_kembali?: string;
  status: PeminjamanStatus;
  keperluan: string;
  created_at: string;
}

export type SerahTerimaStatus = 'Menunggu konfirmasi' | 'Diterima' | 'Ditolak';

export interface SerahTerima {
  id: string;
  dokumen_id: string;
  dokumen?: Dokumen;
  dari_user_id: string;
  dari_user?: Profile;
  ke_user_id: string;
  ke_user?: Profile;
  dari_lokasi?: string;
  ke_lokasi?: string;
  tanggal_serah: string;
  tanggal_terima?: string;
  status_serah: SerahTerimaStatus;
  keterangan?: string;
  bukti_pdf_path?: string;
  created_at: string;
}

export interface LogAktivitas {
  id: string;
  dokumen_id?: string;
  user_id?: string;
  user?: Profile;
  aksi: string;
  keterangan?: string;
  created_at: string;
}

export interface Notifikasi {
  id: string;
  user_id: string;
  judul: string;
  isi: string;
  dokumen_id?: string;
  dibaca: boolean;
  created_at: string;
}

export interface Lampiran {
  id: string;
  dokumen_id: string;
  nama_file: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  diunggah_oleh?: string;
  created_at: string;
}
