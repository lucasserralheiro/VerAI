// Onde estão os valores a corrigir (spec §2.2 passo 3): colunas da planilha ou valores em moeda no
// texto de PDF/DOCX. Valor sempre pela regra única do projeto (`normalizarDecimal`).
import { Readable } from 'node:stream'
import ExcelJS from 'exceljs'
import { extrairPaginas, semCamadaDeTexto } from '@/lib/assistente/indexacao/extrair'
import { normalizarDecimal } from '@/lib/relatorios-clientes/numero'
import { ArquivoIlegivel, type ColunaCandidata, type Leitura, type TipoArquivoReajuste, type ValorNoTexto } from './tipos'

const NOME_DE_VALOR = /valor|pre[çc]o|total|custo|r\$/i
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
    const r = normalizarDecimal(valor)
    return 'valor' in r ? r.valor : null
  }
  if (typeof valor === 'object' && 'result' in valor) return valorDaCelula((valor as { result?: ExcelJS.CellValue }).result ?? null)
  return null
}

function textoDaCelula(valor: ExcelJS.CellValue): string {
  if (typeof valor === 'string') return valor.trim()
  if (valor && typeof valor === 'object' && 'richText' in valor) return valor.richText.map((t) => t.text).join('').trim()
  return ''
}

export function colunasCandidatas(wb: ExcelJS.Workbook): ColunaCandidata[] {
  const colunas: ColunaCandidata[] = []
  wb.eachSheet((aba) => {
    // Cabeçalho = primeira linha com pelo menos 2 textos que não são valor.
    let linhaCabecalho = 0
    aba.eachRow((linha, numero) => {
      if (linhaCabecalho) return
      const textos = (linha.values as ExcelJS.CellValue[]).filter((v) => textoDaCelula(v) && valorDaCelula(v) === null)
      if (textos.length >= 2) linhaCabecalho = numero
    })
    if (!linhaCabecalho) return
    const cabecalhos = aba.getRow(linhaCabecalho)
    for (let coluna = 1; coluna <= aba.columnCount; coluna++) {
      const valores: string[] = []
      for (let linha = linhaCabecalho + 1; linha <= aba.rowCount; linha++) {
        const v = valorDaCelula(aba.getRow(linha).getCell(coluna).value)
        if (v !== null) valores.push(v)
      }
      if (valores.length === 0) continue
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
  if (tipo === 'xlsx' || tipo === 'csv') return { tipo: 'planilha', colunas: colunasCandidatas(await abrirPlanilha(buffer, tipo)) }
  const paginas = await extrairPaginas(buffer, tipo).catch(() => {
    throw new ArquivoIlegivel(`não foi possível ler o ${tipo.toUpperCase()}`)
  })
  if (tipo === 'pdf' && semCamadaDeTexto(paginas)) throw new ArquivoIlegivel('PDF escaneado, sem texto — não há valores para ler')
  return { tipo: 'texto', valores: valoresNoTexto(paginas) }
}
