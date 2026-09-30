/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { contrato: { findUnique: jest.fn() } } }))
jest.mock('@/lib/controles-contratos/consultas', () => ({ controleDoContrato: jest.fn(), listarControles: jest.fn() }))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn(), clienteIdsPermitidos: jest.fn() }))
jest.mock('@/lib/relatorios-clientes/contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))
import { prisma } from '@/lib/prisma'
import { controleDoContrato, listarControles } from '@/lib/controles-contratos/consultas'
import { clienteIdsPermitidos, podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { controleDoFaturamento } from './controles'

const ctx = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' as const }, hoje: new Date('2026-09-30T12:00:00Z') }
const rodar = (e: unknown) => controleDoFaturamento.executar(controleDoFaturamento.entrada.parse(e), ctx)
const controle = (extra = {}) => ({
  arquivoId: 'a1', mes: '2026-08', contratoTexto: 'TC 52/SMIT/2024', contratoId: 'k1', clienteId: 'c1', clienteNome: 'SMIT',
  previsto: '1000000.00', faturado: '400000.00', aFrente: { total: '50000.00', periodos: ['set/26'] }, saldoCalculado: '600000.00',
  percentual: 40, conferido: true, avisos: [], ...extra,
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ id: 'k1', clienteId: 'c1', numeroTermo: 'TC 52/SMIT/2024' })
  ;(podeVerCliente as jest.Mock).mockResolvedValue(true)
  ;(consolidarContratos as jest.Mock).mockResolvedValue(new Map([['k1', { saldo: { faturado: '390000', saldo: '610000', percentualFaturado: '39' } }]]))
})

it('controle × VerAI lado a lado, com a diferença e o que está à frente fora do faturado', async () => {
  ;(controleDoContrato as jest.Mock).mockResolvedValue({ controle: controle(), linhas: [] })
  expect(await rodar({ contratoId: 'k1' })).toEqual({
    contrato: 'TC 52/SMIT/2024', mesDoControle: 'ago/2026', conferido: true,
    controle: { previsto: 'R$ 1.000.000,00', faturadoAteOMes: 'R$ 400.000,00', saldo: 'R$ 600.000,00', percentual: '40%', lancadoAFrente: 'R$ 50.000,00 (set/26) — previsão, fora do faturado' },
    verai: { faturado: 'R$ 390.000,00', saldo: 'R$ 610.000,00', percentual: '39%' },
    diferencaFaturado: 'o controle tem R$ 10.000,00 a mais que o VerAI',
    avisos: [],
    pdf: 'arquivo da biblioteca a1',
  })
})

it('tabela não conferida: sem número do controle', async () => {
  ;(controleDoContrato as jest.Mock).mockResolvedValue({ controle: controle({ conferido: false, previsto: null, faturado: null, saldoCalculado: null, percentual: null, aFrente: null }), linhas: [] })
  const r = (await rodar({ contratoId: 'k1' })) as Record<string, unknown>
  expect(r.controle).toBe('leitura não conferida — confira no PDF')
  expect(r.diferencaFaturado).toBeUndefined()
})

it('sem permissão = não encontrado; sem controle = diz', async () => {
  ;(podeVerCliente as jest.Mock).mockResolvedValue(false)
  expect(await rodar({ contratoId: 'k1' })).toEqual({ erro: 'não encontrado' })
  ;(podeVerCliente as jest.Mock).mockResolvedValue(true)
  ;(controleDoContrato as jest.Mock).mockResolvedValue(null)
  expect(await rodar({ contratoId: 'k1' })).toEqual({ erro: 'nenhum controle do faturamento lido para este contrato' })
})

it('por cliente: controles do mês só dos clientes permitidos', async () => {
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['c1'])
  ;(listarControles as jest.Mock).mockResolvedValue({ meses: ['2026-08'], mes: '2026-08', controles: [controle(), controle({ clienteId: 'c2' })] })
  const r = (await rodar({ clienteId: 'c1' })) as { controles: unknown[] }
  expect(listarControles).toHaveBeenCalledWith({ mes: undefined, clienteIds: ['c1'] })
  expect(r.controles).toHaveLength(1)
})
