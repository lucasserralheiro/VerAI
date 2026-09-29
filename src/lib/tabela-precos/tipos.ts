// Tipos da tabela de preços que vão ao navegador (spec docs/superpowers/specs/2026-09-29-tabela-de-precos-design.md).
// Sem import de servidor.

export type Conferencia = 'confere' | 'diverge' | 'fora-do-pdf' | 'alterado-pelo-informativo' | 'sem-pdf'

export interface ItemSerializado {
  codigo: string
  grupo: string
  secoes: string
  descricao: string
  unidade: string
  /** String decimal ("269" ou "269.00"); `null` em "sob demanda" ou preço não lido. */
  preco: string | null
  sobDemanda: boolean
  precoTexto: string | null
  conferencia: Conferencia
  precoNoPdf: string | null
}

export interface TabelaSerializada {
  versao: string
  publicadaEm: string | null
  totalItens: number
  divergencias: number
  lidaEm: string
  vigente: boolean
  /** Ids de ArquivoBiblioteca — abrem em /api/biblioteca/[id]. */
  arquivos: { planilha: string | null; pdf: string | null; publicacao: string | null; informativo: string | null }
}

export interface VersaoResumo {
  versao: string
  publicadaEm: string | null
  totalItens: number
  vigente: boolean
}

export interface PrecoMudou {
  codigo: string
  descricao: string
  antes: string | null
  depois: string | null
  /** Variação em % com uma casa; `null` quando um dos lados não é número. */
  percentual: number | null
}

export interface Diferencas {
  novos: ItemSerializado[]
  retirados: ItemSerializado[]
  precoMudou: PrecoMudou[]
}
