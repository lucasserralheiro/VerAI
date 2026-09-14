import { aplicarMudancas, mudancasDaChecagem, type TrechoComCorrecao } from './mudancasTexto'

export type TrechoParaCorrigir = TrechoComCorrecao

export interface ResultadoAplicarCorrecoesChecagem {
  markdown: string
  /** Quantas correções realmente entraram no Markdown devolvido. */
  aplicadas: number
}

/**
 * Aplica, de uma vez, as correções sugeridas pela checagem por IA da
 * conversão — troca de `trecho` (cópia exata de um pedaço do Markdown,
 * garantida pelo prompt de `checarConversao`) pela `correcaoSugerida` (já
 * validada contra o texto original da página no servidor, ver
 * `correcaoEhSegura` em `src/lib/ia/checarConversao.ts`).
 *
 * A troca é feita por posição a partir do Markdown recebido (ver
 * `mudancasTexto.ts`), não em cascata: uma correção nunca é aplicada em
 * cima do texto que outra acabou de inserir.
 *
 * Ignora silenciosamente item sem correção, correção igual ao trecho, ou
 * trecho que não existe mais no Markdown atual (a pessoa já editou aquele
 * ponto manualmente desde a checagem).
 */
export function aplicarCorrecoesChecagem(
  markdown: string,
  trechos: TrechoParaCorrigir[]
): ResultadoAplicarCorrecoesChecagem {
  const mudancas = mudancasDaChecagem(markdown, trechos)
  return { markdown: aplicarMudancas(markdown, mudancas), aplicadas: mudancas.length }
}
