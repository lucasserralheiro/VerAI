export type NivelVencimento = 'vencido' | 'critico' | 'atencao' | 'ok' | 'sem-data'

export interface SituacaoVencimento {
  nivel: NivelVencimento
  /** Dias de calendário até o vencimento (negativo = já venceu); `null` sem data. */
  dias: number | null
}

const DIA_MS = 24 * 60 * 60 * 1000

/** Dia de calendário de uma data "só-dia" gravada no banco. Duas convenções convivem: a tela grava
 *  00:00Z e o import do Access grava a meia-noite de Brasília (03:00Z) — somar 12h e pegar o dia
 *  UTC acerta as duas. */
function diaDoVencimento(data: Date): number {
  const meioDia = new Date(data.getTime() + DIA_MS / 2)
  return Date.UTC(meioDia.getUTCFullYear(), meioDia.getUTCMonth(), meioDia.getUTCDate())
}

/** "Hoje" é o dia de calendário em São Paulo, não em UTC (21h de Brasília já é amanhã em UTC). */
function diaDeHoje(agora: Date): number {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
    .format(agora)
    .split('-')
    .map(Number)
  return Date.UTC(ano, mes - 1, dia)
}

/** Semáforo de vencimento do contrato: `< 0` vencido, `≤ 30` crítico, `≤ 90` atenção, senão ok. */
export function situacaoVencimento(dataVencimento: Date | null, hoje: Date): SituacaoVencimento {
  if (!dataVencimento) return { nivel: 'sem-data', dias: null }
  const dias = Math.round((diaDoVencimento(dataVencimento) - diaDeHoje(hoje)) / DIA_MS)
  const nivel: NivelVencimento = dias < 0 ? 'vencido' : dias <= 30 ? 'critico' : dias <= 90 ? 'atencao' : 'ok'
  return { nivel, dias }
}
