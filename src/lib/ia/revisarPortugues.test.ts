/** @jest-environment node */
jest.mock('ai', () => ({ generateObject: jest.fn() }))
jest.mock('./modelo', () => ({ getModel: jest.fn(() => 'modelo-mock') }))

import { generateObject } from 'ai'
import { getModel } from './modelo'
import { revisarPortugues, aplicarCorrecoes } from './revisarPortugues'

describe('aplicarCorrecoes', () => {
  it('aplica cada troca por substituição literal', () => {
    const original = 'A proposta e boa e o servico tambem.'
    const resultado = aplicarCorrecoes(original, [
      { antes: 'proposta e boa', depois: 'proposta é boa' },
      { antes: 'o servico tambem', depois: 'o serviço também' },
    ])
    expect(resultado).toBe('A proposta é boa e o serviço também.')
  })

  it('ignora troca cujo "antes" não aparece no texto', () => {
    expect(aplicarCorrecoes('texto certo', [{ antes: 'inexistente', depois: 'qualquer' }])).toBe('texto certo')
  })

  it('ignora "antes" curto demais (evita casar em todo lugar)', () => {
    expect(aplicarCorrecoes('a e o e i', [{ antes: 'e', depois: 'é' }])).toBe('a e o e i')
  })

  it('ignora troca com quebra de linha', () => {
    const original = 'linha um\nlinha dois'
    expect(aplicarCorrecoes(original, [{ antes: 'linha um\nlinha', depois: 'linha um linha' }])).toBe(original)
  })

  it('ignora troca que mexe em dígitos', () => {
    expect(aplicarCorrecoes('Valor de 100 reais', [{ antes: 'de 100 reais', depois: 'de 200 reais' }])).toBe(
      'Valor de 100 reais'
    )
  })

  it('lista vazia devolve o texto intacto', () => {
    expect(aplicarCorrecoes('# Proposta\n\nTudo certo.', [])).toBe('# Proposta\n\nTudo certo.')
  })
})

describe('revisarPortugues', () => {
  beforeEach(() => jest.clearAllMocks())

  it('pede a lista de correções ao modelo e aplica no markdown recebido', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({
      object: { correcoes: [{ antes: 'proposta e otima', depois: 'proposta é ótima' }] },
    })

    const resultado = await revisarPortugues('Esta proposta e otima para o cliente.')

    expect(resultado).toBe('Esta proposta é ótima para o cliente.')
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-mock',
        prompt: expect.stringContaining('Esta proposta e otima'),
      })
    )
  })

  it('usa AI_REVISAO_MODEL quando definido', async () => {
    process.env.AI_REVISAO_MODEL = 'modelo-rapido'
    ;(generateObject as jest.Mock).mockResolvedValue({ object: { correcoes: [] } })

    await revisarPortugues('texto')

    expect(getModel).toHaveBeenCalledWith('modelo-rapido')
    delete process.env.AI_REVISAO_MODEL
  })

  it('sem correções, devolve o texto idêntico', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({ object: { correcoes: [] } })
    expect(await revisarPortugues('# Proposta\n\nTexto certo.')).toBe('# Proposta\n\nTexto certo.')
  })
})
