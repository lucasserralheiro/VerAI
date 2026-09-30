// Tipos compartilhados entre a tela e as rotas do reajuste (spec 2026-09-30-reajuste-ipc-fipe-design §2.2).

export type TipoArquivoReajuste = 'xlsx' | 'csv' | 'pdf' | 'docx'

export interface ColunaCandidata {
  aba: string
  coluna: number // 1-based (exceljs)
  cabecalho: string
  linhaCabecalho: number
  exemplos: string[] // até 3, já normalizados ("1500.00")
  quantidade: number // células com valor
  sugerida: boolean
}

export interface ValorNoTexto {
  indice: number
  pagina: number | null
  original: string // normalizado ("1500.00")
  bruto: string // como no texto ("R$ 1.500,00")
  antes: string // ~60 caracteres
  depois: string
}

export type Leitura = { tipo: 'planilha'; colunas: ColunaCandidata[] } | { tipo: 'texto'; valores: ValorNoTexto[] }

export class ArquivoIlegivel extends Error {}
