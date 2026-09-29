/** @jest-environment node */
import ExcelJS from 'exceljs'
import { lerPlanilhaDePrecos } from './planilha'

const CAB = ['GRUPO', 'CÓDIGO', 'DESCRIÇÃO', 'UNIDADE', 'PREÇO UNITÁRIO (R$)', 'QTDE', 'PERÍODO (MÊS)', 'TOTAL (R$)']

async function planilha(linhas: (string | number | null)[][], aba = 'Tabela de Preços 2026 v3'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(aba)
  for (const l of linhas) ws.addRow(l)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

it('lê itens, seções em hierarquia e preço como string de 2 casas', async () => {
  const r = await lerPlanilhaDePrecos(
    await planilha([
      ['TABELA DE PREÇOS SERVIÇOS PRODAM-SP 2026 v3.0'],
      ['Vigência a partir da publicação'],
      CAB,
      ['A - SISTEMAS DE INFORMAÇÃO'],
      ['A', '10.050.00065.00', 'ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)', 'HORA/HOMEM', 269],
      ['C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO'],
      ['C3. WIFI GERENCIADO'],
      ['C', '12.055.00013.00', 'INSTALAÇÃO DE PONTO', 'AP', 1234.5],
      ['C7. SD-WAN'],
      ['C7.1. SERVIÇO DE COMUNICAÇÃO DE DADOS – SD-WAN (INSTALAÇÃO)'],
      ['C', '12.070.00001.00', 'INSTALAÇÃO SD-WAN', 'UNIDADE', 369.41],
    ])
  )
  if ('erro' in r) throw new Error(r.erro)
  expect(r.aba).toBe('Tabela de Preços 2026 v3')
  expect(r.itens).toEqual([
    { grupo: 'A', secoes: 'A - SISTEMAS DE INFORMAÇÃO', codigo: '10.050.00065.00', descricao: 'ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)', unidade: 'HORA/HOMEM', preco: '269.00', sobDemanda: false, precoTexto: null },
    { grupo: 'C', secoes: 'C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C3. WIFI GERENCIADO', codigo: '12.055.00013.00', descricao: 'INSTALAÇÃO DE PONTO', unidade: 'AP', preco: '1234.50', sobDemanda: false, precoTexto: null },
    {
      grupo: 'C',
      secoes: 'C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C7. SD-WAN > C7.1. SERVIÇO DE COMUNICAÇÃO DE DADOS – SD-WAN (INSTALAÇÃO)',
      codigo: '12.070.00001.00',
      descricao: 'INSTALAÇÃO SD-WAN',
      unidade: 'UNIDADE',
      preco: '369.41',
      sobDemanda: false,
      precoTexto: null,
    },
  ])
})

it('"SOB DEMANDA" e texto estranho no preço', async () => {
  const r = await lerPlanilhaDePrecos(
    await planilha([CAB, ['A - SISTEMAS'], ['A', '10.050.00070.00', 'ADICIONAL', 'HORA/HOMEM', 'SOB DEMANDA'], ['A', '10.050.00099.00', 'OUTRO', 'UN', 'A CONSULTAR']])
  )
  if ('erro' in r) throw new Error(r.erro)
  expect(r.itens[0]).toMatchObject({ preco: null, sobDemanda: true, precoTexto: null })
  expect(r.itens[1]).toMatchObject({ preco: null, sobDemanda: false, precoTexto: 'A CONSULTAR' })
})

it('acha a aba pelo cabeçalho, não pelo nome; código repetido fica de fora e é avisado', async () => {
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('Capa').addRow(['nada aqui'])
  const ws = wb.addWorksheet('Qualquer nome')
  for (const l of [CAB, ['A', '10.050.00065.00', 'X', 'UN', 1], ['A', '10.050.00065.00', 'X de novo', 'UN', 2]]) ws.addRow(l)
  const r = await lerPlanilhaDePrecos(Buffer.from(await wb.xlsx.writeBuffer()))
  if ('erro' in r) throw new Error(r.erro)
  expect(r.aba).toBe('Qualquer nome')
  expect(r.itens).toHaveLength(1)
  expect(r.repetidos).toEqual(['10.050.00065.00'])
})

it('sem o cabeçalho: erro explicando o que faltou', async () => {
  const r = await lerPlanilhaDePrecos(await planilha([['CÓDIGO', 'DESCRIÇÃO'], ['1', '2']]))
  expect(r).toEqual({ erro: 'nenhuma aba com o cabeçalho GRUPO / CÓDIGO / DESCRIÇÃO / UNIDADE / PREÇO UNITÁRIO' })
})
