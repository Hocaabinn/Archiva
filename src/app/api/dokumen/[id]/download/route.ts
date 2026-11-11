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
      return NextResponse.json({ error: 'ID dokumen wajib disertakan' }, { status: 400 })
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
      .select('role, nama, email')
      .eq('id', user.id)
      .single()

    if (profError || !profile) {
      return NextResponse.json(
        { error: 'Profil pengguna tidak ditemukan dalam basis data.' },
        { status: 403 }
      )
    }

    const userRole = profile.role

    // 3. ATURAN KERAS BLUEPRINT BAB 5: VIEWER TIDAK BOLEH DOWNLOAD BERKAS FISIK
    if (userRole === 'viewer') {
      return NextResponse.json(
        {
          error:
            'Akses Ditolak: Peran Viewer hanya berhak melihat daftar dan detail dokumen, serta dilarang keras mengunduh berkas fisik.',
        },
        { status: 403 }
      )
    }

    // 4. Ambil Data Dokumen menggunakan Admin Client
    const adminClient = createAdminClient()
    const { data: doc, error: docError } = await adminClient
      .from('dokumen')
      .select('id, kode_arsip, judul, file_path, bucket, pemilik_id, pemegang_saat_ini')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Dokumen arsip tidak ditemukan.' },
        { status: 404 }
      )
    }

    // 5. ATURAN HAK AKSES BAB 5: Pengaju (user) hanya boleh mengunduh dokumen miliknya sendiri
    if (userRole === 'user') {
      const isOwnerOrHolder = doc.pemilik_id === user.id || doc.pemegang_saat_ini === user.id
      if (!isOwnerOrHolder) {
        return NextResponse.json(
          {
            error:
              'Akses Ditolak: Pengaju (User) hanya memiliki hak untuk mengunduh dokumen miliknya sendiri.',
          },
          { status: 403 }
        )
      }
    }

    // 6. Buat Signed URL Berumur Pendek (60 detik)
    const rawFileName = doc.file_path.split('/').pop() || `${doc.kode_arsip}.pdf`
    const cleanFileName = rawFileName.replace(/^\d+_/, '')

    const targetBucket = doc.bucket || 'arsip-aktif'
    const { data: signedData, error: signError } = await adminClient.storage
      .from(targetBucket)
      .createSignedUrl(doc.file_path, 60, {
        download: cleanFileName,
      })

    if (signError || !signedData?.signedUrl) {
      console.error('Error saat membuat signed URL:', signError)
      return NextResponse.json(
        { error: 'Gagal menerbitkan tautan unduh bertanda waktu dari tempat penyimpanan.' },
        { status: 500 }
      )
    }

    // 7. Catat Aktivitas Pengunduhan ke log_aktivitas
    try {
      await adminClient.from('log_aktivitas').insert({
        dokumen_id: doc.id,
        user_id: user.id,
        aksi: 'download',
        keterangan: `Mengunduh berkas fisik ${doc.kode_arsip} (${doc.judul}) melalui signed URL berumur 60 detik`,
      })
    } catch (logErr) {
      console.error('Gagal mencatat log_aktivitas pengunduhan:', logErr)
    }

    // 8. Respon: Redirect langsung atau kembalikan JSON jika diminta
    const wantsJson = request.nextUrl.searchParams.get('json') === 'true' ||
      request.headers.get('accept')?.includes('application/json')

    if (wantsJson) {
      return NextResponse.json({
        success: true,
        kode_arsip: doc.kode_arsip,
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

