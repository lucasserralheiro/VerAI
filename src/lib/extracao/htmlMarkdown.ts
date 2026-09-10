/**
 * Conversor de HTML (saída do mammoth ao ler .docx) pra Markdown — 100%
 * determinístico, sem IA. Não interpreta nem reescreve nada: só troca a
 * marcação HTML pela marcação Markdown equivalente, preservando o texto
 * exatamente como veio do documento original.
 *
 * Não é um parser de HTML genérico — cobre só o subconjunto de tags que o
 * mammoth realmente produz (h1-h6, p, strong/b, em/i, u, a, ul/ol/li, table,
 * br), o que é suficiente porque a entrada vem sempre dele, nunca de HTML
 * arbitrário.
 */

interface Token {
  type: 'open' | 'close' | 'text'
  tag?: string
  attrs?: string
  selfClosing?: boolean
  text?: string
}

const TAGS_AUTOFECHAVEIS = new Set(['br', 'img', 'hr'])

function tokenizar(html: string): Token[] {
  const tokens: Token[] = []
  const regex = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(html))) {
    if (match[4] !== undefined) {
      tokens.push({ type: 'text', text: decodeEntidades(match[4]) })
      continue
    }
    const fechando = match[1] === '/'
    const tag = match[2].toLowerCase()
    const attrs = match[3] ?? ''
    if (fechando) {
      tokens.push({ type: 'close', tag })
    } else {
      const autoFechavel = TAGS_AUTOFECHAVEIS.has(tag) || /\/\s*$/.test(attrs)
      tokens.push({ type: 'open', tag, attrs, selfClosing: autoFechavel })
    }
  }
  return tokens
}

function decodeEntidades(texto: string): string {
  return texto
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

interface No {
  tag: string // '#text' pra nó de texto
  texto?: string
  attrs?: string
  filhos: No[]
}

/** Constrói a árvore a partir dos tokens — assume HTML bem formado (é o que
 *  o mammoth sempre produz), então não precisa lidar com fechamento
 *  implícito de tag. */
function construirArvore(tokens: Token[]): No {
  let i = 0
  function parseFilhos(tagPai: string | null): No[] {
    const filhos: No[] = []
    while (i < tokens.length) {
      const tok = tokens[i]
      if (tok.type === 'close') {
        i++
        if (tok.tag === tagPai) return filhos
        continue // tag de fechamento sem par aberto — ignora
      }
      if (tok.type === 'text') {
        filhos.push({ tag: '#text', texto: tok.text, filhos: [] })
        i++
        continue
      }
      // tag de abertura
      i++
      if (tok.selfClosing) {
        filhos.push({ tag: tok.tag!, attrs: tok.attrs, filhos: [] })
        continue
      }
      const netos = parseFilhos(tok.tag!)
      filhos.push({ tag: tok.tag!, attrs: tok.attrs, filhos: netos })
    }
    return filhos
  }
  return { tag: '#root', filhos: parseFilhos(null) }
}

function extrairHref(attrs = ''): string {
  const m = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/)
  return m ? m[1] ?? m[2] ?? '' : ''
}

