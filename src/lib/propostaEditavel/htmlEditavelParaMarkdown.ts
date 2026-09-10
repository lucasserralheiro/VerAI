/**
 * Converte o HTML de um `contentEditable` de volta pra Markdown — a metade
 * inversa de `renderizarMarkdownProposta`. Diferente de
 * `src/lib/extracao/htmlMarkdown.ts` (feito pra saída regular do mammoth),
 * este é baseado em DOM porque o HTML que sai do `contentEditable` do
 * navegador é mais irregular (divs soltas, spans com style, b/i em vez de
 * strong/em) e precisa de uma normalização antes de virar Markdown.
 *
 * Round-trip "melhor esforço": conteúdo e estrutura preservados, não
 * byte-idêntico.
 */
export function htmlEditavelParaMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, 'text/html')
  const raiz = doc.getElementById('raiz')!
  normalizar(raiz)
  return converterFilhos(raiz)
}

function normalizar(raiz: HTMLElement): void {
  const doc = raiz.ownerDocument

  // Desembrulha o callout de divergência — o texto "Divergência:" já basta
  // pra `renderizarMarkdownProposta` recriar o callout na próxima renderização.
  raiz.querySelectorAll('.callout-divergencia').forEach((el) => desembrulhar(el))

  raiz.querySelectorAll('b').forEach((el) => renomear(el, 'strong'))
  raiz.querySelectorAll('i').forEach((el) => renomear(el, 'em'))
  raiz.querySelectorAll('span, font').forEach((el) => desembrulhar(el))

  // <div> de bloco (fora de célula/item de lista) é como o contentEditable
  // costuma marcar uma linha nova — vira parágrafo.
  raiz.querySelectorAll('div').forEach((el) => {
    if (el.closest('td, th, li')) return
    renomear(el, 'p')
  })

  raiz.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('style')
    el.removeAttribute('class')
  })

  const walker = doc.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
  let no = walker.nextNode()
  while (no) {
    no.textContent = (no.textContent ?? '').replace(/\u00A0/g, ' ')
    no = walker.nextNode()
  }
}

function renomear(el: Element, tag: string): void {
  const novo = el.ownerDocument.createElement(tag)
  while (el.firstChild) novo.appendChild(el.firstChild)
  el.replaceWith(novo)
}

function desembrulhar(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes))
}

function escaparInlineMarkdown(texto: string): string {
  return texto.replace(/([*_`])/g, '\\$1')
}

function inline(no: Node): string {
  if (no.nodeType === 3) return escaparInlineMarkdown(no.textContent ?? '')
  const el = no as Element
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') return '  \n'
  const conteudo = Array.from(el.childNodes).map(inline).join('')
  switch (tag) {
    case 'strong':
      return conteudo.trim() ? `**${conteudo}**` : conteudo
    case 'em':
      return conteudo.trim() ? `_${conteudo}_` : conteudo
    case 'a': {
      const href = el.getAttribute('href') ?? ''
      return href ? `[${conteudo}](${href})` : conteudo
    }
    default:
      return conteudo
  }
}

function inlineDoElemento(el: Element): string {
  return Array.from(el.childNodes).map(inline).join('').trim()
}

function converterLista(el: Element, ordenada: boolean, nivel: number): string {
  const indentacao = '  '.repeat(nivel)
  const itens = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li')
  return itens
    .map((li, indice) => {
      const sublistas = Array.from(li.children).filter((c) => ['ul', 'ol'].includes(c.tagName.toLowerCase()))
      const conteudo = Array.from(li.childNodes)
        .filter((n) => !(n.nodeType === 1 && ['ul', 'ol'].includes((n as Element).tagName.toLowerCase())))
        .map(inline)
        .join('')
        .trim()
      const marcador = ordenada ? `${indice + 1}.` : '-'
      let linha = `${indentacao}${marcador} ${conteudo}`
      for (const sub of sublistas) {
        const md = converterLista(sub, sub.tagName.toLowerCase() === 'ol', nivel + 1)
        if (md) linha += `\n${md}`
      }
      return linha
    })
    .join('\n')
}

function escaparCelulaTabela(texto: string): string {
  return texto.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
}

function converterTabela(el: Element): string {
  const linhas = Array.from(el.querySelectorAll('tr'))
  if (linhas.length === 0) return ''

  const celulasPorLinha = linhas.map((tr) =>
    Array.from(tr.children)
      .filter((c) => ['td', 'th'].includes(c.tagName.toLowerCase()))
      .map((c) => escaparCelulaTabela(inlineDoElemento(c)))
  )
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

function converterBloco(el: Element): string {
  const tag = el.tagName.toLowerCase()
  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `${'#'.repeat(Number(tag[1]))} ${inlineDoElemento(el)}`
    case 'p':
      return inlineDoElemento(el)
    case 'ul':
      return converterLista(el, false, 0)
    case 'ol':
      return converterLista(el, true, 0)
    case 'table':
      return converterTabela(el)
    case 'hr':
      return '---'
    default:
      // tag de bloco desconhecida (ex.: sobrou algum <div> aninhado) — desce
      // só pro conteúdo.
      return converterFilhos(el)
  }
}

function converterFilhos(raiz: Element): string {
  const blocos: string[] = []
  for (const no of Array.from(raiz.childNodes)) {
    if (no.nodeType === 3) {
      const texto = escaparInlineMarkdown(no.textContent ?? '').trim()
      if (texto) blocos.push(texto)
      continue
    }
    const bloco = converterBloco(no as Element).trim()
    if (bloco) blocos.push(bloco)
  }
  return blocos.join('\n\n')
}
