import { validarRevisaoPortugues } from './validarRevisaoPortugues'

describe('validarRevisaoPortugues', () => {
  it('aceita quando a revisão só troca acento/ortografia de palavras', () => {
    expect(validarRevisaoPortugues('A proposta e muito boa.', 'A proposta é muito boa.')).toBeNull()
  })

  it('aceita quando o texto volta idêntico', () => {
    expect(validarRevisaoPortugues('# Proposta\n\nTexto.', '# Proposta\n\nTexto.')).toBeNull()
  })

  it('rejeita quando um número muda', () => {
    expect(validarRevisaoPortugues('Valor total: R$ 100.', 'Valor total: R$ 200.')).toMatch(/número/i)
  })

  it('rejeita quando some uma linha do documento', () => {
    expect(validarRevisaoPortugues('linha um\nlinha dois', 'linha um')).toMatch(/linhas/i)
  })

  it('rejeita quando some uma linha de tabela', () => {
    const original = '| item | valor |\n| --- | --- |\n| A | 1 |\n| B | 2 |'
    const corrigido = '| item | valor |\n| --- | --- |\n| A | 1 |'
    expect(validarRevisaoPortugues(original, corrigido)).toBeTruthy()
  })

  it('rejeita quando um item de lista deixa de ser item', () => {
    expect(validarRevisaoPortugues('- primeiro\nsegundo', 'primeiro\nsegundo')).toMatch(/listas/i)
  })

  it('rejeita quando um título deixa de ser título', () => {
    expect(validarRevisaoPortugues('# Escopo\n\ntexto', 'Escopo\n\ntexto')).toBeTruthy()
  })
})
