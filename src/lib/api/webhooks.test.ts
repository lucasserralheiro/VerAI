/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { assinar, verificarAssinatura } from './webhooks'

const agora = Date.UTC(2026, 9, 8, 12) // ms
const t = Math.floor(agora / 1000)

it('assinatura feita aqui é aceita do outro lado (mesmo segredo, mesmo corpo)', () => {
  const corpo = '{"tipo":"recursos.alterados"}'
  expect(verificarAssinatura('whsec_x', corpo, assinar('whsec_x', corpo, t), agora)).toBe(true)
})

it('recusa segredo errado, corpo alterado, cabeçalho ausente e assinatura velha (replay)', () => {
  const corpo = '{"a":1}'
  const cab = assinar('whsec_x', corpo, t)
  expect(verificarAssinatura('whsec_y', corpo, cab, agora)).toBe(false)
  expect(verificarAssinatura('whsec_x', '{"a":2}', cab, agora)).toBe(false)
  expect(verificarAssinatura('whsec_x', corpo, null, agora)).toBe(false)
  expect(verificarAssinatura('whsec_x', corpo, cab, agora + 10 * 60_000)).toBe(false)
})
