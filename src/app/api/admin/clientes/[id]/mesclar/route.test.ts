/** @jest-environment node */
jest.mock('@/lib/prisma', () => {
  const modelos = [
    'documento', 'analiseConsolidada', 'analiseEvolucao', 'contrato', 'faturamento', 'termoConfirmacao',
    'demanda', 'solicitacao', 'responsavelCliente', 'arquivoCliente', 'indiceDocumento', 'trechoDocumento',
    'movimentoCarteira',
  ]
  const prisma: Record<string, unknown> = {
    $transaction: jest.fn(() => Promise.resolve([])),
    cliente: {
      findUnique: jest.fn(),
      update: jest.fn((a: unknown) => ({ op: 'cliente.update', a })),
      delete: jest.fn((a: unknown) => ({ op: 'cliente.delete', a })),
    },
    carteiraCliente: { findUnique: jest.fn(), create: jest.fn((a: unknown) => ({ op: 'carteira.create', a })) },
  }
  for (const m of modelos) prisma[m] = { updateMany: jest.fn((a: unknown) => ({ op: `${m}.updateMany`, a })) }
  return { prisma }
})

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const p = prisma as unknown as Record<string, Record<string, jest.Mock>>

function chamar() {
  const req = new NextRequest('http://x/api/admin/clientes/o1/mesclar', {
    method: 'POST',
    body: JSON.stringify({ destinoClienteId: 'd1' }),
  })
  return POST(req, { params: Promise.resolve({ id: 'o1' }) })
}

function carteiras(origem: unknown, destino: unknown) {
  p.carteiraCliente.findUnique.mockImplementation(({ where }: { where: { clienteId: string } }) =>
    Promise.resolve(where.clienteId === 'o1' ? origem : destino)
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  p.cliente.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({ id: where.id, siglaLegado: null, usuariosPermitidos: [] })
  )
})

it('origem com carteira e destino sem: move os movimentos e cria a carteira do destino antes de apagar a origem', async () => {
  carteiras({ clienteId: 'o1', gerenciaId: 'g1' }, null)
  const res = await chamar()
  expect(res.status).toBe(200)
  const ops = (prisma.$transaction as jest.Mock).mock.calls[0][0] as { op: string; a: unknown }[]
  const nomes = ops.map((o) => o.op)
  expect(p.movimentoCarteira.updateMany).toHaveBeenCalledWith({ where: { clienteId: 'o1' }, data: { clienteId: 'd1' } })
  expect(p.carteiraCliente.create).toHaveBeenCalledWith({
    data: { clienteId: 'd1', gerenciaId: 'g1', movidoPorId: null },
  })
  expect(nomes.indexOf('movimentoCarteira.updateMany')).toBeLessThan(nomes.indexOf('cliente.delete'))
  expect(nomes.indexOf('carteira.create')).toBeGreaterThan(-1)
  expect(nomes.indexOf('carteira.create')).toBeLessThan(nomes.indexOf('cliente.delete'))
})

it('destino com carteira: mantém a dele', async () => {
  carteiras({ clienteId: 'o1', gerenciaId: 'g1' }, { clienteId: 'd1', gerenciaId: 'g2' })
  await chamar()
  expect(p.carteiraCliente.create).not.toHaveBeenCalled()
  expect(p.movimentoCarteira.updateMany).toHaveBeenCalled()
})
