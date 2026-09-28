// Imagens extraídas de dentro do PDF na conversão de uma proposta comercial (figura, print de tela,
// tabela que veio como imagem). Ficam no Cloudflare R2, que é privado: o `<img>` do HTML aponta pra
// rota do VerAI (`/api/propostas-comerciais/[id]/imagens/[indice]/[nome]`), que confere o login e
// lê do R2. Saíram do Vercel Blob porque o store foi suspenso por cota em 24/09/2026 (decisão do
// usuário: uploads vão pro R2).

/** Nome que `pdfImagens.ts` dá a cada imagem — a rota só aceita esse formato (sem `..` nem `/`). */
export const NOME_IMAGEM_VALIDO = /^pagina-\d+-imagem-\d+\.png$/

export function chaveImagemProposta(propostaId: string, indice: number | string, nomeArquivo: string): string {
  return `propostas-comerciais/${propostaId}/${indice}/imagens/${nomeArquivo}`
}

export function urlImagemProposta(propostaId: string, indice: number | string, nomeArquivo: string): string {
  return `/api/propostas-comerciais/${propostaId}/imagens/${indice}/${nomeArquivo}`
}

const escaparRegex = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Chaves no R2 das imagens desta proposta citadas no HTML — é assim que a exclusão sabe o que
 *  apagar, sem precisar listar o bucket. Imagem antiga (URL do Blob) e de outra proposta ficam fora. */
export function chavesDasImagensNoHtml(html: string | null | undefined, propostaId: string): string[] {
  if (!html) return []
  const padrao = new RegExp(`/api/propostas-comerciais/${escaparRegex(propostaId)}/imagens/(\\d+)/(pagina-\\d+-imagem-\\d+\\.png)`, 'g')
  const chaves = new Set<string>()
  for (const [, indice, nome] of html.matchAll(padrao)) chaves.add(chaveImagemProposta(propostaId, indice, nome))
  return [...chaves]
}
