import { Resend } from 'resend'

export async function enviarEmail(destinatario: string, assunto: string, corpo: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const remetente = process.env.EMAIL_FROM

  if (!apiKey || !remetente) {
    console.log(`[email] RESEND_API_KEY/EMAIL_FROM não configurados, pulando envio para ${destinatario}`)
    return
  }

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: remetente,
    to: destinatario,
    subject: assunto,
    text: corpo,
  })
}
