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

const MARKDOWN_TABELA = '| Item | Valor |\n| --- | --- |\n| Storage | R$ 100 |\n| Rede | R$ 200 |'

// jsdom (igual a um browser de verdade) normaliza cor hex pra `rgb(...)` ao
// serializar o `style` de volta pra HTML — o Word/SEI de destino interpreta
// os dois formatos do mesmo jeito, então os testes checam pela forma rgb().
const NAVY_RGB = 'rgb(0, 42, 74)'
const BORDA_GREY_RGB = 'rgb(217, 217, 217)'
const LIGHT_GREY_RGB = 'rgb(242, 242, 242)'

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
    const html = await htmlCopiado(MARKDOWN_TABELA)
    const tdTag = html.match(/<td[^>]*>/)?.[0] ?? ''

    expect(html).toContain('<table')
    expect(tdTag.toLowerCase()).toContain('aptos')
    expect(temEstiloFonte(tdTag, 'font-size: 12pt')).toBe(true)
  })

  it('tabela sai com borda, largura cheia e cabeçalho em navy — sem isso ela cola sem estrutura nenhuma no Word/SEI', async () => {
    const html = await htmlCopiado(MARKDOWN_TABELA)
    const tabelaTag = html.match(/<table[^>]*>/)?.[0] ?? ''
    const linhaCabecalhoTag = html.match(/<tr[^>]*>\s*<th/)?.[0] ?? ''
    // `(?=[\s>])` evita casar com `<thead>` (que também começa com "<th")
    const thTag = html.match(/<th(?=[\s>])[^>]*>/)?.[0] ?? ''
    const tdTag = html.match(/<td[^>]*>/)?.[0] ?? ''

    expect(temEstiloFonte(tabelaTag, 'border-collapse: collapse')).toBe(true)
    expect(temEstiloFonte(tabelaTag, 'width: 100%')).toBe(true)
    expect(temEstiloFonte(linhaCabecalhoTag, `background-color: ${NAVY_RGB}`)).toBe(true)
    expect(temEstiloFonte(thTag, `border: 1px solid ${NAVY_RGB}`)).toBe(true)
    expect(temEstiloFonte(tdTag, `border: 1px solid ${BORDA_GREY_RGB}`)).toBe(true)
    // fonte institucional continua presente — o estilo de tabela SOMA ao de fonte, não substitui
    expect(thTag.toLowerCase()).toContain('aptos')
  })

  it('linhas do corpo da tabela alternam fundo (zebra), igual ao preview na tela', async () => {
    const html = await htmlCopiado(MARKDOWN_TABELA)
    const linhasCorpo = [...html.matchAll(/<tr[^>]*>\s*<td/g)].map((m) => m[0])

    expect(linhasCorpo).toHaveLength(2)
    expect(linhasCorpo[0]).not.toContain(LIGHT_GREY_RGB) // 1ª linha (ímpar): sem zebra
    expect(linhasCorpo[1]).toContain(LIGHT_GREY_RGB) // 2ª linha (par): com zebra
  })
})
