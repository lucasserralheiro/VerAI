import type { MensagemConversa } from './tipos'

// Conversa colada ou exportada: WhatsApp ("dd/mm/aaaa hh:mm - Nome: msg") ou e-mail do Outlook ("De:/Enviado em:").

const WHATSAPP = /^(\d{2}\/\d{2}\/\d{2,4}),? (\d{1,2}:\d{2}) - ([^:]{1,60}): (.*)$/

export function lerConversa(texto: string): { formato: 'whatsapp' | 'email' | null; mensagens: MensagemConversa[] } {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n')
  if (linhas.filter((l) => WHATSAPP.test(l)).length >= 2) {
    const mensagens: MensagemConversa[] = []
    for (const l of linhas) {
      const m = WHATSAPP.exec(l)
      if (m) mensagens.push({ autor: m[3].trim(), quando: `${m[1]} ${m[2]}`, texto: m[4] })
      else if (mensagens.length && l.trim()) mensagens[mensagens.length - 1].texto += `\n${l}`
    }
    return { formato: 'whatsapp', mensagens }
  }
  const blocos = texto.replace(/\r\n/g, '\n').split(/\n(?=De: )/).filter((b) => /^De: /.test(b.trim()))
  if (blocos.length >= 1 && /\nEnviado em: /.test(texto)) {
    const mensagens = blocos.map((b) => {
      const [cab, ...resto] = b.trim().split(/\n\n/)
      const autor = /^De: (.*)$/m.exec(cab)?.[1].trim() ?? '?'
      const quando = /^Enviado em: (.*)$/m.exec(cab)?.[1].trim() ?? null
      return { autor, quando, texto: resto.join('\n\n').trim() }
    })
    return { formato: 'email', mensagens }
  }
  return { formato: null, mensagens: [] }
}
