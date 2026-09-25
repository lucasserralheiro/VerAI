/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findMany: jest.fn(), findUnique: jest.fn() },
    itemContrato: { count: jest.fn(), findMany: jest.fn() },
    indiceDocumento: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn(), podeVerCliente: jest.fn() }))
jest.mock('@/lib/relatorios-clientes/contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { clienteIdsPermitidos, podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import type { Ferramenta, ContextoFerramenta } from './comum'
import { buscarPorSei, contratosVencendo, detalheDoContrato, itensDoContrato } from './contratos'

const ctx: ContextoFerramenta = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' }, hoje: new Date('2026-09-23T12:00:00Z') }
const rodar = <E extends import('zod').ZodType>(f: Ferramenta<E>, entrada: unknown) => f.executar(f.entrada.parse(entrada), ctx)
const contrato = (id: string, over = {}) => ({
  id, clienteId: 'c1', numeroTermo: `0${id}/2023`, descricao: null, seiCliente: null, seiProdam: null, situacao: null,
  dataInicio: null, dataVencimento: null, vigente: null, linkSei: null, cliente: { nome: 'SMIT' }, ...over,
})
const consolidado = (over = {}) => ({
  vigenciaFim: new Date('2026-11-30T00:00:00Z'), vencimento: { nivel: 'atencao', dias: 68 }, rescindido: false, vazio: false, ativo: true,
  resumoHistorico: { aditivos: 1, prorrogacoes: 0, valorAtual: null, proposta: null, termo: null },
  valorBase: '100', saldo: { valorItens: '100', faturado: '0', saldo: '100', percentualFaturado: '0' }, ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['c1'])
  ;(podeVerCliente as jest.Mock).mockImplementation(async (_u, id) => id === 'c1')
  ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([])
})

describe('detalheDoContrato', () => {
  it('exige contratoId ou numero', () => {
    expect(() => detalheDoContrato.entrada.parse({})).toThrow()
  })

  it('restringe aos clientes liberados e devolve histórico com status de leitura do PDF', async () => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([
      {
        ...contrato('k1'),
        _count: { itens: 12 },
        historico: [
          {
            id: 'h1', tipo: 'ADITIVO', numero: 'TA 02', data: new Date('2024-05-01T00:00:00Z'), valor: '150.5', objeto: 'Reajuste', proposta: 'PA 7', situacao: null, dataInicio: null, dataVencimento: null, observacao: null,
            // PC/PA e TC/TA vêm do repositório (propostaArquivo/termoArquivo), não das colunas antigas propostaPdfNome/termoPdfNome (zeradas pela migração).
            propostaArquivo: null, termoArquivo: { id: 'a1', nome: 'TA_02.pdf' }, propostaDoSharepoint: false, termoDoSharepoint: true,
          },
        ],
      },
    ])
    ;(consolidarContratos as jest.Mock).mockResolvedValue(new Map([['k1', consolidado()]]))
    ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([{ origem: 'HISTORICO_TERMO', origemId: 'h1', status: 'sem_texto' }])

    const r = (await rodar(detalheDoContrato, { numero: '031' })) as { historico: unknown[]; itens: number; cliente: string }
    const where = (prisma.contrato.findMany as jest.Mock).mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain('"in":["c1"]')
    expect(r.cliente).toBe('SMIT')
    expect(r.itens).toBe(12)
    expect(r.historico).toEqual([
      { tipo: 'ADITIVO', numero: 'TA 02', assinadoEm: '01/05/2024', valor: 'R$ 150,50', objeto: 'Reajuste', proposta: 'PA 7', situacao: null, inicio: '—', vencimento: '—', observacao: null, pdfProposta: null, pdfTermo: { nome: 'TA_02.pdf', leitura: 'sem_texto' } },
    ])
  })

  it('mais de um contrato casando: devolve opções em vez de escolher', async () => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([contrato('k1'), contrato('k2')])
    expect(await rodar(detalheDoContrato, { numero: '0' })).toEqual({
      ambiguo: true,
      opcoes: [
        { id: 'k1', numero: '0k1/2023', cliente: 'SMIT' },
        { id: 'k2', numero: '0k2/2023', cliente: 'SMIT' },
      ],
    })
  })
})

describe('itensDoContrato', () => {
  it('não encontrado quando o contrato é de cliente sem permissão', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c9' })
    expect(await rodar(itensDoContrato, { contratoId: 'k9' })).toEqual({ erro: 'não encontrado' })
  })

  it('lista itens formatados com total', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
    ;(prisma.itemContrato.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.itemContrato.findMany as jest.Mock).mockResolvedValue([{ descricao: 'Link 100M', quantidade: '2', valorUnitario: '10', valorTotal: '20' }])
    expect(await rodar(itensDoContrato, { contratoId: 'k1' })).toEqual({
      total: 1,
      itens: [{ descricao: 'Link 100M', quantidade: '2', valorUnitario: 'R$ 10,00', valorTotal: 'R$ 20,00' }],
    })
  })
})

