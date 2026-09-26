/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findUnique: jest.fn() },
    fichaDocumento: { findMany: jest.fn() },
    indiceDocumento: { findMany: jest.fn() },
  },
}))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn() }))
jest.mock('@/lib/assistente/fichas/gerar', () => ({ ORIGENS_FICHA: ['HISTORICO_PROPOSTA', 'HISTORICO_TERMO'] }))

import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import type { ContextoFerramenta } from './comum'
import { fichasDoContrato } from './fichas'

const ctx: ContextoFerramenta = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' }, hoje: new Date() }
const rodar = (entrada: unknown) => fichasDoContrato.executar(fichasDoContrato.entrada.parse(entrada), ctx)
const linha = (id: string, tipo: string, over = {}) => ({
  id, tipo, numero: null, data: null, propostaArquivo: null, termoArquivo: null, propostaDoSharepoint: false, termoDoSharepoint: false, ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(podeVerCliente as jest.Mock).mockImplementation(async (_u, id) => id === 'c1')
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({
    clienteId: 'c1',
    numeroTermo: 'TC 13/SMIT/2024',
    historico: [
      linha('h1', 'CONTRATO', { data: new Date('2024-03-01T00:00:00Z'), termoArquivo: { id: 'a1', nome: 'TC 13.pdf' }, propostaArquivo: { id: 'a2', nome: 'PC.pdf' } }),
      linha('h2', 'ADITIVO', { numero: '2', data: new Date('2025-05-10T00:00:00Z'), termoArquivo: { id: 'a3', nome: 'TA_02.pdf' } }),
      linha('h3', 'PRORROGACAO', { termoArquivo: { id: 'a4', nome: 'TA_03.pdf' } }),
      linha('h4', 'ADITIVO'),
    ],
  })
  ;(prisma.fichaDocumento.findMany as jest.Mock).mockResolvedValue([
    {
      origem: 'HISTORICO_TERMO', origemId: 'h2', status: 'parcial', mensagem: 'não confirmados: multas',
      campos: {
        valorTotal: { valor: 'R$ 1.200.000,00', pagina: 2, trecho: 'x', fonte: 'ia' },
        vigenciaFim: { valor: '30/06/2027', pagina: 3, trecho: 'y', fonte: 'regra' },
      },
    },
    { origem: 'HISTORICO_PROPOSTA', origemId: 'h1', status: 'ok', mensagem: null, campos: { reajusteIndice: { valor: 'IPC-FIPE', pagina: 5, trecho: 'z', fonte: 'regra' } } },
  ])
  ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([{ origem: 'HISTORICO_TERMO', origemId: 'h1', status: 'sem_texto' }])
})

it('sem permissão: não encontrado', async () => {
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValueOnce({ clienteId: 'c9', numeroTermo: 'x', historico: [] })
  expect(await rodar({ contratoId: 'k9' })).toEqual({ erro: 'não encontrado' })
})

it('ordem do histórico e marcas escaneado, sem ficha e não confirmado no compacto', async () => {
  const texto = fichasDoContrato.compactar!(await rodar({ contratoId: 'k1' }))
  expect(texto.split('\n')).toEqual([
    'fichas do contrato TC 13/SMIT/2024:',
    'CONTRATO (assinado 01/03/2024) — proposta PC.pdf: reajusteIndice IPC-FIPE (p. 5)',
    'CONTRATO (assinado 01/03/2024) — termo TC 13.pdf: escaneado',
    'ADITIVO 2 (assinado 10/05/2025) — termo TA_02.pdf: valorTotal R$ 1.200.000,00 (p. 2) · vigenciaFim 30/06/2027 (p. 3) · não confirmado: multas',
    'PRORROGACAO (sem data de assinatura) — termo TA_03.pdf: sem ficha',
    'ADITIVO (sem data de assinatura) — sem PDF',
  ])
})
