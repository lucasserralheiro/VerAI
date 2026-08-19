/**
 * @jest-environment node
 */
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}))
const modeloFactoryMock = jest.fn(() => 'modelo-mock')
jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: jest.fn(() => modeloFactoryMock),
}))
jest.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: jest.fn() }))
jest.mock('@ai-sdk/google-vertex', () => ({ createVertex: jest.fn() }))
jest.mock('@ai-sdk/groq', () => ({ createGroq: jest.fn() }))

import { generateObject } from 'ai'
import { analisarConsolidado } from './consolidar'

describe('analisarConsolidado', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AI_PROVIDER = 'anthropic'
    process.env.AI_API_KEY = 'chave-fake'
    process.env.AI_MODEL = 'modelo-fake'
  })

  it('chama generateObject com o prompt contendo os resumos e as métricas já calculadas', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({
      object: {
        resumo: 'resumo consolidado',
        pontosCriticos: [{ texto: 'divergência entre docs', severidade: 'alto' }],
        pontosPositivos: [],
        recomendacoes: ['confirmar valor com o fornecedor'],
      },
    })

    const resumos = [{ nomeArquivo: 'azure.pdf', resumo: 'relatório da azure' }]
    const metricas = [
      {
        label: 'Storage',
        valores: [
          { documentoId: 'd1', nomeArquivo: 'azure.pdf', valorNumerico: 11200, valorExibicao: 'R$ 11.200,00' },
          { documentoId: 'd2', nomeArquivo: 'interno.xlsx', valorNumerico: 10900, valorExibicao: 'R$ 10.900,00' },
        ],
        divergencia: { minimo: 10900, maximo: 11200, diferencaAbsoluta: 300, diferencaPercentual: 300 / 10900 },
      },
    ]

    const resultado = await analisarConsolidado(resumos, metricas, 'v1')

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-mock',
        prompt: expect.stringContaining('R$ 11.200,00'),
      })
    )
    expect(resultado).toEqual({
      resumo: 'resumo consolidado',
      pontosCriticos: [{ texto: 'divergência entre docs', severidade: 'alto' }],
      pontosPositivos: [],
      recomendacoes: ['confirmar valor com o fornecedor'],
      promptVersion: 'v1',
    })
  })
})
