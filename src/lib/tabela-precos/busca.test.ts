import { agruparPorSecao, filtrarItens, gruposDosItens, rotuloDoGrupo, trechosDestacados } from './busca'

const itens = [
  { codigo: '10.050.00065.00', grupo: 'A', secoes: 'A - SISTEMAS DE INFORMAÇÃO', descricao: 'ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)' },
  {
    codigo: '12.066.00015.00',
    grupo: 'C',
    secoes: 'C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C5. COMUNICAÇÃO DE VOZ',
    descricao: 'GERENCIAMENTO DE RAMAIS (1 a 60 ramais)',
  },
  {
    codigo: '12.066.00016.00',
    grupo: 'C',
    secoes: 'C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C5. COMUNICAÇÃO DE VOZ',
    descricao: 'GERENCIAMENTO DE RAMAIS (61 a 180 ramais)',
  },
]

it('busca sem acento e sem caixa, todas as palavras; código com ou sem pontos', () => {
  expect(filtrarItens(itens, 'informacao').map((i) => i.codigo)).toEqual(['10.050.00065.00'])
  expect(filtrarItens(itens, 'ramais 61').map((i) => i.codigo)).toEqual(['12.066.00016.00'])
  expect(filtrarItens(itens, '12.066').length).toBe(2)
  expect(filtrarItens(itens, '1206600015').map((i) => i.codigo)).toEqual(['12.066.00015.00'])
  expect(filtrarItens(itens, '', 'C').length).toBe(2)
  expect(filtrarItens(itens, 'ramais', 'A')).toEqual([])
})

it('grupos com rótulo e contagem, na ordem da tabela', () => {
  expect(gruposDosItens(itens)).toEqual([
    { grupo: 'A', rotulo: 'Sistemas de informação', total: 1 },
    { grupo: 'C', rotulo: 'Soluções de serviços de comunicação', total: 2 },
  ])
  expect(rotuloDoGrupo('E - DATA CENTER')).toBe('Data center')
})

it('seções em blocos consecutivos', () => {
  expect(agruparPorSecao(itens).map((b) => [b.secao, b.itens.length])).toEqual([
    ['A - SISTEMAS DE INFORMAÇÃO', 1],
    ['C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C5. COMUNICAÇÃO DE VOZ', 2],
  ])
})

it('destaque das palavras achadas, sem perder o acento do original', () => {
  expect(trechosDestacados('ANALISTA DE INFORMAÇÃO', 'informacao')).toEqual([
    { texto: 'ANALISTA DE ', destaque: false },
    { texto: 'INFORMAÇÃO', destaque: true },
  ])
  expect(trechosDestacados('ABC', '')).toEqual([{ texto: 'ABC', destaque: false }])
})
