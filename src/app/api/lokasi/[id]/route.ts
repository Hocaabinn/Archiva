import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLokasiMetadataMap, saveLokasiMetadata, deleteLokasiMetadata } from '@/lib/server-lokasi'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/lokasi/[id]
 * Ubah data lokasi atau ubah status (Aktif/Nonaktif)
 * Khusus Superadmin
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
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
        { error: 'Akses Ditolak: Hanya Superadmin yang berhak mengubah Master Lokasi.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { nama, kode, status, parent_id } = body
    const admin = createAdminClient()

    // 1. Cek keberadaan lokasi
    const { data: currentLok, error: curErr } = await admin
      .from('lokasi')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (curErr || !currentLok) {
      return NextResponse.json({ error: 'Lokasi tidak ditemukan.' }, { status: 404 })
    }

    const metaMap = getLokasiMetadataMap()
    const currentMeta = metaMap[id] || {}

    const dbPayload: Record<string, any> = {}
    const metaPayload: Record<string, any> = {}

    if (nama !== undefined) {
      const cleanNama = nama.trim()
      if (!cleanNama) {
        return NextResponse.json({ error: 'Nama lokasi tidak boleh kosong.' }, { status: 400 })
      }
      dbPayload.nama = cleanNama
    }

    if (kode !== undefined) {
      const cleanKode = kode.trim().toUpperCase()
      dbPayload.kode = cleanKode
      metaPayload.kode = cleanKode
    }

    if (status !== undefined) {
      if (!['Aktif', 'Nonaktif'].includes(status)) {
        return NextResponse.json({ error: 'Status lokasi harus "Aktif" atau "Nonaktif".' }, { status: 400 })
      }
      dbPayload.status = status
      metaPayload.status = status
    }

    // Update parent jika ada perubahan induk (dan sesuaikan tingkat)
    if (parent_id !== undefined) {
      if (!parent_id || parent_id === 'root') {
        dbPayload.parent_id = null
        dbPayload.tingkat = 'Gedung'
      } else {
        const { data: pLok, error: pErr } = await admin
          .from('lokasi')
          .select('*')
          .eq('id', parent_id)
          .maybeSingle()

        if (pErr || !pLok) {
          return NextResponse.json({ error: 'Lokasi induk tidak valid.' }, { status: 400 })
        }
        if (pLok.id === id) {
          return NextResponse.json({ error: 'Lokasi tidak dapat menjadi induk bagi dirinya sendiri.' }, { status: 400 })
        }
        if (pLok.tingkat === 'Gedung') {
          dbPayload.tingkat = 'Ruangan'
          dbPayload.parent_id = pLok.id
        } else if (pLok.tingkat === 'Ruangan') {
          dbPayload.tingkat = 'Rak'
          dbPayload.parent_id = pLok.id
        } else {
          return NextResponse.json({ error: 'Tingkat Rak tidak dapat menjadi induk (Maksimal 3 tingkat).' }, { status: 400 })
        }
      }
    }

    let updatedRow = { ...currentLok }

    // 2. Eksekusi update pada kolom database jika ada kolom yang perlu diupdate
    // Filter payload yang didukung tabel (nama, tingkat, parent_id)
    const basePayload: Record<string, any> = {}
    if (dbPayload.nama !== undefined) basePayload.nama = dbPayload.nama
    if (dbPayload.tingkat !== undefined) basePayload.tingkat = dbPayload.tingkat
    if (dbPayload.parent_id !== undefined) basePayload.parent_id = dbPayload.parent_id

    // Coba update DB termasuk kode dan status jika kolom ada
    if (Object.keys(dbPayload).length > 0) {
      const { data: upData, error: upErr } = await admin
        .from('lokasi')
        .update(dbPayload)
        .eq('id', id)
        .select()

      if (upErr) {
        // Jika kolom kode/status belum ada di DB table, coba update kolom base
        if (Object.keys(basePayload).length > 0) {
          const { data: baseData, error: baseErr } = await admin
            .from('lokasi')
            .update(basePayload)
            .eq('id', id)
            .select()

          if (!baseErr && baseData && baseData.length > 0) {
            updatedRow = { ...updatedRow, ...baseData[0] }
          }
        }
      } else if (upData && upData.length > 0) {
        updatedRow = { ...updatedRow, ...upData[0] }
      }
    }

    // 3. Simpan metadata kode dan status ke persistence helper
    if (Object.keys(metaPayload).length > 0) {
      saveLokasiMetadata(id, metaPayload)
    }

    const finalMeta = getLokasiMetadataMap()[id] || {}
    const finalResult = {
      ...updatedRow,
      kode: updatedRow.kode || finalMeta.kode || currentMeta.kode || 'LOC',
      status: updatedRow.status || finalMeta.status || currentMeta.status || 'Aktif',
    }

    return NextResponse.json({
      success: true,
      message: `Lokasi "${finalResult.nama}" berhasil diperbarui.`,
      data: finalResult,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/lokasi/[id]
 * Hapus lokasi Master Lokasi secara permanen.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
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
        { error: 'Akses Ditolak: Hanya Superadmin yang berhak menghapus Master Lokasi.' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    // 1. Ambil data lokasi saat ini
    const { data: lok, error: lokErr } = await admin
      .from('lokasi')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (lokErr || !lok) {
      return NextResponse.json({ error: 'Lokasi tidak ditemukan.' }, { status: 404 })
    }

    // 2. Cek apakah ada lokasi anak (sub-lokasi)
    const { data: children, error: chErr } = await admin
      .from('lokasi')
      .select('id, nama, tingkat')
      .eq('parent_id', id)

    if (chErr) {
      return NextResponse.json({ error: chErr.message }, { status: 500 })
    }

    if (children && children.length > 0) {
      const childNames = children.map((c: any) => c.nama).join(', ')
      return NextResponse.json(
        {
          error: `Penghapusan Ditolak: Lokasi "${lok.nama}" (${lok.tingkat}) masih memiliki ${children.length} sub-lokasi di bawahnya (${childNames}). Hapus atau pindahkan sub-lokasi terlebih dahulu, atau gunakan opsi "Nonaktifkan".`,
        },
        { status: 400 }
      )
    }

    // 3. Cek apakah ada boks yang terikat pada rak_id ini (jika tingkat Rak)
    if (lok.tingkat === 'Rak') {
      const { data: boksItems, error: boksErr } = await admin
        .from('boks')
        .select('id, nomor_boks')
        .eq('rak_id', id)

      if (boksErr) {
        return NextResponse.json({ error: boksErr.message }, { status: 500 })
      }

      if (boksItems && boksItems.length > 0) {
        const boksNums = boksItems.map((b: any) => `Boks ${b.nomor_boks}`).join(', ')
        return NextResponse.json(
          {
            error: `Penghapusan Ditolak: Rak "${lok.nama}" masih memuat ${boksItems.length} boks arsip (${boksNums}). Pindahkan boks ke rak lain terlebih dahulu, atau pilih opsi "Nonaktifkan".`,
          },
          { status: 400 }
        )
      }
    }

    // 4. Cek apakah ada dokumen yang lokasi_saat_ini memuat nama lokasi ini
    const { data: relatedDocs, error: docErr } = await admin
      .from('dokumen')
      .select('id, kode_arsip, lokasi_saat_ini')
      .ilike('lokasi_saat_ini', `%${lok.nama}%`)
      .limit(5)

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 })
    }

    if (relatedDocs && relatedDocs.length > 0) {
      return NextResponse.json(
        {
          error: `Penghapusan Ditolak: Lokasi "${lok.nama}" masih tercatat digunakan pada ${relatedDocs.length} dokumen aktif/inaktif (contoh: ${relatedDocs[0].kode_arsip}). Gunakan opsi "Nonaktifkan" agar dokumen lama tetap utuh tanpa menampilkan lokasi ini di entri baru.`,
        },
        { status: 400 }
      )
    }

    // 5. Eksekusi hapus permanen
    const { error: delErr } = await admin.from('lokasi').delete().eq('id', id)
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    deleteLokasiMetadata(id)

    return NextResponse.json({
      success: true,
      message: `Lokasi "${lok.nama}" (${lok.tingkat}) berhasil dihapus permanen.`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
