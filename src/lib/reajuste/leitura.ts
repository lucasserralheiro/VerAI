// Onde estão os valores a corrigir (spec §2.2 passo 3): colunas da planilha ou valores em moeda no
// texto de PDF/DOCX. Valor sempre pela regra única do projeto (`normalizarDecimal`).
import { Readable } from 'node:stream'
import ExcelJS from 'exceljs'
import { extrairPaginas, semCamadaDeTexto } from '@/lib/assistente/indexacao/extrair'
import { normalizarDecimal } from '@/lib/relatorios-clientes/numero'
import { colunasCitadas } from './formulas'
import {
  ArquivoIlegivel,
  type AbaPrevia,
  type CelulaPrevia,
  type ColunaCandidata,
  type Leitura,
  type TipoArquivoReajuste,
  type ValorNoTexto,
} from './tipos'

// Palavra inteira: "CUSTOMIZADOS" não é custo. Quantidade, período e código nunca entram por nome.
const NOME_DE_VALOR = /(?<![\p{L}])(?:valor(?:es)?|pre[çc]os?|(?:sub)?total|custos?)(?![\p{L}])|r\$/iu
// Código de serviço/processo ("10.050.00001.00"): vários pontos sem vírgula que não são milhar.
const CODIGO_COM_PONTOS = /^\d+(?:\.\d+){2,}$/
const MILHAR_COM_PONTOS = /^\d{1,3}(?:\.\d{3})+$/
// Com centavos obrigatórios: `R$ 1.234,56`, `1.234,56`, `1234,56`. Sem centavos não entra (processo, ano, quantidade).
const MOEDA = /(?<![\d.,/-])(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?![\d,])/g
const CONTEXTO = 60

export async function abrirPlanilha(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  try {
    if (tipo === 'xlsx') {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer)
    } else {
      const texto = buffer.toString('utf8').replace(/^﻿/, '')
      const primeira = texto.split(/\r?\n/, 1)[0] ?? ''
      const delimiter = (primeira.match(/;/g) ?? []).length > (primeira.match(/,/g) ?? []).length ? ';' : ','
      // `map` devolvendo o texto cru: sem isso o exceljs converte "1.500,00" e datas por conta própria.
      await wb.csv.read(Readable.from([texto]), { parserOptions: { delimiter }, map: (v: string) => v })
    }
  } catch {
    throw new ArquivoIlegivel('não foi possível abrir a planilha — verifique se o arquivo é um .xlsx ou .csv')
  }
  return wb
}

export function valorDaCelula(valor: ExcelJS.CellValue): string | null {
  if (valor === null || valor === undefined || valor instanceof Date) return null
  if (typeof valor === 'number') return Number.isFinite(valor) && valor >= 0 ? String(valor) : null
  if (typeof valor === 'string') {
    if (!/\d/.test(valor)) return null
    const limpo = valor.replace(/R\$/gi, '').replace(/\s/g, '')
    if (CODIGO_COM_PONTOS.test(limpo) && !MILHAR_COM_PONTOS.test(limpo)) return null
    const r = normalizarDecimal(valor)
    return 'valor' in r ? r.valor : null
  }
  if (typeof valor === 'object' && 'result' in valor) return valorDaCelula((valor as { result?: ExcelJS.CellValue }).result ?? null)
  return null
}

// Célula de mesclagem que não é a principal devolve o valor da principal no exceljs — contaria o título
// mesclado em B2:H2 como sete cabeçalhos e o mesmo valor várias vezes. Só a principal vale.
function ehCopiaDeMesclagem(celula: ExcelJS.Cell): boolean {
  return celula.isMerged && celula.master.address !== celula.address
}

/** Valor da célula olhando a fórmula compartilhada também (o `value` dela às vezes vem sem `result`). */
function valorDaCelulaDaAba(celula: ExcelJS.Cell): string | null {
  if (ehCopiaDeMesclagem(celula)) return null
  if (celula.type === ExcelJS.ValueType.Formula) return valorDaCelula(celula.result ?? null)
  return valorDaCelula(celula.value)
}

