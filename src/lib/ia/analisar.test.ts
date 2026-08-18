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

import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
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

  it('lança erro quando AI_PROVIDER não é suportado', async () => {
    process.env.AI_PROVIDER = 'desconhecido'
    await expect(analisarDocumento('conteúdo', 'v1')).rejects.toThrow(
      'AI_PROVIDER "desconhecido" não suportado'
    )
  })
})
