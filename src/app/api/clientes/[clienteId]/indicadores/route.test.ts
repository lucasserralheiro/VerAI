/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    contrato: { findMany: jest.fn() },
    itemContrato: { groupBy: jest.fn() },
    historicoContrato: { findMany: jest.fn() },
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
const get = (clienteId = 'c1') =>
  GET(new NextRequest(`http://localhost/api/clientes/${clienteId}/indicadores`), {
    params: Promise.resolve({ clienteId }),
  })

const diasAPartirDeHoje = (dias: number) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ contratos: [], faturamentos: [], demandas: [] })
  // `consolidarContratos` volta ao banco pelas contagens (_count) para saber se o contrato é linha vazia.
  ;(prisma.contrato.findMany as jest.Mock).mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.map((id) => ({
      id,
      numeroTermo: `TC ${id}`,
      descricao: null,
      seiCliente: null,
      seiProdam: null,
      dataInicio: null,
      dataVencimento: null,
      _count: { historico: 0, itens: 0, faturamentos: 0 },
    }))
  )
  ;(prisma.itemContrato.groupBy as jest.Mock).mockResolvedValue([])
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.notaFiscal.groupBy as jest.Mock).mockResolvedValue([])
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])
})

describe('GET /api/clientes/[clienteId]/indicadores', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await get()).status).toBe(401)
  })

  it('403 sem acesso ao cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await get('c9')).status).toBe(403)
  })

  it('404 quando o cliente não existe', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await get()).status).toBe(404)
  })

  it('cliente sem nada: zeros e sem último mês', async () => {
    expect(await (await get()).json()).toEqual({
      contratosAtivos: 0,
      vencendoEm30Dias: 0,
      vencidos: 0,
      valorContratado: '0',
      contratosSemValor: 0,
      faturadoUltimoMes: null,
      demandasAbertas: 0,
      abertasHaMaisDe30Dias: 0,
    })
  })

  it('calcula os quatro indicadores', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
      contratos: [
        { id: 'k1', situacao: 'Ativo', dataVencimento: diasAPartirDeHoje(10) },
        { id: 'k2', situacao: 'Ativo', dataVencimento: diasAPartirDeHoje(200) },
        { id: 'k3', situacao: 'Finalizado', dataVencimento: diasAPartirDeHoje(5) },
        { id: 'k4', situacao: 'Ativo', dataVencimento: diasAPartirDeHoje(-3) },
      ],
      faturamentos: [
        { id: 'f1', competenciaAno: 2026, competenciaMes: 7, valor: '999' },
        { id: 'f2', competenciaAno: 2026, competenciaMes: 8, valor: null },
        { id: 'f3', competenciaAno: 2026, competenciaMes: 8, valor: '50.25' },
        { id: 'f4', competenciaAno: 20252, competenciaMes: 1, valor: '1' },
        { id: 'f5', competenciaAno: 2026, competenciaMes: 88, valor: '1' },
      ],
      demandas: [
        { situacao: 'Em andamento', dataAbertura: diasAPartirDeHoje(-45), createdAt: new Date() },
        { situacao: null, dataAbertura: null, createdAt: diasAPartirDeHoje(-2) },
        { situacao: 'Concluído', dataAbertura: diasAPartirDeHoje(-90), createdAt: new Date() },
      ],
    })
    ;(prisma.itemContrato.groupBy as jest.Mock).mockResolvedValue([
      { contratoId: 'k1', _sum: { valorTotal: '1000.10' } },
      { contratoId: 'k2', _sum: { valorTotal: '200' } },
    ])
    ;(prisma.notaFiscal.groupBy as jest.Mock).mockResolvedValue([
      { faturamentoId: 'f2', servico: null, _sum: { valor: '100.50' } },
    ])

    // k4 ("Ativo" com prazo vencido) segue ativo, com o aviso de situação desatualizada — e não entra em
    // "vencendo em 30 dias", que é quem ainda vai vencer (decisão do usuário, 23/09/2026).
    expect(await (await get()).json()).toEqual({
      contratosAtivos: 3,
      vencendoEm30Dias: 1,
      vencidos: 1,
      valorContratado: '1200.1',
      contratosSemValor: 1,
      faturadoUltimoMes: { ano: 2026, mes: 8, valor: '150.75', semValor: false },
      demandasAbertas: 2,
      abertasHaMaisDe30Dias: 1,
    })
    expect(prisma.itemContrato.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contratoId: { in: ['k1', 'k2', 'k3', 'k4'] } } })
    )
  })

  it('usa o valor atual do histórico e cai pros itens; conta quem não tem nenhum dos dois', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
      contratos: [
        { id: 'k1', situacao: 'Ativo', dataVencimento: diasAPartirDeHoje(100) },
        { id: 'k2', situacao: 'Ativo', dataVencimento: diasAPartirDeHoje(100) },
        { id: 'k3', situacao: 'Ativo', dataVencimento: diasAPartirDeHoje(100) },
      ],
      faturamentos: [],
      demandas: [],
    })
    const linha = (contratoId: string, tipo: string, dia: number, valor: string | null) => ({
      contratoId,
      tipo,
      data: new Date(2026, 0, dia),
      createdAt: new Date(2026, 0, dia),
      numero: null,
      proposta: null,
      valor,
      situacao: null,
      dataVencimento: null,
      propostaArquivo: null,
      termoArquivo: null,
      propostaDoSharepoint: false,
      termoDoSharepoint: false,
    })
    // k1: o aditivo (mais recente) vence o contrato original — cada linha guarda o total do momento.
    ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
      linha('k1', 'CONTRATO', 1, '1000'),
      linha('k1', 'ADITIVO', 2, '1500'),
    ])
    // k2: sem histórico, mas com itens. k3: nada.
    ;(prisma.itemContrato.groupBy as jest.Mock).mockResolvedValue([{ contratoId: 'k2', _sum: { valorTotal: '500' } }])

    const corpo = await (await get()).json()
    expect(corpo.contratosAtivos).toBe(3)
    expect(corpo.valorContratado).toBe('2000')
    expect(corpo.contratosSemValor).toBe(1)
  })
})
