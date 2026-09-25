/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    propostaComercial: { findMany: jest.fn(), count: jest.fn() },
    documento: { findMany: jest.fn() },
    analiseConsolidada: { findMany: jest.fn() },
    confereExecucao: { findMany: jest.fn(), count: jest.fn() },
  },
}))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn(), podeVerCliente: jest.fn(), documentosVisiveisWhere: jest.fn(async () => ({ uploadedById: 'u' })) }))
jest.mock('@/lib/assistente/busca', () => ({ buscarTrechos: jest.fn() }))
jest.mock('@/lib/assistente/indexacao/sincronizar', () => ({ sincronizarIndice: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { buscarTrechos } from '@/lib/assistente/busca'
import { sincronizarIndice } from '@/lib/assistente/indexacao/sincronizar'
import type { Ferramenta, ContextoFerramenta } from './comum'
import { analisesDeDocumentos, buscarNosDocumentos, execucoesConfere, hrefDoTrecho, linkDoTrecho } from './conteudo'

const ctx: ContextoFerramenta = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' }, hoje: new Date('2026-09-23T12:00:00Z') }
const rodar = <E extends import('zod').ZodType>(f: Ferramenta<E>, entrada: unknown) => f.executar(f.entrada.parse(entrada), ctx)

beforeEach(() => {
  jest.clearAllMocks()
  ;(podeVerCliente as jest.Mock).mockImplementation(async (_u, id) => id === 'c1')
})

describe('buscarNosDocumentos', () => {
  it('com cliente: sincroniza sob demanda (sem HEAD, poucos arquivos) antes de buscar', async () => {
    ;(buscarTrechos as jest.Mock).mockResolvedValue([
      { origem: 'HISTORICO_TERMO', origemId: 'h1', clienteId: 'c1', contratoId: 'k1', nomeArquivo: 'TA_02.pdf', pagina: 3, texto: 'reajuste pelo IPCA' },
    ])
    const r = await rodar(buscarNosDocumentos, { consulta: 'reajuste', clienteId: 'c1' })
    expect(sincronizarIndice).toHaveBeenCalledWith({ clienteId: 'c1', limite: 2 })
    expect(buscarTrechos).toHaveBeenCalledWith({ consulta: 'reajuste', clienteId: 'c1', contratoId: undefined }, ctx.usuario)
    expect(r).toEqual({
      total: 1,
      trechos: [{ arquivo: 'TA_02.pdf', pagina: 3, origem: 'HISTORICO_TERMO', citacao: 'reajuste pelo IPCA', link: 'contrato:k1', href: '/clientes/c1/contratos/k1' }],
    })
    expect(buscarNosDocumentos.compactar!(r)).toBe('trechos (total 1):\n[TA_02.pdf, p. 3] contrato:k1\n"reajuste pelo IPCA"')
  })

  it('cliente sem permissão: não encontrado, sem buscar', async () => {
    expect(await rodar(buscarNosDocumentos, { consulta: 'xy', clienteId: 'c9' })).toEqual({ erro: 'não encontrado' })
    expect(buscarTrechos).not.toHaveBeenCalled()
  })

  it('falha na sincronização sob demanda não impede a busca', async () => {
    ;(sincronizarIndice as jest.Mock).mockRejectedValueOnce(new Error('blob fora'))
    ;(buscarTrechos as jest.Mock).mockResolvedValue([])
    expect(await rodar(buscarNosDocumentos, { consulta: 'xy', clienteId: 'c1' })).toEqual({ total: 0, trechos: [], aviso: expect.any(String) })
  })
})

it('hrefDoTrecho aponta para a tela de origem', () => {
  const base = { clienteId: 'c1', contratoId: 'k1', nomeArquivo: 'a', pagina: null, texto: '' }
  expect(hrefDoTrecho({ ...base, origem: 'FATURAMENTO_PDF', origemId: 'f1' })).toBe('/clientes/c1/faturamentos/f1')
  expect(hrefDoTrecho({ ...base, origem: 'DOCUMENTO', origemId: 'd1' })).toBe('/documentos/d1')
  expect(hrefDoTrecho({ ...base, origem: 'PROPOSTA_COMERCIAL_ARQUIVO', origemId: 'p1', clienteId: null })).toBe('/propostas-comerciais')
})

it('linkDoTrecho: tipo:id que a IA cita', () => {
  const base = { clienteId: 'c1', contratoId: 'k1', nomeArquivo: 'a', pagina: null, texto: '' }
  expect(linkDoTrecho({ ...base, origem: 'HISTORICO_TERMO', origemId: 'h1' })).toBe('contrato:k1')
  expect(linkDoTrecho({ ...base, origem: 'HISTORICO_PROPOSTA', origemId: 'h1', contratoId: null })).toBe('cliente:c1')
  expect(linkDoTrecho({ ...base, origem: 'FATURAMENTO_PDF', origemId: 'f1' })).toBe('faturamento:f1')
  expect(linkDoTrecho({ ...base, origem: 'DOCUMENTO', origemId: 'd1' })).toBe('documento:d1')
  expect(linkDoTrecho({ ...base, origem: 'PROPOSTA_COMERCIAL_ARQUIVO', origemId: 'p1', clienteId: null })).toBeNull()
  expect(linkDoTrecho({ ...base, origem: 'ARQUIVO_CLIENTE', origemId: 'a1', clienteId: 'c3', contratoId: null })).toBe('cliente:c3')
  expect(hrefDoTrecho({ ...base, origem: 'ARQUIVO_CLIENTE', origemId: 'a1', clienteId: 'c3', contratoId: null })).toBe('/clientes/c3?aba=documentos')
})

describe('analisesDeDocumentos', () => {
  it('só documentos visíveis ao usuário', async () => {
    ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.analiseConsolidada.findMany as jest.Mock).mockResolvedValue([])
    await rodar(analisesDeDocumentos, { clienteId: 'c1', competencia: '2026-08' })
    const where = (prisma.documento.findMany as jest.Mock).mock.calls[0][0].where
    expect(where.AND).toEqual([{ uploadedById: 'u' }, { clienteId: 'c1' }, { competenciaAno: 2026, competenciaMes: 8 }])
  })
})

describe('execucoesConfere', () => {
  it('resume o resultado em até 1500 caracteres', async () => {
    ;(prisma.confereExecucao.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.confereExecucao.findMany as jest.Mock).mockResolvedValue([
      { id: 'e1', nomeContrato: 'c.pdf', nomeLevantamento: 'l.xlsx', nomesAditivos: [], createdAt: new Date('2026-09-20T00:00:00Z'), resultado: { grid: 'x'.repeat(5000) } },
    ])
    const r = (await rodar(execucoesConfere, {})) as { execucoes: { resultado: string; href: string }[] }
    expect(r.execucoes[0].resultado.length).toBeLessThanOrEqual(1500)
    expect(r.execucoes[0].href).toBe('/confere/historico/e1')
    expect((r.execucoes[0] as { id?: string }).id).toBe('e1')
  })

  it('total vem da contagem real, não do tamanho da página (findMany capado por take)', async () => {
    ;(prisma.confereExecucao.count as jest.Mock).mockResolvedValue(37)
    ;(prisma.confereExecucao.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `e${i}`,
        nomeContrato: 'c.pdf',
        nomeLevantamento: 'l.xlsx',
        nomesAditivos: [],
        createdAt: new Date('2026-09-20T00:00:00Z'),
        resultado: null,
      }))
    )
    const r = (await rodar(execucoesConfere, { limite: 10 })) as { total: number; execucoes: unknown[] }
    expect(r.total).toBe(37)
    expect(r.execucoes).toHaveLength(10)
  })
})
