import { listarBlocosOcrPendente } from './ocr/marcadorOcrPendente'

/**
 * Pós-processa o HTML já salvo da proposta pra exibição: troca cada
 * marcador `<div class="ocr-pendente">` por um callout visual
 * (`.callout-ocr-pendente`) e marca como `.callout-divergencia` qualquer
 * parágrafo que comece com "Divergência" — convenção que fica disponível
 * pra quem for editar o texto manualmente sinalizar um conflito entre
 * fontes (a conversão em si é 100% determinística, sem IA, então nada gera
 * esse aviso sozinho).
 *
 * Não interpreta sintaxe nenhuma — o conteúdo já É HTML (ver
 * docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md).
 * Antes desta função rodava `marked.parse` pra converter Markdown; isso saiu.
 */
export function renderizarHtmlProposta(html: string): string {
  let comCallouts = html
  for (const bloco of listarBlocosOcrPendente(html)) {
    const aviso = `<div class="callout-ocr-pendente">⚠️ Texto por OCR, não conferido — página ${bloco.pagina} do arquivo original</div>`
    comCallouts = comCallouts.replace(bloco.blocoCompleto, aviso)
  }

  if (typeof DOMParser === 'undefined') return comCallouts // SSR — o pós-processamento só roda no client

  const doc = new DOMParser().parseFromString(comCallouts, 'text/html')
  for (const paragrafo of doc.body.querySelectorAll('p')) {
    if (/^divergência/i.test(paragrafo.textContent?.trim() ?? '')) {
      paragrafo.classList.add('callout-divergencia')
    }
  }
  return doc.body.innerHTML
}
