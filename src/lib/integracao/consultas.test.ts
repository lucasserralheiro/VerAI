/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: { contrato: { findMany: jest.fn() }, cliente: { findMany: jest.fn(), findUniqueOrThrow: jest.fn() } },
}))
jest.mock('@/lib/relatorios-clientes/contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))
jest.mock('@/lib/relatorios-clientes/alertas-banco', () => ({ alertasDosContratos: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { alertasDosContratos } from '@/lib/relatorios-clientes/alertas-banco'
import { buscarClientePorSigla, diaIso, localizarContratos } from './consultas'

const hoje = new Date('2026-10-07T15:00:00Z')

const contrato = (id: string, sigla: string, numeroTermo: string, chaveSharepoint: string | null = null) => ({
  id,
  clienteId: `cli-${sigla}`,
  numeroTermo,
  chaveSharepoint,
  descricao: null,
  situacao: 'Ativo',
  seiProdam: null,
  seiCliente: null,
  dataVencimento: null,
  cliente: { nome: `Cliente ${sigla}`, siglaLegado: sigla },
})

const consolidado = {
  vigenciaFim: new Date('2027-04-30T03:00:00Z'),
  vencimento: { nivel: 'ok', dias: 205 },
  rescindido: false,
  vazio: false,
  ativo: true,
  situacaoDesatualizada: false,
  prorrogacaoEmAndamento: true,
  resumoHistorico: {},
  valorBase: '1000.00',
  saldo: { valorItens: '1000.00', faturado: '250.00', saldo: '750.00', percentualFaturado: '25.00' },
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(consolidarContratos as jest.Mock).mockImplementation(async (lista: { id: string }[]) => new Map(lista.map((c) => [c.id, consolidado])))
  ;(alertasDosContratos as jest.Mock).mockResolvedValue([])
})

describe('localizarContratos', () => {
  beforeEach(() => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([
      contrato('k-sgm', 'SGM', 'TC 17/SGM/2025', 'SGM|17 2025'),
      contrato('k-siurb', 'SIURB', 'TC 24/SIURB/2025', 'SIURB|24 2025'),
      contrato('k-regula', 'SP REGULA', 'TC 03/SP-REGULA/2022', 'SP-REGULA|3 2022'),
      contrato('k-a', 'SMS', 'TC 5/SMS/2024', 'SMS|5 2024'),
      contrato('k-b', 'SMS', 'TC 05/SMS/2024 (cópia)', 'SMS|5 2024'),
    ])
  })

  it('usa a sigla do cliente quando o número não traz o órgão ("17/2025-SGM")', async () => {
    const [r] = await localizarContratos([{ numero: '17/2025-SGM', cliente: 'SGM' }], hoje)
    expect(r).toMatchObject({ resultado: 'encontrado', contrato: { id: 'k-sgm', cliente: { sigla: 'SGM' } } })
  })

  it('aceita ano com 2 dígitos e órgão com hífen', async () => {
    const r = await localizarContratos([{ numero: '024/SIURB/25' }, { numero: '03/SP-REGULA/2022' }], hoje)
    expect(r.map((x) => x.resultado)).toEqual(['encontrado', 'encontrado'])
  })

  it('devolve os números do consolidado (string decimal, dia ISO, avisos)', async () => {
    const [r] = await localizarContratos([{ numero: '024/SIURB/25' }], hoje)
    expect(r).toMatchObject({
      contrato: { valorContratado: '1000.00', faturado: '250.00', saldo: '750.00', vigenciaFim: '2027-04-30', avisos: ['prorrogacaoEmAndamento'] },
    })
  })

  it('nunca escolhe entre dois candidatos', async () => {
    const [r] = await localizarContratos([{ numero: '5/SMS/2024' }], hoje)
    expect(r).toMatchObject({ resultado: 'ambiguo' })
    expect(r.resultado === 'ambiguo' && r.candidatos.map((c) => c.id)).toEqual(['k-a', 'k-b'])
  })

  it('número que não se lê vira "ilegivel"; inexistente, "nenhum"', async () => {
    const r = await localizarContratos([{ numero: 'sem número' }, { numero: '999/SGM/2020' }], hoje)
    expect(r.map((x) => x.resultado)).toEqual(['ilegivel', 'nenhum'])
  })
})

describe('buscarClientePorSigla', () => {
  it('sigla que casa com dois clientes é ambígua', async () => {
    ;(prisma.cliente.findMany as jest.Mock).mockResolvedValue([
      { id: 'a', nome: 'SP Regula', siglaLegado: 'SP-REGULA' },
      { id: 'b', nome: 'Outro', siglaLegado: 'SP REGULA' },
    ])
    expect(await buscarClientePorSigla('spregula', hoje)).toMatchObject({ tipo: 'ambiguo' })
  })

  it('sem cliente', async () => {
    ;(prisma.cliente.findMany as jest.Mock).mockResolvedValue([{ id: 'a', nome: 'SMS', siglaLegado: 'SMS' }])
    expect(await buscarClientePorSigla('SF', hoje)).toEqual({ tipo: 'nenhum' })
  })

  it('cliente achado traz contratos consolidados e totais', async () => {
    ;(prisma.cliente.findMany as jest.Mock).mockResolvedValue([{ id: 'c1', nome: 'Secretaria do Governo', siglaLegado: 'SGM' }])
    ;(prisma.cliente.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'c1',
      nome: 'Secretaria do Governo',
      siglaLegado: 'SGM',
      carteira: { gerencia: { nome: 'KAM-4', sigla: 'KAM-4' } },
      contratos: [{ id: 'k1', clienteId: 'c1', numeroTermo: 'TC 17/SGM/2025', descricao: null, situacao: 'Ativo', seiProdam: null, seiCliente: null, dataVencimento: null }],
    })
    const r = await buscarClientePorSigla('sgm', hoje)
    expect(r).toMatchObject({
      tipo: 'encontrado',
      cliente: { carteira: { chave: 'KAM4' }, contratos: [{ id: 'k1', ativo: true }], totais: { contratosAtivos: 1, valorContratado: '1000' } },
    })
  })
})

it('diaIso acerta as duas convenções de data só-dia', () => {
  expect(diaIso(new Date('2026-04-30T00:00:00Z'))).toBe('2026-04-30')
  expect(diaIso(new Date('2026-04-30T03:00:00Z'))).toBe('2026-04-30')
  expect(diaIso(null)).toBeNull()
})
