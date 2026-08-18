import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'

const AMOSTRA_MAX_LINHAS = 30

async function carregarPrimeiraPlanilha(buffer: Buffer, tipo: 'xlsx' | 'csv') {
  const workbook = new ExcelJS.Workbook()

  if (tipo === 'csv') {
    await workbook.csv.read(Readable.from(buffer))
  } else {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  }

  const planilha = workbook.worksheets[0]
  if (!planilha || planilha.rowCount === 0) {
    return null
  }

  const cabecalho = (planilha.getRow(1).values as unknown[]).slice(1).map((v) => String(v ?? ''))
  const linhas: unknown[][] = []
  for (let i = 2; i <= planilha.rowCount; i++) {
    linhas.push((planilha.getRow(i).values as unknown[]).slice(1))
  }

  return { planilha, cabecalho, linhas }
}

export interface PreviewPlanilha {
  cabecalho: string[]
  linhas: string[][]
  totalLinhas: number
  truncado: boolean
}

export async function lerPlanilhaPreview(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<PreviewPlanilha> {
  const dados = await carregarPrimeiraPlanilha(buffer, tipo)
  if (!dados) {
    return { cabecalho: [], linhas: [], totalLinhas: 0, truncado: false }
  }

  const { cabecalho, linhas } = dados
  return {
    cabecalho,
    linhas: linhas.slice(0, AMOSTRA_MAX_LINHAS).map((linha) => linha.map((v) => String(v ?? ''))),
    totalLinhas: linhas.length,
    truncado: linhas.length > AMOSTRA_MAX_LINHAS,
  }
}

export async function extrairExcel(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<string> {
  const dados = await carregarPrimeiraPlanilha(buffer, tipo)
  if (!dados) {
    return 'Planilha vazia — nenhum dado encontrado.'
  }
  const { planilha, cabecalho, linhas } = dados

  const tipos = cabecalho.map((_, colIdx) => {
    const valor = linhas[0]?.[colIdx]
    if (typeof valor === 'number') return 'número'
    if (valor instanceof Date) return 'data'
    return 'texto'
  })

  const estatisticas = cabecalho
    .map((nome, colIdx) => {
      if (tipos[colIdx] !== 'número') return null
      const valores = linhas
        .map((linha) => linha[colIdx])
        .filter((v): v is number => typeof v === 'number')
      if (valores.length === 0) return null
      const soma = valores.reduce((acc, v) => acc + v, 0)
      const min = Math.min(...valores)
      const max = Math.max(...valores)
      const media = soma / valores.length
      return `${nome}: min=${min}, máx=${max}, média=${media.toFixed(2)}, soma=${soma}`
    })
    .filter((linha): linha is string => linha !== null)

  const amostra = linhas.slice(0, AMOSTRA_MAX_LINHAS).map((linha) => linha.join(' | '))

  return [
    `Planilha: ${planilha.name}`,
    `Linhas de dados: ${linhas.length}`,
    `Colunas (${cabecalho.length}): ${cabecalho.map((nome, i) => `${nome} (${tipos[i]})`).join(', ')}`,
    '',
    `Amostra (até ${AMOSTRA_MAX_LINHAS} linhas):`,
    cabecalho.join(' | '),
    ...amostra,
    '',
    estatisticas.length > 0 ? `Estatísticas básicas:\n${estatisticas.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
