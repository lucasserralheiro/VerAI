import { lerConversa } from './conversa'

it('exportação do WhatsApp', () => {
  const r = lerConversa('01/10/2026 09:12 - Ana SMS: bom dia, o aditivo saiu?\n01/10/2026 09:15 - Lucas: sai até sexta\ncontinuação da mensagem\n02/10/2026 08:00 - Ana SMS: ok')
  expect(r.formato).toBe('whatsapp')
  expect(r.mensagens).toEqual([
    { autor: 'Ana SMS', quando: '01/10/2026 09:12', texto: 'bom dia, o aditivo saiu?' },
    { autor: 'Lucas', quando: '01/10/2026 09:15', texto: 'sai até sexta\ncontinuação da mensagem' },
    { autor: 'Ana SMS', quando: '02/10/2026 08:00', texto: 'ok' },
  ])
})

it('e-mail colado do Outlook (De:/Enviado em:/Assunto:)', () => {
  const r = lerConversa('De: Ana Souza\nEnviado em: quinta-feira, 1 de outubro de 2026 10:00\nPara: Lucas\nAssunto: Reajuste\n\nSolicito o reajuste.\n\nDe: Lucas\nEnviado em: quinta-feira, 1 de outubro de 2026 11:00\nAssunto: RE: Reajuste\n\nVou verificar.')
  expect(r.formato).toBe('email')
  expect(r.mensagens.map((m) => m.autor)).toEqual(['Ana Souza', 'Lucas'])
  expect(r.mensagens[0].texto).toBe('Solicito o reajuste.')
})

it('texto comum', () => {
  expect(lerConversa('Ata da reunião: ficou combinado o envio.')).toEqual({ formato: null, mensagens: [] })
})

it('WhatsApp iOS com colchetes e segundos', () => {
  const r = lerConversa('[01/10/2026, 09:12:33] Ana: oi\n[01/10/2026, 09:13:00] Lucas: olá')
  expect(r.formato).toBe('whatsapp')
  expect(r.mensagens).toEqual([
    { autor: 'Ana', quando: '01/10/2026 09:12:33', texto: 'oi' },
    { autor: 'Lucas', quando: '01/10/2026 09:13:00', texto: 'olá' },
  ])
})

it('WhatsApp com dia/mês de 1 dígito e ano de 2', () => {
  const r = lerConversa('1/10/26 09:12 - Ana: oi\n1/10/26 09:15 - Lucas: ok')
  expect(r.mensagens.map((m) => m.quando)).toEqual(['1/10/26 09:12', '1/10/26 09:15'])
})

it('WhatsApp 12h com AM/PM', () => {
  const r = lerConversa('10/1/26, 9:12 AM - Ana: hi\n10/1/26, 9:15 PM - Lucas: ok')
  expect(r.formato).toBe('whatsapp')
  expect(r.mensagens.map((m) => m.quando)).toEqual(['10/1/26 9:12 AM', '10/1/26 9:15 PM'])
})

it('e-mail em inglês (From/Sent/Subject)', () => {
  const r = lerConversa('From: Ana\nSent: Thursday, October 1, 2026 10:00 AM\nTo: Lucas\nSubject: Raise\n\nPlease raise.\n\nFrom: Lucas\nSent: Thursday, October 1, 2026 11:00 AM\nSubject: RE: Raise\n\nOk.')
  expect(r.formato).toBe('email')
  expect(r.mensagens.map((m) => m.autor)).toEqual(['Ana', 'Lucas'])
  expect(r.mensagens[1].texto).toBe('Ok.')
})

it('e-mail com "Enviado:"', () => {
  const r = lerConversa('De: Ana\nEnviado: 1 de outubro de 2026 10:00\nAssunto: X\n\nTexto.')
  expect(r.formato).toBe('email')
  expect(r.mensagens[0].quando).toBe('1 de outubro de 2026 10:00')
})

it('texto antes do primeiro De: vira mensagem "(texto colado)"', () => {
  const r = lerConversa('Segue minha resposta.\n\nDe: Ana\nEnviado em: 1 de outubro de 2026 10:00\nAssunto: X\n\nOriginal.')
  expect(r.formato).toBe('email')
  expect(r.mensagens.map((m) => m.autor)).toEqual(['(texto colado)', 'Ana'])
  expect(r.mensagens[0]).toEqual({ autor: '(texto colado)', quando: null, texto: 'Segue minha resposta.' })
})
