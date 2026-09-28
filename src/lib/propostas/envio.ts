import { randomUUID } from 'node:crypto'

// Envio de arquivo da "Nova conversão" direto do navegador pro Cloudflare R2 (spec
// docs/superpowers/specs/2026-09-28-envio-proposta-r2-design.md). O arquivo cai num caminho
// temporário; a conversão (`POST /api/propostas-comerciais`) só aceita endereço desse formato e grava
// o original ao lado das imagens da proposta. Saiu do Vercel Blob, suspenso por cota em 24/09/2026.

export const TIPOS_DE_ENVIO = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const
export type ExtensaoDeEnvio = keyof typeof TIPOS_DE_ENVIO

/** Bem acima do que qualquer proposta real usa hoje (a tela avisa 20 MB) — o mesmo teto do token antigo. */
export const TAMANHO_MAXIMO_ENVIO = 50 * 1024 * 1024
export const VALIDADE_DO_LINK_S = 15 * 60

export function extensaoDeEnvio(nome: string): ExtensaoDeEnvio | null {
  if (!nome.includes('.')) return null
  const ext = nome.toLowerCase().split('.').pop() ?? ''
  return Object.hasOwn(TIPOS_DE_ENVIO, ext) ? (ext as ExtensaoDeEnvio) : null
}

/** Só uuid e extensão: o nome do arquivo viaja à parte, nunca no caminho. */
export const chaveDeEnvio = (extensao: ExtensaoDeEnvio, id: string = randomUUID()) => `tmp-uploads/${id}.${extensao}`

const ENDERECO_DE_ENVIO = /^r2:tmp-uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|xlsx|csv|docx)$/

/** Endereço que o navegador pode mandar pra conversão: só o temporário do envio. A conversão lê e
 *  depois APAGA esse endereço — qualquer outro deixaria mexer em arquivo alheio do bucket. */
export const ehEnderecoDeEnvio = (endereco: string) => ENDERECO_DE_ENVIO.test(endereco)

export const chaveOriginalProposta = (propostaId: string, indice: number, extensao: string) =>
  `propostas-comerciais/${propostaId}/${indice}/original.${extensao}`

/** Chave no R2 do original gravado por esta proposta — `null` pra arquivo antigo (Blob) ou de fora dela. */
export function chaveDoOriginalNoR2(endereco: string, propostaId: string): string | null {
  const prefixo = `r2:propostas-comerciais/${propostaId}/`
  return endereco.startsWith(prefixo) ? endereco.slice('r2:'.length) : null
}
