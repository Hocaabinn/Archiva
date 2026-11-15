import { createAdminClient } from '@/lib/supabase/admin'
import { UserRole } from '@/types'
import { kirimEmailNotifikasi } from '@/lib/server-email'

export { validateKodeArsipSIG, extractSigTokens } from '@/lib/kode-arsip'

/**
 * Menerbitkan nomor Doc Voucher otomatis sistem (10 digit, diawali '19').
 * Mencari nomor voucher tertinggi yang ada di database, lalu menambahkan 1.
 * Format standar SIG: 1900000001 s.d. 1999999999.
 */
export async function generateNextDocVoucher(): Promise<string> {
  const admin = createAdminClient()
  
  // Ambil dokumen dengan nomor_dokumen 10 digit yang diawali '19'
  const { data: docs } = await admin
    .from('dokumen')
    .select('nomor_dokumen')
    .like('nomor_dokumen', '19%')
    .order('nomor_dokumen', { ascending: false })
    .limit(20)

  let highestNum = 1900000000
  if (docs && docs.length > 0) {
    for (const d of docs) {
      if (d.nomor_dokumen && /^\d{10}$/.test(d.nomor_dokumen)) {
        const parsed = parseInt(d.nomor_dokumen, 10)
        if (!isNaN(parsed) && parsed > highestNum) {
          highestNum = parsed
        }
      }
    }
  }

  let candidate = highestNum + 1

  // Pastikan kandidat unik terhadap nomor_dokumen maupun kode_arsip
  let candidateStr = String(candidate).padStart(10, '0')
  let isUnique = false
  let attempts = 0
  while (!isUnique && attempts < 100) {
    attempts++
    candidateStr = String(candidate).padStart(10, '0')
    const { data: existing } = await admin
      .from('dokumen')
      .select('id')
      .or(`nomor_dokumen.eq.${candidateStr},kode_arsip.ilike.%_${candidateStr}`)
      .limit(1)

    if (!existing || existing.length === 0) {
      isUnique = true
    } else {
      candidate++
    }
  }

  return candidateStr
}

/**
 * Mencatat log aktivitas ke tabel log_aktivitas
 */
export async function catatLogAktivitas(params: {
  dokumen_id?: string
  user_id?: string
  aksi: string
  keterangan: string
}) {
  try {
    const admin = createAdminClient()
    await admin.from('log_aktivitas').insert({
      dokumen_id: params.dokumen_id || null,
      user_id: params.user_id || null,
      aksi: params.aksi,
      keterangan: params.keterangan,
    })
  } catch (err) {
    console.error('Gagal mencatat log_aktivitas:', err)
  }
}

/**
 * Mengirim notifikasi ke satu pengguna melalui tabel notifikasi (dashboard) + surel (SMTP)
 * Sesuai BLUEPRINT 3.8 & Tabel 16: Kanal dashboard (selalu aktif) + surel.
 * Jika surel gagal terkirim, dashboard tetap tampil sukses tanpa menghentikan sistem.
 */
export async function kirimNotifikasiKeUser(params: {
  userId: string
  judul: string
  isi: string
  dokumenId?: string
}) {
  const admin = createAdminClient()

  // 1. Catat ke tabel notifikasi (Dashboard)
  try {
    await admin.rpc('kirim_notifikasi', {
      p_user_id: params.userId,
      p_judul: params.judul,
      p_isi: params.isi,
      p_dokumen_id: params.dokumenId || null,
    })
  } catch (err) {
    console.error('Gagal memanggil rpc kirim_notifikasi, fallback insert langsung:', err)
    try {
      await admin.from('notifikasi').insert({
        user_id: params.userId,
        judul: params.judul,
        isi: params.isi,
        dokumen_id: params.dokumenId || null,
        dibaca: false,
      })
    } catch (insertErr) {
      console.error('Gagal insert notifikasi:', insertErr)
    }
  }

  // 2. Kirim Surel (SMTP) ke email pengguna jika tersedia
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('email, nama_lengkap')
      .eq('id', params.userId)
      .maybeSingle()

    if (profile?.email) {
      await kirimEmailNotifikasi({
        to: profile.email,
        subject: params.judul,
        text: `Yth. ${profile.nama_lengkap || 'Bapak/Ibu'},\n\n${params.isi}`,
      })
    }
  } catch (emailErr) {
    // Sesuai BLUEPRINT 3.8: Dashboard tetap tampil walau surel gagal
    console.warn(`[Notifikasi] Surel gagal dikirim ke userId ${params.userId}, dashboard tetap aktif:`, emailErr)
  }
}

/**
 * Mengirim notifikasi ke semua pengguna dengan peran tertentu (misal: semua pic_arsip, atau semua atasan)
 */
export async function kirimNotifikasiKePeran(params: {
  roles: UserRole[]
  judul: string
  isi: string
  dokumenId?: string
}) {
  try {
    const admin = createAdminClient()
    const { data: users, error } = await admin
      .from('profiles')
      .select('id')
      .in('role', params.roles)

    if (error || !users || users.length === 0) {
      return
    }

    await Promise.all(
      users.map((u) =>
        kirimNotifikasiKeUser({
          userId: u.id,
          judul: params.judul,
          isi: params.isi,
          dokumenId: params.dokumenId,
        })
      )
    )
  } catch (err) {
    console.error('Gagal mengirim notifikasi ke peran:', err)
  }
}

