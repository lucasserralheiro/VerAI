// Qual versão e qual papel cada arquivo da pasta TABELA DE PREÇOS PRODAM-SP tem, pelo nome (spec
// 2026-09-29-tabela-de-precos §4.1).

export type PapelArquivo = 'planilha' | 'pdf' | 'publicacao' | 'informativo'

export interface VersaoTabela {
  /** "2026 v3.0" */
  versao: string
  ano: number
  numero: string
  /** ano*10000 + maior*100 + menor — a vigente é a de maior ordem. */
  ordem: number
}

export function versaoDoNome(nome: string): VersaoTabela | null {
  const m = /(\d{4})\s*v(\d+)(?:\.(\d+))?/i.exec(nome)
  if (!m) return null
  const ano = Number(m[1])
  const maior = Number(m[2])
  const menor = Number(m[3] ?? 0)
  return { versao: `${ano} v${maior}.${menor}`, ano, numero: `${maior}.${menor}`, ordem: ano * 10000 + maior * 100 + menor }
}

/** "INFORMATIVO Alterações Tabela de Preços v3.0.pdf" → "3.0" (o informativo não traz o ano no nome). */
export function numeroDoInformativo(nome: string): string | null {
  const m = /v(\d+)(?:\.(\d+))?/i.exec(nome)
  return m ? `${Number(m[1])}.${Number(m[2] ?? 0)}` : null
}

const simples = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function papelDoArquivo(nome: string): PapelArquivo | null {
  const n = simples(nome)
  if (/^memoria de calculo.*\.xlsx$/.test(n)) return 'planilha'
  if (/^informativo.*\.pdf$/.test(n)) return 'informativo'
  if (/^publicacao.*\.pdf$/.test(n)) return 'publicacao'
  if (/^tabela de precos.*\.pdf$/.test(n)) return 'pdf'
  return null
}

/** "Publicação DOC 21.09.2026.pdf" → 21/09/2026 (UTC, meia-noite). */
export function dataDoNome(nome: string): Date | null {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(nome)
  if (!m) return null
  const data = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
  return data.getUTCDate() === Number(m[1]) ? data : null
}
