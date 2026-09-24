import type { CategoriaArquivo } from '@prisma/client'
import { TAMANHO_MAXIMO_ARQUIVO_BYTES } from '../caminhos'
import { extensaoDe, sugerirCategoria } from '../tipos'

// Regras puras da sincronização com a biblioteca ContratosReceita (specs
// docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md §4 e
// docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.1). Sem banco, sem sistema de
// arquivos — tudo aqui é testável isolado.

/** Chave de comparação de nome de pasta/sigla: sem acento, sem caixa, espaços colapsados. */
export function normalizarChave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

/** Sigla (normalizada) a que a pasta do cliente corresponde: mapa explícito primeiro, senão a própria
 *  pasta. `null` = pasta ignorada de propósito no mapa. */
export function siglaDaPasta(pasta: string, mapa: MapaPastas): string | null {
  const chave = normalizarChave(pasta)
  const entrada = Object.entries(mapa).find(([k]) => normalizarChave(k) === chave)
  if (entrada) return entrada[1] === null ? null : normalizarChave(entrada[1])
  return chave
}

/** Cliente da primeira pasta: pela sigla (pasta ou mapa). Nunca por nome do cliente — mesma regra do
 *  importador GRC-1. */
export function resolverCliente(pasta: string, clientes: ClientePorSigla, mapa: MapaPastas): ResolucaoCliente {
  const sigla = siglaDaPasta(pasta, mapa)
  if (sigla === null) return { tipo: 'ignorar' }
  const cliente = clientes.get(sigla)
  return cliente ? { tipo: 'cliente', clienteId: cliente.id, nome: cliente.nome } : { tipo: 'sem-cliente' }
}

const ARQUIVOS_DE_SISTEMA = new Set(['DESKTOP.INI', 'THUMBS.DB'])

/** Por que um arquivo fica de fora, ou `null` se entra. Entra TODO documento — inclusive `WORK/` e
 *  extensão desconhecida (spec lugar-certo §3.1); fora só lixo técnico e o que não cabe no Blob.
 *  `segmentos` = caminho relativo quebrado em pastas, último = nome do arquivo. */
export function motivoIgnorar(segmentos: string[], tamanhoBytes: number): string | null {
  if (segmentos.length < 2) return 'arquivo solto na raiz'
  if (segmentos.some((s) => s.startsWith('.') || s.startsWith('~$'))) return 'oculto ou temporário'
  if (ARQUIVOS_DE_SISTEMA.has(segmentos[segmentos.length - 1].toUpperCase())) return 'arquivo de sistema'
  if (tamanhoBytes === 0) return 'arquivo vazio'
  if (tamanhoBytes > TAMANHO_MAXIMO_ARQUIVO_BYTES) return 'acima de 50 MB'
  return null
}

/** Sigla do cliente no nome de uma publicação do DOC — o trecho entre o 1º e o 2º " - ":
 *  "2026.09.17 - SIURB - Sust. de TIC - Despacho.pdf" → "SIURB". */
export function siglaNoNome(nome: string): string | null {
  const partes = nome.split(/\s+-\s+/)
  if (partes.length < 3) return null
  return partes[1].trim() || null
}

/** Cliente de um arquivo. Pasta listada em `rotearPeloNome` (ex.: "1. PUBLICAÇÕES NO DOC") não é
 *  cliente: cada arquivo vai para a sigla do próprio nome. `rotulo` identifica a origem no relatório
 *  de "sem cliente". */
export function clienteDoArquivo(
  segmentos: string[],
  clientes: ClientePorSigla,
  mapa: MapaPastas,
  rotearPeloNome: string[]
): { resolucao: ResolucaoCliente; roteadoPeloNome: boolean; rotulo: string } {
  const pasta = segmentos[0]
  if (rotearPeloNome.some((p) => normalizarChave(p) === normalizarChave(pasta))) {
    const sigla = siglaNoNome(segmentos[segmentos.length - 1])
    return {
      resolucao: sigla ? resolverCliente(sigla, clientes, mapa) : { tipo: 'sem-cliente' },
      roteadoPeloNome: true,
      rotulo: `${pasta} → ${sigla ?? '(sem sigla no nome)'}`,
    }
  }
  return { resolucao: resolverCliente(pasta, clientes, mapa), roteadoPeloNome: false, rotulo: pasta }
}

export type PapelArquivo = 'termo' | 'proposta' | 'outro'

const PLANILHA = new Set(['xlsx', 'xls', 'csv'])

/** Categoria na criação do `ArquivoCliente` vindo do SharePoint (spec lugar-certo §3.1). Só vale na
 *  criação — reclassificação feita na tela não é desfeita. */
export function categoriaSharepoint(
  nome: string,
  contexto: { papel: PapelArquivo; inicial: boolean; publicacao: boolean }
): CategoriaArquivo {
  if (contexto.publicacao || /^DOC\s/i.test(nome)) return 'PUBLICACAO_DOC'
  if (contexto.papel === 'termo') return contexto.inicial ? 'TERMO_CONTRATO' : 'TERMO_ADITIVO'
  if (contexto.papel === 'proposta') return contexto.inicial ? 'PROPOSTA_COMERCIAL' : 'PROPOSTA_ADITIVO'
  const sugerida = sugerirCategoria(nome)
  if (sugerida === 'OUTRO' && PLANILHA.has(extensaoDe(nome))) return 'PLANILHA'
  return sugerida
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
