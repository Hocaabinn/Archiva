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
 * Handler Cron Harian untuk Siklus Hidup Dokumen:
 * Pemindahan otomatis dokumen kedaluwarsa ke Inaktif (arsip-inaktif bucket, lokasi Gudang Inaktif).
 *
 * Mendukung pemanggilan terjadwal (Vercel Cron / pg_cron) maupun pemicu manual untuk pengujian.
 */
async function runKadaluarsaCron(request: NextRequest) {
  try {
    const admin = createAdminClient()

    // 1. Otorisasi Pemicu:
    const url = new URL(request.url)
    const cronSecret = process.env.CRON_SECRET || 'archiva-cron-secret-2026'
    const authHeader = request.headers.get('authorization')
    const keyParam = url.searchParams.get('key')
    const isSecretAuthorized =
      (authHeader && authHeader.replace('Bearer ', '') === cronSecret) ||
      keyParam === cronSecret ||
      url.searchParams.get('manual') === 'true'

    if (!isSecretAuthorized) {
      try {
        const supabase = await createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          if (!profile || (profile.role !== 'admin' && profile.role !== 'pic_arsip')) {
            return NextResponse.json(
              { error: 'Akses Ditolak: Hanya Admin atau PIC Arsip yang dapat memicu cron manual.' },
              { status: 403 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Akses Ditolak: Kunci cron tidak valid atau Anda belum login.' },
            { status: 401 }
          )
        }
      } catch (authErr) {
        return NextResponse.json(
          { error: 'Akses Ditolak: Otorisasi cron gagal.' },
          { status: 401 }
        )
      }
    }

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10) // YYYY-MM-DD

    // PEMINDAHAN DOKUMEN KEDALUWARSA KE INAKTIF (Blueprint 3.4 & 8.2)
    const { data: expiredDocs, error: expError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, file_path, bucket, tanggal_kadaluarsa, pemilik_id')
      .eq('status', 'aktif')
      .lte('tanggal_kadaluarsa', todayStr)

    if (expError) {
      console.error('Error query dokumen kedaluwarsa:', expError)
      return NextResponse.json({ error: expError.message }, { status: 500 })
    }

    const movedDocs: string[] = []

    if (expiredDocs && expiredDocs.length > 0) {
      for (const doc of expiredDocs) {
        try {
          const currentBucket = doc.bucket || 'arsip-aktif'

          // Salin berkas utama dari arsip-aktif ke arsip-inaktif
          if (doc.file_path && currentBucket !== 'arsip-inaktif') {
            const { data: fileData, error: dlError } = await admin.storage
              .from(currentBucket)
              .download(doc.file_path)

            if (!dlError && fileData) {
              const fileBuffer = Buffer.from(await fileData.arrayBuffer())

              const { error: upError } = await admin.storage
                .from('arsip-inaktif')
                .upload(doc.file_path, fileBuffer, {
                  contentType: fileData.type || 'application/pdf',
                  upsert: true,
                })

              // Hapus dari arsip-aktif setelah salinan terverifikasi
              if (!upError) {
                await admin.storage.from(currentBucket).remove([doc.file_path])
              }
            }
          }

          // Perbarui status dokumen menjadi inaktif, bucket arsip-inaktif, lokasi Gudang Inaktif
          const { error: updateError } = await admin
            .from('dokumen')
            .update({
              status: 'inaktif',
              bucket: 'arsip-inaktif',
              lokasi_saat_ini: 'Gudang Inaktif',
              updated_at: new Date().toISOString(),
            })
            .eq('id', doc.id)

          if (updateError) {
            console.error(`Gagal update status dokumen ${doc.kode_arsip}:`, updateError)
            continue
          }

          // Catat ke log_aktivitas
          await catatLogAktivitas({
            dokumen_id: doc.id,
            aksi: 'pindah_inaktif',
            keterangan: `Dokumen otomatis dialihkan ke status Inaktif dan dipindahkan ke bucket arsip-inaktif (Gudang Inaktif) karena masa retensi telah berakhir pada ${doc.tanggal_kadaluarsa}.`,
          })

          // Kirim notifikasi ke pemilik
          if (doc.pemilik_id) {
            await kirimNotifikasiKeUser({
              userId: doc.pemilik_id,
              judul: 'Dokumen Berpindah ke Inaktif',
              isi: `Masa aktif 3 tahun dokumen "${doc.judul}" (${doc.kode_arsip}) telah berakhir pada ${doc.tanggal_kadaluarsa}. Berkas fisik telah dipindahkan ke Gudang Inaktif.`,
              dokumenId: doc.id,
            })
          }

          // Kirim notifikasi ke seluruh PIC Arsip
          await kirimNotifikasiKePeran({
            roles: ['pic_arsip'],
            judul: 'Dokumen Masuk Gudang Inaktif',
            isi: `Dokumen "${doc.judul}" (${doc.kode_arsip}) telah otomatis beralih ke status Inaktif dan tersimpan di Gudang Inaktif.`,
            dokumenId: doc.id,
          })

          movedDocs.push(doc.kode_arsip)
        } catch (itemErr) {
          console.error(`Error memproses dokumen ${doc.kode_arsip}:`, itemErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tanggal_pemrosesan: todayStr,
      hasil_perpindahan: {
        total_kedaluwarsa_ditemukan: expiredDocs ? expiredDocs.length : 0,
        total_berhasil_dipindahkan: movedDocs.length,
        daftar_dokumen_inaktif: movedDocs,
      },
    })
  } catch (err: unknown) {
    console.error('Error cron kadaluarsa:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return runKadaluarsaCron(request)
}

export async function POST(request: NextRequest) {
  return runKadaluarsaCron(request)
}
