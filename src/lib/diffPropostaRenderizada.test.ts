import { diffPropostaRenderizada } from './diffPropostaRenderizada'

describe('diffPropostaRenderizada', () => {
  it('marca a palavra trocada com <del> e <ins> dentro do parágrafo renderizado', () => {
    const html = diffPropostaRenderizada('<p>A proposta e boa.</p>', '<p>A proposta é boa.</p>')

    expect(html).toMatch(/<del>\s*e\s*<\/del>/)
    expect(html).toMatch(/<ins>\s*é\s*<\/ins>/)
    expect(html).toContain('<p>')
  })

  it('não marca nada quando os textos são idênticos', () => {
    const html = diffPropostaRenderizada(
      '<h1>Proposta</h1><p>Texto igual.</p>',
      '<h1>Proposta</h1><p>Texto igual.</p>'
    )

    expect(html).not.toContain('<del>')
    expect(html).not.toContain('<ins>')
  })

  it('preserva títulos e tabelas na saída', () => {
    const html =
      '<h1>Título</h1><table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
    const resultado = diffPropostaRenderizada(html, html)

    expect(resultado).toContain('<h1')
    expect(resultado).toContain('<table')
  })

  it('cai no fallback (só a versão corrigida) quando a estrutura de texto diverge', () => {
    const html = diffPropostaRenderizada('<p>um dois</p>', '<p>um dois três</p><p>quatro</p>')

    expect(html).toContain('quatro')
    expect(html).not.toContain('<del>')
  })
})
