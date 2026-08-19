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
const modeloFactoryVertexMock = jest.fn(() => 'modelo-vertex-mock')
jest.mock('@ai-sdk/google-vertex', () => ({
  createVertex: jest.fn(() => modeloFactoryVertexMock),
}))
const modeloFactoryGoogleMock = jest.fn(() => 'modelo-google-mock')
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => modeloFactoryGoogleMock),
}))
const modeloFactoryGroqMock = jest.fn(() => 'modelo-groq-mock')
jest.mock('@ai-sdk/groq', () => ({
  createGroq: jest.fn(() => modeloFactoryGroqMock),
}))

import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createGroq } from '@ai-sdk/groq'
import { analisarDocumento } from './analisar'

describe('analisarDocumento', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AI_PROVIDER = 'anthropic'
    process.env.AI_API_KEY = 'chave-fake'
    process.env.AI_MODEL = 'modelo-fake'
  })

  it('chama generateObject com o modelo do provedor configurado e devolve a análise com a versão do prompt', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({
      object: {
        resumo: 'resumo gerado',
        pontosCriticos: [{ texto: 'ponto crítico', severidade: 'alto' }],
        pontosPositivos: [{ texto: 'ponto positivo' }],
        metricasChave: [{ label: 'linhas', valor: '120' }],
      },
    })

    const resultado = await analisarDocumento('conteúdo extraído do documento', 'v1')

    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'chave-fake' })
    expect(modeloFactoryMock).toHaveBeenCalledWith('modelo-fake')
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ model: 'modelo-mock' }))
    expect(resultado).toEqual({
      resumo: 'resumo gerado',
      pontosCriticos: [{ texto: 'ponto crítico', severidade: 'alto' }],
      pontosPositivos: [{ texto: 'ponto positivo' }],
      metricasChave: [{ label: 'linhas', valor: '120' }],
      promptVersion: 'v1',
    })
  })

  it('usa o Vertex AI quando AI_PROVIDER=vertex, sem exigir AI_API_KEY', async () => {
    process.env.AI_PROVIDER = 'vertex'
    process.env.AI_MODEL = 'gemini-2.5-flash'
    process.env.GOOGLE_VERTEX_PROJECT = 'meu-projeto'
    process.env.GOOGLE_VERTEX_LOCATION = 'us-central1'
    delete process.env.AI_API_KEY

    ;(generateObject as jest.Mock).mockResolvedValue({
      object: {
        resumo: 'resumo',
        pontosCriticos: [],
        pontosPositivos: [],
        metricasChave: null,
      },
    })

    await analisarDocumento('conteúdo', 'v1')

    expect(createVertex).toHaveBeenCalledWith({ project: 'meu-projeto', location: 'us-central1' })
    expect(modeloFactoryVertexMock).toHaveBeenCalledWith('gemini-2.5-flash')
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ model: 'modelo-vertex-mock' }))
  })

  it('usa o Google AI Studio quando AI_PROVIDER=google', async () => {
    process.env.AI_PROVIDER = 'google'
    process.env.AI_MODEL = 'gemini-2.5-flash'
    process.env.AI_API_KEY = 'chave-google-fake'

    ;(generateObject as jest.Mock).mockResolvedValue({
      object: { resumo: 'resumo', pontosCriticos: [], pontosPositivos: [], metricasChave: null },
    })

    await analisarDocumento('conteúdo', 'v1')

    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'chave-google-fake' })
    expect(modeloFactoryGoogleMock).toHaveBeenCalledWith('gemini-2.5-flash')
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ model: 'modelo-google-mock' }))
  })

  it('usa o Groq quando AI_PROVIDER=groq', async () => {
    process.env.AI_PROVIDER = 'groq'
    process.env.AI_MODEL = 'llama-3.3-70b-versatile'
    process.env.AI_API_KEY = 'chave-groq-fake'

    ;(generateObject as jest.Mock).mockResolvedValue({
      object: { resumo: 'resumo', pontosCriticos: [], pontosPositivos: [], metricasChave: null },
    })

    await analisarDocumento('conteúdo', 'v1')

    expect(createGroq).toHaveBeenCalledWith({ apiKey: 'chave-groq-fake' })
    expect(modeloFactoryGroqMock).toHaveBeenCalledWith('llama-3.3-70b-versatile')
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ model: 'modelo-groq-mock' }))
  })

  it('lança erro quando AI_PROVIDER não é suportado', async () => {
    process.env.AI_PROVIDER = 'desconhecido'
    await expect(analisarDocumento('conteúdo', 'v1')).rejects.toThrow(
      'AI_PROVIDER "desconhecido" não suportado'
    )
  })
})
