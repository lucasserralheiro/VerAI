const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function formatarCompetencia(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`
}

export function parseCompetencia(texto: string): { ano: number; mes: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(texto)
  if (!match) return null
  const ano = Number(match[1])
  const mes = Number(match[2])
  if (mes < 1 || mes > 12) return null
  return { ano, mes }
}

export function nomeCompetencia(ano: number, mes: number): string {
  return `${NOMES_MES[mes - 1]}/${ano}`
}
