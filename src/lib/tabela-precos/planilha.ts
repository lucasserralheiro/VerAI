import ExcelJS from 'exceljs'

// Itens da "Memória de Cálculo <ano> v<n>.xlsx" (spec 2026-09-29-tabela-de-precos §4.2–4.3). A aba é achada
// pelo cabeçalho, não pelo nome (muda a cada versão). Preço vira string decimal de 2 casas, sem float na
// gravação.

export interface ItemLido {
  grupo: string
  secoes: string
  codigo: string
  descricao: string
  unidade: string
  preco: string | null
  sobDemanda: boolean
  precoTexto: string | null
}

const CODIGO = /^\d{2}\.\d{3}\.\d{5}\.\d{2}$/
const COLUNAS = { grupo: 'GRUPO', codigo: 'CODIGO', descricao: 'DESCRICAO', unidade: 'UNIDADE', preco: 'PRECO UNITARIO' } as const
type Coluna = keyof typeof COLUNAS

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

function texto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((r) => r.text).join('')
    if ('result' in valor) return valor.result === null || valor.result === undefined ? '' : String(valor.result)
    if ('text' in valor) return String(valor.text)
    return ''
  }
  return String(valor)
}

function numero(valor: ExcelJS.CellValue): number | null {
  if (typeof valor === 'number') return valor
  if (valor && typeof valor === 'object' && 'result' in valor && typeof valor.result === 'number') return valor.result
  return null
}

function acharCabecalho(ws: ExcelJS.Worksheet): { linha: number; col: Record<Coluna, number> } | null {
  for (let l = 1; l <= Math.min(ws.rowCount, 30); l++) {
    const row = ws.getRow(l)
    const col: Partial<Record<Coluna, number>> = {}
    for (let c = 1; c <= ws.columnCount; c++) {
      const t = normal(texto(row.getCell(c).value))
      for (const [chave, rotulo] of Object.entries(COLUNAS) as [Coluna, string][]) {
        if (col[chave] === undefined && t.startsWith(rotulo)) col[chave] = c
      }
    }
    if ((Object.keys(COLUNAS) as Coluna[]).every((k) => col[k] !== undefined)) return { linha: l, col: col as Record<Coluna, number> }
  }
  return null
}

/** "A - SISTEMAS…" → 0; "C3. WIFI…" → 1; "C7.1. SERVIÇO…" → 2; outra coisa → null (não é seção). */
function nivelDaSecao(titulo: string): number | null {
  if (/^[A-Z]\s*-\s+\S/.test(titulo)) return 0
  const m = /^[A-Z](\d+(?:\.\d+)*)\.?\s/.exec(titulo)
  return m ? m[1].split('.').length : null
}

export async function lerPlanilhaDePrecos(conteudo: Buffer): Promise<{ aba: string; itens: ItemLido[]; repetidos: string[] } | { erro: string }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(conteudo as unknown as ArrayBuffer)
  for (const ws of wb.worksheets) {
    const cab = acharCabecalho(ws)
    if (!cab) continue
    const { col } = cab
    const itens: ItemLido[] = []
    const vistos = new Set<string>()
    const repetidos: string[] = []
    const secoes: string[] = []
    for (let l = cab.linha + 1; l <= ws.rowCount; l++) {
      const row = ws.getRow(l)
      const codigo = texto(row.getCell(col.codigo).value).trim()
      if (!CODIGO.test(codigo)) {
        const titulo = texto(row.getCell(col.grupo).value).trim()
        const nivel = titulo ? nivelDaSecao(titulo) : null
        if (nivel !== null) {
          secoes.length = nivel
          secoes[nivel] = titulo
        }
        continue
      }
      if (vistos.has(codigo)) {
        repetidos.push(codigo)
        continue
      }
      vistos.add(codigo)
      const bruto = row.getCell(col.preco).value
      const n = numero(bruto)
      const precoBruto = texto(bruto).trim()
      const sobDemanda = n === null && /SOB\s+DEMANDA/i.test(precoBruto)
      itens.push({
        grupo: texto(row.getCell(col.grupo).value).trim() || (secoes[0]?.[0] ?? ''),
        secoes: secoes.filter(Boolean).join(' > '),
        codigo,
        descricao: texto(row.getCell(col.descricao).value).replace(/\s+/g, ' ').trim(),
        unidade: texto(row.getCell(col.unidade).value).trim(),
        preco: n === null ? null : (Math.round(n * 100) / 100).toFixed(2),
        sobDemanda,
        precoTexto: n === null && !sobDemanda && precoBruto ? precoBruto : null,
      })
    }
    return { aba: ws.name, itens, repetidos }
  }
  return { erro: 'nenhuma aba com o cabeçalho GRUPO / CÓDIGO / DESCRIÇÃO / UNIDADE / PREÇO UNITÁRIO' }
}
