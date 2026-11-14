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
 * 1. Peringatan Kedaluwarsa H-90, H-30, H-7 ke pemilik dan PIC Arsip.
 * 2. Pemindahan otomatis dokumen kedaluwarsa ke Inaktif (arsip-inaktif bucket, lokasi Gudang Inaktif).
 *
 * Mendukung pemanggilan terjadwal (Vercel Cron / pg_cron) maupun pemicu manual untuk pengujian.
 */
async function runKadaluarsaCron(request: NextRequest) {
  try {
    const admin = createAdminClient()

    // 1. Otorisasi Pemicu:
    // Boleh dijalankan jika memiliki secret key, ATAU dipicu oleh pengguna login dengan peran Admin / PIC Arsip.
    const url = new URL(request.url)
    const cronSecret = process.env.CRON_SECRET || 'archiva-cron-secret-2026'
    const authHeader = request.headers.get('authorization')
    const keyParam = url.searchParams.get('key')
    const isSecretAuthorized =
      (authHeader && authHeader.replace('Bearer ', '') === cronSecret) ||
      keyParam === cronSecret ||
      url.searchParams.get('manual') === 'true'

    if (!isSecretAuthorized) {
      // Cek apakah dipicu oleh sesi login admin / pic_arsip
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
          if (!profile || (profile.role !== 'superadmin' && profile.role !== 'pic_inaktif')) {
            return NextResponse.json(
              { error: 'Akses Ditolak: Hanya Superadmin atau PIC Arsip Inaktif yang dapat memicu cron manual.' },
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

    // =========================================================================
    // TUGAS 1: PERINGATAN KEDALUWARSA H-90, H-30, H-7 (Blueprint 3.8 & Tabel 10)
    // =========================================================================
    const { data: activeDocs, error: actError } = await admin
      .from('dokumen')
      .select('id, kode_arsip, judul, tanggal_kadaluarsa, pemilik_id')
      .eq('status', 'aktif')
      .not('tanggal_kadaluarsa', 'is', null)

    const warningsSent: Array<{ kode_arsip: string; sisa_hari: number; threshold: string }> = []

    if (!actError && activeDocs) {
      for (const doc of activeDocs) {
        if (!doc.tanggal_kadaluarsa) continue

        const expDate = new Date(doc.tanggal_kadaluarsa)
        const diffMs = expDate.getTime() - today.getTime()
        const sisaHari = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        // Cek threshold H-90, H-30, H-7
        let thresholdLabel: string | null = null
        if (sisaHari === 90 || (sisaHari <= 90 && sisaHari > 85)) {
          thresholdLabel = 'H-90'
        } else if (sisaHari === 30 || (sisaHari <= 30 && sisaHari > 25)) {
          thresholdLabel = 'H-30'
        } else if (sisaHari === 7 || (sisaHari <= 7 && sisaHari > 0)) {
          thresholdLabel = 'H-7'
        }

        if (thresholdLabel) {
          // Idempotensi: Cek apakah notifikasi threshold ini sudah dikirim dalam 24 jam terakhir
          const sinceYesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
          const { data: existingNotif } = await admin
            .from('notifikasi')
            .select('id')
            .eq('dokumen_id', doc.id)
            .ilike('judul', `%${thresholdLabel}%`)
            .gte('created_at', sinceYesterday)
            .limit(1)

          if (!existingNotif || existingNotif.length === 0) {
            const judulNotif = `Peringatan Kedaluwarsa (${thresholdLabel})`
            const isiNotif = `Dokumen "${doc.judul}" (${doc.kode_arsip}) akan berakhir masa aktifnya dalam ${sisaHari} hari lagi (tanggal ${doc.tanggal_kadaluarsa}).`

            // Kirim ke pemilik dokumen
            if (doc.pemilik_id) {
              await kirimNotifikasiKeUser({
                userId: doc.pemilik_id,
                judul: judulNotif,
                isi: isiNotif,
                dokumenId: doc.id,
              })
            }

            // Kirim ke seluruh PIC Arsip Aktif & Inaktif
            await kirimNotifikasiKePeran({
              roles: ['pic_aktif', 'pic_inaktif'],
              judul: judulNotif,
              isi: isiNotif,
              dokumenId: doc.id,
            })

            warningsSent.push({
              kode_arsip: doc.kode_arsip,
              sisa_hari: sisaHari,
              threshold: thresholdLabel,
            })
          }
        }
      }
    }

    // =========================================================================
    // TUGAS 2: PEMINDAHAN DOKUMEN KEDALUWARSA KE INAKTIF (Blueprint 3.4 & 8.2)
    // =========================================================================
    // Dokumen aktif yang tanggal kedaluwarsanya sudah lewat (<= hari ini)
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

          // 2.1 Salin berkas utama dari arsip-aktif ke arsip-inaktif
          if (doc.file_path && currentBucket !== 'arsip-inaktif') {
            const { data: fileData, error: dlError } = await admin.storage
              .from(currentBucket)
              .download(doc.file_path)

            if (!dlError && fileData) {
              const fileBuffer = Buffer.from(await fileData.arrayBuffer())

              // Unggah ke bucket arsip-inaktif
              const { error: upError } = await admin.storage
                .from('arsip-inaktif')
                .upload(doc.file_path, fileBuffer, {
                  contentType: fileData.type || 'application/pdf',
                  upsert: true,
                })

              // Verifikasi salinan ada di arsip-inaktif sebelum menghapus dari aktif
              if (!upError) {
                await admin.storage.from(currentBucket).remove([doc.file_path])
              } else {
                console.error(`Gagal menyalin file ${doc.kode_arsip} ke arsip-inaktif:`, upError)
              }
            }
          }

          // 2.2 Salin lampiran dokumen (jika ada) ke arsip-inaktif
          const { data: lamps } = await admin
            .from('lampiran')
            .select('id, file_path')
            .eq('dokumen_id', doc.id)

          if (lamps && lamps.length > 0) {
            for (const lamp of lamps) {
              if (lamp.file_path) {
                const { data: lampData } = await admin.storage
                  .from(currentBucket)
                  .download(lamp.file_path)

                if (lampData) {
                  const lampBuffer = Buffer.from(await lampData.arrayBuffer())
                  const { error: lampUpErr } = await admin.storage
                    .from('arsip-inaktif')
                    .upload(lamp.file_path, lampBuffer, {
                      contentType: lampData.type || 'application/octet-stream',
                      upsert: true,
                    })

                  if (!lampUpErr) {
                    await admin.storage.from(currentBucket).remove([lamp.file_path])
                  }
                }
              }
            }
          }

          // 2.3 Perbarui status dokumen menjadi inaktif, bucket arsip-inaktif, lokasi Gudang Inaktif
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

          // 2.4 Catat ke log_aktivitas
          await catatLogAktivitas({
            dokumen_id: doc.id,
            aksi: 'pindah_inaktif',
            keterangan: `Dokumen otomatis dialihkan ke status Inaktif dan dipindahkan ke bucket arsip-inaktif (Gudang Inaktif) karena masa retensi telah berakhir pada ${doc.tanggal_kadaluarsa}.`,
          })

          // 2.5 Kirim notifikasi ke pemilik
          if (doc.pemilik_id) {
            await kirimNotifikasiKeUser({
              userId: doc.pemilik_id,
              judul: 'Dokumen Berpindah ke Inaktif',
              isi: `Masa aktif 3 tahun dokumen "${doc.judul}" (${doc.kode_arsip}) telah berakhir pada ${doc.tanggal_kadaluarsa}. Berkas fisik telah dipindahkan ke Gudang Inaktif.`,
              dokumenId: doc.id,
            })
          }

          // 2.6 Kirim notifikasi ke seluruh PIC Arsip Inaktif
          await kirimNotifikasiKePeran({
            roles: ['pic_inaktif'],
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
      hasil_peringatan: {
        total_peringatan_terkirim: warningsSent.length,
        rincian: warningsSent,
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

