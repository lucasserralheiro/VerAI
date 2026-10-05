/** @jest-environment node */
import ExcelJS from 'exceljs'
import { ArquivoIlegivel } from './tipos'
import { abrirPlanilha, colunasCandidatas, lerArquivo, previaDasAbas, valorDaCelula, valoresNoTexto } from './leitura'

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
    expect(valorDaCelula('10.050.00001.00')).toBeNull()
    expect(valorDaCelula('1.234.567')).toBe('1234567')
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

describe('colunasCandidatas numa memória de cálculo', () => {
  it('título mesclado não vira cabeçalho, código não é valor, qtde/meses ficam de fora e o cronograma vem junto', () => {
    const wb = new ExcelJS.Workbook()
    const mem = wb.addWorksheet('Memória Cálculo')
    mem.addRow(['TABELA DE PREÇOS SERVIÇOS PRODAM - 2026'])
    mem.mergeCells('A1:E1')
    mem.addRow(['CÓDIGO', 'PREÇO UNITÁRIO (R$)', 'QTDE', 'PERÍODO (MÊS)', 'TOTAL (R$)'])
    mem.addRow(['10.050.00001.00', 237.75, 160, 24, { formula: 'ROUND(B3*C3,2)', result: 38040 }])
    const cron = wb.addWorksheet('Cronograma')
    cron.addRow(['PERÍODO', 'A - SISTEMAS', 'H - PRODUTOS CUSTOMIZADOS', 'I - TERCEIROS', 'VALOR TOTAL'])
    cron.addRow(['MÊS 1', { formula: "ROUND('Memória Cálculo'!E3/12,2)", result: 3170 }, 0, 0, { formula: 'SUM(B2:D2)', result: 3170 }])
    const colunas = colunasCandidatas(wb)
    expect(colunas.map((c) => [c.aba, c.cabecalho, c.linhaCabecalho, c.sugerida])).toEqual([
      ['Memória Cálculo', 'PREÇO UNITÁRIO (R$)', 2, true],
      ['Memória Cálculo', 'QTDE', 2, false],
      ['Memória Cálculo', 'PERÍODO (MÊS)', 2, false],
      ['Memória Cálculo', 'TOTAL (R$)', 2, true],
      ['Cronograma', 'A - SISTEMAS', 1, true], // usa o total da memória
      ['Cronograma', 'H - PRODUTOS CUSTOMIZADOS', 1, true], // "CUSTOMIZADOS" não é custo; entra por estar no SUM
      ['Cronograma', 'I - TERCEIROS', 1, true],
      ['Cronograma', 'VALOR TOTAL', 1, true],
    ])
  })
})

describe('previaDasAbas', () => {
  it('células como aparecem, com o valor normalizado quando é valor, e o cabeçalho achado', () => {
    const wb = new ExcelJS.Workbook()
    const aba = wb.addWorksheet('Itens')
    aba.addRow(['Planilha de preços'])
    aba.addRow(['Item', 'Valor'])
    aba.addRow(['Hospedagem', 'R$ 1.500,00'])
    aba.addRow(['Suporte', 800.5])
    const [previa] = previaDasAbas(wb)
    expect(previa).toMatchObject({ nome: 'Itens', linhaCabecalho: 2, totalLinhas: 4, totalColunas: 2 })
    expect(previa.linhas.map((l) => l.numero)).toEqual([1, 2, 3, 4])
    expect(previa.linhas[0].celulas).toEqual([{ t: 'Planilha de preços' }, { t: '' }])
    expect(previa.linhas[2].celulas).toEqual([{ t: 'Hospedagem' }, { t: 'R$ 1.500,00', v: '1500.00' }])
    expect(previa.linhas[3].celulas[1]).toEqual({ t: '800,50', v: '800.5' })
  })
  it('corta linhas e colunas nos limites, mas conta o total', () => {
    const wb = new ExcelJS.Workbook()
    const aba = wb.addWorksheet('Grande')
    for (let i = 0; i < 5; i++) aba.addRow(['a', 'b', 'c', 'd'])
    const [previa] = previaDasAbas(wb, { linhas: 3, colunas: 2 })
    expect(previa.linhas).toHaveLength(3)
    expect(previa.linhas[0].celulas).toHaveLength(2)
    expect(previa).toMatchObject({ totalLinhas: 5, totalColunas: 4 })
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
    expect(leitura).toEqual({
      tipo: 'planilha',
      colunas: [expect.objectContaining({ cabecalho: 'Valor', quantidade: 2 })],
      abas: [expect.objectContaining({ linhaCabecalho: 1, totalLinhas: 3 })],
    })
  })
  it('planilha que não abre vira ArquivoIlegivel', async () => {
    await expect(abrirPlanilha(Buffer.from('não é xlsx'), 'xlsx')).rejects.toThrow(ArquivoIlegivel)
  })
})
