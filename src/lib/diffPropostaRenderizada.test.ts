import { diffPropostaRenderizada } from './diffPropostaRenderizada'

describe('diffPropostaRenderizada', () => {
  it('marca a palavra trocada com <del> e <ins> dentro do parágrafo renderizado', () => {
    const html = diffPropostaRenderizada('A proposta e boa.', 'A proposta é boa.')

    expect(html).toMatch(/<del>\s*e\s*<\/del>/)
    expect(html).toMatch(/<ins>\s*é\s*<\/ins>/)
    expect(html).toContain('<p>')
  })

  it('não marca nada quando os textos são idênticos', () => {
    const html = diffPropostaRenderizada('# Proposta\n\nTexto igual.', '# Proposta\n\nTexto igual.')

    expect(html).not.toContain('<del>')
    expect(html).not.toContain('<ins>')
  })

  it('preserva títulos e tabelas na saída', () => {
    const md = '# Título\n\n| a | b |\n| --- | --- |\n| 1 | 2 |'
    const html = diffPropostaRenderizada(md, md)

    expect(html).toContain('<h1')
    expect(html).toContain('<table')
  })

  it('cai no fallback (só a versão corrigida) quando a estrutura de texto diverge', () => {
    const html = diffPropostaRenderizada('um dois', 'um dois três\n\nquatro')

    expect(html).toContain('quatro')
    expect(html).not.toContain('<del>')
  })
})
