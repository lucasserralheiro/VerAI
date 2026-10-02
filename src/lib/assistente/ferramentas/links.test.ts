/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { contrato: { findUnique: jest.fn(), findMany: jest.fn() } } }))
jest.mock('@/lib/links-mpls/consultas', () => ({ linksDoContrato: jest.fn() }))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn() }))
import { prisma } from '@/lib/prisma'
import { linksDoContrato } from '@/lib/links-mpls/consultas'
import { podeVerCliente } from '@/lib/visibilidade'
import { linksMpls } from './links'

const ctx = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' as const }, hoje: new Date('2026-09-30T12:00:00Z') }
const rodar = (e: unknown) => linksMpls.executar(linksMpls.entrada.parse(e), ctx)
const rel = (extra = {}) => ({
  competencia: '2026-08', categoria: 'SOLUCAO', ativos: 120, cancelados: 3, conferido: true, avisos: [], entraram: 2, sairam: 1,
  entraramLinks: [{ codigo: 'A1' }, { codigo: 'A2' }], sairamLinks: [{ codigo: 'B9' }], arquivoId: 'x', ...extra,
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(podeVerCliente as jest.Mock).mockResolvedValue(true)
})

it('por contrato: ativos, entraram e saíram por categoria; sem prova fica fora das contas', async () => {
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ id: 'k1', clienteId: 'c1', numeroTermo: 'TC 9/SMS/2024' })
  ;(linksDoContrato as jest.Mock).mockResolvedValue({ competencia: '2026-08', relatorios: [rel(), rel({ categoria: 'SOCIAL', conferido: false, ativos: null, entraram: null, sairam: null, entraramLinks: [], sairamLinks: [] })] })
  expect(await rodar({ contratoId: 'k1' })).toEqual({
    competencia: 'ago/2026',
    contratos: [
      {
        contrato: 'TC 9/SMS/2024',
        competencia: 'ago/2026',
        relatorios: [
          { categoria: 'Solução', ativos: 120, entraram: 'A1, A2', sairam: 'B9' },
          { categoria: 'Social', leitura: 'sem prova — fora das contas; confira no PDF' },
        ],
      },
    ],
    totalAtivosConferidos: 120,
  })
})

it('por cliente: soma os contratos do cliente; sem permissão = não encontrado', async () => {
  ;(podeVerCliente as jest.Mock).mockResolvedValue(false)
  expect(await rodar({ clienteId: 'c9' })).toEqual({ erro: 'não encontrado' })
  ;(podeVerCliente as jest.Mock).mockResolvedValue(true)
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([{ id: 'k1', numeroTermo: 'TC 9/SMS/2024' }, { id: 'k2', numeroTermo: 'TC 10/SMS/2024' }])
  ;(linksDoContrato as jest.Mock).mockResolvedValueOnce({ competencia: '2026-08', relatorios: [rel()] }).mockResolvedValueOnce({ competencia: null, relatorios: [] })
  const r = (await rodar({ clienteId: 'c1' })) as { contratos: unknown[]; totalAtivosConferidos: number }
  expect(r.contratos).toHaveLength(1)
  expect(r.totalAtivosConferidos).toBe(120)
})

it('por cliente com contratos em meses diferentes: cada item traz o seu mês e não há total somado', async () => {
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([{ id: 'k1', numeroTermo: 'TC 9/SMS/2024' }, { id: 'k2', numeroTermo: 'TC 10/SMS/2024' }])
  ;(linksDoContrato as jest.Mock)
    .mockResolvedValueOnce({ competencia: '2026-08', relatorios: [rel()] })
    .mockResolvedValueOnce({ competencia: '2026-07', relatorios: [rel({ competencia: '2026-07' })] })
  const r = (await rodar({ clienteId: 'c1' })) as { contratos: { competencia: string }[]; totalAtivosConferidos?: number; aviso?: string }
  expect(r.contratos.map((c) => c.competencia)).toEqual(['ago/2026', 'jul/2026'])
  expect(r.totalAtivosConferidos).toBeUndefined()
  expect(r.aviso).toBe('contratos em meses diferentes — sem total')
})

it('por cliente, mesmo mês: total somado e sem aviso', async () => {
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([{ id: 'k1', numeroTermo: 'A' }, { id: 'k2', numeroTermo: 'B' }])
  ;(linksDoContrato as jest.Mock).mockResolvedValue({ competencia: '2026-08', relatorios: [rel()] })
  const r = (await rodar({ clienteId: 'c1' })) as { totalAtivosConferidos?: number; aviso?: string }
  expect(r.totalAtivosConferidos).toBe(240)
  expect(r.aviso).toBeUndefined()
})

it('competência pedida que o contrato não tem: sai com aviso e sem números', async () => {
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([{ id: 'k1', numeroTermo: 'A' }, { id: 'k2', numeroTermo: 'B' }])
  ;(linksDoContrato as jest.Mock)
    .mockResolvedValueOnce({ competencia: '2026-08', relatorios: [rel()] })
    .mockResolvedValueOnce({ competencia: '2026-07', relatorios: [rel({ competencia: '2026-07' })] })
  const r = (await rodar({ clienteId: 'c1', competencia: '2026-08' })) as { contratos: Record<string, unknown>[]; totalAtivosConferidos?: number }
  expect(r.contratos[1]).toEqual({ contrato: 'B', competencia: 'jul/2026', aviso: 'sem relatório em ago/2026' })
  expect(r.totalAtivosConferidos).toBe(120)
})
