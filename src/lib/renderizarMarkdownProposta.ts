import { marked } from 'marked'
import { listarBlocosOcrPendente } from './ocr/marcadorOcrPendente'

/**
 * Renderiza Markdown pra HTML e destaca como alerta visual qualquer parágrafo
 * que comece com "Divergência" — convenção que fica disponível pra quem for
 * editar o texto manualmente sinalizar um conflito entre fontes (a
 * conversão em si é 100% determinística, sem IA, então nada gera esse aviso
 * sozinho). Sem isso, um aviso desses (geralmente em itálico) se perderia
 * visualmente no meio do texto normal; aqui ele vira um card com borda e
 * ícone, junto com `.callout-divergencia` em globals.css. Também troca cada
 * bloco `:::ocr-pendente` por um callout `.callout-ocr-pendente` — o `:::`
 * não é sintaxe que o `marked` entenda, então a substituição acontece ANTES
 * do parse, virando `<div>` puro que o `marked` repassa sem mexer.
 */
export function renderizarMarkdownProposta(markdown: string): string {
  let comCallouts = markdown
  for (const bloco of listarBlocosOcrPendente(markdown)) {
    const aviso = `<div class="callout-ocr-pendente">⚠️ Texto por OCR, não conferido — página ${bloco.pagina} do arquivo original</div>`
    comCallouts = comCallouts.replace(bloco.blocoCompleto, aviso)
  }

  const html = marked.parse(comCallouts) as string

  if (typeof DOMParser === 'undefined') return html // SSR — o pós-processamento só roda no client

  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const paragrafo of doc.body.querySelectorAll('p')) {
    if (/^divergência/i.test(paragrafo.textContent?.trim() ?? '')) {
      paragrafo.classList.add('callout-divergencia')
    }
  }
  return doc.body.innerHTML
}
