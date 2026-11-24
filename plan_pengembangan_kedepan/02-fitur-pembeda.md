# 02 — Fitur Pembeda

1. **Retensi dan penyusutan sesuai regulasi**: jadwal retensi, pemusnahan dengan berita acara dan persetujuan berjenjang.
2. **Multi-tenant**: satu aplikasi, banyak instansi, data terpisah (fondasi untuk dijual).
3. **Audit trail kuat**: `log_aktivitas` sudah ada; tambah ekspor laporan audit.
4. **PWA / mobile**: scan QR serah terima dan stock opname langsung di gudang.
5. **Stock opname fisik**: cocokkan isi boks dengan data lewat scan massal.
6. **Integrasi**: impor Excel data lama, SSO (Google/Microsoft), API untuk ERP/SAP.
7. **Tanda tangan digital + segel waktu** pada persetujuan agar sah secara hukum.
8. **Mode offline** untuk gudang dengan sinyal buruk.
9. **Asisten AI** (lihat `01-ai-agent.md`).

Pembeda utama: QR + serah terima + peminjaman inaktif + approval + AI dalam satu alur,
bukan sekadar "folder digital".
