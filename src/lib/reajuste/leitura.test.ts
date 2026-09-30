/** @jest-environment node */
import ExcelJS from 'exceljs'
import { ArquivoIlegivel } from './tipos'
import { abrirPlanilha, colunasCandidatas, lerArquivo, valorDaCelula, valoresNoTexto } from './leitura'

describe('valorDaCelula', () => {
  it('número, texto em moeda e resultado de fórmula', () => {
    expect(valorDaCelula(1500)).toBe('1500')
    expect(valorDaCelula('R$ 1.500,00')).toBe('1500.00')
    expect(valorDaCelula({ formula: 'A1*2', result: 30 } as ExcelJS.CellValue)).toBe('30')
  })
  it('texto que não é valor, ambíguo, vazio e data ficam de fora', () => {
    expect(valorDaCelula('Serviço de hospedagem')).toBeNull()
    expect(valorDaCelula('1.500')).toBeNull()
    expect(valorDaCelula(null)).toBeNull()
    expect(valorDaCelula(new Date())).toBeNull()
  })
})

describe('colunasCandidatas', () => {
  it('acha colunas com valor, sugere as com nome de valor', () => {
    const wb = new ExcelJS.Workbook()
    const aba = wb.addWorksheet('Itens')
    aba.addRow(['Item', 'Quantidade', 'Valor unitário', 'Total'])
    aba.addRow(['Hospedagem', 2, 'R$ 1.500,00', 3000])
    aba.addRow(['Suporte', 1, '800,50', 800.5])
    const colunas = colunasCandidatas(wb)
    expect(colunas.map((c) => [c.cabecalho, c.coluna, c.sugerida, c.quantidade])).toEqual([
      ['Quantidade', 2, false, 2],
      ['Valor unitário', 3, true, 2],
      ['Total', 4, true, 2],
    ])
    expect(colunas[1].exemplos).toEqual(['1500.00', '800.50'])
    expect(colunas[1].linhaCabecalho).toBe(1)
  })
})

describe('valoresNoTexto', () => {
  it('só valor com centavos; processo, ano e quantidade ficam de fora', () => {
    const valores = valoresNoTexto([
      { pagina: 1, texto: 'Processo 7010.2024/0001234-5, ano 2026, 12 meses. Valor mensal de R$ 1.500,00 e total de 18.000,00.' },
      { pagina: 2, texto: 'Taxa: R$\n250,5 e item 1234,56' },
    ])
    expect(valores.map((v) => [v.pagina, v.bruto, v.original])).toEqual([
      [1, 'R$ 1.500,00', '1500.00'],
      [1, '18.000,00', '18000.00'],
      [2, '1234,56', '1234.56'],
    ])
    expect(valores[0].antes).toContain('Valor mensal de')
    expect(valores.map((v) => v.indice)).toEqual([0, 1, 2])
  })
})

describe('lerArquivo', () => {
  it('CSV com ponto e vírgula', async () => {
    const csv = Buffer.from('Item;Valor\nA;1.500,00\nB;200,00\n', 'utf8')
    const leitura = await lerArquivo(csv, 'csv')
    expect(leitura).toEqual({ tipo: 'planilha', colunas: [expect.objectContaining({ cabecalho: 'Valor', quantidade: 2 })] })
  })
  it('planilha que não abre vira ArquivoIlegivel', async () => {
    await expect(abrirPlanilha(Buffer.from('não é xlsx'), 'xlsx')).rejects.toThrow(ArquivoIlegivel)
  })
})
