/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findMany: jest.fn() },
    historicoContrato: { findMany: jest.fn() },
    itemContrato: { groupBy: jest.fn() },
    notaFiscal: { groupBy: jest.fn() },
    usuario: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const get = (query: string) => new NextRequest(`http://localhost/api/relatorios/status-faturamento${query}`)
const cliente = { id: 'c1', nome: 'Saúde', siglaLegado: 'SMS' }

/** A rota lista os contratos e `consolidarContratos` volta ao banco pelas contagens (`_count`) para saber se
 *  o contrato está vazio — a mesma lista responde às duas consultas. */
function contratosNoBanco(lista: Array<Record<string, unknown>>) {
  ;(prisma.contrato.findMany as jest.Mock).mockImplementation(async (args?: { select?: { _count?: unknown } }) =>
    args?.select?._count ? lista.map((c) => ({ ...c, _count: { historico: 0, itens: 0, faturamentos: 0 } })) : lista
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  contratosNoBanco([])
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.itemContrato.groupBy as jest.Mock).mockResolvedValue([])
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])
  ;(prisma.notaFiscal.groupBy as jest.Mock).mockResolvedValue([])
})

describe('GET /api/relatorios/status-faturamento', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(get('?ano=2026&mes=8'))).status).toBe(401)
  })

  it.each(['', '?ano=2026', '?ano=2026&mes=13', '?ano=26&mes=8'])('400 com competência inválida (%s)', async (query) => {
    const resposta = await GET(get(query))
    expect(resposta.status).toBe(400)
    expect(prisma.contrato.findMany).not.toHaveBeenCalled()
  })

  it('não restringe clientes e filtra os faturamentos da competência', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    await GET(get('?ano=2026&mes=8'))
    const chamada = (prisma.contrato.findMany as jest.Mock).mock.calls[0][0]
    expect(chamada.where).toEqual({ cliente: {} })
    expect(chamada.select.faturamentos.where).toEqual({ competenciaAno: 2026, competenciaMes: 8 })
  })

  it('mantém ativos sem faturamento (faltou faturar), descarta encerrados sem faturamento e soma as notas', async () => {
    contratosNoBanco([
      { id: 'k1', numeroTermo: 'T1', descricao: null, situacao: 'Ativo', dataVencimento: null, cliente, faturamentos: [] },
      { id: 'k2', numeroTermo: 'T2', descricao: null, situacao: 'Finalizado', dataVencimento: null, cliente, faturamentos: [] },
      {
        id: 'k3',
        numeroTermo: 'T3',
        descricao: null,
        situacao: 'Finalizado',
        dataVencimento: null,
        cliente,
        faturamentos: [
          { id: 'f1', valor: null, situacao: null, sei: 'S1', complementar: false, enviadoCliente: true, enviadoGfp: false },
        ],
      },
    ])
    ;(prisma.notaFiscal.groupBy as jest.Mock).mockResolvedValue([
      { faturamentoId: 'f1', servico: 'Link', _sum: { valor: '100.50' } },
      { faturamentoId: 'f1', servico: 'Suporte', _sum: { valor: '9.50' } },
    ])

    const corpo = await (await GET(get('?ano=2026&mes=8'))).json()

    expect(corpo.map((linha: { id: string }) => linha.id)).toEqual(['k1', 'k3'])
    expect(corpo[0]).toEqual({ id: 'k1', numeroTermo: 'T1', descricao: null, cliente, faturamentos: [] })
    expect(corpo[1].faturamentos).toEqual([
      {
        id: 'f1',
        situacao: null,
        sei: 'S1',
        complementar: false,
        enviadoCliente: true,
        enviadoGfp: false,
        valorExibido: '110',
        semNota: false,
        cancelado: false,
      },
    ])
  })
})
