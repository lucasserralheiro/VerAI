/**
 * @jest-environment node
 */
import ExcelJS from 'exceljs'
import { extrairExcel, converterPlanilhaParaHtml } from './excel'

async function gerarBuffer(montar: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  montar(workbook)
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

describe('extrairExcel', () => {
  it('extrai os dados quando a primeira planilha já tem os registros', async () => {
    const buffer = await gerarBuffer((wb) => {
      const sheet = wb.addWorksheet('Faturamento')
      sheet.addRow(['item', 'valor'])
      sheet.addRow(['Storage', 11200])
    })

    const resultado = await extrairExcel(buffer, 'xlsx')

    expect(resultado).toContain('Storage')
    expect(resultado).toContain('Linhas de dados: 1')
  })

  it('usa a primeira planilha que TEM dados quando a primeira aba está vazia', async () => {
    const buffer = await gerarBuffer((wb) => {
      wb.addWorksheet('Resumo') // aba de capa, sem nenhuma linha
      const dados = wb.addWorksheet('Faturamento')
      dados.addRow(['item', 'quantidade', 'valor_unitario', 'valor_total'])
      dados.addRow(['Storage Premium', 500, 22.4, 11200])
      dados.addRow(['Backup diario', 200, 12.5, 2500])
      dados.addRow(['VM standard D4s', 12, 890, 10680])
    })

    const resultado = await extrairExcel(buffer, 'xlsx')

    expect(resultado).not.toBe('Planilha vazia — nenhum dado encontrado.')
    expect(resultado).toContain('Storage Premium')
    expect(resultado).toContain('Linhas de dados: 3')
  })

  it('continua reportando planilha vazia quando NENHUMA aba tem dados', async () => {
    const buffer = await gerarBuffer((wb) => {
      wb.addWorksheet('Resumo')
      wb.addWorksheet('Rascunho')
    })

    const resultado = await extrairExcel(buffer, 'xlsx')

    expect(resultado).toBe('Planilha vazia — nenhum dado encontrado.')
  })
})

describe('converterPlanilhaParaHtml', () => {
  it('converte a planilha inteira numa tabela HTML, sem amostrar nem resumir', async () => {
    const buffer = await gerarBuffer((wb) => {
      const sheet = wb.addWorksheet('Faturamento')
      sheet.addRow(['item', 'valor'])
      sheet.addRow(['Storage', 11200])
      sheet.addRow(['Backup', 2500])
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    expect(html).toBe(
      '<table><thead><tr><th>item</th><th>valor</th></tr></thead>' +
        '<tbody><tr><td>Storage</td><td>11200</td></tr><tr><td>Backup</td><td>2500</td></tr></tbody></table>'
    )
  })

  it('preserva coluna que a pessoa preencheu só com espaço em branco (não é descartada como vazia)', async () => {
    const buffer = await gerarBuffer((wb) => {
      const sheet = wb.addWorksheet('Dados')
      sheet.addRow(['A', 'B', 'C'])
      sheet.addRow(['x', 'y', ' '])
      sheet.addRow(['z', 'w', ' '])
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    // 3 colunas continuam na tabela — a coluna "C" não foi cortada
    expect(html).toContain('<th>A</th><th>B</th><th>C</th>')
    expect(html).toContain('<td>x</td><td>y</td><td> </td>')
  })

  it('preserva linha preenchida só com espaço em branco', async () => {
    const buffer = await gerarBuffer((wb) => {
      const sheet = wb.addWorksheet('Dados')
      sheet.addRow(['A', 'B'])
      sheet.addRow(['x', 'y'])
      sheet.addRow([' ', ' '])
      sheet.addRow(['z', 'w'])
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    // cabeçalho + 3 linhas de dados = 4 <tr> no total
    expect(html.match(/<tr>/g)).toHaveLength(4)
    expect(html).toContain('<td> </td><td> </td>')
  })

  it('converte TODAS as abas com dados, cada uma sob o próprio nome, sem descartar nenhuma', async () => {
    const buffer = await gerarBuffer((wb) => {
      const fat = wb.addWorksheet('Faturamento')
      fat.addRow(['item', 'valor'])
      fat.addRow(['Storage', 11200])
      const det = wb.addWorksheet('Detalhamento')
      det.addRow(['data', 'uso'])
      det.addRow(['2026-08', '480h'])
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    expect(html).toBe(
      '<h2>Faturamento</h2><table><thead><tr><th>item</th><th>valor</th></tr></thead>' +
        '<tbody><tr><td>Storage</td><td>11200</td></tr></tbody></table>' +
        '<hr>' +
        '<h2>Detalhamento</h2><table><thead><tr><th>data</th><th>uso</th></tr></thead>' +
        '<tbody><tr><td>2026-08</td><td>480h</td></tr></tbody></table>'
    )
  })

  it('ignora aba de capa vazia mas mantém todas as abas que têm dados', async () => {
    const buffer = await gerarBuffer((wb) => {
      wb.addWorksheet('Capa') // sem linhas
      const a = wb.addWorksheet('Jan')
      a.addRow(['x'])
      a.addRow(['1'])
      const b = wb.addWorksheet('Fev')
      b.addRow(['x'])
      b.addRow(['2'])
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    expect(html).toContain('<h2>Jan</h2>')
    expect(html).toContain('<h2>Fev</h2>')
    expect(html).not.toContain('<h2>Capa</h2>')
  })

  it('uma única aba não ganha cabeçalho de seção (comportamento inalterado)', async () => {
    const buffer = await gerarBuffer((wb) => {
      const sheet = wb.addWorksheet('Unica')
      sheet.addRow(['a', 'b'])
      sheet.addRow(['1', '2'])
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    expect(html.startsWith('<table>')).toBe(true)
    expect(html).not.toContain('<h2>')
  })

  it('mostra o resultado calculado da fórmula, não "[object Object]"', async () => {
    const buffer = await gerarBuffer((wb) => {
      const sheet = wb.addWorksheet('Custos')
      sheet.addRow(['item', 'custo', 'preco'])
      const linha = sheet.addRow(['Storage', 100])
      linha.getCell(3).value = { formula: 'B2*2', result: 200 }
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    expect(html).not.toContain('[object Object]')
    expect(html).toContain('<td>Storage</td><td>100</td><td>200</td>')
  })

  it('mostra o texto visível do hyperlink, não o objeto da célula', async () => {
    const buffer = await gerarBuffer((wb) => {
      const sheet = wb.addWorksheet('Links')
      sheet.addRow(['item', 'link'])
      const linha = sheet.addRow(['Contrato', null])
      linha.getCell(2).value = { text: 'Ver contrato', hyperlink: 'https://exemplo.com/contrato' }
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    expect(html).not.toContain('[object Object]')
    expect(html).toContain('<td>Contrato</td><td>Ver contrato</td>')
  })

  it('concatena o texto de uma célula rich text', async () => {
    const buffer = await gerarBuffer((wb) => {
      const sheet = wb.addWorksheet('Notas')
      sheet.addRow(['item', 'nota'])
      const linha = sheet.addRow(['Storage', null])
      linha.getCell(2).value = {
        richText: [
          { text: 'Aprovado ' },
          { text: 'por Lucas', font: { bold: true } },
        ],
      }
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    expect(html).not.toContain('[object Object]')
    expect(html).toContain('<td>Storage</td><td>Aprovado por Lucas</td>')
  })

  it('preenche com célula vazia uma linha cuja última coluna preenchida fica antes das outras (ExcelJS devolve values mais curto)', async () => {
    // Reproduz o bug real: numa planilha de "faixas" de preço, a primeira
    // faixa não tem colunas de custo preenchidas — só item e descrição. O
    // `row.values` do ExcelJS pra essa linha específica vem mais curto do
    // que o das outras linhas (só vai até a última célula com valor NAQUELA
    // linha), e sem preencher isso a tabela final fica com número de
    // células diferente por linha — célula fantasma faltando no HTML.
    const buffer = await gerarBuffer((wb) => {
      const sheet = wb.addWorksheet('Faixas')
      sheet.addRow(['item', 'descricao', 'custo', 'preco'])
      sheet.addRow([100, 'Bronze até 100']) // só 2 células — as outras 4 linhas têm 4
      sheet.addRow([1000, 'Prata de 101 até 1000', 9920.14, 18127.33])
      sheet.addRow([5000, 'Ouro de 1001 até 5000', 10729.95, 19607.11])
    })

    const html = await converterPlanilhaParaHtml(buffer, 'xlsx')

    // Toda linha da tabela (cabeçalho e corpo) tem o mesmo número de
    // células — nenhuma linha "curta" quebrando o alinhamento.
    const linhas = [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((m) => m[1])
    const contarCelulas = (linha: string) => (linha.match(/<t[dh]>/g) ?? []).length
    const celulasEsperadas = contarCelulas(linhas[0])
    for (const linha of linhas) {
      expect(contarCelulas(linha)).toBe(celulasEsperadas)
    }

    expect(linhas[1]).toBe('<td>100</td><td>Bronze até 100</td><td></td><td></td>')
  })
})
