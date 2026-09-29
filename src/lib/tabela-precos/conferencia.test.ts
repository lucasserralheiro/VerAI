import { conferirItens, resumoDaConferencia } from './conferencia'
import type { ItemLido } from './planilha'
import type { Informativo, PrecoNoPdf } from './pdf'

const item = (codigo: string, descricao: string, preco: string | null, extra: Partial<ItemLido> = {}): ItemLido => ({
  grupo: 'E',
  secoes: 'E - DATA CENTER',
  codigo,
  descricao,
  unidade: 'UN',
  preco,
  sobDemanda: false,
  precoTexto: null,
  ...extra,
})
const pdf = (pares: [string, string | null, boolean?][]) => new Map<string, PrecoNoPdf>(pares.map(([c, p, s]) => [c, { preco: p, sobDemanda: !!s }]))
const informativo: Informativo = {
  versao: '2026 v3.0',
  publicadaEm: null,
  alteracoes: [
    { tipo: 'preco', nome: 'TID' },
    { tipo: 'novo', nome: 'SPdf' },
  ],
  codigos: ['15.062.00008.00'],
}

it('confere, diverge, fora do PDF, sob demanda', () => {
  const r = conferirItens(
    [
      item('10.050.00065.00', 'ANALISTA', '269.00'),
      item('11.051.00012.00', 'CONSULTORIA', '369.41'),
      item('99.999.00001.00', 'SÓ NA PLANILHA', '1.00'),
      item('10.050.00070.00', 'ADICIONAL', null, { sobDemanda: true }),
    ],
    pdf([
      ['10.050.00065.00', '269.00'],
      ['11.051.00012.00', '370.00'],
      ['10.050.00070.00', null, true],
    ]),
    null
  )
  expect(r.map((i) => [i.codigo, i.conferencia, i.precoNoPdf])).toEqual([
    ['10.050.00065.00', 'confere', '269.00'],
    ['11.051.00012.00', 'diverge', '370.00'],
    ['99.999.00001.00', 'fora-do-pdf', null],
    ['10.050.00070.00', 'confere', null],
  ])
})

it('o informativo explica a diferença: pelo nome do produto (palavra inteira) ou pelo código', () => {
  const r = conferirItens(
    [
      item('14.052.00001.00', 'TID CORPORATIVO ATÉ 4000', '4.09'),
      item('15.075.00032.00', 'SPdf - PLANO BRONZE ATÉ 400 DOCUMENTOS/MÊS', '100.00'),
      item('15.062.00008.00', 'ELEIÇÃO - DISPONIBILIZAÇÃO DE INFRAESTRUTURA', '5.00'),
      item('14.000.00001.00', 'SERVIÇO NO SENTIDO AMPLO', '9.99'),
    ],
    pdf([
      ['14.052.00001.00', '0.50'],
      ['14.000.00001.00', '1.00'],
    ]),
    informativo
  )
  expect(r.map((i) => i.conferencia)).toEqual(['alterado-pelo-informativo', 'alterado-pelo-informativo', 'alterado-pelo-informativo', 'diverge'])
})

it('sem PDF oficial: nada é conferido', () => {
  expect(conferirItens([item('10.050.00065.00', 'A', '1.00')], null, null)[0].conferencia).toBe('sem-pdf')
})

it('resumo por tipo', () => {
  const r = conferirItens([item('1', 'A', '1.00'), item('2', 'B', '2.00')], pdf([['1', '1.00']]), null)
  expect(resumoDaConferencia(r)).toEqual({ confere: 1, diverge: 0, 'fora-do-pdf': 1, 'alterado-pelo-informativo': 0, 'sem-pdf': 0 })
})
