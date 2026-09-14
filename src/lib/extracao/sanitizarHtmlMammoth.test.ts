import { sanitizarHtmlMammoth } from './sanitizarHtmlMammoth'

describe('sanitizarHtmlMammoth', () => {
  it('remove atributos id/class/style que o mammoth pode anexar', () => {
    const html = '<h1 id="titulo-1" class="Titulo1">Objeto do contrato</h1>'
    expect(sanitizarHtmlMammoth(html)).toBe('<h1>Objeto do contrato</h1>')
  })

  it('preserva a tag e o conteúdo quando não tem atributo nenhum', () => {
    const html = '<p><strong>Negrito</strong> e <em>itálico</em>.</p>'
    expect(sanitizarHtmlMammoth(html)).toBe(html)
  })

  it('preserva tabela do mammoth sem alteração de estrutura', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr></table>'
    expect(sanitizarHtmlMammoth(html)).toBe(html)
  })
})