function formulaDaCelula(celula: ExcelJS.Cell): string | null {
  if (ehCopiaDeMesclagem(celula) || celula.type !== ExcelJS.ValueType.Formula) return null
  return celula.formula || null
}

function textoDaCelula(valor: ExcelJS.CellValue): string {
  if (typeof valor === 'string') return valor.trim()
  if (valor && typeof valor === 'object' && 'richText' in valor) return valor.richText.map((t) => t.text).join('').trim()
  return ''
}

// Cabeçalho = primeira linha com pelo menos 2 textos que não são valor (0 = nenhuma). Título mesclado
// em várias colunas conta uma vez só.
function linhaDoCabecalho(aba: ExcelJS.Worksheet): number {
  let linhaCabecalho = 0
  aba.eachRow((linha, numero) => {
    if (linhaCabecalho) return
    let textos = 0
    linha.eachCell((celula) => {
      if (!ehCopiaDeMesclagem(celula) && textoDaCelula(celula.value) && valorDaCelula(celula.value) === null) textos++
    })
    if (textos >= 2) linhaCabecalho = numero
  })
  return linhaCabecalho
}

// Como a célula aparece na prévia — só exibição; o valor da conta é sempre `valorDaCelula`.
function exibicaoDaCelula(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') {
    const inteiro = Number.isInteger(valor)
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: inteiro ? 0 : 4 })
  }
  if (typeof valor === 'string') return valor.trim()
  if (typeof valor === 'boolean') return valor ? 'VERDADEIRO' : 'FALSO'
  if (valor instanceof Date) return valor.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  if (typeof valor === 'object' && 'richText' in valor) return valor.richText.map((t) => t.text).join('').trim()
  if (typeof valor === 'object' && 'result' in valor) return exibicaoDaCelula((valor as { result?: ExcelJS.CellValue }).result ?? null)
  if (typeof valor === 'object' && 'text' in valor) return String((valor as { text: unknown }).text ?? '')
  return ''
}

export function previaDasAbas(wb: ExcelJS.Workbook, limites = { linhas: 200, colunas: 30 }): AbaPrevia[] {
  const abas: AbaPrevia[] = []
  wb.eachSheet((aba) => {
    const totalLinhas = aba.rowCount
    const totalColunas = aba.columnCount
    const linhas: AbaPrevia['linhas'] = []
    for (let numero = 1; numero <= Math.min(totalLinhas, limites.linhas); numero++) {
      const linha = aba.getRow(numero)
      const celulas: CelulaPrevia[] = []
      for (let coluna = 1; coluna <= Math.min(totalColunas, limites.colunas); coluna++) {
        const celula = linha.getCell(coluna)
        const bruto = ehCopiaDeMesclagem(celula) ? null : celula.value
        const v = valorDaCelulaDaAba(celula)
        const f = formulaDaCelula(celula) !== null
        celulas.push(v === null ? { t: exibicaoDaCelula(bruto) } : f ? { t: exibicaoDaCelula(bruto), v, f: true as const } : { t: exibicaoDaCelula(bruto), v })
      }
      linhas.push({ numero, celulas })
    }
    abas.push({ nome: aba.name, linhaCabecalho: linhaDoCabecalho(aba), totalLinhas, totalColunas, linhas })
  })
  return abas
}

const chave = (aba: string, coluna: number) => `${aba}\u0000${coluna}`

