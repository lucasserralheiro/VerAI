/**
 * Formato e manipulação do marcador `:::ocr-pendente[...]` — é ele que carrega
 * todo o estado de "essa página ainda não foi conferida", direto no texto do
 * `conteudoMarkdown`, sem coluna nova no banco (ver
 * docs/superpowers/specs/2026-08-31-ocr-fallback-proposta-comercial-design.md,
 * seção 2).
 */

export interface BlocoOcrPendente {
  /** Trecho exato do markdown, do "::: ocr-pendente[...]" ao ":::" de
   *  fechamento — chave pra localizar/substituir esse bloco específico. */
  blocoCompleto: string
  arquivoId: string | null
  pagina: number
  corpo: string
}

const REGEX_BLOCO = /:::ocr-pendente\[([^\]]*)\]\n([\s\S]*?)\n:::/g

function montarAtributos(pagina: number, arquivoId?: string | null): string {
  return arquivoId ? `arquivoId=${arquivoId} pagina=${pagina}` : `pagina=${pagina}`
}

export function formatarBlocoOcrPendente(pagina: number, arquivoId?: string | null, corpo = '_(aguardando OCR)_'): string {
  return `:::ocr-pendente[${montarAtributos(pagina, arquivoId)}]\n${corpo}\n:::`
}

export function listarBlocosOcrPendente(markdown: string): BlocoOcrPendente[] {
  const blocos: BlocoOcrPendente[] = []
  for (const m of markdown.matchAll(REGEX_BLOCO)) {
    const atributos = m[1]
    const arquivoId = /arquivoId=(\S+)/.exec(atributos)?.[1] ?? null
    const pagina = Number(/pagina=(\d+)/.exec(atributos)?.[1] ?? '0')
    blocos.push({ blocoCompleto: m[0], arquivoId, pagina, corpo: m[2] })
  }
  return blocos
}

/** Usado pelo `POST /api/propostas-comerciais` — o conversor só sabe o número
 *  da página, não o `arquivoId` (ainda não existe no banco nesse ponto). */
export function reescreverComArquivoId(markdown: string, arquivoId: string): string {
  return markdown.replace(/:::ocr-pendente\[pagina=(\d+)\]/g, `:::ocr-pendente[arquivoId=${arquivoId} pagina=$1]`)
}

/** Troca só o CORPO do bloco (ex.: preenche com o texto reconhecido no lugar
 *  de "_(aguardando OCR)_"), mantendo o wrapper — a página continua pendente
 *  de conferência humana até `removerWrapper`. */
export function substituirCorpo(markdown: string, bloco: BlocoOcrPendente, novoCorpo: string): string {
  return markdown.replace(bloco.blocoCompleto, formatarBlocoOcrPendente(bloco.pagina, bloco.arquivoId, novoCorpo))
}

/** Conferência: some com o wrapper, fica só o texto — é isso que faz a
 *  página parar de contar como pendente. */
export function removerWrapper(markdown: string, bloco: BlocoOcrPendente, textoFinal: string): string {
  return markdown.replace(bloco.blocoCompleto, textoFinal)
}

export function temBlocoOcrPendente(markdown: string): boolean {
  return /:::ocr-pendente/.test(markdown)
}
