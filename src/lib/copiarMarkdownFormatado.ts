import { marked } from 'marked'

/**
 * Copia Markdown pra área de transferência como HTML real (`text/html`, com
 * `text/plain` de fallback) — assim colar num Word/editor rico traz tabelas
 * e negrito de verdade, em vez do texto cru com `**` e `|` literais que sai
 * ao copiar direto do source Markdown (é esse o motivo de existir: colar a
 * partir do textarea de edição nunca vira formatação nenhuma, só o preview
 * renderizado carrega isso pro clipboard).
 */
export async function copiarMarkdownFormatado(markdown: string): Promise<void> {
  const html = marked.parse(markdown) as string
  const textoSimples = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? markdown

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([textoSimples], { type: 'text/plain' }),
    }),
  ])
}
