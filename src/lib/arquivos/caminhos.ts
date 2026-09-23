// Caminhos no Vercel Blob do repositório do cliente. Roda no navegador e no servidor.

export const PREFIXO_TEMPORARIO = 'tmp-arquivos/'
export const TAMANHO_MAXIMO_ARQUIVO_BYTES = 50 * 1024 * 1024

const LIMITE_NOME = 120

/** Nome utilizável em caminho de blob: sem acento, só `[A-Za-z0-9._-]`, até 120 caracteres com a
 *  extensão preservada. */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9.\-]+/g, '_')
  if (limpo.length <= LIMITE_NOME) return limpo
  const ponto = limpo.lastIndexOf('.')
  const extensao = ponto > 0 ? limpo.slice(ponto) : ''
  return limpo.slice(0, LIMITE_NOME - extensao.length) + extensao
}

export function caminhoTemporario(nome: string): string {
  return `${PREFIXO_TEMPORARIO}${crypto.randomUUID()}-${nomeSeguro(nome)}`
}

export function caminhoFinalArquivo(clienteId: string, arquivoId: string, nome: string): string {
  return `clientes/${clienteId}/${arquivoId}/${nomeSeguro(nome)}`
}

/** O servidor só baixa (e registra) o que veio do upload direto: https, host do Vercel Blob, sob o
 *  prefixo temporário. Qualquer outra URL seria o servidor buscando endereço arbitrário. */
export function urlTemporariaValida(url: unknown): boolean {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return (
      u.protocol === 'https:' &&
      u.hostname.endsWith('.public.blob.vercel-storage.com') &&
      u.pathname.startsWith(`/${PREFIXO_TEMPORARIO}`)
    )
  } catch {
    return false
  }
}
