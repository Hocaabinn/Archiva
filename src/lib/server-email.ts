import nodemailer, { type Transporter } from 'nodemailer'

interface SendEmailParams {
  to: string
  subject: string
  text: string
  html?: string
}

/** Transporter singleton ter-cache untuk pengiriman surel */
let cachedTransporter: Transporter | null = null

async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) return cachedTransporter

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (host && user && pass) {
    // Gunakan konfigurasi SMTP live / environment jika ada
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
    console.log(`[Email] Configured custom SMTP: ${host}:${port} (${user})`)
    return cachedTransporter
  }

  // Fallback: Buat transporter Ethereal Email otomatis untuk testing & verifikasi pengiriman real
  try {
    const testAccount = await nodemailer.createTestAccount()
    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
    console.log(`[Email] Generated Ethereal Test SMTP: ${testAccount.user} (${testAccount.smtp.host}:${testAccount.smtp.port})`)
    return cachedTransporter
  } catch (err) {
    console.warn('[Email] Gagal membuat Ethereal account, fallback ke JSON/Mock transport:', err)
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true,
    })
    return cachedTransporter
  }
}

/**
 * Mengirim surel notifikasi resmi kedinasan Archiva
 * Mengembalikan informasi pengiriman surel termasuk messageId dan preview URL
 */
export async function kirimEmailNotifikasi(params: SendEmailParams): Promise<{
  success: boolean
  messageId?: string
  previewUrl?: string | false
  error?: string
}> {
  try {
    const transporter = await getTransporter()
    const fromAddress = process.env.SMTP_FROM || '"Sistem Informasi Arsip Dokumen Archiva" <notifikasi-arsip@instansi.co.id>'

    const info = await transporter.sendMail({
      from: fromAddress,
      to: params.to,
      subject: `[Archiva] ${params.subject}`,
      text: `${params.text}\n\n---\nSistem Informasi Arsip Dokumen (Archiva)\nPemberitahuan otomatis, mohon tidak membalas email ini.`,
      html: params.html || `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #CBD7E3; border-radius: 8px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #1E3A5F; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #1E3A5F; margin: 0; font-size: 20px;">ARCHIVA — Pemberitahuan Arsip Kedinasan</h2>
          </div>
          <h3 style="color: #111827; margin-top: 0;">${params.subject}</h3>
          <p style="color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-line;">${params.text}</p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0 16px;" />
          <p style="color: #64748B; font-size: 11px; margin: 0;">
            Surel ini diterbitkan secara otomatis oleh Sistem Informasi Arsip Dokumen sesuai SOP Retensi & Tata Kelola Dokumen.
          </p>
        </div>
      `,
    })

    const previewUrl = nodemailer.getTestMessageUrl(info)
    console.log(`[Email] Sukses kirim surel ke ${params.to} | MessageID: ${info.messageId}${previewUrl ? ` | Preview: ${previewUrl}` : ''}`)

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    }
  } catch (err: any) {
    console.error(`[Email] Gagal kirim surel ke ${params.to}:`, err?.message || err)
    return {
      success: false,
      error: err?.message || String(err),
    }
  }
}
