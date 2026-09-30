// Tipos dos Controles de Contratos que vão ao navegador (spec
// docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md). Sem import de servidor.

export interface ControleSerializado {
  /** ArquivoBiblioteca do PDF — abre em /api/biblioteca/[id]. */
  arquivoId: string
  /** Mês do controle (pasta), "2026-08". */
  mes: string
  sigla: string
  contratoTexto: string | null
  contratoId: string | null
  clienteId: string | null
  clienteNome: string | null
  termoTexto: string | null
  vigenciaTexto: string | null
  vigenciaInicio: string | null
  vigenciaFim: string | null
  /** Só de tabela conferida pela soma; `null` quando não fechou. */
  previsto: string | null
  /** Faturado ATÉ o mês do controle (meses seguintes lançados na tabela são previsão — `aFrente`). */
  faturado: string | null
  /** TOTAL da tabela do faturado como está no PDF (inclui o lançado à frente). */
  faturadoDocumento: string | null
  /** Lançado na tabela do faturado para depois do mês do controle: previsão, fora do faturado e do %. */
  aFrente: { total: string; periodos: string[] } | null
  saldoCalculado: string | null
  saldoDocumento: string | null
  percentual: number | null
  /** Rótulo do último período com faturamento diferente de zero. */
  ultimoFaturado: string | null
  conferido: boolean
  avisos: string[]
}

export interface LinhaControle {
  tipo: 'previsto' | 'faturado' | 'saldo'
  rotulo: string
  valor: string
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-08" → "ago/2026". */
export function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  return `${MESES[m - 1] ?? '?'}/${ano}`
}
