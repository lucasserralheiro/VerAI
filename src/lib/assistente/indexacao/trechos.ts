import { createHash } from 'node:crypto'

export interface PaginaDeTexto {
  /** Página do PDF (1-indexada); `null` em planilha/docx/texto já extraído. */
  pagina: number | null
  texto: string
}

export interface Trecho {
  pagina: number | null
  ordem: number
  texto: string
}

export const TAMANHO_TRECHO = 1500
export const SOBREPOSICAO = 200

/**
 * Corta o texto de cada página em pedaços pesquisáveis. A sobreposição existe pra uma cláusula
 * cortada no meio aparecer inteira em pelo menos um dos dois trechos vizinhos. Quando há quebra
 * de linha ou fim de frase depois da metade do pedaço, corta ali em vez de no meio da palavra.
 */
export function cortarEmTrechos(
  paginas: PaginaDeTexto[],
  tamanho = TAMANHO_TRECHO,
  sobreposicao = SOBREPOSICAO
): Trecho[] {
  const trechos: Trecho[] = []
  for (const { pagina, texto } of paginas) {
    // Alguns PDFs trazem 0x00 e outros caracteres de controle no texto; o Postgres recusa 0x00 em
    // `text` e a gravação do trecho inteiro falhava. Quebra de linha e tab ficam.
    const limpo = texto.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (!limpo) continue
    let inicio = 0
    while (inicio < limpo.length) {
      let fim = Math.min(inicio + tamanho, limpo.length)
      if (fim < limpo.length) {
        const quebra = Math.max(limpo.lastIndexOf('\n', fim - 1), limpo.lastIndexOf('. ', fim - 2))
        if (quebra > inicio + tamanho / 2) fim = quebra + 1
      }
      trechos.push({ pagina, ordem: trechos.length, texto: limpo.slice(inicio, fim).trim() })
      if (fim >= limpo.length) break
      inicio = Math.max(fim - sobreposicao, inicio + 1)
    }
  }
  return trechos
}

/** HTML da conversão determinística (Proposta Comercial) → texto corrido pesquisável. */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<br\s*\/?>|<\/(p|tr|li|h[1-6]|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function hashTexto(texto: string): string {
  return createHash('sha1').update(texto).digest('hex')
}
