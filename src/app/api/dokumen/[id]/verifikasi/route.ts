import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { catatLogAktivitas, kirimNotifikasiKePeran } from '@/lib/server-dokumen'

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

    // 2. Cek peran pengguna: Hanya PIC Arsip dan Admin yang dapat memverifikasi tahap 1
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'pic_aktif' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya PIC Arsip Aktif yang berhak memverifikasi kelengkapan dokumen pada tahap 1.' },
        { status: 403 }
      )
    }

    // 3. Ambil data dokumen
    const admin = createAdminClient()
    const { data: doc, error: docError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, status, verifikasi_pic_oleh, pemilik_id')
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

    if (doc.verifikasi_pic_oleh) {
      return NextResponse.json(
        { error: 'Dokumen ini telah diverifikasi tahap 1 sebelumnya dan sedang menunggu persetujuan Atasan.' },
        { status: 400 }
      )
    }

    // 4. Update data: catat verifikator PIC
    const { error: updateError } = await admin
      .from('dokumen')
      .update({
        verifikasi_pic_oleh: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    if (updateError) {
      return NextResponse.json(
        { error: `Gagal memperbarui verifikasi dokumen: ${updateError.message}` },
        { status: 500 }
      )
    }

    // 5. Catat ke log_aktivitas
    const verifikatorNama = profile.nama_lengkap || profile.nama || user.email || 'PIC Arsip'
    await catatLogAktivitas({
      dokumen_id: doc.id,
      user_id: user.id,
      aksi: 'verifikasi',
      keterangan: `Verifikasi tahap 1 lolos oleh ${verifikatorNama}. Dokumen diteruskan ke antrean persetujuan Atasan.`,
    })

    // 6. Kirim notifikasi ke semua Atasan
    await kirimNotifikasiKePeran({
      roles: ['atasan_aktif'],
      judul: 'Dokumen Menunggu Persetujuan Akhir',
      isi: `Dokumen "${doc.judul}" (${doc.kode_arsip}) telah lolos verifikasi tahap 1 oleh PIC Arsip dan siap untuk persetujuan akhir Anda.`,
      dokumenId: doc.id,
    })

    return NextResponse.json({
      success: true,
      message: `Dokumen ${doc.kode_arsip} berhasil diverifikasi dan diteruskan ke Atasan.`,
    })
  } catch (err: unknown) {
    console.error('Error verifikasi:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

