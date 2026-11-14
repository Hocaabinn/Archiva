import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { catatLogAktivitas, kirimNotifikasiKeUser } from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/serah-terima/[id]/tolak
 * Penerima menolak serah terima dokumen fisik (Blueprint 3.5 & 8.3).
 *
 * ATURAN KERAS:
 * 1. Status serah terima diubah menjadi 'Ditolak'.
 * 2. Pemegang saat ini dan lokasi dokumen TETAP pada penyerah (TIDAK BERUBAH).
 * 3. Dicatat di log_aktivitas.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: serahTerimaId } = await params

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil pengguna tidak ditemukan.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const alasan = (body.alasan || '').trim() || 'Fisik dokumen tidak sesuai atau belum diterima'

    const admin = createAdminClient()

    // 1. Ambil data serah terima
    const { data: st, error: stError } = await admin
      .from('serah_terima')
      .select(`
        id, dokumen_id, dari_user_id, ke_user_id, dari_lokasi, ke_lokasi,
        status_serah,
        dokumen:dokumen_id ( id, kode_arsip, judul, lokasi_saat_ini, pemegang_saat_ini ),
        penyerah:dari_user_id ( id, nama_lengkap, email )
      `)
      .eq('id', serahTerimaId)
      .single()

    if (stError || !st) {
      return NextResponse.json({ error: 'Data serah terima tidak ditemukan.' }, { status: 404 })
    }

    if (st.status_serah !== 'Menunggu konfirmasi') {
      return NextResponse.json(
        {
          error: `Serah terima tidak dapat ditolak karena status saat ini '${st.status_serah}'.`,
        },
        { status: 400 }
      )
    }

    // 2. Validasi hak akses: Hanya penerima (ke_user_id) atau Admin/PIC yang berhak menolak
    const isRecipient = st.ke_user_id === user.id
    const isPrivileged = profile.role === 'superadmin' || profile.role === 'pic_aktif'
    if (!isRecipient && !isPrivileged) {
      return NextResponse.json(
        {
          error: 'Akses Ditolak: Anda bukan pihak penerima yang berhak menolak dokumen ini.',
        },
        { status: 403 }
      )
    }

    const doc = st.dokumen as any

    // 3. Update status serah terima menjadi 'Ditolak'
    // Pemegang dokumen dan lokasi TETAP pada penyerah (TIDAK BERUBAH)
    const { error: updateErr } = await admin
      .from('serah_terima')
      .update({
        status_serah: 'Ditolak',
        keterangan: alasan,
      })
      .eq('id', st.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    const penerimaNama = profile.nama_lengkap || profile.nama || user.email || 'Penerima'

    // 4. Catat ke log_aktivitas
    await catatLogAktivitas({
      dokumen_id: doc?.id,
      user_id: user.id,
      aksi: 'serah_terima',
      keterangan: `Serah terima dokumen "${doc?.judul}" (${doc?.kode_arsip}) DITOLAK oleh calon penerima (${penerimaNama}). Alasan: "${alasan}". Pemegang fisik dan lokasi tetap pada penyerah.`,
    })

    // 5. Kirim notifikasi ke penyerah
    if (st.dari_user_id) {
      await kirimNotifikasiKeUser({
        userId: st.dari_user_id,
        judul: 'Serah Terima Dokumen Ditolak',
        isi: `Pengajuan serah terima fisik dokumen "${doc?.judul}" (${doc?.kode_arsip}) ditolak oleh ${penerimaNama}. Alasan: "${alasan}". Dokumen tetap berada dalam tanggung jawab Anda.`,
        dokumenId: doc?.id,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Serah terima dokumen ${doc?.kode_arsip} telah ditolak. Pemegang dan lokasi fisik tetap pada penyerah.`,
    })
  } catch (err: unknown) {
    console.error('Error in POST /api/serah-terima/[id]/tolak:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
