// Mês de referência do IPC-Fipe como texto `AAAA-MM` — o formato que viaja entre banco, API e tela
// (spec docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md).

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function partes(mes: string): [number, number] {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  if (!m) throw new Error(`mês inválido: ${mes}`)
  return [Number(m[1]), Number(m[2])]
}

const formatar = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`

export function somarMeses(mes: string, n: number): string {
  const [ano, m] = partes(mes)
  const total = ano * 12 + (m - 1) + n
  return formatar(Math.floor(total / 12), (total % 12) + 1)
}

export function mesesEntre(inicial: string, final: string): string[] {
  const lista: string[] = []
  for (let atual = inicial; atual <= final; atual = somarMeses(atual, 1)) lista.push(atual)
  return lista
}

export function nomeDoMes(mes: string): string {
  const [ano, m] = partes(mes)
  return `${NOMES[m - 1]}/${ano}`
}

export const mesParaData = (mes: string) => {
  const [ano, m] = partes(mes)
  return new Date(Date.UTC(ano, m - 1, 1))
}

export const dataParaMes = (d: Date) => formatar(d.getUTCFullYear(), d.getUTCMonth() + 1)

export function mesDeHoje(agora: Date = new Date()): string {
  const [ano, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })
    .format(agora)
    .split('-')
  return `${ano}-${mes}`
}
