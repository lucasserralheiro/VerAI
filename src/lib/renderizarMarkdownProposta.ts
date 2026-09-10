import { marked } from 'marked'

/**
 * Renderiza Markdown pra HTML e destaca como alerta visual qualquer parágrafo
 * que comece com "Divergência" — convenção que fica disponível pra quem for
 * editar o texto manualmente sinalizar um conflito entre fontes (a
 * conversão em si é 100% determinística, sem IA, então nada gera esse aviso
 * sozinho). Sem isso, um aviso desses (geralmente em itálico) se perderia
 * visualmente no meio do texto normal; aqui ele vira um card com borda e
 * ícone, junto com `.callout-divergencia` em globals.css.
 */
export function renderizarMarkdownProposta(markdown: string): string {
  const html = marked.parse(markdown) as string

  if (typeof DOMParser === 'undefined') return html // SSR — o pós-processamento só roda no client

  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const paragrafo of doc.body.querySelectorAll('p')) {
    if (/^divergência/i.test(paragrafo.textContent?.trim() ?? '')) {
      paragrafo.classList.add('callout-divergencia')
    }
  }
  return doc.body.innerHTML
}
