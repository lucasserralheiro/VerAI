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
