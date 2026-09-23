import type { TipoPdfHistorico } from '@/lib/storage'

/**
 * PDFs que JÁ estão no sistema e podem ser aproveitados nas colunas PC/PA e TC/TA do histórico do
 * contrato (em vez de subir de novo do computador). Duas fontes:
 *  - `proposta-comercial`: PDFs enviados na tela "Propostas comerciais";
 *  - `historico`: PDFs já anexados em OUTRA linha de contrato do MESMO cliente (o mesmo termo/aditivo
 *    costuma aparecer em mais de uma linha).
 * Escolher um deles COPIA o arquivo para a linha (não compartilha o blob), então apagar o PDF de
 * um lado nunca quebra o outro.
 */

export const TAMANHO_MAXIMO_PDF_BYTES = 15 * 1024 * 1024 // 15 MB

/** Coluna da linha do histórico ↔ campos do banco. `proposta` = PC/PA; `termo` = TC/TA. */
export const COLUNAS_PDF = {
  proposta: { url: 'propostaPdfUrl', nome: 'propostaPdfNome', rotulo: 'PC/PA' },
  termo: { url: 'termoPdfUrl', nome: 'termoPdfNome', rotulo: 'TC/TA' },
} as const

export const SELECAO_PDFS = { propostaPdfUrl: true, propostaPdfNome: true, termoPdfUrl: true, termoPdfNome: true } as const

export function tipoPdfValido(tipo: unknown): tipo is TipoPdfHistorico {
  return tipo === 'proposta' || tipo === 'termo'
}

export type OrigemPdf =
  | { origem: 'proposta-comercial'; arquivoId: string }
  | { origem: 'historico'; linhaId: string; coluna: TipoPdfHistorico }

export interface PdfExistente {
  /** Chave estável pra lista da tela. */
  chave: string
  nome: string
  /** De onde vem, em texto pro usuário ("Propostas comerciais · 12/03/2026"). */
  detalhe: string
  tamanhoBytes: number | null
  /** Endereço pra conferir o PDF antes de escolher. */
  verUrl: string
  /** O nome (ou o texto da linha de origem) bate com a proposta/termo desta linha. */
  sugerido: boolean
  origem: OrigemPdf
}

/** "PC_SMS_211014_136_v4.0.pdf" → "pcsms211014136v40": sem acento, extensão, pontuação ou caixa. */
export function normalizarNomePdf(nome: string | null | undefined): string {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** O nome do arquivo contém a referência (ou o contrário). Curto demais (< 5 caracteres) não conta. */
export function nomeCombina(referencia: string | null | undefined, outro: string | null | undefined): boolean {
  const a = normalizarNomePdf(referencia)
  const b = normalizarNomePdf(outro)
  if (a.length < 5 || b.length < 5) return false
  return b.includes(a) || a.includes(b)
}

/** Sugeridos primeiro; dentro de cada grupo mantém a ordem recebida (já vem do mais novo ao mais antigo). */
export function ordenarSugeridosPrimeiro<T extends { sugerido: boolean }>(itens: T[]): T[] {
  return [...itens.filter((item) => item.sugerido), ...itens.filter((item) => !item.sugerido)]
}
