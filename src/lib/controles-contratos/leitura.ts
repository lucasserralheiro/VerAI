// Leitura do PDF de "Controles de Contratos" (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md
// §4). Regra pura sobre as linhas do PDF (itens agrupados por y). Planilha feita à mão: cada tabela só vale com
// a prova "soma das linhas = TOTAL"; o que não fecha fica "não conferido" e não entra em tela nenhuma.

export interface LinhaPdf {
  pagina: number
  textos: string[]
}

export type TipoTabela = 'previsto' | 'faturado' | 'saldo'

export interface LinhaTabela {
  rotulo: string
  valor: string
  inicio: Date | null
  fim: Date | null
}

export interface TabelaLida {
  tipo: TipoTabela
  linhas: LinhaTabela[]
  total: string | null
  conferida: boolean
}

export interface ControleLido {
  contratoTexto: string | null
  termoTexto: string | null
  vigenciaTexto: string | null
  vigenciaInicio: Date | null
  vigenciaFim: Date | null
  previsto: TabelaLida | null
  faturado: TabelaLida | null
  saldo: TabelaLida | null
  avisos: string[]
}

const VALOR = /^(-?)(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/
// "à"/"á" não são \w no JS: `\b` depois deles falha — o fim do separador é "seguido de espaço".
// Mês com 1 a 4 dígitos depois da barra: a planilha tem "MAR/6" e "FEV/265" digitados assim.
const PERIODO = /^(M[ÊE]S\s*\d+|[A-ZÇ]{3,9}\/\d{1,4}|\d{1,2}\/\d{1,2}\/\d{2,4}\s*(?:[àáa]|at[ée])(?=\s))/i
const DATA = String.raw`(\d{1,2}\/\d{1,2}\/\d{2,4})`
const ATE = String.raw`\s*(?:[àáa]|at[ée])\s*`
const VIGENCIA = new RegExp(String.raw`Vig[êe]ncia\s*[:\-–]?\s*${DATA}${ATE}${DATA}`, 'i')
// Em qualquer ponto do rótulo: "NOV/25 - 01/11/2025 a 20/11/2025-20Dias" traz o mês e o intervalo.
const INTERVALO = new RegExp(String.raw`${DATA}${ATE}${DATA}`, 'i')
const MESES: Record<string, number> = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 }

/** "1.254,89" → "1254.89"; o que não for dinheiro com centavos → null. */
export function valorBr(texto: string): string | null {
  const m = VALOR.exec(texto.trim())
  return m ? `${m[1]}${m[2].replace(/\./g, '')}.${m[3]}` : null
}

/** "24/09/25" ou "24/09/2025" → Date UTC; data impossível → null. */
export function dataBr(texto: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(texto.trim())
  if (!m) return null
  const [d, mes, a] = [Number(m[1]), Number(m[2]), m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])]
  const data = new Date(Date.UTC(a, mes - 1, d))
  return data.getUTCMonth() === mes - 1 && data.getUTCDate() === d ? data : null
}

