/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    contrato: { findUnique: jest.fn() },
    faturamento: { findUnique: jest.fn() },
    demanda: { findUnique: jest.fn() },
    documento: { findFirst: jest.fn() },
    propostaComercial: { findUnique: jest.fn() },
    confereExecucao: { findUnique: jest.fn() },
    fornecedor: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn(), documentosVisiveisWhere: jest.fn(async () => ({})) }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { GET } from './route'

const ir = (tipo: string, id: string) => GET(new NextRequest(`http://localhost/ir/${tipo}/${id}`), { params: Promise.resolve({ tipo, id }) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' })
  ;(podeVerCliente as jest.Mock).mockImplementation(async (_u, id) => id === 'c1')
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await ir('contrato', 'k1')).status).toBe(401)
})

it('redireciona cada tipo para a tela certa', async () => {
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.faturamento.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
  ;(prisma.demanda.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.documento.findFirst as jest.Mock).mockResolvedValue({ id: 'd1' })
  ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({ id: 'p1' })
  ;(prisma.confereExecucao.findUnique as jest.Mock).mockResolvedValue({ id: 'e1' })
  ;(prisma.fornecedor.findUnique as jest.Mock).mockResolvedValue({ id: 'f1' })
  const destino = async (tipo: string, id: string) => new URL((await ir(tipo, id)).headers.get('location')!).pathname
  expect(await destino('contrato', 'k1')).toBe('/clientes/c1/contratos/k1')
  expect(await destino('faturamento', 'f1')).toBe('/clientes/c1/faturamentos/f1')
  expect(await destino('cliente', 'c1')).toBe('/clientes/c1')
  expect(await destino('demanda', 'd1')).toBe('/demandas/d1')
  expect(await destino('documento', 'd1')).toBe('/documentos/d1')
  expect(await destino('proposta', 'p1')).toBe('/propostas-comerciais/p1')
  expect(await destino('confere', 'e1')).toBe('/confere/historico/e1')
  expect(await destino('fornecedor', 'f1')).toBe('/fornecedores/f1')
})

it('404 igual para inexistente, sem permissão e tipo desconhecido', async () => {
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ clienteId: 'c9' })
  const a = await ir('contrato', 'k0')
  const b = await ir('contrato', 'k9')
  const c = await ir('toString', 'u1')
  expect([a.status, b.status, c.status]).toEqual([404, 404, 404])
  expect(await a.json()).toEqual(await b.json())
})
