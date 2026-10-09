import { createHash, randomBytes } from 'node:crypto'

// Chave de API de um aplicativo: `vrai_` + 32 caracteres aleatórios. Só o SHA-256 fica no banco; a chave
// inteira aparece uma vez (ao criar ou girar). O prefixo ("vrai_3f9a1c2b") identifica a chave na tela.

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
export const PREFIXO_DA_CHAVE = 'vrai_'

function aleatorio(tamanho: number): string {
  const bytes = randomBytes(tamanho)
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')
}

export function hashDaChave(chave: string): string {
  return createHash('sha256').update(chave).digest('hex')
}

export function gerarChave(): { chave: string; prefixo: string; hash: string } {
  const chave = `${PREFIXO_DA_CHAVE}${aleatorio(32)}`
  return { chave, prefixo: chave.slice(0, PREFIXO_DA_CHAVE.length + 8), hash: hashDaChave(chave) }
}

/** Segredo de webhook (HMAC). */
export function gerarSegredo(): string {
  return `whsec_${aleatorio(32)}`
}