describe('contratosVencendo', () => {
  it('só vigência até a data, não vencidos, ordenados; rescindido e vazio fora', async () => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([contrato('a'), contrato('b'), contrato('c'), contrato('d')])
    ;(consolidarContratos as jest.Mock).mockResolvedValue(
      new Map([
        ['a', consolidado({ vigenciaFim: new Date('2026-12-15T00:00:00Z'), vencimento: { nivel: 'atencao', dias: 83 } })],
        ['b', consolidado({ vigenciaFim: new Date('2026-10-01T00:00:00Z'), vencimento: { nivel: 'critico', dias: 8 } })],
        ['c', consolidado({ vigenciaFim: new Date('2026-10-01T00:00:00Z'), vencimento: { nivel: 'critico', dias: 8 }, rescindido: true })],
        ['d', consolidado({ vigenciaFim: new Date('2026-01-01T00:00:00Z'), vencimento: { nivel: 'vencido', dias: -265 } })],
      ])
    )
    const r = (await rodar(contratosVencendo, { ate: '2026-12-31' })) as { total: number; contratos: { id: string }[] }
    expect(r.total).toBe(2)
    expect(r.contratos.map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('vence hoje (dias: 0) entra mesmo sem incluirVencidos, mesmo com vigenciaFim antes do timestamp de hoje', async () => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([contrato('a')])
    ;(consolidarContratos as jest.Mock).mockResolvedValue(
      new Map([['a', consolidado({ vigenciaFim: new Date('2026-09-23T00:00:00Z'), vencimento: { nivel: 'critico', dias: 0 } })]])
    )
    const r = (await rodar(contratosVencendo, { ate: '2026-09-23' })) as { total: number; contratos: { id: string }[] }
    expect(r.total).toBe(1)
    expect(r.contratos.map((c) => c.id)).toEqual(['a'])
  })

  it('já vencido (dias: -1) só entra com incluirVencidos', async () => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([contrato('a')])
    ;(consolidarContratos as jest.Mock).mockResolvedValue(
      new Map([['a', consolidado({ vigenciaFim: new Date('2026-09-22T00:00:00Z'), vencimento: { nivel: 'vencido', dias: -1 } })]])
    )
    const semIncluir = (await rodar(contratosVencendo, { ate: '2026-09-23' })) as { total: number }
    expect(semIncluir.total).toBe(0)
    const comIncluir = (await rodar(contratosVencendo, { ate: '2026-09-23', incluirVencidos: true })) as {
      total: number
      contratos: { id: string }[]
    }
    expect(comIncluir.total).toBe(1)
    expect(comIncluir.contratos.map((c) => c.id)).toEqual(['a'])
  })

  it('fronteira: dias igual ao limite (ate) entra', async () => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([contrato('a')])
    ;(consolidarContratos as jest.Mock).mockResolvedValue(
      new Map([['a', consolidado({ vigenciaFim: new Date('2026-10-23T00:00:00Z'), vencimento: { nivel: 'critico', dias: 30 } })]])
    )
    const r = (await rodar(contratosVencendo, { ate: '2026-10-23' })) as { total: number; contratos: { id: string }[] }
    expect(r.total).toBe(1)
    expect(r.contratos.map((c) => c.id)).toEqual(['a'])
  })
})

describe('buscarPorSei', () => {
  it('filtra por cliente DENTRO do SQL (antes do LIMIT) — não em JS depois de truncar', async () => {
    // Simula o que o Postgres devolveria já filtrado pela cláusula WHERE do sub-select: a linha do
    // cliente sem permissão (c9) nunca chega aqui — não é escondida depois em JS, como antes.
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { tipo: 'contrato', id: 'k1', clienteId: 'c1', rotulo: '031/2023', sei: '6018.2023/0001234-5' },
      { tipo: 'fornecedor', id: 'f1', clienteId: null, rotulo: 'ACME', sei: '6018202300012345' },
    ])
    const r = (await rodar(buscarPorSei, { numero: '6018.2023/0001234-5' })) as { total: number; ocorrencias: { tipo: string; href: string }[] }
    const sql = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    expect(sql.sql).toContain('"clienteId" IS NULL OR sub."clienteId" IN')
    expect(sql.values).toContain('c1')
    expect(sql.values).toContain('%6018202300012345%')
    expect(r.total).toBe(2)
    expect(r.ocorrencias.map((o) => o.tipo)).toEqual(['contrato', 'fornecedor'])
    expect(r.ocorrencias[0].href).toBe('/clientes/c1/contratos/k1')
  })

  it('admin (sem restrição de cliente): SQL não filtra por clienteId', async () => {
    ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(null)
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])
    await rodar(buscarPorSei, { numero: '601820230001234' })
    const sql = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    expect(sql.sql).not.toContain('"clienteId" IN')
  })
})
