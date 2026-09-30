/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { acharDuplicatas, dadosDaJuncao, etapaDasDuplicatas, resumoDaFicha, type LinhaHistorico } from './duplicatas'

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia))
const linha = (parcial: Partial<LinhaHistorico>): LinhaHistorico => ({
  id: 'x',
  contratoId: 'k1',
  tipo: 'PRORROGACAO',
  numero: null,
  data: null,
  dataInicio: null,
  dataVencimento: null,
  valor: null,
  situacao: null,
  objeto: null,
  proposta: null,
  observacao: null,
  legacyId: null,
  propostaArquivoId: null,
  termoArquivoId: null,
  doSharepoint: false,
  ...parcial,
})

// SF TC 003/2024 (dev, 29/09): o legado tem "TA 001/2025" com datas; o SharePoint criou "TA 01" vazio, com o PDF.
const legado = linha({ id: 'h-leg', numero: 'TA 001/2025', legacyId: 77, data: d(2025, 2, 6), dataInicio: d(2025, 2, 15), dataVencimento: d(2026, 2, 14), valor: '74988.60' })
const doSharepoint = linha({ id: 'h-sp', numero: 'TA 01', doSharepoint: true, termoArquivoId: 'arq-ta01' })

it('mesmo termo, nada se contradiz e o PDF do termo confirma o fim: junta, fica a linha do SharePoint', () => {
  const r = acharDuplicatas([legado, doSharepoint], new Map([['h-sp', { fim: d(2026, 2, 14), valor: null }]]))
  expect(r.avisos).toEqual([])
  expect(r.pares).toEqual([{ fica: doSharepoint, sai: legado, provas: ['fim no PDF do termo'] }])
})

it('período da planilha de contratos (início e fim) igual ao da linha do legado é prova', () => {
  const planilha = new Map([['k1|TA1', { inicio: d(2025, 2, 15), fim: d(2026, 2, 14) }]])
  expect(acharDuplicatas([legado, doSharepoint], new Map(), planilha).pares[0].provas).toEqual(['período na planilha de contratos'])
  const soFim = new Map([['k1|TA1', { inicio: null, fim: d(2026, 2, 14) }]])
  expect(acharDuplicatas([legado, doSharepoint], new Map(), soFim).pares).toEqual([])
})

it('sem nenhuma prova (linha do SharePoint vazia e PDF sem leitura): não junta, avisa', () => {
  const r = acharDuplicatas([legado, doSharepoint], new Map())
  expect(r.pares).toEqual([])
  expect(r.avisos[0].aviso).toMatch(/nenhum campo nem o PDF do termo confirma/)
})

it('campo que se contradiz (SGM 6/2025: início 30/01 × 01/02): não junta, avisa', () => {
  const a = linha({ id: 'a', numero: 'TA 001/2026', data: d(2026, 1, 6), dataInicio: d(2026, 1, 30), dataVencimento: d(2026, 9, 30) })
  const b = linha({ id: 'b', numero: 'TA 01', doSharepoint: true, dataInicio: d(2026, 2, 1), dataVencimento: d(2026, 9, 30) })
  const r = acharDuplicatas([a, b], new Map())
  expect(r.pares).toEqual([])
  expect(r.avisos[0].aviso).toBe('possível duplicata não juntada: início diferente(s)')
})

it('tipo diferente também é contradição; campo igual é prova', () => {
  const a = linha({ id: 'a', numero: 'TA 02', tipo: 'ADITIVO', dataVencimento: d(2026, 1, 1) })
  const b = linha({ id: 'b', numero: 'TA 002/2025', tipo: 'PRORROGACAO', doSharepoint: true, dataVencimento: d(2026, 1, 1) })
  expect(acharDuplicatas([a, b], new Map()).avisos[0].aviso).toMatch(/tipo diferente/)
  const c = linha({ id: 'c', numero: 'TA 002/2025', doSharepoint: false, dataVencimento: d(2026, 1, 1) })
  const e = linha({ id: 'e', numero: 'TA 02', doSharepoint: true, dataVencimento: d(2026, 1, 1) })
  expect(acharDuplicatas([c, e], new Map()).pares[0].provas).toEqual(['vencimento'])
})

it('só pares: três linhas com a mesma identidade, duas do SharePoint, ou TAP × TA não juntam', () => {
  const tres = [legado, doSharepoint, linha({ id: 'h3', numero: 'TA 1', dataVencimento: d(2026, 2, 14) })]
  expect(acharDuplicatas(tres, new Map()).pares).toEqual([])
  const doisSp = [{ ...legado, doSharepoint: true }, doSharepoint]
  expect(acharDuplicatas(doisSp, new Map([['h-sp', { fim: d(2026, 2, 14), valor: null }]])).pares).toEqual([])
  const tap = [linha({ id: 'p', numero: 'TAP 01', dataVencimento: d(2026, 2, 14) }), doSharepoint]
  expect(acharDuplicatas(tap, new Map([['h-sp', { fim: d(2026, 2, 14), valor: null }]])).pares).toEqual([])
})

it('junção leva só campo vazio, o legacyId e o número oficial vai para a observação', () => {
  const { dados, campos } = dadosDaJuncao({ ...doSharepoint, dataVencimento: d(2026, 2, 14), situacao: 'Em elaboração' }, { ...legado, situacao: 'Assinada' })
  expect(dados).toEqual({
    valor: '74988.60',
    data: d(2025, 2, 6),
    dataInicio: d(2025, 2, 15),
    legacyId: 77,
    situacao: 'Assinada',
    observacao: 'também registrado como TA 001/2025',
  })
  expect(campos).toEqual(['valor', 'data', 'dataInicio', 'legacyId', 'situacao'])
})

it('etapa do agendador: sem a migração pula sem tocar em nada; erro vira linha', async () => {
  const juntar = jest.fn()
  expect(await etapaDasDuplicatas({} as never, { aplicar: true }, { bancoPronto: async () => false, juntar })).toEqual([
    'linhas duplicadas do histórico: pulado — migração 20260929170000_valor_vigencia não aplicada neste banco',
  ])
  expect(juntar).not.toHaveBeenCalled()
  const falha = await etapaDasDuplicatas({} as never, { aplicar: true }, {
    bancoPronto: async () => true,
    juntar: async () => {
      throw new Error('conexão caiu')
    },
  })
  expect(falha).toEqual(['linhas duplicadas do histórico: falhou — conexão caiu (a próxima rodada tenta de novo)'])
})

it('resumo da ficha', () => {
  expect(resumoDaFicha({ vigenciaFim: { valor: '14/02/2026' }, valorTotal: { valor: 'R$ 74.988,60 (setenta…)' } })).toEqual({ fim: d(2026, 2, 14), valor: '74988.60' })
  expect(resumoDaFicha(null)).toEqual({ fim: null, valor: null })
})
