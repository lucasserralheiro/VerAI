/**
 * Sanitiza o HTML que sai de um `contentEditable` antes de salvar —
 * normaliza o jeito irregular como o navegador marca formatação
 * (`<div>`/`<span style>`/`<b>` em vez de `<p>`/`<strong>`) pro mesmo
 * subconjunto de tags que o resto do conversor usa. Diferente do módulo
 * anterior (`htmlEditavelParaMarkdown.ts`, removido), NÃO serializa pra
 * Markdown — devolve HTML mesmo, que já é o formato de armazenamento (ver
 * docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md).
 *
 * Round-trip "melhor esforço": conteúdo e estrutura preservados, não
 * byte-idêntico.
 */
export function sanitizarHtmlEditavel(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, 'text/html')
  const raiz = doc.getElementById('raiz')!
  normalizar(raiz)
  return raiz.innerHTML
}

function normalizar(raiz: HTMLElement): void {
  const doc = raiz.ownerDocument

  // Desembrulha o callout de divergência — decoração só de exibição
  // (`renderizarHtmlProposta` recria a partir do texto "Divergência:" na
  // próxima renderização); salvar o wrapper junto duplicaria a marcação.
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
    no.textContent = (no.textContent ?? '').replace(/ /g, ' ')
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
