/** @jest-environment node */
import ExcelJS from 'exceljs'
import { lerPlanilhaItens, numeroPtBr } from './importar-itens'

async function xlsx(linhas: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const aba = workbook.addWorksheet('Itens')
  linhas.forEach((linha) => aba.addRow(linha))
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

describe('numeroPtBr', () => {
  it.each([
    ['R$ 1.234,56', '1234.56'],
    ['1234.5', '1234.5'],
    ['1.234.567', '1234567'],
    ['10,5', '10.5'],
    ['0', '0'],
  ])('%s → %s', (entrada, esperado) => expect(numeroPtBr(entrada)).toBe(esperado))

  it.each(['abc', '', '1,2,3', 'R$', '1.234', '0.125', '-5'])('%p não é número', (entrada) => expect(numeroPtBr(entrada)).toBeNull())
})

describe('lerPlanilhaItens', () => {
  it('lê xlsx com valor total, aceitando célula numérica e texto pt-BR', async () => {
    const buffer = await xlsx([
      ['Descrição', 'Valor total'],
      ['Sustentação', 1500.5],
      ['Licenças', 'R$ 2.000,00'],
    ])
    const { linhas, erros } = await lerPlanilhaItens(buffer, 'itens.xlsx')
    expect(erros).toEqual([])
    expect(linhas.map((l) => [l.linha, l.descricao, l.valorTotal])).toEqual([
      [2, 'Sustentação', '1500.5'],
      [3, 'Licenças', '2000'],
    ])
  })

  it('calcula o total por quantidade × valor unitário e reconhece sinônimos do legado', async () => {
    const buffer = await xlsx([
      ['Descrição Produto', 'Qtd', 'Vl Unit'],
      ['Hora técnica', 10, '150,25'],
    ])
    const { linhas, erros } = await lerPlanilhaItens(buffer, 'itens.xlsx')
    expect(erros).toEqual([])
    expect(linhas[0]).toMatchObject({ quantidade: '10', valorUnitario: '150.25', valorTotal: '1502.5' })
  })

  it('lê csv com separador ponto e vírgula e ignora linhas em branco', async () => {
    const csv = 'Descrição;Valor total\nItem A;"1.000,00"\n;\nItem B;250,50\n'
    const { linhas, erros } = await lerPlanilhaItens(Buffer.from(csv), 'itens.csv')
    expect(erros).toEqual([])
    expect(linhas.map((l) => l.valorTotal)).toEqual(['1000', '250.5'])
  })

  it('aponta a linha de cada erro e não devolve linhas parciais silenciosamente', async () => {
    const buffer = await xlsx([
      ['Descrição', 'Valor total'],
      ['Ok', 100],
      ['Ruim', 'abc'],
      ['Negativo', -5],
    ])
    const { linhas, erros } = await lerPlanilhaItens(buffer, 'itens.xlsx')
    expect(linhas).toHaveLength(1)
    expect(erros.map((e) => e.linha)).toEqual([3, 4])
  })

  it('erro de arquivo quando o cabeçalho não é reconhecido', async () => {
    const { linhas, erros } = await lerPlanilhaItens(await xlsx([['Foo', 'Bar'], ['a', 'b']]), 'itens.xlsx')
    expect(linhas).toEqual([])
    expect(erros[0]).toMatchObject({ linha: 0 })
    expect(erros[0].mensagem).toMatch(/Cabeçalho não reconhecido/)
  })

  it('erro de arquivo quando não é planilha válida', async () => {
    const { erros } = await lerPlanilhaItens(Buffer.from('lixo'), 'itens.xlsx')
    expect(erros[0].mensagem).toMatch(/Não foi possível ler/)
  })
})
