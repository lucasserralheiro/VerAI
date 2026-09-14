/**
 * Formato e manipulação do marcador `<div class="ocr-pendente" ...>` — é ele
 * que carrega todo o estado de "essa página ainda não foi conferida", direto
 * no texto do `conteudoMarkdown` (que hoje guarda HTML, ver
 * docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md),
 * sem coluna nova no banco (ver
 * docs/superpowers/specs/2026-08-31-ocr-fallback-proposta-comercial-design.md,
 * seção 2).
 */

export interface BlocoOcrPendente {
  /** Trecho exato do HTML, da abertura `<div class="ocr-pendente" ...>` ao
   *  `</div>` de fechamento — chave pra localizar/substituir esse bloco
   *  específico. */
  blocoCompleto: string
  arquivoId: string | null
  pagina: number
  corpo: string
}

const REGEX_BLOCO = /<div class="ocr-pendente"([^>]*)>([\s\S]*?)<\/div>/g

function montarAtributos(pagina: number, arquivoId?: string | null): string {
  const arquivo = arquivoId ? ` data-arquivo-id="${arquivoId}"` : ''
  return `${arquivo} data-pagina="${pagina}"`
}

export function formatarBlocoOcrPendente(
  pagina: number,
  arquivoId?: string | null,
  corpo = '<p><em>(aguardando OCR)</em></p>'
): string {
  return `<div class="ocr-pendente"${montarAtributos(pagina, arquivoId)}>${corpo}</div>`
}

export function listarBlocosOcrPendente(html: string): BlocoOcrPendente[] {
  const blocos: BlocoOcrPendente[] = []
  for (const m of html.matchAll(REGEX_BLOCO)) {
    const atributos = m[1]
    const arquivoId = /data-arquivo-id="([^"]*)"/.exec(atributos)?.[1] ?? null
    const pagina = Number(/data-pagina="(\d+)"/.exec(atributos)?.[1] ?? '0')
    blocos.push({ blocoCompleto: m[0], arquivoId, pagina, corpo: m[2] })
  }
  return blocos
}

/** Usado pelo `POST /api/propostas-comerciais` — o conversor só sabe o número
 *  da página, não o `arquivoId` (ainda não existe no banco nesse ponto). */
export function reescreverComArquivoId(html: string, arquivoId: string): string {
  return html.replace(
    /<div class="ocr-pendente" data-pagina="(\d+)">/g,
    `<div class="ocr-pendente" data-arquivo-id="${arquivoId}" data-pagina="$1">`
  )
}

/** Troca só o CORPO do bloco (ex.: preenche com o texto reconhecido no lugar
 *  de "(aguardando OCR)"), mantendo o wrapper — a página continua pendente
 *  de conferência humana até `removerWrapper`. */
export function substituirCorpo(html: string, bloco: BlocoOcrPendente, novoCorpo: string): string {
  return html.replace(bloco.blocoCompleto, formatarBlocoOcrPendente(bloco.pagina, bloco.arquivoId, novoCorpo))
}

/** Conferência: some com o wrapper, fica só o HTML final — é isso que faz a
 *  página parar de contar como pendente. */
export function removerWrapper(html: string, bloco: BlocoOcrPendente, htmlFinal: string): string {
  return html.replace(bloco.blocoCompleto, htmlFinal)
}

export function temBlocoOcrPendente(html: string): boolean {
  return /<div class="ocr-pendente"/.test(html)
}
