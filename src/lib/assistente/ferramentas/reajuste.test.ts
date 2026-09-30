/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { contrato: { findUnique: jest.fn() }, reajusteExecucao: { findMany: jest.fn() } } }))
jest.mock('@/lib/reajuste/indice', () => ({ lerIndiceGravado: jest.fn() }))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn() }))
jest.mock('@/lib/relatorios-clientes/contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))
import { prisma } from '@/lib/prisma'
import { lerIndiceGravado } from '@/lib/reajuste/indice'
import { podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { indiceIpcFipe, reajustesCalculados, simularReajuste } from './reajuste'
import type { Ferramenta } from './comum'

const ctx = (role: 'admin' | 'responsavel' = 'responsavel') => ({ usuario: { id: 'u1', nome: 'U', email: 'u@x', role }, hoje: new Date('2026-09-30T12:00:00Z') })
const rodar = (f: Ferramenta, e: unknown, role?: 'admin' | 'responsavel') => f.executar(f.entrada.parse(e), ctx(role))
const meses = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']

beforeEach(() => {
  jest.clearAllMocks()
  ;(lerIndiceGravado as jest.Mock).mockResolvedValue({ meses: meses.map((mes) => ({ mes, variacao: '0.5' })), atualizadoEm: '2026-09-29T10:00:00.000Z' })
})

it('indiceIpcFipe: sem período = últimos 12 publicados, com acumulado', async () => {
  const r = (await rodar(indiceIpcFipe, {})) as Record<string, unknown>
  expect(r).toMatchObject({ periodo: '09/2025 a 08/2026', ultimoPublicado: '08/2026', acumulado: '6,17%', fator: '1,061678' })
  expect((r.meses as unknown[]).length).toBe(12)
})

it('indiceIpcFipe: mês sem índice não calcula e diz quais faltam', async () => {
  expect(await rodar(indiceIpcFipe, { mesInicial: '2026-06', mesFinal: '2026-09' })).toEqual({ erro: 'sem índice publicado para 09/2026 — o período não pode ser calculado' })
})

it('simularReajuste por valor: conta do código da tela de Reajuste; "1.500" é recusado', async () => {
  expect(await rodar(simularReajuste, { valor: 'R$ 250.000,00' })).toEqual({
    periodo: '09/2025 a 08/2026', valorOriginal: 'R$ 250.000,00', acumulado: '6,17%', fator: '1,061678',
    valorCorrigido: 'R$ 265.419,45', diferenca: 'R$ 15.419,45',
  })
  expect(await rodar(simularReajuste, { valor: '1.500' })).toEqual({ erro: 'valor ambíguo — use vírgula para decimais (ex.: 1.500,00)' })
})

it('simularReajuste por contrato: valor do consolidado; sem permissão = não encontrado; sem valor = erro', async () => {
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ id: 'k1', clienteId: 'c1', numeroTermo: 'TC 1/2025' })
  ;(podeVerCliente as jest.Mock).mockResolvedValue(false)
  expect(await rodar(simularReajuste, { contratoId: 'k1' })).toEqual({ erro: 'não encontrado' })
  ;(podeVerCliente as jest.Mock).mockResolvedValue(true)
  ;(consolidarContratos as jest.Mock).mockResolvedValue(new Map([['k1', { valorBase: null }]]))
  expect(await rodar(simularReajuste, { contratoId: 'k1' })).toEqual({ erro: 'contrato sem valor cadastrado — informe o valor' })
  ;(consolidarContratos as jest.Mock).mockResolvedValue(new Map([['k1', { valorBase: '100000' }]]))
  expect(await rodar(simularReajuste, { contratoId: 'k1' })).toMatchObject({ contrato: 'TC 1/2025', valorOriginal: 'R$ 100.000,00', valorCorrigido: 'R$ 106.167,78' })
})

it('reajustesCalculados: não-admin só vê os seus', async () => {
  ;(prisma.reajusteExecucao.findMany as jest.Mock).mockResolvedValue([])
  await rodar(reajustesCalculados, { mes: '2026-09' })
  expect((prisma.reajusteExecucao.findMany as jest.Mock).mock.calls[0][0].where).toEqual({
    usuarioId: 'u1', createdAt: { gte: new Date('2026-09-01T00:00:00.000Z'), lt: new Date('2026-10-01T00:00:00.000Z') },
  })
  await rodar(reajustesCalculados, {}, 'admin')
  expect((prisma.reajusteExecucao.findMany as jest.Mock).mock.calls[1][0].where).toEqual({})
})
