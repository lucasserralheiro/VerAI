/**
 * @jest-environment node
 */
import ExcelJS from 'exceljs'
import { extrairExcel } from './excel'

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
