// Conferência dos números da resposta contra o que as ferramentas devolveram (spec 2026-09-30-assistente-consultor §7).
// Puro. Marca, não bloqueia (quem bloqueia o caso "sem consulta" é a rota).

export interface Conferencia {
  conferidos: number
  naoConfirmados: string[]
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Sobreposição é tratada por `ocupado`: quem chega primeiro fica com o trecho (SEI e data antes de mm/aaaa).
const PADROES = [
  /-?R\$\s?-?\d+(?:\.\d{3})*(?:,\d{1,2})?(?!\d)/g, // moeda, com ou sem milhar, 1–2 casas, com sinal
  /\b\d{4}\.\d{4}\/\d{7}-\d\b/g, // SEI
  /(?<![\d-])20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?![\d-])/g, // data ISO AAAA-MM-DD (entrada de ferramenta)
  /(?<![\d.,])-?\d{1,3}(?:[.,]\d{1,2})?%/g, // percentual
  /\b\d{2}\/\d{2}\/\d{4}\b/g, // data
  /\b\d{1,4}\/[A-Za-zÀ-ú]+\/\d{4}\b/g, // contrato NN/SIGLA/AAAA
  /(?<![\d/])(?:0[1-9]|1[0-2])\/20\d{2}(?![\d/])/g, // competência mm/aaaa
  /(?<!\p{L})(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/20\d{2}(?!\d)/giu, // competência "ago/2026"
  /(?<![\d-])20\d{2}-(?:0[1-9]|1[0-2])(?![\d-])/g, // competência AAAA-MM
]

export function extrairNumeros(texto: string): string[] {
  const achados: { i: number; v: string }[] = []
  const ocupado: [number, number][] = []
  for (const p of PADROES) {
    for (const m of texto.matchAll(p)) {
      const ini = m.index!
      const fim = ini + m[0].length
      if (ocupado.some(([a, b]) => ini < b && fim > a)) continue
      ocupado.push([ini, fim])
      achados.push({ i: ini, v: m[0].trim() })
    }
  }
  return achados.sort((a, b) => a.i - b.i).map((a) => a.v)
}

const fixo = (n: number) => (n === 0 ? 0 : n).toFixed(2)

/** Forma canônica: moeda (m:) e percentual (p:) viram número com 2 casas, competência vira c:AAAA-MM; o resto, texto sem espaço. */
function canonico(v: string): string {
  if (v.includes('R$')) {
    const neg = v.includes('-')
    const n = Number(v.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'))
    return `m:${fixo(neg ? -n : n)}`
  }
  if (v.endsWith('%')) return `p:${fixo(Number(v.slice(0, -1).replace(',', '.')))}`
  let m = v.match(/^(0[1-9]|1[0-2])\/(20\d{2})$/)
  if (m) return `c:${m[2]}-${m[1]}`
  m = v.match(/^(20\d{2})-(0[1-9]|1[0-2])-(\d{2})$/)
  if (m) return `t:${m[3]}/${m[2]}/${m[1]}` // igual à data dd/mm/aaaa
  m = v.match(/^(20\d{2})-(0[1-9]|1[0-2])$/)
  if (m) return `c:${m[1]}-${m[2]}`
  m = v.match(/^([A-Za-z]{3})\/(20\d{2})$/)
  if (m) return `c:${m[2]}-${String(MESES.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0')}`
  return `t:${v.toUpperCase().replace(/\s/g, '')}`
}

const MESES_EXTENSO = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
// "1º de julho de 2026", "01 de julho de 2026", "1 de jul. de 2026" (termo e ofício escrevem assim).
const DATA_POR_EXTENSO = /(?<!\d)(\d{1,2})\s*[º°o]?\s+de\s+(\p{L}+)\.?\s+de\s+(\d{4})(?!\d)/giu

/** Datas por extenso da FONTE na forma canônica da data dd/mm/aaaa (`t:dd/mm/aaaa`). Só da fonte: a resposta segue em dd/mm/aaaa. */
function datasPorExtenso(texto: string): string[] {
  const datas: string[] = []
  for (const m of texto.matchAll(DATA_POR_EXTENSO)) {
    const nome = m[2].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const mes = MESES.indexOf(nome.slice(0, 3))
    const dia = Number(m[1])
    if (mes < 0 || (nome.length !== 3 && nome !== MESES_EXTENSO[mes]) || dia < 1 || dia > 31) continue
    datas.push(`t:${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${m[3]}`)
  }
  return datas
}

function canonicosDasFontes(fontes: string[]): Set<string> {
  const s = new Set<string>()
  const texto = fontes.join('\n')
  for (const v of extrairNumeros(texto)) s.add(canonico(v))
  for (const d of datasPorExtenso(texto)) s.add(d)
  // Número cru das ferramentas ("1000.00", "33.333333", "1000") vale como moeda e como percentual, arredondado
  // a 2 casas. Inteiro só com 3+ dígitos e fora de data/competência: o "30" de "30/09/2026" não confirma "R$ 30,00".
  const crus = [/(?<![\d.,/-])-?\d+\.\d+(?![\d/]|,\d)/g, /(?<![\d.,/-])-?\d{3,}(?![\d/]|[.,]\d|-\d)/g]
  for (const p of crus) {
    for (const m of texto.matchAll(p)) {
      const f = fixo(Number(m[0]))
      s.add(`m:${f}`)
      s.add(`p:${f}`)
    }
  }
  return s
}

export function conferirResposta({ textoVerai, fontes }: { textoVerai: string; fontes: string[] }): Conferencia {
  const numeros = extrairNumeros(textoVerai)
  if (numeros.length === 0) return { conferidos: 0, naoConfirmados: [] }
  const conhecidos = canonicosDasFontes(fontes)
  const naoConfirmados = numeros.filter((v) => !conhecidos.has(canonico(v)))
  return { conferidos: numeros.length - naoConfirmados.length, naoConfirmados: [...new Set(naoConfirmados)] }
}

const ehDataOuCompetencia = (v: string) => /^(?:\d{2}\/\d{2}\/\d{4}|20\d{2}-\d{2}(?:-\d{2})?|\d{2}\/20\d{2}|[A-Za-z]{3}\/20\d{2})$/.test(v)

/** Da entrada que a IA passou a uma ferramenta, só data e competência servem de fonte; valor e percentual têm de voltar na saída. */
export function soDatasECompetencias(texto: string): string {
  return extrairNumeros(texto).filter(ehDataOuCompetencia).join(' ')
}