export function colunasCandidatas(wb: ExcelJS.Workbook): ColunaCandidata[] {
  const colunas: ColunaCandidata[] = []
  const citadasPor = new Map<string, Set<string>>()
  const intervalosPor = new Map<string, string[][]>()
  wb.eachSheet((aba) => {
    const linhaCabecalho = linhaDoCabecalho(aba)
    if (!linhaCabecalho) return
    const cabecalhos = aba.getRow(linhaCabecalho)
    for (let coluna = 1; coluna <= aba.columnCount; coluna++) {
      const valores: string[] = []
      const citadas = new Set<string>()
      const intervalos: string[][] = []
      for (let linha = linhaCabecalho + 1; linha <= aba.rowCount; linha++) {
        const celula = aba.getRow(linha).getCell(coluna)
        const v = valorDaCelulaDaAba(celula)
        if (v !== null) valores.push(v)
        const formula = formulaDaCelula(celula)
        if (formula) {
          for (const ref of colunasCitadas(formula, aba.name)) {
            const chaves = ref.colunas.map((n) => chave(ref.aba, n))
            chaves.forEach((k) => citadas.add(k))
            if (chaves.length > 1) intervalos.push(chaves)
          }
        }
      }
      if (valores.length === 0) continue
      citadasPor.set(chave(aba.name, coluna), citadas)
      intervalosPor.set(chave(aba.name, coluna), intervalos)
      const cabecalho = textoDaCelula(cabecalhos.getCell(coluna).value) || `Coluna ${coluna}`
      colunas.push({
        aba: aba.name,
        coluna,
        cabecalho,
        linhaCabecalho,
        exemplos: valores.slice(0, 3),
        quantidade: valores.length,
        sugerida: NOME_DE_VALOR.test(cabecalho),
      })
    }
  })
  // A planilha inteira anda junto: (1) coluna cuja fórmula usa uma sugerida sai da conta dela (total a
  // partir do preço, cronograma a partir do total da memória de cálculo); (2) coluna somada no mesmo
  // intervalo que uma sugerida, por uma sugerida (VALOR TOTAL = SUM(C3:H3)), é dinheiro também.
  const porChave = new Map(colunas.map((c) => [chave(c.aba, c.coluna), c]))
  const sugeridas = new Set(colunas.filter((c) => c.sugerida).map((c) => chave(c.aba, c.coluna)))
  const sugerir = (k: string) => {
    const c = porChave.get(k)
    if (!c || c.sugerida) return false
    c.sugerida = true
    sugeridas.add(k)
    return true
  }
  for (let mudou = true; mudou; ) {
    mudou = false
    for (const [propria, citadas] of citadasPor) {
      if (!sugeridas.has(propria) && [...citadas].some((k) => k !== propria && sugeridas.has(k))) mudou = sugerir(propria) || mudou
      if (!sugeridas.has(propria)) continue
      for (const intervalo of intervalosPor.get(propria) ?? []) {
        if (intervalo.some((k) => sugeridas.has(k))) for (const k of intervalo) mudou = sugerir(k) || mudou
      }
    }
  }
  return colunas
}

export function valoresNoTexto(paginas: Array<{ pagina: number | null; texto: string }>): ValorNoTexto[] {
  const valores: ValorNoTexto[] = []
  for (const { pagina, texto } of paginas) {
    for (const achado of texto.matchAll(MOEDA)) {
      const r = normalizarDecimal(achado[0])
      if (!('valor' in r)) continue
      const inicio = achado.index ?? 0
      const fim = inicio + achado[0].length
      valores.push({
        indice: valores.length,
        pagina,
        original: r.valor,
        bruto: achado[0].replace(/\s+/g, ' '),
        antes: texto.slice(Math.max(0, inicio - CONTEXTO), inicio).replace(/\s+/g, ' ').trimStart(),
        depois: texto.slice(fim, fim + CONTEXTO).replace(/\s+/g, ' ').trimEnd(),
      })
    }
  }
  return valores
}

export async function lerArquivo(buffer: Buffer, tipo: TipoArquivoReajuste): Promise<Leitura> {
  if (tipo === 'xlsx' || tipo === 'csv') {
    const wb = await abrirPlanilha(buffer, tipo)
    return { tipo: 'planilha', colunas: colunasCandidatas(wb), abas: previaDasAbas(wb) }
  }
  const paginas = await extrairPaginas(buffer, tipo).catch(() => {
    throw new ArquivoIlegivel(`não foi possível ler o ${tipo.toUpperCase()}`)
  })
  if (tipo === 'pdf' && semCamadaDeTexto(paginas)) throw new ArquivoIlegivel('PDF escaneado, sem texto — não há valores para ler')
  return { tipo: 'texto', valores: valoresNoTexto(paginas) }
}
