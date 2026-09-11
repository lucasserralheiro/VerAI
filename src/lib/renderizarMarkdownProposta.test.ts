import { renderizarMarkdownProposta } from './renderizarMarkdownProposta'

describe('renderizarMarkdownProposta', () => {
  it('renderiza markdown normal como HTML', () => {
    const html = renderizarMarkdownProposta('# Título\n\nTexto normal.')

    expect(html).toContain('<h1>Título</h1>')
    expect(html).toContain('<p>Texto normal.</p>')
  })

  it('destaca parágrafo que começa com "Divergência" como callout', () => {
    const html = renderizarMarkdownProposta('Divergência entre fontes.')

    expect(html).toContain('callout-divergencia')
  })

  it('bloco :::ocr-pendente vira callout .callout-ocr-pendente', () => {
    const markdown = 'Texto normal.\n\n:::ocr-pendente[arquivoId=a1 pagina=3]\nTexto reconhecido.\n:::'

    const html = renderizarMarkdownProposta(markdown)

    expect(html).toContain('callout-ocr-pendente')
    expect(html).toContain('página 3')
    expect(html).not.toContain(':::ocr-pendente')
  })

  it('texto normal não é afetado', () => {
    const html = renderizarMarkdownProposta('# Título\n\nTexto normal.')

    expect(html).not.toContain('callout-ocr-pendente')
  })
})
