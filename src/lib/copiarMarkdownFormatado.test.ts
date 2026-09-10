import { copiarMarkdownFormatado } from './copiarMarkdownFormatado'

class ClipboardItemFalso {
  constructor(public items: Record<string, Blob>) {}
}

async function htmlCopiado(markdown: string): Promise<string> {
  await copiarMarkdownFormatado(markdown)
  const item = (navigator.clipboard.write as jest.Mock).mock.calls[0][0][0] as ClipboardItemFalso
  return item.items['text/html'].text()
}

/** jsdom serializa o atributo `style` com aspas duplas (`font-family="Aptos"`
 *  vira `font-family: &quot;Aptos&quot;`) — os testes checam o conteúdo em
 *  si (nome da fonte, tamanho, peso), não o caractere de aspas usado. */
function temEstiloFonte(html: string, trecho: string): boolean {
  return html.includes(trecho)
}

describe('copiarMarkdownFormatado', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as unknown as { ClipboardItem: typeof ClipboardItemFalso }).ClipboardItem = ClipboardItemFalso
    Object.assign(navigator, { clipboard: { write: jest.fn().mockResolvedValue(undefined) } })
  })

  it('copia HTML e texto simples pra área de transferência', async () => {
    await copiarMarkdownFormatado('# Título\n\nTexto normal.')

    expect(navigator.clipboard.write).toHaveBeenCalledTimes(1)
    const item = (navigator.clipboard.write as jest.Mock).mock.calls[0][0][0] as ClipboardItemFalso
    expect(item.items['text/html']).toBeInstanceOf(Blob)
    expect(item.items['text/plain']).toBeInstanceOf(Blob)
    expect(await item.items['text/plain'].text()).toBe('Título\nTexto normal.\n')
  })

  it('título sai com a fonte institucional Aptos, 14pt e negrito', async () => {
    const html = await htmlCopiado('## Seção 1')
    const tituloTag = html.match(/<h2[^>]*>/)?.[0] ?? ''

    expect(tituloTag.toLowerCase()).toContain('aptos')
    expect(temEstiloFonte(tituloTag, 'font-size: 14pt')).toBe(true)
    expect(temEstiloFonte(tituloTag, 'font-weight: bold')).toBe(true)
  })

  it('parágrafo sai com a fonte institucional Aptos em 12pt (corpo do texto)', async () => {
    const html = await htmlCopiado('Um parágrafo qualquer da proposta.')
    const paragrafoTag = html.match(/<p[^>]*>/)?.[0] ?? ''

    expect(paragrafoTag.toLowerCase()).toContain('aptos')
    expect(temEstiloFonte(paragrafoTag, 'font-size: 12pt')).toBe(true)
  })

  it('trecho em negrito (**...**) sai em negrito mas mantém o tamanho do corpo do texto (não vira título)', async () => {
    const html = await htmlCopiado('Isso é **importante** de verdade.')
    const strongTag = html.match(/<strong[^>]*>/)?.[0] ?? ''

    expect(strongTag).not.toBe('')
    expect(temEstiloFonte(strongTag, 'font-weight: bold')).toBe(true)
    expect(strongTag).not.toContain('14pt') // negrito no corpo do texto não é título
  })

  it('célula de tabela sai com a fonte institucional em 12pt', async () => {
    const html = await htmlCopiado('| Item | Valor |\n| --- | --- |\n| Storage | R$ 100 |')
    const tdTag = html.match(/<td[^>]*>/)?.[0] ?? ''

    expect(html).toContain('<table>')
    expect(tdTag.toLowerCase()).toContain('aptos')
    expect(temEstiloFonte(tdTag, 'font-size: 12pt')).toBe(true)
  })
})
