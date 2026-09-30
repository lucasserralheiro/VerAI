// Tipos dos Links MPLS que vão ao navegador (spec docs/superpowers/specs/2026-09-29-links-mpls-design.md §6).
// Sem import de servidor.

export type CategoriaLinks = 'SOLUCAO' | 'SOCIAL' | 'GERENCIAMENTO' | 'OUTRA'

export const ROTULO_CATEGORIA: Record<CategoriaLinks, string> = {
  SOLUCAO: 'Solução',
  SOCIAL: 'Social',
  GERENCIAMENTO: 'Gerenciamento',
  OUTRA: 'Outra',
}

export interface RelatorioResumo {
  id: string
  arquivoId: string
  competencia: string
  sigla: string
  clienteId: string | null
  clienteNome: string | null
  contratoId: string | null
  contratoTexto: string | null
  categoria: CategoriaLinks
  /** Só de relatório conferido (códigos lidos = totais do PDF); `null` quando não fechou. */
  ativos: number | null
  cancelados: number | null
  conferido: boolean
  avisos: string[]
  /** Em relação ao mês anterior do mesmo contrato e categoria, os dois conferidos; `null` sem base. */
  entraram: number | null
  sairam: number | null
}

export interface LinkSerializado {
  codigo: string
  situacao: 'ATIVO' | 'CANCELADO'
  kbps: number | null
  redundancia: string | null
  dataAceite: string | null
  dataCancelamento: string | null
  entidade: string | null
  endereco: string | null
}

export interface RelatorioDoContrato extends RelatorioResumo {
  links: LinkSerializado[]
  entraramLinks: LinkSerializado[]
  sairamLinks: LinkSerializado[]
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-09" → "set/2026". */
export function nomeDaCompetencia(c: string): string {
  const [ano, mes] = c.split('-').map(Number)
  return `${MESES[mes - 1] ?? '?'}/${ano}`
}

/** Entraram/saíram por código MPLS entre dois meses. */
export function diferencaDeLinks<T extends { codigo: string }>(atuais: T[], anteriores: T[]): { entraram: T[]; sairam: T[] } {
  const antes = new Set(anteriores.map((l) => l.codigo))
  const agora = new Set(atuais.map((l) => l.codigo))
  return { entraram: atuais.filter((l) => !antes.has(l.codigo)), sairam: anteriores.filter((l) => !agora.has(l.codigo)) }
}
