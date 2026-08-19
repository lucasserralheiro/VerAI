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
import { analisarEvolucao } from './evoluir'

describe('analisarEvolucao', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AI_PROVIDER = 'anthropic'
    process.env.AI_API_KEY = 'chave-fake'
    process.env.AI_MODEL = 'modelo-fake'
  })

  it('chama generateObject com o prompt contendo as métricas já calculadas', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({
      object: {
        resumo: 'resumo da evolução',
        pontosAtencao: [{ texto: 'Storage subiu 31,8%' }],
        melhorias: [],
      },
    })

    const metricas = [
      { label: 'Storage', valorAtual: 11200, valorAnterior: 8500, deltaAbsoluto: 2700, deltaPercentual: 0.318, status: 'alta' as const },
    ]

    const resultado = await analisarEvolucao(metricas, '2026-08', '2026-07', 'v1')

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-mock',
        prompt: expect.stringContaining('31.8%'),
      })
    )
    expect(resultado).toEqual({
      resumo: 'resumo da evolução',
      pontosAtencao: [{ texto: 'Storage subiu 31,8%' }],
      melhorias: [],
      promptVersion: 'v1',
    })
  })
})
