/** @jest-environment node */
jest.mock('ai', () => ({ generateText: jest.fn() }))
jest.mock('./modelo', () => ({ getModel: jest.fn(() => 'modelo-mock') }))

import { generateText } from 'ai'
import { revisarPortugues } from './revisarPortugues'

describe('revisarPortugues', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devolve o texto do modelo e passa o markdown recebido no prompt', async () => {
    ;(generateText as jest.Mock).mockResolvedValue({ text: '# Proposta corrigida' })

    const resultado = await revisarPortugues('# Proposta corigida')

    expect(resultado).toBe('# Proposta corrigida')
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-mock',
        prompt: expect.stringContaining('# Proposta corigida'),
      })
    )
  })

  it('remove cercas de código markdown que o modelo adicione ao redor da resposta', async () => {
    ;(generateText as jest.Mock).mockResolvedValue({ text: '```markdown\n# Proposta\n\nTexto.\n```' })

    expect(await revisarPortugues('# Proposta\n\nTexto.')).toBe('# Proposta\n\nTexto.')
  })

  it('devolve o texto aparado quando não há cercas', async () => {
    ;(generateText as jest.Mock).mockResolvedValue({ text: '  # Proposta\n' })

    expect(await revisarPortugues('# Proposta')).toBe('# Proposta')
  })
})
