import { itensDasTabelas } from './itens'

const tabela = (cab: string[], linhas: string[][]) =>
  `<table><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr>${linhas.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`

it('acha colunas pelo cabeçalho e lê só linhas com código de serviço', () => {
  const html = tabela(
    ['Item', 'Código', 'Descrição', 'Qtde', 'Valor Unitário (R$)', 'Valor Total (R$)'],
    [
      ['1', '10.050.00067.00', 'Analista complexidade 3', '120', '150,25', '18.030,00'],
      ['2', '14.052.00001.00', 'TID corporativo', '1.000', '0,50', '500,00'],
      ['', '', 'TOTAL GERAL', '', '', '18.530,00'],
    ]
  )
  expect(itensDasTabelas(html)).toEqual([
    { codigo: '10.050.00067.00', descricao: 'Analista complexidade 3', quantidade: '120', unitario: '150.25', total: '18030.00', linha: 1 },
    { codigo: '14.052.00001.00', descricao: 'TID corporativo', quantidade: '1000', unitario: '0.50', total: '500.00', linha: 2 },
  ])
})

it('código na mesma célula da descrição e sem coluna de quantidade', () => {
  const html = tabela(['Serviço', 'Preço'], [['10.050.00067.00 - Analista', 'R$ 150,25']])
  expect(itensDasTabelas(html)).toEqual([{ codigo: '10.050.00067.00', descricao: 'Analista', quantidade: null, unitario: '150.25', total: null, linha: 1 }])
})

it('sem tabela ou sem código → vazio', () => {
  expect(itensDasTabelas('<p>texto</p>')).toEqual([])
  expect(itensDasTabelas(tabela(['A', 'B'], [['x', '1,00']]))).toEqual([])
})

it('formato real do conversor: thead/tbody, cabeçalho em th e várias tabelas', () => {
  const html =
    '<table><thead><tr><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th></tr></thead>' +
    '<tbody><tr><td>10.050.00067.00</td><td>Analista</td><td>2</td><td>R$ 1.500,00</td><td>R$ 3.000,00</td></tr></tbody></table>' +
    '<table><thead><tr><th>Código</th><th>Descrição</th><th>Qtd</th><th>Unitário</th></tr></thead>' +
    '<tbody><tr><td>14.052.00001.00</td><td>TID</td><td>3</td><td>0,50</td></tr></tbody></table>'
  expect(itensDasTabelas(html)).toEqual([
    { codigo: '10.050.00067.00', descricao: 'Analista', quantidade: '2', unitario: '1500.00', total: '3000.00', linha: 1 },
    { codigo: '14.052.00001.00', descricao: 'TID', quantidade: '3', unitario: '0.50', total: null, linha: 1 },
  ])
})

it('cabeçalho em td (xlsx/csv) também é reconhecido', () => {
  const html = '<table><tr><td>Código</td><td>Descrição</td><td>Total</td></tr><tr><td>10.050.00067.00</td><td>Analista</td><td>10,00</td></tr></table>'
  expect(itensDasTabelas(html)).toEqual([{ codigo: '10.050.00067.00', descricao: 'Analista', quantidade: null, unitario: null, total: '10.00', linha: 1 }])
})
