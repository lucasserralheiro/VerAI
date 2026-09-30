// Faturado "até o mês do controle" (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md §9):
// a equipe do faturamento lança na tabela do faturado meses que ainda não aconteceram (previsão). Faturado de
// verdade é só até o mês da pasta do controle; o resto aparece à parte. Regra pura, sem import de servidor.

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const ano4 = (a: string) => (a.length === 2 ? 2000 + Number(a) : Number(a))
const valido = (ano: number, mes: number) => ano >= 2015 && ano <= 2040 && mes >= 1 && mes <= 12
/** Índice contínuo do mês (para comparar): ano * 12 + mês. */
export const indiceDoMes = (ano: number, mes: number) => ano * 12 + mes

/**
 * Mês de competência de uma linha do faturado, pelo rótulo como está no PDF; `null` quando não dá pra saber.
 * Período com datas ("21/08/2026 a 20/09/2026") vale pelo FIM — é como a própria equipe nomeia ("MAR/26 -
 * 21/02/2026 A 20/03/2026"). Sem datas, o nome do mês com ano ("Ago/26", "Agosto/2026", "OUT/26-27DIAS").
 * "MÊS 3" só com o início da vigência (o 3º mês a partir dele, pelo fim); "FEV/265", "MAR/6" → null.
 */
export function mesDaLinha(rotulo: string, inicioVigencia: Date | null = null): number | null {
  const periodo = /(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\s*(?:à|á|a|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/i.exec(rotulo)
  if (periodo) {
    const [ano, mes] = [ano4(periodo[6]), Number(periodo[5])]
    return valido(ano, mes) ? indiceDoMes(ano, mes) : null
  }
  const nome = /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\s*[/-]\s*(\d{4}|\d{2})(?!\d)/i.exec(rotulo)
  if (nome) {
    const [ano, mes] = [ano4(nome[2]), MESES.indexOf(nome[1].toLowerCase()) + 1]
    return valido(ano, mes) ? indiceDoMes(ano, mes) : null
  }
  const ordinal = /^\s*m[eê]s\s*(\d{1,3})\s*-?\s*$/i.exec(rotulo)
  if (ordinal && inicioVigencia) {
    // Mês n = do início + (n−1) meses até a véspera do início + n meses; vale o mês do fim.
    const fim = new Date(Date.UTC(inicioVigencia.getUTCFullYear(), inicioVigencia.getUTCMonth() + Number(ordinal[1]), inicioVigencia.getUTCDate() - 1))
    return indiceDoMes(fim.getUTCFullYear(), fim.getUTCMonth() + 1)
  }
  return null
}

/**
 * A tabela é cronológica: vale a MAIOR sequência de meses em ordem; o que fica fora dela é erro de digitação do
 * documento e vira `null`. Mais de uma sequência máxima (não dá pra saber qual linha está errada) → `null`.
 */
function semForaDeOrdem(meses: (number | null)[]): { meses: (number | null)[]; foraDeOrdem: number[] } | null {
  const idx = meses.flatMap((k, i) => (k === null ? [] : [i]))
  const tam = idx.map(() => 1)
  const qtd = idx.map(() => 1)
  const anterior = idx.map(() => -1)
  for (let b = 0; b < idx.length; b++) {
    for (let a = 0; a < b; a++) {
      if (meses[idx[a]]! > meses[idx[b]]!) continue
      if (tam[a] + 1 > tam[b]) [tam[b], qtd[b], anterior[b]] = [tam[a] + 1, qtd[a], a]
      else if (tam[a] + 1 === tam[b]) qtd[b] = Math.min(2, qtd[b] + qtd[a])
    }
  }
  const maior = Math.max(0, ...tam)
  const fins = tam.flatMap((t, b) => (t === maior ? [b] : []))
  if (fins.reduce((s, b) => s + qtd[b], 0) > 1) return null
  const fica = new Set<number>()
  for (let b = fins[0] ?? -1; b >= 0; b = anterior[b]) fica.add(idx[b])
  const fora = idx.filter((i) => !fica.has(i))
  return { meses: meses.map((k, i) => (fora.includes(i) ? null : k)), foraDeOrdem: fora }
}

export interface LinhaValor {
  rotulo: string
  valor: string
}

export interface FaturadoSeparado {
  /** Soma das linhas até o mês do controle (string decimal); `null` quando a ordem dos meses não confere. */
  ateOMes: string | null
  /** Linhas depois do mês do controle, com valor — previsão, não faturamento. */
  aFrente: LinhaValor[]
  /** Linhas com valor, no fim da tabela, cujo mês não dá pra identificar — também ficam fora do faturado. */
  semMes: LinhaValor[]
  /** Rótulos com mês depois do controle mas seguidos de linha anterior a ele: erro de digitação do documento. */
  foraDeOrdem: string[]
  /** Último período até o mês do controle com valor diferente de zero. */
  ultimo: string | null
}

const centavos = (v: string) => Math.round(Number(v) * 100)

/**
 * Separa a tabela do faturado (na ordem do PDF, que é cronológica) em "até o mês do controle" e "à frente".
 * - mês que quebra a ordem em relação aos vizinhos ("OUT/26" antes de "nov/25") é erro de digitação do
 *   documento: vira mês desconhecido e é apontado; se a ordem ainda não fecha, `ateOMes` = null;
 * - mês ≤ controle → faturado; mês > controle → à frente;
 * - mês desconhecido antes da última linha ≤ controle → faturado (está no meio do que já foi);
 *   depois dela → fora do faturado (`semMes`), porque não dá pra provar que já aconteceu.
 */
export function separarFaturado(linhas: LinhaValor[], mesDoControle: string, inicioVigencia: Date | null = null): FaturadoSeparado {
  const [a, m] = mesDoControle.split('-').map(Number)
  const limite = indiceDoMes(a, m)
  const lidos = semForaDeOrdem(linhas.map((l) => mesDaLinha(l.rotulo, inicioVigencia)))
  if (!lidos) return { ateOMes: null, aFrente: [], semMes: [], foraDeOrdem: [], ultimo: null }
  const meses = lidos.meses
  const foraDeOrdem = lidos.foraDeOrdem.filter((i) => centavos(linhas[i].valor) !== 0).map((i) => linhas[i].rotulo)
  let ultimaAte = -1
  meses.forEach((k, i) => {
    if (k !== null && k <= limite) ultimaAte = i
  })

  let soma = 0
  const r: FaturadoSeparado = { ateOMes: '0.00', aFrente: [], semMes: [], foraDeOrdem, ultimo: null }
  linhas.forEach((linha, i) => {
    const k = meses[i]
    const vale = centavos(linha.valor)
    const antesDoFim = i <= ultimaAte
    if (antesDoFim) {
      soma += vale
      if (vale !== 0) r.ultimo = linha.rotulo
    } else if (vale !== 0) {
      ;(k === null ? r.semMes : r.aFrente).push(linha)
    }
  })
  r.ateOMes = (soma / 100).toFixed(2)
  return r
}
