/** @jest-environment node */
import ExcelJS from 'exceljs'
import { ABA_RESUMO, planilhaCorrigida, planilhaDeComparacao, type Resumo } from './resultado'

const resumo: Resumo = {
  meses: [{ mes: '2026-07', variacao: '-0.03' }, { mes: '2026-08', variacao: '0.01' }],
  fator: '0.999800',
  acumuladoPct: '-0.02',
  usuario: 'Fulano',
  geradoEm: new Date('2026-09-30T12:00:00Z'),
  arquivo: 'itens.xlsx',
}

// set/2025–ago/2026, reais (fator 1,035543)
const DOZE = [
  ['2025-09', '0.65'], ['2025-10', '0.27'], ['2025-11', '0.20'], ['2025-12', '0.32'], ['2026-01', '0.21'], ['2026-02', '0.25'],
  ['2026-03', '0.59'], ['2026-04', '0.40'], ['2026-05', '0.45'], ['2026-06', '0.18'], ['2026-07', '-0.03'], ['2026-08', '0.01'],
].map(([mes, variacao]) => ({ mes, variacao }))

async function reabrir(buffer: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  return wb
}

describe('planilhaCorrigida', () => {
  it('põe a coluna corrigida depois da última usada, sem mover fórmula, e a aba de resumo', async () => {
    const wb = new ExcelJS.Workbook()
    const aba = wb.addWorksheet('Itens')
    aba.addRow(['Item', 'Valor', 'Obs'])
    aba.addRow(['A', 1000, 'x'])
    aba.addRow(['B', 'sem valor', 'y'])
    aba.getCell('D4').value = { formula: 'B2*2', result: 2000 } as ExcelJS.CellFormulaValue

    const { buffer, quantidade } = await planilhaCorrigida(wb, [{ aba: 'Itens', coluna: 2, linhaCabecalho: 1 }], resumo)
    const saida = await reabrir(buffer)
    const itens = saida.getWorksheet('Itens')!
    expect(quantidade).toBe(1)
    expect(itens.getCell('E1').value).toBe('Valor corrigido')
    expect(itens.getCell('E2').value).toBe(999.8)
    expect(itens.getCell('E3').value).toBeNull()
    expect((itens.getCell('D4').value as ExcelJS.CellFormulaValue).formula).toBe('B2*2')
    const r = saida.getWorksheet(ABA_RESUMO)!
    expect(r).toBeDefined()
    const texto = JSON.stringify(r.getSheetValues())
    expect(texto).toContain('jul/2026')
    expect(texto).toContain('0.999800')
  })
})

describe('planilhaCorrigida com fórmulas (memória de cálculo)', () => {
  it('corrige o preço; total, subtotal e cronograma refazem a conta com as colunas corrigidas', async () => {
    const wb = new ExcelJS.Workbook()
    const mem = wb.addWorksheet('Memória Cálculo')
    mem.addRow(['Código', 'Preço unitário (R$)', 'Qtde', 'Meses', 'Total (R$)'])
    mem.addRow(['Subtotal', null, null, null, { formula: 'SUM(E3:E4)', result: 3740.4 }])
    mem.addRow(['10.050.00001.00', 100, 2, 12, { formula: 'ROUND(B3*C3*D3,2)', result: 2400 }])
    mem.addRow(['15.075.00012.00', 0.15, 8936, 1, { formula: 'ROUND(B4*C4,2)', result: 1340.4 }])
    const cron = wb.addWorksheet('Cronograma')
    cron.addRow(['Mês', 'Valor'])
    cron.addRow(['Mês 1', { formula: "ROUND('Memória Cálculo'!E2/12,2)", result: 311.7 }])

    const { buffer, quantidade } = await planilhaCorrigida(
      wb,
      [
        { aba: 'Memória Cálculo', coluna: 2, linhaCabecalho: 1 },
        { aba: 'Memória Cálculo', coluna: 5, linhaCabecalho: 1 },
        { aba: 'Cronograma', coluna: 2, linhaCabecalho: 1 },
      ],
      { ...resumo, fator: '1.035543', acumuladoPct: '3.55', meses: DOZE }
    )
    const saida = await reabrir(buffer)
    const m = saida.getWorksheet('Memória Cálculo')!
    expect(quantidade).toBe(6)
    expect(m.getCell('F1').value).toBe('Preço unitário (R$) corrigido')
    expect(m.getCell('G1').value).toBe('Total (R$) corrigido')
    // preço × fator, 2 casas (0,15 → 0,16); quantidade e meses nunca são corrigidos
    expect(m.getCell('F3').value).toBe(103.55)
    expect(m.getCell('F4').value).toBe(0.16)
    expect((m.getCell('G3').value as ExcelJS.CellFormulaValue).formula).toBe('ROUND(F3*C3*D3,2)')
    expect((m.getCell('G4').value as ExcelJS.CellFormulaValue).formula).toBe('ROUND(F4*C4,2)')
    expect((m.getCell('G2').value as ExcelJS.CellFormulaValue).formula).toBe('SUM(G3:G4)')
    const c = saida.getWorksheet('Cronograma')!
    expect((c.getCell('C2').value as ExcelJS.CellFormulaValue).formula).toBe("ROUND('Memória Cálculo'!G2/12,2)")
  })
})

describe('planilhaDeComparacao', () => {
  it('uma linha por valor marcado com original, corrigido e diferença', async () => {
    const { buffer, quantidade } = await planilhaDeComparacao(
      [{ indice: 0, pagina: 3, original: '1500.00', bruto: 'R$ 1.500,00', antes: 'mensal de', depois: 'por mês' }],
      { ...resumo, fator: '1.035543', acumuladoPct: '3.55', meses: DOZE }
    )
    const aba = (await reabrir(buffer)).getWorksheet('Valores')!
    expect(quantidade).toBe(1)
    expect(aba.getRow(1).values).toEqual([, 'Página', 'Trecho', 'Valor original', 'Valor corrigido', 'Diferença'])
    expect(aba.getRow(2).values).toEqual([, 3, 'mensal de [R$ 1.500,00] por mês', 1500, 1553.31, 53.31])
  })
})
