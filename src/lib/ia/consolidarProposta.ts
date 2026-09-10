/**
 * DESATIVADO — não use.
 *
 * Este módulo mesclava o conteúdo de vários arquivos de uma Proposta
 * Comercial num único Markdown usando IA (`generateText`). Foi removido do
 * fluxo por exigência explícita: a Proposta Comercial (Conversão SEI) não
 * pode ter NENHUMA etapa de IA — o conteúdo final tem que ser idêntico ao
 * original, apenas reformatado. A consolidação de múltiplos arquivos agora é
 * feita de forma 100% determinística em `src/app/api/propostas-comerciais/route.ts`
 * (concatenação simples, cada arquivo sob seu próprio título), usando os
 * conversores determinísticos de `src/lib/extracao` (`converterParaMarkdownDeterministico`,
 * `converterPdfParaMarkdown`).
 *
 * Este arquivo não pôde ser apagado neste ambiente — fica só como registro,
 * sem ser importado por nada. Não reintroduza essa chamada de IA aqui.
 */
export {}
