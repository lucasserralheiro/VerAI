/** @jest-environment node */
jest.mock('@/lib/prisma', () => {
  const tx = (ops: unknown[]) => Promise.all(ops)
  return {
    prisma: {
      $transaction: jest.fn(tx),
      gerencia: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      carteiraCliente: { findMany: jest.fn(), count: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
      movimentoCarteira: { create: jest.fn(), findMany: jest.fn() },
      membroGerencia: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), delete: jest.fn() },
      cliente: { findMany: jest.fn() },
      usuario: { findMany: jest.fn() },
    },
  }
})
import { prisma } from '@/lib/prisma'
import { atualizarGerencia, criarGerencia, detalheGerencia, moverClientes, vinculosDoUsuario } from './servico'
import { ErroGerencia } from './tipos'
const p = prisma as unknown as Record<string, Record<string, jest.Mock>>
beforeEach(() => {
  jest.resetAllMocks()
  ;(prisma.$transaction as unknown as jest.Mock).mockImplementation((ops: unknown[]) => Promise.all(ops))
})

describe('moverClientes', () => {
  it('grava carteira e movimento só de quem muda de lugar', async () => {
    p.gerencia.findUnique.mockResolvedValue({ id: 'g2', ativa: true })
    p.carteiraCliente.findMany.mockResolvedValue([{ clienteId: 'c1', gerenciaId: 'g1' }, { clienteId: 'c2', gerenciaId: 'g2' }])
    await expect(moverClientes(['c1', 'c2', 'c3'], 'g2', 'u1')).resolves.toEqual({ movidos: 2 })
    expect(p.movimentoCarteira.create).toHaveBeenCalledWith({ data: { clienteId: 'c1', deGerenciaId: 'g1', paraGerenciaId: 'g2', porId: 'u1' } })
    expect(p.movimentoCarteira.create).toHaveBeenCalledWith({ data: { clienteId: 'c3', deGerenciaId: null, paraGerenciaId: 'g2', porId: 'u1' } })
    expect(p.movimentoCarteira.create).toHaveBeenCalledTimes(2)
  })
  it('para = null tira da carteira', async () => {
    p.carteiraCliente.findMany.mockResolvedValue([{ clienteId: 'c1', gerenciaId: 'g1' }])
    await moverClientes(['c1'], null, 'u1')
    expect(p.carteiraCliente.deleteMany).toHaveBeenCalledWith({ where: { clienteId: { in: ['c1'] } } })
  })
  it('recusa gerência desativada', async () => {
    p.gerencia.findUnique.mockResolvedValue({ id: 'g2', ativa: false })
    await expect(moverClientes(['c1'], 'g2', 'u1')).rejects.toThrow(new ErroGerencia('Gerência desativada não recebe clientes.', 409))
  })
})

describe('atualizarGerencia', () => {
  it('não desativa gerência com cliente', async () => {
    p.carteiraCliente.count.mockResolvedValue(3)
    await expect(atualizarGerencia('g1', { ativa: false })).rejects.toThrow('Tire os 3 clientes da carteira antes de desativar.')
  })
})

describe('criarGerencia', () => {
  it('traduz P2002 em 409', async () => {
    p.gerencia.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(criarGerencia({ nome: 'GSI' })).rejects.toMatchObject({
      message: 'Já existe gerência com esse nome ou sigla.',
      status: 409,
    })
  })
})

describe('detalheGerencia', () => {
  it('devolve null quando não existe', async () => {
    p.gerencia.findUnique.mockResolvedValue(null)
    await expect(detalheGerencia('x')).resolves.toBeNull()
  })
  it('resolve nomes de de/para/por e datas em ISO', async () => {
    p.gerencia.findUnique.mockResolvedValue({
      id: 'g1', nome: 'GSI', sigla: 'GSI', ativa: true,
      _count: { carteira: 1 },
      membros: [{ papel: 'manager', usuario: { id: 'u1', nome: 'Ana', email: 'a@x' } }],
    })
    p.carteiraCliente.findMany.mockResolvedValue([{ cliente: { id: 'c1', nome: 'Cli', siglaLegado: 'CL' } }])
    p.movimentoCarteira.findMany.mockResolvedValue([
      { id: 'm1', cliente: { nome: 'Cli' }, deGerenciaId: 'g0', paraGerenciaId: 'g1', porId: 'u1', em: new Date('2026-10-01T10:00:00Z') },
    ])
    p.gerencia.findMany.mockResolvedValue([{ id: 'g0', nome: 'Antiga' }, { id: 'g1', nome: 'GSI' }])
    p.usuario.findMany.mockResolvedValue([{ id: 'u1', nome: 'Ana' }])
    const d = await detalheGerencia('g1')
    expect(d).toMatchObject({
      id: 'g1', clientes: 1, managers: ['Ana'],
      carteira: [{ id: 'c1', nome: 'Cli', siglaLegado: 'CL' }],
      membros: [{ usuarioId: 'u1', nome: 'Ana', email: 'a@x', papel: 'manager' }],
      movimentos: [{ id: 'm1', cliente: 'Cli', de: 'Antiga', para: 'GSI', por: 'Ana', em: '2026-10-01T10:00:00.000Z' }],
    })
  })
})

describe('vinculosDoUsuario', () => {
  it('só gerências ativas, com nome e papel', async () => {
    p.membroGerencia.findMany.mockResolvedValue([{ gerenciaId: 'g1', papel: 'usuario', gerencia: { nome: 'GSI' } }])
    await expect(vinculosDoUsuario('u1')).resolves.toEqual([{ gerenciaId: 'g1', papel: 'usuario', nome: 'GSI' }])
    expect(p.membroGerencia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 'u1', gerencia: { ativa: true } } })
    )
  })
})
