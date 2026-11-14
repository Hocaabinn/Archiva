import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  catatLogAktivitas,
  kirimNotifikasiKeUser,
  kirimNotifikasiKePeran,
} from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

/**
 * Pembatalan Dokumen Aktif (Blueprint Bab 6.7):
 * 1. Membatalkan dokumen Aktif HANYA oleh Atasan, dengan alasan wajib.
 * 2. Menyimpan kode arsip dan tidak memakainya ulang; dokumen tetap dapat dilihat
 *    dengan penanda DIBATALKAN; memberi tahu pemilik dan PIC Arsip.
 * 3. Mengecualikan dokumen yang belum Aktif dari pembatalan (PIC Arsip atau Atasan
 *    menolak dokumen menunggu_persetujuan, bukan membatalkannya).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID dokumen wajib disertakan.' }, { status: 400 })
    }

    // 1. Verifikasi pengguna login
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus login terlebih dahulu.' },
        { status: 401 }
      )
    }

    // 2. Cek peran pengguna: Hanya Atasan Arsip Aktif yang berhak membatalkan dokumen (Blueprint 6.6)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role, unit_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'atasan_aktif') {
      return NextResponse.json(
        {
          error:
            'Akses Ditolak: Sesuai Blueprint 6.6, hanya Atasan Arsip Aktif (atasan_aktif) yang berhak membatalkan dokumen arsip.',
        },
        { status: 403 }
      )
    }

    // 3. Baca alasan pembatalan (wajib diisi)
    const body = await request.json().catch(() => ({}))
    const alasan = (body.alasan || '').trim()

    if (!alasan) {
      return NextResponse.json(
        { error: 'Alasan pembatalan wajib diisi sesuai ketentuan Blueprint 6.7.' },
        { status: 400 }
      )
    }

    // 4. Ambil data dokumen
    const admin = createAdminClient()
    const { data: doc, error: docError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, status, pemilik_id')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    // 5. ATURAN KERAS BLUEPRINT 6.7 POIN 1 & 3:
    // "Membatalkan dokumen Aktif hanya oleh Atasan... Mengecualikan dokumen yang belum Aktif dari pembatalan"
    if (doc.status !== 'aktif') {
      return NextResponse.json(
        {
          error: `Dokumen tidak dapat dibatalkan karena status saat ini '${doc.status}'. Pembatalan hanya berlaku untuk dokumen yang berstatus Aktif. Dokumen yang belum aktif ditolak melalui alur penolakan.`,
        },
        { status: 400 }
      )
    }

    // 6. Update status dokumen menjadi 'dibatalkan'
    // Kode arsip tetap tersimpan dan tidak dipakai ulang.
    const { error: updateError } = await admin
      .from('dokumen')
      .update({
        status: 'dibatalkan',
        alasan_penolakan: alasan, // dicatat alasan pembatalan
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    if (updateError) {
      return NextResponse.json(
        { error: `Gagal membatalkan dokumen: ${updateError.message}` },
        { status: 500 }
      )
    }

    // 7. Catat log aktivitas
    const atasanNama = profile.nama_lengkap || profile.nama || user.email || 'Atasan'
    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'pembatalan',
      keterangan: `Dokumen Aktif resmi dibatalkan oleh ${atasanNama}. Alasan pembatalan: "${alasan}"`,
    })

    // 8. Beri tahu Pemilik Dokumen
    if (doc.pemilik_id) {
      await kirimNotifikasiKeUser({
        userId: doc.pemilik_id,
        judul: 'Dokumen Dibatalkan',
        isi: `Dokumen Anda "${doc.judul}" (${doc.kode_arsip}) telah dibatalkan oleh Atasan. Alasan: "${alasan}". Dokumen tetap tercatat dengan penanda DIBATALKAN.`,
        dokumenId: doc.id,
      })
    }

    // 9. Beri tahu seluruh PIC Arsip Aktif
    await kirimNotifikasiKePeran({
      roles: ['pic_aktif'],
      judul: 'Dokumen Dibatalkan oleh Atasan',
      isi: `Dokumen "${doc.judul}" (${doc.kode_arsip}) telah dibatalkan oleh Atasan (${atasanNama}). Alasan: "${alasan}".`,
      dokumenId: doc.id,
    })

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} telah resmi dibatalkan dan berstatus DIBATALKAN.`,
    })
  } catch (err: unknown) {
    console.error('Error pembatalan:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

