/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { mensagemAssistente: { count: jest.fn() } } }))
import { prisma } from '@/lib/prisma'
import { esquemaPergunta, excedeuLimite, tituloDaPergunta } from './conversas'

it('tituloDaPergunta', () => {
  expect(tituloDaPergunta('  Qual o saldo do SMIT?  ')).toBe('Qual o saldo do SMIT?')
  const longa = 'Quais contratos da secretaria municipal de saúde vencem até dezembro deste ano e qual o saldo'
  const titulo = tituloDaPergunta(longa)
  expect(titulo.length).toBeLessThanOrEqual(61)
  expect(titulo.endsWith('…')).toBe(true)
  expect(longa.startsWith(titulo.slice(0, -1))).toBe(true)
})

it('esquemaPergunta: apara, exige texto e limita 2000', () => {
  expect(esquemaPergunta.parse({ pergunta: '  oi ' })).toEqual({ pergunta: 'oi' })
  expect(esquemaPergunta.safeParse({ pergunta: '   ' }).success).toBe(false)
  expect(esquemaPergunta.safeParse({ pergunta: 'x'.repeat(2001) }).success).toBe(false)
})

it('excedeuLimite conta perguntas do usuário na última hora', async () => {
  ;(prisma.mensagemAssistente.count as jest.Mock).mockResolvedValue(30)
  const agora = new Date('2026-09-23T15:00:00Z')
  expect(await excedeuLimite('u1', agora)).toBe(true)
  expect((prisma.mensagemAssistente.count as jest.Mock).mock.calls[0][0]).toEqual({
    where: { papel: 'usuario', createdAt: { gte: new Date('2026-09-23T14:00:00Z') }, conversa: { usuarioId: 'u1' },
      OR: [{ origem: null }, { origem: { not: 'direta' } }],
    },
  })
  ;(prisma.mensagemAssistente.count as jest.Mock).mockResolvedValue(29)
  expect(await excedeuLimite('u1', agora)).toBe(false)
})

it('limite conta só perguntas que foram à IA', async () => {
  ;(prisma.mensagemAssistente.count as jest.Mock).mockClear()
  ;(prisma.mensagemAssistente.count as jest.Mock).mockResolvedValue(0)
  await excedeuLimite('u1', new Date('2026-09-30T12:00:00Z'))
  expect((prisma.mensagemAssistente.count as jest.Mock).mock.calls[0][0].where).toEqual({
    papel: 'usuario', createdAt: { gte: new Date('2026-09-30T11:00:00Z') }, conversa: { usuarioId: 'u1' },
    OR: [{ origem: null }, { origem: { not: 'direta' } }],
  })
})
