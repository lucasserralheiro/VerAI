// "Mês passado", "últimos 6 meses", "novembro" → datas, antes da IA (spec 2026-09-30-assistente-consultor §4.3).
// A IA não calcula data: recebe o período pronto no contexto.

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const iso = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10)
const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate()
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const somar = (a: number, m: number, n: number) => {
  const t = a * 12 + (m - 1) + n
  return [Math.floor(t / 12), (t % 12) + 1] as const
}

function doMes(a: number, m: number) {
  const inicio = iso(a, m, 1)
  const fim = iso(a, m, ultimoDia(a, m))
  return { inicio, fim, texto: `Período citado: ${br(inicio)} a ${br(fim)} (competência ${a}-${String(m).padStart(2, '0')}).` }
}

function entre(a1: number, m1: number, d1: number, a2: number, m2: number, d2: number) {
  const inicio = iso(a1, m1, d1)
  const fim = iso(a2, m2, d2)
  return { inicio, fim, texto: `Período citado: ${br(inicio)} a ${br(fim)}.` }
}

export function periodoDaPergunta(pergunta: string, hoje: Date): { inicio: string; fim: string; texto: string } | null {
  const q = semAcento(pergunta)
  const a = hoje.getUTCFullYear()
  const m = hoje.getUTCMonth() + 1
  const d = hoje.getUTCDate()

  if (/\bmes passado\b|\bultimo mes\b/.test(q)) return doMes(...somar(a, m, -1))
  if (/\b(este|esse|neste|nesse) mes\b|\bmes atual\b/.test(q)) return doMes(a, m)
  if (/\bproximo mes\b/.test(q)) return doMes(...somar(a, m, 1))
  if (/\bano passado\b/.test(q)) return entre(a - 1, 1, 1, a - 1, 12, 31)
  if (/\bate o fim do ano\b|\bate dezembro\b/.test(q)) return entre(a, m, d, a, 12, 31)
  if (/\b(este|esse|neste|nesse) ano\b|\bano atual\b/.test(q)) return entre(a, 1, 1, a, 12, 31)
  const ultimos = q.match(/\bultimos (\d{1,2}) meses\b/)
  if (ultimos) {
    const [ai, mi] = somar(a, m, -(Number(ultimos[1]) - 1))
    return entre(ai, mi, 1, a, m, ultimoDia(a, m))
  }
  if (/\bproximo trimestre\b/.test(q)) {
    const [ai, mi] = somar(a, m, 1)
    const [af, mf] = somar(a, m, 3)
    return entre(ai, mi, 1, af, mf, ultimoDia(af, mf))
  }
  const mmaaaa = q.match(/(0?[1-9]|1[0-2])\/(20\d{2})(?![\d/])/)
  if (mmaaaa) {
    // Conferir se mm/aaaa não vem logo depois de TC, TA, PC, PA, TAP, contrato, termo, aditivo, proposta
    const beforeMatch = q.substring(0, mmaaaa.index)
    const isAfterDocType = /(?:tc|ta|pc|pa|tap|contrato|termo|aditivo|proposta)\s*$/.test(beforeMatch)
    if (!isAfterDocType) return doMes(Number(mmaaaa[2]), Number(mmaaaa[1]))
  }
  const nome = MESES.findIndex((n) => new RegExp(`\\b${n}\\b`).test(q))
  if (nome >= 0) return doMes(a, nome + 1)
  return null
}
