import { sanitizarHtmlEditavel } from './sanitizarHtmlEditavel'

describe('sanitizarHtmlEditavel', () => {
  it('normaliza <b>/<i> pra <strong>/<em>', () => {
    expect(sanitizarHtmlEditavel('<p><b>Negrito</b> e <i>itálico</i>.</p>')).toBe(
      '<p><strong>Negrito</strong> e <em>itálico</em>.</p>'
    )
  })

  it('desembrulha <span>/<font>, preservando o texto', () => {
    expect(sanitizarHtmlEditavel('<p><span style="color:red">Texto</span></p>')).toBe('<p>Texto</p>')
  })

  it('<div> fora de tabela/lista vira <p>', () => {
    expect(sanitizarHtmlEditavel('<div>Linha nova</div>')).toBe('<p>Linha nova</p>')
  })

  it('<div> dentro de <td> não vira <p> (preserva a célula)', () => {
    const html = '<table><tbody><tr><td><div>Conteúdo</div></td></tr></tbody></table>'
    expect(sanitizarHtmlEditavel(html)).toBe(html)
  })

  it('remove style/class de qualquer elemento', () => {
    expect(sanitizarHtmlEditavel('<p class="foo" style="color:red">Texto</p>')).toBe('<p>Texto</p>')
  })

  it('desembrulha o callout de divergência, mantendo o texto', () => {
    const html = '<p class="callout-divergencia">Divergência: texto.</p>'
    expect(sanitizarHtmlEditavel(html)).toBe('Divergência: texto.')
  })

  it('normaliza nbsp pra espaço comum', () => {
    expect(sanitizarHtmlEditavel('<p>Texto com nbsp.</p>')).toBe('<p>Texto com nbsp.</p>')
  })
})
