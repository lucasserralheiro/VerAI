jest.mock('ai', () => ({ generateObject: jest.fn() }))
jest.mock('./modelo', () => ({ getModel: jest.fn().mockReturnValue('modelo-fake') }))

import { generateObject } from 'ai'
import { checarConversao } from './checarConversao'

describe('checarConversao', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sem página pra checar devolve score null e lista vazia, sem chamar a IA', async () => {
    const resultado = await checarConversao([])

    expect(resultado).toEqual({ scoreExibido: null, trechosSuspeitos: [] })
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('agrega o score (média) e marca a página nos trechos suspeitos', async () => {
    ;(generateObject as jest.Mock)
      .mockResolvedValueOnce({
        object: { scoreConfianca: 1, trechosSuspeitos: [] },
      })
      .mockResolvedValueOnce({
        object: { scoreConfianca: 0.6, trechosSuspeitos: [{ trecho: 'Valor: R$ 100', motivo: 'número pode ter trocado' }] },
      })

    const resultado = await checarConversao([
      { pagina: 1, textoOriginal: 'Texto da página 1', markdown: 'Texto da página 1' },
      { pagina: 2, textoOriginal: 'Valor: R$ 1.000', markdown: 'Valor: R$ 100' },
    ])

    expect(resultado.scoreExibido).toBe(80) // média (1 + 0.6) / 2 = 0.8 -> 80%
    expect(resultado.trechosSuspeitos).toEqual([
      { pagina: 2, trecho: 'Valor: R$ 100', motivo: 'número pode ter trocado' },
    ])
  })

  it('nunca devolve 100%, mesmo quando toda página vem com score 1', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({ object: { scoreConfianca: 1, trechosSuspeitos: [] } })

    const resultado = await checarConversao([{ pagina: 1, textoOriginal: 'x', markdown: 'x' }])

    expect(resultado.scoreExibido).toBe(99)
  })

  it('uma página falhando não derruba a checagem inteira', async () => {
    ;(generateObject as jest.Mock)
      .mockRejectedValueOnce(new Error('modelo indisponível'))
      .mockResolvedValueOnce({ object: { scoreConfianca: 0.9, trechosSuspeitos: [] } })

    const resultado = await checarConversao([
      { pagina: 1, textoOriginal: 'a', markdown: 'a' },
      { pagina: 2, textoOriginal: 'b', markdown: 'b' },
    ])

    expect(resultado.scoreExibido).toBe(90)
  })

  it('todas as páginas falhando lança erro', async () => {
    ;(generateObject as jest.Mock).mockRejectedValue(new Error('modelo indisponível'))

    await expect(checarConversao([{ pagina: 1, textoOriginal: 'a', markdown: 'a' }])).rejects.toThrow(
      'não foi possível checar nenhuma página'
    )
  })
})
