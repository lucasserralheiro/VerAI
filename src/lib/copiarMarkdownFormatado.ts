import { marked } from 'marked'

/** Mesma fonte/tamanho institucional definidos em `.markdown-preview`
 *  (`src/app/globals.css`) — Aptos (Corpo) 12pt no texto normal, 14pt negrito
 *  nos títulos. Repetido aqui porque o HTML copiado vai colado num app
 *  externo (Word, SEI); só a classe CSS `.markdown-preview` não viaja com a
 *  área de transferência, então cada elemento precisa carregar o estilo
 *  embutido (`style="..."`) pra manter a formatação depois de colado. */
const FONTE_APTOS = "'Aptos', 'Aptos Text', Calibri, 'Segoe UI', sans-serif"
const TAMANHO_CORPO = '12pt'
const TAMANHO_TITULO = '14pt'

/** Aplica a fonte/tamanho institucional como estilo inline em cada elemento
 *  do HTML gerado pelo Markdown — mutação in-place do `doc` recebido. */
function aplicarFonteInstitucional(doc: Document): void {
  doc.body.style.cssText = `font-family: ${FONTE_APTOS}; font-size: ${TAMANHO_CORPO}; line-height: 1.5;`

  for (const titulo of doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    ;(titulo as HTMLElement).style.cssText = `font-family: ${FONTE_APTOS}; font-size: ${TAMANHO_TITULO}; font-weight: bold;`
  }

  for (const negrito of doc.body.querySelectorAll('strong, b')) {
    ;(negrito as HTMLElement).style.cssText = `font-family: ${FONTE_APTOS}; font-weight: bold;`
  }

  for (const elemento of doc.body.querySelectorAll('p, li, td, th, span, em, i, a, blockquote, code')) {
    const el = elemento as HTMLElement
    const pesoNegrito = el.tagName === 'TH' ? ' font-weight: bold;' : ''
    el.style.cssText = `font-family: ${FONTE_APTOS}; font-size: ${TAMANHO_CORPO};${pesoNegrito}`
  }
}

/**
 * Copia Markdown pra área de transferência como HTML real (`text/html`, com
 * `text/plain` de fallback) — assim colar num Word/editor rico traz tabelas
 * e negrito de verdade, em vez do texto cru com `**` e `|` literais que sai
 * ao copiar direto do source Markdown (é esse o motivo de existir: colar a
 * partir do textarea de edição nunca vira formatação nenhuma, só o preview
 * renderizado carrega isso pro clipboard).
 *
 * Cada elemento sai com a fonte institucional (Aptos, corpo 12pt / título
 * 14pt negrito) já embutida no `style`, pra colar no Word/SEI com a mesma
 * formatação que aparece na tela — ver `aplicarFonteInstitucional`.
 */
export async function copiarMarkdownFormatado(markdown: string): Promise<void> {
  const htmlBruto = marked.parse(markdown) as string
  const doc = new DOMParser().parseFromString(htmlBruto, 'text/html')
  aplicarFonteInstitucional(doc)

  const html = doc.body.innerHTML
  const textoSimples = doc.body.textContent ?? markdown

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([textoSimples], { type: 'text/plain' }),
    }),
  ])
}
