/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    indiceDocumento: { findMany: jest.fn() },
    fichaDocumento: { findMany: jest.fn(), upsert: jest.fn() },
    historicoContrato: { findMany: jest.fn() },
    trechoDocumento: { findMany: jest.fn() },
  },
}))
jest.mock('@/lib/assistente/configuracao', () => ({ configuracaoDoAssistente: jest.fn(() => ({ modelo: 'deepseek-chat' })), modeloDoAssistente: jest.fn() }))
jest.mock('./ia', () => ({ lerComIa: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { gerarFichasPendentes } from './gerar'

const ler = jest.fn()
const TEXTO_COMPLETO =
  'CLÁUSULA PRIMEIRA – DO OBJETO\n1.1 O objeto é a prestação de serviços de sustentação.\nO valor total é de R$ 1.000,00.\n' +
  'Vigência de 12 (doze) meses. Reajuste pelo IPCA. Garantia: caução de 5%. Pagamento em até 30 dias.'

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
    { id: 'h1', tipo: 'CONTRATO' },
    { id: 'h2', tipo: 'ADITIVO' },
  ])
  ;(prisma.trechoDocumento.findMany as jest.Mock).mockResolvedValue([{ pagina: 1, ordem: 0, texto: TEXTO_COMPLETO }])
  ;(prisma.fichaDocumento.findMany as jest.Mock).mockResolvedValue([])
  ler.mockResolvedValue({ campos: { multas: { valor: '10%', pagina: 1, trecho: 'multa de 10%', fonte: 'ia' } }, descartados: [], tokensEntrada: 900, tokensSaida: 50 })
})

const indice = (origemId: string, over = {}) => ({ origem: 'HISTORICO_TERMO', origemId, versao: 'v1', status: 'ok', ...over })

it('ficha da mesma versão não é refeita; versão nova é', async () => {
  ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([indice('h1'), indice('h2', { versao: 'v2' })])
  ;(prisma.fichaDocumento.findMany as jest.Mock).mockResolvedValue([
    { origem: 'HISTORICO_TERMO', origemId: 'h1', versao: 'v1' },
    { origem: 'HISTORICO_TERMO', origemId: 'h2', versao: 'v1' },
  ])
  await gerarFichasPendentes({ ler })
  expect((prisma.fichaDocumento.upsert as jest.Mock).mock.calls.map((c) => c[0].where.origem_origemId.origemId)).toEqual(['h2'])
})

it('sem_texto grava a ficha sem chamar a IA', async () => {
  ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([indice('h1', { status: 'sem_texto' })])
  const r = await gerarFichasPendentes({ ler })
  expect(ler).not.toHaveBeenCalled()
  expect((prisma.fichaDocumento.upsert as jest.Mock).mock.calls[0][0].create).toMatchObject({ status: 'sem_texto', campos: {} })
  expect(r.semTexto).toBe(1)
})

it('IA só nos campos que a regra não achou; alterações só em aditivo', async () => {
  ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([indice('h1'), indice('h2')])
  const r = await gerarFichasPendentes({ ler })
  const [primeira, segunda] = ler.mock.calls.map((c) => c[0].faltando as string[])
  expect(primeira).not.toContain('reajusteIndice')
  expect(primeira).not.toContain('alteracoes')
  expect(primeira).toContain('multas')
  expect(segunda).toContain('alteracoes')
  expect(r.comIa).toBe(2)
  expect(r.tokens).toBe(1900)
  const gravado = (prisma.fichaDocumento.upsert as jest.Mock).mock.calls[0][0].create
  expect(gravado).toMatchObject({ status: 'parcial', modelo: 'deepseek-chat', tokensEntrada: 900, tokensSaida: 50 })
  expect(gravado.campos.multas).toEqual({ valor: '10%', pagina: 1, trecho: 'multa de 10%', fonte: 'ia' })
  expect(gravado.campos.reajusteIndice.fonte).toBe('regra')
})

it('sem IA: fica parcial e não chama', async () => {
  ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([indice('h1')])
  const r = await gerarFichasPendentes({ ler, comIa: false })
  expect(ler).not.toHaveBeenCalled()
  expect(r).toMatchObject({ porRegra: 1, parciais: 1 })
})

it('erro da IA vira ficha "erro" e o lote segue; respeita o limite', async () => {
  ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([indice('h1'), indice('h2'), indice('h3')])
  ler.mockRejectedValueOnce(new Error('provedor fora'))
  const r = await gerarFichasPendentes({ ler, limite: 2 })
  expect(r).toMatchObject({ erros: 1, comIa: 1, restantes: 1 })
  expect((prisma.fichaDocumento.upsert as jest.Mock).mock.calls[0][0].create).toMatchObject({ status: 'erro', mensagem: 'provedor fora' })
})
