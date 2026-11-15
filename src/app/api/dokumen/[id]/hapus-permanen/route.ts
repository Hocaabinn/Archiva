import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/dokumen/[id]/hapus-permanen
 * Superadmin menghapus permanen dokumen arsip (Blueprint Bab 5 & 10.2).
 * HANYA aktif bila sudah ada log persetujuan_hapus dari Atasan yang tercatat di log aktivitas.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda belum login.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, nama_lengkap, email')
      .eq('id', user.id)
      .single()

    // 1. Cek otorisasi peran: HANYA Superadmin
    if (profile?.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Superadmin yang berhak mengeksekusi penghapusan permanen dokumen.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { alasan } = body

    if (!alasan || !alasan.trim()) {
      return NextResponse.json(
        { error: 'Alasan penghapusan permanen wajib dicantumkan untuk kepentingan audit.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // 2. Cek apakah dokumen ada
    const { data: doc, error: docErr } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, file_path, bucket, boks_id, jumlah_halaman')
      .eq('id', id)
      .single()

    if (docErr || !doc) {
      return NextResponse.json({ error: 'Dokumen arsip tidak ditemukan.' }, { status: 404 })
    }

    // 3. Verifikasi Log Persetujuan Atasan (Syarat Mutlak Blueprint)
    const { data: approvalLogs, error: logSearchErr } = await admin
      .from('log_aktivitas')
      .select('id, aksi, keterangan, created_at')
      .eq('dokumen_id', id)
      .eq('aksi', 'persetujuan_hapus')
      .order('created_at', { ascending: false })
      .limit(1)

    if (logSearchErr) {
      return NextResponse.json({ error: logSearchErr.message }, { status: 500 })
    }

    if (!approvalLogs || approvalLogs.length === 0) {
      return NextResponse.json(
        {
          error:
            'Akses Ditolak: Penghapusan permanen tidak dapat diproses karena belum ada log persetujuan_hapus resmi dari Atasan.',
        },
        { status: 403 }
      )
    }

    const atasanLog = approvalLogs[0]

    // 4. Hapus berkas fisik digital dari Supabase Storage
    const targetBucket = doc.bucket || 'arsip-aktif'
    if (doc.file_path) {
      try {
        await admin.storage.from(targetBucket).remove([doc.file_path])
      } catch (storageErr) {
        console.warn(`Gagal menghapus file dari storage ${targetBucket}:`, storageErr)
      }
    }

    // 5. Sesuaikan kapasitas terisi boks jika ada
    if (doc.boks_id && doc.jumlah_halaman) {
      try {
        const { data: currentBoks } = await admin
          .from('boks')
          .select('jumlah_lembar_terisi, status')
          .eq('id', doc.boks_id)
          .single()

        if (currentBoks) {
          const newFilled = Math.max(0, (currentBoks.jumlah_lembar_terisi || 0) - doc.jumlah_halaman)
          await admin
            .from('boks')
            .update({
              jumlah_lembar_terisi: newFilled,
              status: 'Aktif',
            })
            .eq('id', doc.boks_id)
        }
      } catch (boksErr) {
        console.warn('Gagal memperbarui kapasitas boks:', boksErr)
      }
    }

    const namaSuperadmin = profile?.nama_lengkap || profile?.email || 'Superadmin'

    // 6. Catat log_aktivitas audit hapus_permanen
    await admin.from('log_aktivitas').insert({
      dokumen_id: null, // Tetap tersimpan meski baris dokumen dihapus
      user_id: user.id,
      aksi: 'hapus_permanen',
      keterangan: `Superadmin (${namaSuperadmin}) mengeksekusi penghapusan permanen dokumen ${doc.kode_arsip} ("${doc.judul}"). Alasan Superadmin: ${alasan.trim()}. Diverifikasi atas dasar persetujuan Atasan (${atasanLog.created_at}). Berkas storage telah dimusnahkan.`,
    })

    // 7. Hapus baris dokumen dari database
    const { error: deleteErr } = await admin.from('dokumen').delete().eq('id', id)
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} beserta berkas fisiknya berhasil dihapus permanen dari sistem.`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

