/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    contrato: { findUnique: jest.fn() },
    faturamento: { findUnique: jest.fn() },
    demanda: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn(async (_u: unknown, id: string) => id === 'c1') }))

import { prisma } from '@/lib/prisma'
import { descreverContexto, interpretarRota } from './contexto-pagina'

const usuario = { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' as const }

it('interpretarRota', () => {
  expect(interpretarRota('/clientes/c1')).toEqual({ clienteId: 'c1' })
  expect(interpretarRota('/clientes/c1/contratos/k1')).toEqual({ clienteId: 'c1', contratoId: 'k1' })
  expect(interpretarRota('/clientes/c1/faturamentos/f1')).toEqual({ clienteId: 'c1', faturamentoId: 'f1' })
  expect(interpretarRota('/clientes/c1/2026-08')).toEqual({ clienteId: 'c1' })
  expect(interpretarRota('/demandas/d1')).toEqual({ demandaId: 'd1' })
  expect(interpretarRota('/confere')).toEqual({})
})

it('descreve cliente e contrato com ids', async () => {
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ nome: 'SMIT' })
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ numeroTermo: '031/2023', clienteId: 'c1' })
  expect(await descreverContexto({ clienteId: 'c1', contratoId: 'k1' }, usuario)).toEqual({
    rotulo: 'SMIT › Contrato 031/2023',
    texto: 'Tela aberta pelo usuário: cliente SMIT (clienteId: c1); contrato 031/2023 (contratoId: k1). Quando a pergunta disser "este cliente", "este contrato" ou similar, é deste.',
  })
})

it('nada para cliente sem permissão ou rota sem contexto', async () => {
  expect(await descreverContexto({ clienteId: 'c9' }, usuario)).toBeNull()
  expect(await descreverContexto({}, usuario)).toBeNull()
})

it('demanda: usa o cliente dela para checar permissão', async () => {
  ;(prisma.demanda.findUnique as jest.Mock).mockResolvedValue({ assunto: 'Ofício 12', clienteId: 'c1', cliente: { nome: 'SMIT' } })
  expect((await descreverContexto({ demandaId: 'd1' }, usuario))?.rotulo).toBe('SMIT › Demanda Ofício 12')
})
