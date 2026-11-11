import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID lampiran wajib disertakan' }, { status: 400 })
    }

    // 1. Verifikasi Sesi Pengguna
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus masuk ke sistem terlebih dahulu.' },
        { status: 401 }
      )
    }

    // 2. Ambil Profil dan Role Pengguna
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profError || !profile) {
      return NextResponse.json(
        { error: 'Profil pengguna tidak ditemukan dalam basis data.' },
        { status: 403 }
      )
    }

    const userRole = profile.role

    // 3. ATURAN KERAS BLUEPRINT BAB 5: VIEWER DILARANG MENGUNDUH
    if (userRole === 'viewer') {
      return NextResponse.json(
        {
          error:
            'Akses Ditolak: Peran Viewer hanya diizinkan melihat daftar dan pratinjau, dilarang mengunduh berkas lampiran.',
        },
        { status: 403 }
      )
    }

    // 4. Ambil Lampiran beserta info Dokumen induknya
    const adminClient = createAdminClient()
    const { data: lampiran, error: lampError } = await adminClient
      .from('lampiran')
      .select('id, dokumen_id, nama_file, file_path, diunggah_oleh')
      .eq('id', id)
      .single()

    if (lampError || !lampiran) {
      return NextResponse.json({ error: 'Berkas lampiran tidak ditemukan.' }, { status: 404 })
    }

    const { data: doc } = await adminClient
      .from('dokumen')
      .select('id, bucket, pemilik_id, pemegang_saat_ini, kode_arsip')
      .eq('id', lampiran.dokumen_id)
      .single()

    // 5. Cek kepemilikan untuk Pengaju (user)
    if (userRole === 'user' && doc) {
      const isOwnerOrUploader =
        doc.pemilik_id === user.id ||
        doc.pemegang_saat_ini === user.id ||
        lampiran.diunggah_oleh === user.id

      if (!isOwnerOrUploader) {
        return NextResponse.json(
          { error: 'Akses Ditolak: Anda hanya berhak mengunduh lampiran pada dokumen milik sendiri.' },
          { status: 403 }
        )
      }
    }

    // 6. Buat Signed URL Berumur Pendek (60 detik)
    const targetBucket = doc?.bucket || 'arsip-aktif'
    const { data: signedData, error: signError } = await adminClient.storage
      .from(targetBucket)
      .createSignedUrl(lampiran.file_path, 60, {
        download: lampiran.nama_file || true,
      })

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: 'Gagal menerbitkan tautan unduh bertanda waktu.' },
        { status: 500 }
      )
    }

    // 7. Catat Aktivitas ke log_aktivitas
    try {
      await adminClient.from('log_aktivitas').insert({
        dokumen_id: lampiran.dokumen_id,
        user_id: user.id,
        aksi: 'download',
        keterangan: `Mengunduh lampiran "${lampiran.nama_file}" pada dokumen ${doc?.kode_arsip || ''}`,
      })
    } catch (logErr) {
      console.error('Gagal mencatat log_aktivitas lampiran:', logErr)
    }

    // 8. Respon
    const wantsJson =
      request.nextUrl.searchParams.get('json') === 'true' ||
      request.headers.get('accept')?.includes('application/json')

    if (wantsJson) {
      return NextResponse.json({
        success: true,
        nama_file: lampiran.nama_file,
        signedUrl: signedData.signedUrl,
        expiresInSeconds: 60,
      })
    }

    return NextResponse.redirect(signedData.signedUrl, 307)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

