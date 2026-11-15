import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const CONFIG_PATH = path.join(process.cwd(), 'src/config/system-settings.json')

function getSettings() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Gagal membaca system-settings.json:', err)
  }
  return {
    batas_lampiran_mb: 25,
    retensi_aktif_tahun: 3,
    updated_at: new Date().toISOString(),
  }
}

function saveSettings(settings: any) {
  try {
    const dir = path.dirname(CONFIG_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Gagal menulis system-settings.json:', err)
    return false
  }
}

/**
 * GET /api/pengaturan/sistem
 * Mengambil pengaturan sistem saat ini (khusus Superadmin)
 */
export async function GET() {
  try {
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Superadmin yang berhak mengakses pengaturan sistem.' },
        { status: 403 }
      )
    }

    const currentSettings = getSettings()

    return NextResponse.json({
      success: true,
      data: {
        batas_lampiran_mb: currentSettings.batas_lampiran_mb || 25,
        retensi_aktif_tahun: currentSettings.retensi_aktif_tahun || 3,
        updated_at: currentSettings.updated_at,
        smtp_status: 'Terkonfigurasi aman via Environment Variable (.env) server',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/pengaturan/sistem
 * Memperbarui pengaturan batas ukuran lampiran (khusus Superadmin)
 */
export async function POST(req: NextRequest) {
  try {
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
      .select('role, nama_lengkap')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Superadmin yang berhak mengubah pengaturan sistem.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { batas_lampiran_mb } = body

    const numLimit = parseInt(String(batas_lampiran_mb), 10)
    if (isNaN(numLimit) || numLimit < 1 || numLimit > 200) {
      return NextResponse.json(
        { error: 'Batas lampiran harus berupa bilangan bulat antara 1 MB hingga 200 MB.' },
        { status: 400 }
      )
    }

    const currentSettings = getSettings()
    currentSettings.batas_lampiran_mb = numLimit
    currentSettings.updated_at = new Date().toISOString()

    const saved = saveSettings(currentSettings)
    if (!saved) {
      return NextResponse.json({ error: 'Gagal menyimpan konfigurasi ke sistem.' }, { status: 500 })
    }

    // Catat log aktivitas sistem
    try {
      const admin = createAdminClient()
      await admin.from('log_aktivitas').insert({
        user_id: user.id,
        aksi: 'pengaturan_sistem',
        keterangan: `Superadmin (${profile.nama_lengkap || user.email}) memperbarui batas ukuran lampiran maksimal menjadi ${numLimit} MB.`,
      })
    } catch (logErr) {
      console.warn('Gagal mencatat log aktivitas pengaturan sistem:', logErr)
    }

    return NextResponse.json({
      success: true,
      data: currentSettings,
      message: `Batas ukuran lampiran berhasil diperbarui menjadi ${numLimit} MB.`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

