import { htmlEditavelParaMarkdown } from './htmlEditavelParaMarkdown'

describe('htmlEditavelParaMarkdown', () => {
  it('converte títulos, negrito, itálico e parágrafo', () => {
    const html = '<h1>Título</h1><p>Texto <strong>forte</strong> e <em>itálico</em>.</p>'
    expect(htmlEditavelParaMarkdown(html)).toBe('# Título\n\nTexto **forte** e _itálico_.')
  })

  it('normaliza <b>/<i> como <strong>/<em>', () => {
    expect(htmlEditavelParaMarkdown('<p>Texto <b>forte</b> e <i>itálico</i>.</p>')).toBe(
      'Texto **forte** e _itálico_.'
    )
  })

  it('remove style e class de qualquer elemento', () => {
    expect(htmlEditavelParaMarkdown('<p style="color:red" class="x">Texto</p>')).toBe('Texto')
  })

  it('desembrulha <span> mantendo o texto', () => {
    expect(htmlEditavelParaMarkdown('<p>Antes <span style="color:red">colorido</span> depois.</p>')).toBe(
      'Antes colorido depois.'
    )
  })

  it('trata <div> de bloco solto como parágrafo (jeito comum do contentEditable criar linha nova)', () => {
    expect(htmlEditavelParaMarkdown('<div>Primeira linha</div><div>Segunda linha</div>')).toBe(
      'Primeira linha\n\nSegunda linha'
    )
  })

  it('converte lista não ordenada e ordenada', () => {
    expect(htmlEditavelParaMarkdown('<ul><li>Um</li><li>Dois</li></ul>')).toBe('- Um\n- Dois')
    expect(htmlEditavelParaMarkdown('<ol><li>Um</li><li>Dois</li></ol>')).toBe('1. Um\n2. Dois')
  })

  it('converte tabela com cabeçalho', () => {
    const html =
      '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead><tbody><tr><td>A</td><td>10</td></tr></tbody></table>'
    expect(htmlEditavelParaMarkdown(html)).toBe('| Item | Valor |\n| --- | --- |\n| A | 10 |')
  })

  it('converte link', () => {
    expect(htmlEditavelParaMarkdown('<p><a href="https://x.com">link</a></p>')).toBe('[link](https://x.com)')
  })

  it('desembrulha .callout-divergencia mantendo o parágrafo interno', () => {
    expect(
      htmlEditavelParaMarkdown('<div class="callout-divergencia"><p>Divergência: teste.</p></div>')
    ).toBe('Divergência: teste.')
  })

  it('converte &nbsp; em espaço normal', () => {
    expect(htmlEditavelParaMarkdown('<p>Antes&nbsp;depois</p>')).toBe('Antes depois')
  })

  it('texto solto sem wrapper de bloco (digitado direto no editor vazio) vira parágrafo', () => {
    expect(htmlEditavelParaMarkdown('Texto solto')).toBe('Texto solto')
  })

  it('round-trip sem edição preserva o conteúdo', () => {
    const html = '<h2>Escopo</h2><p>Serviço de <strong>consultoria</strong>.</p>'
    expect(htmlEditavelParaMarkdown(html)).toBe('## Escopo\n\nServiço de **consultoria**.')
  })
})
