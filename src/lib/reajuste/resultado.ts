// Resultado do reajuste (spec §2.3): planilha com colunas "corrigido" depois da última usada (nada
// muda de lugar, fórmula existente não quebra) ou planilha de comparação pra PDF/DOCX. Sempre com a
// aba "Reajuste IPC-Fipe" provando o cálculo. Na planilha, só valor digitado é multiplicado pelo
// fator; célula de fórmula ganha a mesma fórmula apontando pras colunas corrigidas (spec §2.3.1).
import Decimal from 'decimal.js'
import ExcelJS from 'exceljs'
import { corrigirValor, fatorCompleto } from './calculo'
import { type MapaDeColunas, traduzirFormula } from './formulas'
import { valorDaCelula } from './leitura'
import { nomeDoMes } from './meses'
import type { ValorNoTexto } from './tipos'

export const ABA_RESUMO = 'Reajuste IPC-Fipe'
const MOEDA_BR = '#,##0.00'

export interface Resumo {
  meses: Array<{ mes: string; variacao: string }>
  fator: string
  acumuladoPct: string
  usuario: string
  geradoEm: Date
  arquivo: string
}

function abaDeResumo(wb: ExcelJS.Workbook, resumo: Resumo) {
  const existente = wb.getWorksheet(ABA_RESUMO)
  if (existente) wb.removeWorksheet(existente.id)
  const aba = wb.addWorksheet(ABA_RESUMO)
  aba.addRow(['Índice', 'IPC-Fipe (Banco Central, série 193)'])
  aba.addRow(['Arquivo', resumo.arquivo])
  aba.addRow(['Período', `${nomeDoMes(resumo.meses[0].mes)} a ${nomeDoMes(resumo.meses.at(-1)!.mes)}`])
  aba.addRow(['Acumulado (%)', resumo.acumuladoPct])
  aba.addRow(['Fator', resumo.fator])
  aba.addRow(['Gerado por', resumo.usuario])
  aba.addRow(['Gerado em', resumo.geradoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })])
  aba.addRow([])
  aba.addRow(['Mês', 'Variação (%)'])
  for (const m of resumo.meses) aba.addRow([nomeDoMes(m.mes), m.variacao])
  aba.getColumn(1).width = 16
  aba.getColumn(2).width = 40
}

const paraBuffer = async (wb: ExcelJS.Workbook) => Buffer.from(await wb.xlsx.writeBuffer())

export async function planilhaCorrigida(
  wb: ExcelJS.Workbook,
  colunas: Array<{ aba: string; coluna: number; linhaCabecalho: number }>,
  resumo: Resumo
) {
  const fator = fatorCompleto(resumo.meses)
  let quantidade = 0
  const porAba = new Map<string, typeof colunas>()
  for (const c of colunas) porAba.set(c.aba, [...(porAba.get(c.aba) ?? []), c])

  // Primeiro decide onde cai cada coluna corrigida, em TODAS as abas: a fórmula de uma aba pode citar
  // outra (cronograma → memória de cálculo). Em ordem de coluna, pra intervalo C:H virar K:P.
  const mapa: MapaDeColunas = new Map()
  for (const [nome, lista] of porAba) {
    const aba = wb.getWorksheet(nome)
    if (!aba) continue
    lista.sort((a, b) => a.coluna - b.coluna)
    const destinos = new Map<number, number>()
    let destino = aba.columnCount
    for (const c of lista) if (!destinos.has(c.coluna)) destinos.set(c.coluna, ++destino)
    mapa.set(nome, destinos)
  }

  for (const [nome, lista] of porAba) {
    const aba = wb.getWorksheet(nome)
    const destinos = mapa.get(nome)
    if (!aba || !destinos) continue
    for (const c of lista) {
      const destino = destinos.get(c.coluna)!
      const titulo = aba.getRow(c.linhaCabecalho).getCell(c.coluna).text || `Coluna ${c.coluna}`
      aba.getRow(c.linhaCabecalho).getCell(destino).value = `${titulo} corrigido`
      for (let linha = c.linhaCabecalho + 1; linha <= aba.rowCount; linha++) {
        const origem = aba.getRow(linha).getCell(c.coluna)
        if (origem.isMerged && origem.master.address !== origem.address) continue
        const celula = aba.getRow(linha).getCell(destino)
        const ehFormula = origem.type === ExcelJS.ValueType.Formula
        // Fórmula que usa coluna corrigida: a mesma conta, com as colunas corrigidas (o Excel recalcula
        // ao abrir). Preço × fator, total = ROUND(preço corrigido × qtde × meses) — como a planilha faz.
        if (ehFormula && origem.formula) {
          const traducao = traduzirFormula(origem.formula, nome, mapa)
          if (traducao.tipo === 'traduzida') {
            celula.value = { formula: traducao.formula } as ExcelJS.CellFormulaValue
            celula.numFmt = MOEDA_BR
            quantidade++
            continue
          }
        }
        // Valor digitado (ou fórmula que não depende de nada corrigido): valor × fator, 2 casas.
        const original = valorDaCelula(ehFormula ? (origem.result ?? null) : origem.value)
        if (original === null) continue
        celula.value = Number(corrigirValor(original, fator))
        celula.numFmt = MOEDA_BR
        quantidade++
      }
    }
  }
  // Sem isso o Excel mostraria as fórmulas novas vazias até alguém mandar recalcular.
  wb.calcProperties = { ...wb.calcProperties, fullCalcOnLoad: true }
  abaDeResumo(wb, resumo)
  return { buffer: await paraBuffer(wb), quantidade }
}

export async function planilhaDeComparacao(valores: ValorNoTexto[], resumo: Resumo) {
  const fator = fatorCompleto(resumo.meses)
  const wb = new ExcelJS.Workbook()
  const aba = wb.addWorksheet('Valores')
  aba.addRow(['Página', 'Trecho', 'Valor original', 'Valor corrigido', 'Diferença'])
  for (const v of valores) {
    const corrigido = corrigirValor(v.original, fator)
    aba.addRow([
      v.pagina ?? '',
      `${v.antes} [${v.bruto}] ${v.depois}`.trim(),
      Number(v.original),
      Number(corrigido),
      Number(new Decimal(corrigido).minus(v.original).toFixed(2)),
    ])
  }
  for (const c of [3, 4, 5]) aba.getColumn(c).numFmt = MOEDA_BR
  aba.getColumn(2).width = 80
  abaDeResumo(wb, resumo)
  return { buffer: await paraBuffer(wb), quantidade: valores.length }
}