function escaparInlineMarkdown(texto: string): string {
  // Só escapa o que realmente quebraria a formatação Markdown se vier cru
  // do documento original (ex.: um "*" ou "_" digitado à mão no Word).
  return texto.replace(/([*_`])/g, '\\$1')
}

function renderizarInline(no: No): string {
  if (no.tag === '#text') return escaparInlineMarkdown(no.texto ?? '')
  if (no.tag === 'br') return '  \n'

  const inner = no.filhos.map(renderizarInline).join('')

  switch (no.tag) {
    case 'strong':
    case 'b':
      return inner.trim() ? `**${inner}**` : inner
    case 'em':
    case 'i':
      return inner.trim() ? `_${inner}_` : inner
    case 'a': {
      const href = extrairHref(no.attrs)
      return href ? `[${inner}](${href})` : inner
    }
    default:
      return inner
  }
}

function textoInlineDoNo(no: No): string {
  return no.filhos.map(renderizarInline).join('').trim()
}

function renderizarLista(no: No, ordenada: boolean, nivel: number): string {
  const itens = no.filhos.filter((f) => f.tag === 'li')
  const indentacao = '  '.repeat(nivel)
  return itens
    .map((li, indice) => {
      const listasFilhas = li.filhos.filter((f) => f.tag === 'ul' || f.tag === 'ol')
      const conteudoInline = li.filhos
        .filter((f) => f.tag !== 'ul' && f.tag !== 'ol')
        .map(renderizarInline)
        .join('')
        .trim()
      const marcador = ordenada ? `${indice + 1}.` : '-'
      let linha = `${indentacao}${marcador} ${conteudoInline}`
      for (const sub of listasFilhas) {
        const subMarkdown = renderizarLista(sub, sub.tag === 'ol', nivel + 1)
        if (subMarkdown) linha += `\n${subMarkdown}`
      }
      return linha
    })
    .join('\n')
}

/** Linhas "• texto" pra uma lista (com sublistas) DENTRO de célula de
 *  tabela — usada só por `renderizarConteudoCelula`. Cada nível de
 *  aninhamento ganha um recuo de espaços não separáveis (`&nbsp;`), já que
 *  dentro de uma célula não dá pra usar recuo de verdade (é tudo uma linha
 *  só de Markdown). Numerada ou com marcador, sempre sai como "•" — dentro
 *  da célula o que importa é preservar a hierarquia visual, não recriar uma
 *  lista Markdown de verdade (que exigiria quebra de linha real, impossível
 *  numa única célula de tabela). */
function linhasDeListaEmCelula(no: No, nivel: number): string[] {
  const itens = no.filhos.filter((f) => f.tag === 'li')
  const indentacao = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(nivel)
  return itens.flatMap((li) => {
    const listasFilhas = li.filhos.filter((f) => f.tag === 'ul' || f.tag === 'ol')
    const conteudoInline = li.filhos
      .filter((f) => f.tag !== 'ul' && f.tag !== 'ol')
      .map(renderizarInline)
      .join('')
      .trim()
    const linhasFilhas = listasFilhas.flatMap((sub) => linhasDeListaEmCelula(sub, nivel + 1))
    return [`${indentacao}• ${conteudoInline}`, ...linhasFilhas]
  })
}

/**
 * Renderiza o conteúdo de UMA célula (`<td>`/`<th>`), preservando parágrafo
 * e item de lista (inclusive lista aninhada) como linha separada — em vez
 * de jogar tudo achatado num parágrafo só, que era o que a célula virava
 * antes (bastava a célula ter um `<ul>`/`<p>` dentro pra perder toda a
 * hierarquia: cabeçalho, bullet e sub-bullet colavam tudo junto).
 *
 * Markdown de tabela não aceita célula com quebra de linha de verdade — uma
 * quebra vira nova linha da TABELA, não da célula — então as linhas saem
 * unidas por `<br>` HTML: o Markdown deixa tag inline passar direto, e ao
 * renderizar (`marked.parse`) ela vira quebra de linha de verdade dentro da
 * célula, igual ao Word original.
 */
function renderizarConteudoCelula(no: No): string {
  const linhas: string[] = []
  for (const filho of no.filhos) {
    if (filho.tag === 'ul' || filho.tag === 'ol') {
      linhas.push(...linhasDeListaEmCelula(filho, 0))
      continue
    }
    if (filho.tag === '#text') {
      const texto = escaparInlineMarkdown(filho.texto ?? '').trim()
      if (texto) linhas.push(texto)
      continue
    }
    // <p> e qualquer outro bloco (h1-h6, div, etc.) — trata como parágrafo:
    // um <p> só tem conteúdo inline dentro, então dá pra extrair com
    // textoInlineDoNo sem perder nada.
    const texto = textoInlineDoNo(filho)
    if (texto) linhas.push(texto)
  }
  return linhas.join('<br>')
}

function escaparCelulaTabela(texto: string): string {
  return texto.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
}

function renderizarTabela(no: No): string {
  const linhas = no.filhos.flatMap((f) => (f.tag === 'thead' || f.tag === 'tbody' || f.tag === 'tfoot' ? f.filhos : [f])).filter((f) => f.tag === 'tr')
  if (linhas.length === 0) return ''

  const celulasPorLinha = linhas.map((tr) => tr.filhos.filter((f) => f.tag === 'td' || f.tag === 'th').map((c) => escaparCelulaTabela(renderizarConteudoCelula(c))))
  const numColunas = Math.max(...celulasPorLinha.map((l) => l.length))

  function normalizarLinha(linha: string[]): string {
    const celulas = [...linha]
    while (celulas.length < numColunas) celulas.push('')
    return `| ${celulas.join(' | ')} |`
  }

  const [cabecalho, ...resto] = celulasPorLinha
  const separador = `| ${Array(numColunas).fill('---').join(' | ')} |`
  return [normalizarLinha(cabecalho), separador, ...resto.map(normalizarLinha)].join('\n')
}

function renderizarBloco(no: No): string {
  switch (no.tag) {
    case 'h1':
      return `# ${textoInlineDoNo(no)}`
    case 'h2':
      return `## ${textoInlineDoNo(no)}`
    case 'h3':
      return `### ${textoInlineDoNo(no)}`
    case 'h4':
      return `#### ${textoInlineDoNo(no)}`
    case 'h5':
      return `##### ${textoInlineDoNo(no)}`
    case 'h6':
      return `###### ${textoInlineDoNo(no)}`
    case 'p':
      return textoInlineDoNo(no)
    case 'ul':
      return renderizarLista(no, false, 0)
    case 'ol':
      return renderizarLista(no, true, 0)
    case 'table':
      return renderizarTabela(no)
    case 'hr':
      return '---'
    case '#text':
      return escaparInlineMarkdown(no.texto ?? '').trim()
    default:
      // tag de bloco desconhecida (ex.: div) — desce só pro conteúdo
      return no.filhos.map(renderizarBloco).filter(Boolean).join('\n\n')
  }
}

/** Converte o HTML produzido pelo mammoth (a partir de um .docx) em Markdown,
 *  preservando o conteúdo original — sem IA, sem interpretar nem resumir. */
export function converterHtmlParaMarkdown(html: string): string {
  const arvore = construirArvore(tokenizar(html))
  return arvore.filhos
    .map(renderizarBloco)
    .map((bloco) => bloco.trim())
    .filter(Boolean)
    .join('\n\n')
}
