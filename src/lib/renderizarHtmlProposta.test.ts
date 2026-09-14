import { renderizarHtmlProposta } from './renderizarHtmlProposta'

describe('renderizarHtmlProposta', () => {
  it('html normal passa direto, sem alteração', () => {
    const html = renderizarHtmlProposta('<h1>Título</h1><p>Texto normal.</p>')
    expect(html).toBe('<h1>Título</h1><p>Texto normal.</p>')
  })

  it('destaca parágrafo que começa com "Divergência" como callout', () => {
    const html = renderizarHtmlProposta('<p>Divergência entre fontes.</p>')
    expect(html).toContain('callout-divergencia')
  })

  it('marcador de OCR pendente vira callout .callout-ocr-pendente', () => {
    const conteudo =
      '<p>Texto normal.</p>' +
      '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="3"><p>Texto reconhecido.</p></div>'

    const html = renderizarHtmlProposta(conteudo)

    expect(html).toContain('callout-ocr-pendente')
    expect(html).toContain('página 3')
    expect(html).not.toContain('class="ocr-pendente"')
  })

  it('texto normal não é afetado', () => {
    const html = renderizarHtmlProposta('<h1>Título</h1><p>Texto normal.</p>')
    expect(html).not.toContain('callout-ocr-pendente')
  })
})
