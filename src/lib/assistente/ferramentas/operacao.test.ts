/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    faturamento: { findMany: jest.fn(), aggregate: jest.fn() },
    demanda: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    solicitacao: { count: jest.fn(), findMany: jest.fn() },
    fornecedor: { findMany: jest.fn(), count: jest.fn() },
  },
}))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn(), podeVerCliente: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { clienteIdsPermitidos, podeVerCliente } from '@/lib/visibilidade'
import type { Ferramenta, ContextoFerramenta } from './comum'
import { demandas, faturamentos, filtroCompetencia, fornecedores, solicitacoes, tramitesDaDemanda } from './operacao'

const ctx: ContextoFerramenta = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' }, hoje: new Date('2026-09-23T12:00:00Z') }
const rodar = <E extends import('zod').ZodType>(f: Ferramenta<E>, entrada: unknown) => f.executar(f.entrada.parse(entrada), ctx)

beforeEach(() => {
  jest.clearAllMocks()
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['c1'])
  ;(podeVerCliente as jest.Mock).mockImplementation(async (_u, id) => id === 'c1')
})

it('filtroCompetencia monta o intervalo por ano/mês', () => {
  expect(filtroCompetencia('2026-03', '2026-08')).toEqual([
    { OR: [{ competenciaAno: { gt: 2026 } }, { competenciaAno: 2026, competenciaMes: { gte: 3 } }] },
    { OR: [{ competenciaAno: { lt: 2026 } }, { competenciaAno: 2026, competenciaMes: { lte: 8 } }] },
  ])
  expect(filtroCompetencia()).toEqual([])
})

describe('faturamentos', () => {
  it('não encontrado sem permissão', async () => {
    expect(await rodar(faturamentos, { clienteId: 'c9' })).toEqual({ erro: 'não encontrado' })
  })

  it('compacto: uma linha por faturamento, NFs resumidas', () => {
    const texto = faturamentos.compactar!({
      total: 1,
      valorTotalPeriodo: 'R$ 300,00',
      faturamentos: [{ competencia: '08/2026', contrato: '031/2023', valor: 'R$ 300,00', notasFiscais: [{ numero: '1' }, { numero: '2' }], totalNotas: 'R$ 300,00', href: '/x' }],
    })
    expect(texto).toBe('valor do período: R$ 300,00\nfaturamentos (total 1, mostrando 1):\ncompetencia|contrato|valor|notas\n08/2026|031/2023|R$ 300,00|2 NFs, R$ 300,00')
  })

  it('lista por competência com NFs e soma do período', async () => {
    ;(prisma.faturamento.aggregate as jest.Mock).mockResolvedValue({ _count: { _all: 1 }, _sum: { valor: '300' } })
    ;(prisma.faturamento.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'f1', competenciaAno: 2026, competenciaMes: 8, valor: '300', situacao: 'Faturado', sei: null, enviadoCliente: true, enviadoGfp: false,
        observacao: null, pdfNomeArquivo: 'NF.pdf', contrato: { numeroTermo: '031/2023' },
        notasFiscais: [{ numero: '123', servico: 'Rede', valor: '300', dataEmissao: new Date('2026-09-01T00:00:00Z') }],
      },
    ])
    expect(await rodar(faturamentos, { clienteId: 'c1' })).toEqual({
      total: 1,
      valorTotalPeriodo: 'R$ 300,00',
      faturamentos: [
        {
          id: 'f1', competencia: '08/2026', contrato: '031/2023', valor: 'R$ 300,00', situacao: 'Faturado', sei: null, enviadoCliente: true, enviadoGfp: false,
          observacao: null, pdf: 'NF.pdf',
          notasFiscais: [{ numero: '123', servico: 'Rede', valor: 'R$ 300,00', emissao: '01/09/2026' }],
          totalNotas: 'R$ 300,00',
          href: '/clientes/c1/faturamentos/f1',
        },
      ],
    })
  })
})

describe('demandas', () => {
  it('sem clienteId filtra pelos clientes liberados e busca em vários campos', async () => {
    ;(prisma.demanda.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.demanda.findMany as jest.Mock).mockResolvedValue([])
    await rodar(demandas, { busca: 'ofício' })
    const where = (prisma.demanda.findMany as jest.Mock).mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain('"clienteId":{"in":["c1"]}')
    expect(JSON.stringify(where)).toContain('"assunto":{"contains":"ofício","mode":"insensitive"}')
  })
})

describe('tramitesDaDemanda', () => {
  it('não encontrado quando a demanda é de outro cliente', async () => {
    ;(prisma.demanda.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c9', assunto: 'x', tramites: [] })
    expect(await rodar(tramitesDaDemanda, { demandaId: 'd1' })).toEqual({ erro: 'não encontrado' })
  })
})

describe('solicitacoes', () => {
  it('restringe aos clientes liberados', async () => {
    ;(prisma.solicitacao.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.solicitacao.findMany as jest.Mock).mockResolvedValue([])
    await rodar(solicitacoes, {})
    expect(JSON.stringify((prisma.solicitacao.findMany as jest.Mock).mock.calls[0][0].where)).toContain('"in":["c1"]')
  })
})

describe('fornecedores', () => {
  it('termos de confirmação só dos clientes liberados', async () => {
    ;(prisma.fornecedor.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.fornecedor.findMany as jest.Mock).mockResolvedValue([])
    await rodar(fornecedores, {})
    const select = (prisma.fornecedor.findMany as jest.Mock).mock.calls[0][0].select
    expect(select.termosConfirmacao.where).toEqual({ clienteId: { in: ['c1'] } })
  })

  it('total vem da contagem, não do tamanho da página (lista pode estar truncada pelo limite)', async () => {
    ;(prisma.fornecedor.count as jest.Mock).mockResolvedValue(25)
    ;(prisma.fornecedor.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        id: `f${i}`, razaoSocial: `Fornecedor ${i}`, cnpj: null, contato: null, acordo: null, numeroAcordo: null,
        dataAssinatura: null, sei: null, contratosOperacionalizacao: [], termosConfirmacao: [],
      })),
    )
    const resultado = (await rodar(fornecedores, {})) as { total: number; fornecedores: { id?: string }[] }
    expect(resultado.fornecedores[0].id).toBe('f0')
    expect(resultado.total).toBe(25)
    expect(resultado.fornecedores).toHaveLength(20)
  })
})
