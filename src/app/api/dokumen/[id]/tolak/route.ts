import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { catatLogAktivitas, kirimNotifikasiKeUser } from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID dokumen wajib disertakan.' }, { status: 400 })
    }

    // 1. Verifikasi pengguna
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus login terlebih dahulu.' },
        { status: 401 }
      )
    }

    // 2. Cek peran pengguna: Hanya Atasan Arsip Aktif yang berhak menolak dokumen (Blueprint Bab 5)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role, unit_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'atasan_aktif') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Atasan Arsip Aktif (atasan_aktif) yang berhak menolak dokumen.' },
        { status: 403 }
      )
    }

    // 3. Baca alasan penolakan (wajib diisi sesuai Blueprint 3.3 poin 3 & 6.3)
    const body = await request.json().catch(() => ({}))
    const alasan = (body.alasan || '').trim()

    if (!alasan) {
      return NextResponse.json(
        { error: 'Alasan penolakan wajib diisi untuk mengembalikan dokumen ke PIC Arsip Aktif.' },
        { status: 400 }
      )
    }

    // 4. Ambil data dokumen
    const admin = createAdminClient()
    const { data: doc, error: docError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, status, pemilik_id, unit_id')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    if (doc.status !== 'menunggu_persetujuan') {
      return NextResponse.json(
        { error: `Dokumen tidak dalam status menunggu persetujuan (status saat ini: ${doc.status}).` },
        { status: 400 }
      )
    }

    // Blueprint 3.3 poin 2: Hanya Atasan Arsip Aktif dari unit yang sama
    if (profile.unit_id && doc.unit_id && profile.unit_id !== doc.unit_id) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda hanya berhak menolak dokumen dari unit organisasi Anda sendiri.' },
        { status: 403 }
      )
    }

    // 5. Update data: ubah status menjadi ditolak dan simpan alasan penolakan
    const { error: updateError } = await admin
      .from('dokumen')
      .update({
        status: 'ditolak',
        alasan_penolakan: alasan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    if (updateError) {
      return NextResponse.json(
        { error: `Gagal menolak dokumen: ${updateError.message}` },
        { status: 500 }
      )
    }

    // 6. Catat log aktivitas (aksi: 'tolak')
    const penolakNama = profile.nama_lengkap || profile.nama || user.email || 'Atasan Arsip Aktif'
    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'tolak',
      keterangan: `Dokumen ditolak oleh Atasan Arsip Aktif (${penolakNama}). Alasan: "${alasan}". Dokumen dikembalikan ke PIC Arsip Aktif untuk diperbaiki.`,
    })

    // 7. Kirim notifikasi ke PIC Arsip Aktif pengentri (pemilik_id)
    if (doc.pemilik_id) {
      await kirimNotifikasiKeUser({
        userId: doc.pemilik_id,
        judul: 'Dokumen Ditolak oleh Atasan',
        isi: `Dokumen Anda "${doc.judul}" (${doc.kode_arsip}) telah ditolak oleh Atasan. Alasan: "${alasan}". Silakan perbaiki metadata/berkas dan ajukan ulang.`,
        dokumenId: doc.id,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} telah ditolak dan dikembalikan ke PIC Arsip Aktif untuk perbaikan.`,
      alasan_penolakan: alasan,
    })
  } catch (err: unknown) {
    console.error('Error penolakan:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
