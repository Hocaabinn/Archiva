import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateNextDocVoucher } from '@/lib/server-dokumen'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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

    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('id, nama, nama_lengkap, role, unit_id, unit:unit_organisasi(id, nama, kode_perusahaan)')
      .eq('id', user.id)
      .single()

    if (profError || !profile) {
      return NextResponse.json(
        { error: 'Profil pengguna tidak ditemukan.' },
        { status: 404 }
      )
    }

    // Hanya PIC Arsip Aktif yang berhak mengakses info entri
    if (profile.role !== 'pic_aktif') {
      return NextResponse.json(
        {
          error: `Akses Ditolak: Hanya PIC Arsip Aktif (pic_aktif) yang berhak mengentri dokumen baru. Peran akun Anda adalah '${profile.role}'.`,
        },
        { status: 403 }
      )
    }

    // Ambil unit organisasi PIC
    let unitData = profile.unit as unknown as { id: string; nama: string; kode_perusahaan: string } | null
    if (!unitData && profile.unit_id) {
      const { data: u } = await supabase
        .from('unit_organisasi')
        .select('id, nama, kode_perusahaan')
        .eq('id', profile.unit_id)
        .single()
      unitData = u
    }

    // Fallback bila unit belum diset di master
    if (!unitData) {
      const { data: defaultUnit } = await supabase
        .from('unit_organisasi')
        .select('id, nama, kode_perusahaan')
        .order('nama')
        .limit(1)
        .single()
      unitData = defaultUnit || { id: '', nama: 'Keuangan', kode_perusahaan: '2000' }
    }

    const nextDocVoucher = await generateNextDocVoucher()
    const currentYear = new Date().getFullYear().toString()

    return NextResponse.json({
      success: true,
      unit: unitData,
      nextDocVoucher,
      currentYear,
      user: {
        id: user.id,
        nama: profile.nama_lengkap || profile.nama || user.email,
        role: profile.role,
      },
    })
  } catch (err: unknown) {
    console.error('Error info-entri:', err)
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

