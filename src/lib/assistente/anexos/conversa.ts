import type { MensagemConversa } from './tipos'

// Conversa colada ou exportada: WhatsApp (Android "dd/mm/aaaa hh:mm - Nome: msg", iOS "[dd/mm/aaaa, hh:mm:ss] Nome: msg",
// dia/mês de 1 dígito, ano de 2, 12h com AM/PM) ou e-mail colado (Outlook em português ou inglês).

const WHATSAPP = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),? (\d{1,2}:\d{2}(?::\d{2})?(?: ?[AaPp]\.? ?[Mm]\.?)?)\]?(?: -|:)? ([^:]{1,60}): (.*)$/
const INICIO = /^(?:De|From): /
const DATA = /^(?:Enviado em|Enviado|Sent|Date|Data): (.*)$/m

export function lerConversa(texto: string): { formato: 'whatsapp' | 'email' | null; mensagens: MensagemConversa[] } {
  const bruto = texto.replace(/\r\n/g, '\n')
  const linhas = bruto.split('\n')
  if (linhas.filter((l) => WHATSAPP.test(l)).length >= 2) {
    const mensagens: MensagemConversa[] = []
    for (const l of linhas) {
      const m = WHATSAPP.exec(l)
      if (m) mensagens.push({ autor: m[3].trim(), quando: `${m[1]} ${m[2]}`, texto: m[4] })
      else if (mensagens.length && l.trim()) mensagens[mensagens.length - 1].texto += `\n${l}`
    }
    return { formato: 'whatsapp', mensagens }
  }
  if (DATA.test(bruto) && /^(?:De|From): /m.test(bruto)) {
    const mensagens: MensagemConversa[] = []
    for (const b of bruto.split(/\n(?=(?:De|From): )/)) {
      if (!INICIO.test(b.trim())) {
        // Resposta colada acima do histórico: não some.
        if (b.trim()) mensagens.push({ autor: '(texto colado)', quando: null, texto: b.trim() })
        continue
      }
      const [cab, ...resto] = b.trim().split(/\n\n/)
      const autor = /^(?:De|From): (.*)$/m.exec(cab)?.[1].trim() ?? '?'
      const quando = DATA.exec(cab)?.[1].trim() ?? null
      mensagens.push({ autor, quando, texto: resto.join('\n\n').trim() })
    }
    return { formato: 'email', mensagens }
  }
  return { formato: null, mensagens: [] }
}