const centavos = (valor: string) => Math.round(Number(valor) * 100)
const deCentavos = (c: number) => (c / 100).toFixed(2)
const moeda = (valor: string) => `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Período de uma linha: "01/12/2025 à 31/12/2025", "24/09/25 a 20/10/25-27Dias", "NOV/2025", "OUT/25-16DD".
 *  "MÊS n" não tem data. */
function periodo(rotulo: string): { inicio: Date | null; fim: Date | null } {
  const intervalo = INTERVALO.exec(rotulo)
  if (intervalo) return { inicio: dataBr(intervalo[1]), fim: dataBr(intervalo[2]) }
  const mes = /^([A-ZÇ]{3})[A-ZÇ]*\/(\d{4}|\d{2})/i.exec(rotulo)
  const numero = mes ? MESES[mes[1].toUpperCase()] : undefined
  if (!mes || !numero) return { inicio: null, fim: null }
  const ano = mes[2].length === 2 ? 2000 + Number(mes[2]) : Number(mes[2])
  return { inicio: new Date(Date.UTC(ano, numero - 1, 1)), fim: new Date(Date.UTC(ano, numero, 0)) }
}

function tipoDoTitulo(texto: string): TipoTabela | null {
  if (/SALDO\s+A\s+FATURAR/i.test(texto)) return 'saldo'
  if (/\bFATURADO\b/i.test(texto)) return 'faturado'
  if (/PREVIS[ÃA]O|PREVISTO/i.test(texto)) return 'previsto'
  return null
}

export function lerControle(linhas: LinhaPdf[]): ControleLido {
  const r: ControleLido = {
    contratoTexto: null,
    termoTexto: null,
    vigenciaTexto: null,
    vigenciaInicio: null,
    vigenciaFim: null,
    previsto: null,
    faturado: null,
    saldo: null,
    avisos: [],
  }
  let tipo: TipoTabela | null = null
  let aberta: TabelaLida | null = null
  const fechar = () => {
    if (!aberta) return
    const soma = aberta.linhas.reduce((s, l) => s + centavos(l.valor), 0)
    aberta.conferida = aberta.total !== null && Math.abs(soma - centavos(aberta.total)) <= 5
    r[aberta.tipo] = aberta // a última tabela de cada tipo vence (termo anterior + atual no mesmo PDF)
    aberta = null
  }
  for (const linha of linhas) {
    const texto = linha.textos.join(' ').replace(/\s+/g, ' ').trim()
    const primeiro = linha.textos[0]?.trim() ?? ''
    const vigencia = VIGENCIA.exec(texto)
    if (vigencia) {
      fechar()
      r.vigenciaTexto = `${vigencia[1]} à ${vigencia[2]}`
      r.vigenciaInicio = dataBr(vigencia[1])
      r.vigenciaFim = dataBr(vigencia[2])
      r.contratoTexto = /\bC\.?\s?O\.?\s*\d[\w/.-]*/i.exec(texto)?.[0].replace(/\s+/g, ' ').trim() ?? r.contratoTexto
      const termo = /\bT\.?\s?A\.?\s*(\d+)/i.exec(texto)
      r.termoTexto = termo ? `T.A. ${termo[1].padStart(2, '0')}` : null
      continue
    }
    const titulo = PERIODO.test(primeiro) || /^TOTAL\b/i.test(primeiro) ? null : tipoDoTitulo(texto)
    if (titulo) {
      fechar()
      tipo = titulo
      continue
    }
    if (!tipo) continue
    const valores = linha.textos.map(valorBr).filter((v): v is string => v !== null)
    if (valores.length === 0) continue
    if (/^TOTAL\b/i.test(primeiro)) {
      if (aberta) {
        aberta.total = valores[valores.length - 1]
        fechar()
      }
      continue
    }
    if (!PERIODO.test(primeiro)) continue
    if (!aberta) aberta = { tipo, linhas: [], total: null, conferida: false }
    const rotulo = linha.textos
      .filter((t) => valorBr(t) === null)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    aberta.linhas.push({ rotulo, valor: valores[valores.length - 1], ...periodo(rotulo) })
  }
  fechar()

  if (r.vigenciaInicio && r.vigenciaFim && r.vigenciaFim.getTime() <= r.vigenciaInicio.getTime()) {
    r.avisos.push(`vigência com datas trocadas no documento: ${r.vigenciaTexto}`)
    r.vigenciaInicio = null
    r.vigenciaFim = null
  }
  // Data de período fora da vigência ± 1 ano é erro de digitação da planilha: fica o texto, sai a data.
  if (r.vigenciaInicio && r.vigenciaFim) {
    const de = Date.UTC(r.vigenciaInicio.getUTCFullYear() - 1, r.vigenciaInicio.getUTCMonth(), r.vigenciaInicio.getUTCDate())
    const ate = Date.UTC(r.vigenciaFim.getUTCFullYear() + 1, r.vigenciaFim.getUTCMonth(), r.vigenciaFim.getUTCDate())
    const fora = (d: Date | null) => !!d && (d.getTime() < de || d.getTime() > ate)
    for (const t of [r.previsto, r.faturado, r.saldo]) {
      for (const l of t?.linhas ?? []) {
        if (fora(l.inicio) || fora(l.fim)) {
          l.inicio = null
          l.fim = null
        }
      }
    }
  }
  if (r.previsto?.conferida && r.faturado?.conferida && r.saldo?.total) {
    const calculado = centavos(r.previsto.total!) - centavos(r.faturado.total!)
    if (Math.abs(calculado - centavos(r.saldo.total)) > 5) {
      r.avisos.push(`o controle informa saldo de ${moeda(r.saldo.total)}; previsto − faturado dá ${moeda(deCentavos(calculado))}`)
    }
  }
  return r
}
