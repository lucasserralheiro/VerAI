import { TAMANHO_MAXIMO_ARQUIVO_BYTES } from '../caminhos'
import { contentTypeDe } from '../tipos'

// Regras puras da sincronização com a biblioteca ContratosReceita (spec
// docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md §4). Sem banco,
// sem sistema de arquivos — tudo aqui é testável isolado.

/** Chave de comparação de nome de pasta/sigla: sem acento, sem caixa, espaços colapsados. */
export function normalizarChave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mapa `scripts/sharepoint-clientes.json`: nome da pasta → sigla do cliente, ou `null` pra ignorar. */
export type MapaPastas = Record<string, string | null>

export type ClientePorSigla = Map<string, { id: string; nome: string }>

export type ResolucaoCliente =
  | { tipo: 'cliente'; clienteId: string; nome: string }
  | { tipo: 'ignorar' }
  | { tipo: 'sem-cliente' }

/** Cliente da primeira pasta: mapa explícito primeiro (vale `null` = ignorar), senão a própria
 *  pasta como sigla. Nunca por nome do cliente — mesma regra do importador GRC-1. */
export function resolverCliente(pasta: string, clientes: ClientePorSigla, mapa: MapaPastas): ResolucaoCliente {
  const chave = normalizarChave(pasta)
  const entrada = Object.entries(mapa).find(([k]) => normalizarChave(k) === chave)
  if (entrada && entrada[1] === null) return { tipo: 'ignorar' }
  const sigla = entrada ? normalizarChave(entrada[1] as string) : chave
  const cliente = clientes.get(sigla)
  return cliente ? { tipo: 'cliente', clienteId: cliente.id, nome: cliente.nome } : { tipo: 'sem-cliente' }
}

/** Por que um arquivo fica de fora, ou `null` se entra. `segmentos` = caminho relativo quebrado
 *  em pastas, último = nome do arquivo. */
export function motivoIgnorar(segmentos: string[], tamanhoBytes: number, incluirWork: boolean): string | null {
  if (segmentos.length < 2) return 'arquivo solto na raiz'
  if (segmentos.some((s) => s.startsWith('.') || s.startsWith('~$'))) return 'oculto ou temporário'
  const pastas = segmentos.slice(0, -1)
  if (!incluirWork && pastas.some((p) => normalizarChave(p) === 'WORK')) return 'rascunho (WORK)'
  const nome = segmentos[segmentos.length - 1]
  if (contentTypeDe(nome) === 'application/octet-stream') return 'extensão não aceita'
  if (tamanhoBytes > TAMANHO_MAXIMO_ARQUIVO_BYTES) return 'acima de 50 MB'
  if (tamanhoBytes === 0) return 'arquivo vazio'
  return null
}

/** Primeira pasta (fora a do cliente) que começa com "TC " — só informativo. */
export function pastaContratoDe(segmentos: string[]): string | null {
  return segmentos.slice(1, -1).find((s) => /^TC\s/i.test(s.trim())) ?? null
}

/** Tamanho ou data diferente do estado → precisa ler e recalcular o hash. Tolerância de 2 s na
 *  data (precisão do sistema de arquivos / OneDrive). */
export function mudouPorMetadado(
  estado: { tamanhoBytes: number; modificadoEm: Date },
  atual: { tamanhoBytes: number; modificadoEm: Date }
): boolean {
  return (
    estado.tamanhoBytes !== atual.tamanhoBytes ||
    Math.abs(estado.modificadoEm.getTime() - atual.modificadoEm.getTime()) > 2000
  )
}
