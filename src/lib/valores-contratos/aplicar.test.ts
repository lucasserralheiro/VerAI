/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { aplicarValoresProvados, termoDoTexto } from './aplicar'

/* eslint-disable @typescript-eslint/no-explicit-any */

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia))
const TRECHO = 'O valor total estimado do Contrato, para o período ora prorrogado pelo presente Termo de aditamento, é de R$ 3.151.984,05 (Três milhões'

function prismaFake() {
  const historico: any[] = [
    { id: 'h0', contratoId: 'k1', tipo: 'CONTRATO', numero: 'TC 68/SMDHC/2020', valor: { toString: () => '2900000' }, data: d(2020, 11, 1), dataInicio: d(2020, 11, 1), dataVencimento: d(2021, 10, 31), situacao: null, createdAt: d(2026, 9, 1) },
    { id: 'h2', contratoId: 'k1', tipo: 'PRORROGACAO', numero: 'TA 02', valor: null, data: null, dataInicio: null, dataVencimento: null, situacao: null, createdAt: d(2026, 9, 2) },
  ]
  return {
    contrato: { findMany: jest.fn(async () => [{ id: 'k1', chaveSharepoint: 'SMDHC|68 2020', numeroTermo: 'TC 68/SMDHC/2020', cliente: { siglaLegado: 'SMDHC', nome: 'Direitos Humanos' } }]) },
    historicoContrato: { findMany: jest.fn(async () => historico), updateMany: jest.fn(async () => ({ count: 1 })) },
    fichaDocumento: {
      findMany: jest.fn(async () => [{ origem: 'HISTORICO_TERMO', origemId: 'h2', campos: { valorTotal: { valor: 'R$ 3.151.984,05', trecho: TRECHO, pagina: 2 } } }]),
    },
    linhaPlanilhaContratos: {
      findMany: jest.fn(async () => [
        { linha: 245, chave: 'SMDHC|68 2020', termoTexto: 'TA 02', termoNumero: 2, tipoTermo: 'Prorrogação', valor: { toString: () => '3151984.05' }, inicio: d(2025, 11, 1), fim: d(2026, 10, 31), statusFormalizacao: 'CONTRATAÇÃO CONCLUÍDA' },
      ]),
    },
    controleContrato: {
      findMany: jest.fn(async () => [
        { contratoId: 'k1', termoTexto: 'T.A. 02', previstoTotal: { toString: () => '3151984.05' }, vigenciaInicio: d(2025, 11, 1), vigenciaFim: d(2026, 10, 31), mesAno: 2026, mesMes: 8, arquivoId: 'ab1' },
      ]),
    },
    origemCampoHistorico: { upsert: jest.fn() },
  }
}

it('simulação: decide e conta, sem gravar nada', async () => {
  const prisma = prismaFake()
  const r = await aplicarValoresProvados(prisma as any, { aplicar: false })
  expect(r).toMatchObject({ linhas: 2, valor: 1, vigencia: 1, assinatura: 1 })
  expect(r.gravacoes).toContainEqual({ contrato: 'SMDHC TC 68/SMDHC/2020', linha: 'TA 02', campo: 'valor', dado: 'R$ 3.151.984,05', origem: 'TERMO+PLANILHA+CONTROLE' })
  expect(prisma.historicoContrato.updateMany).not.toHaveBeenCalled()
  expect(prisma.origemCampoHistorico.upsert).not.toHaveBeenCalled()
})

it('aplicar: grava só em campo vazio (condição no where) e registra a origem', async () => {
  const prisma = prismaFake()
  await aplicarValoresProvados(prisma as any, { aplicar: true })
  expect(prisma.historicoContrato.updateMany).toHaveBeenCalledWith({ where: { id: 'h2', valor: null }, data: { valor: '3151984.05' } })
  expect(prisma.historicoContrato.updateMany).toHaveBeenCalledWith({ where: { id: 'h2', dataVencimento: null }, data: { dataVencimento: d(2026, 10, 31), dataInicio: d(2025, 11, 1) } })
  expect(prisma.historicoContrato.updateMany).toHaveBeenCalledWith({
    where: { id: 'h2', data: null, OR: [{ situacao: null }, { situacao: '' }, { situacao: 'Em elaboração' }] },
    data: { situacao: 'Assinado (controle do faturamento)' },
  })
  expect(prisma.origemCampoHistorico.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ where: { historicoId_campo: { historicoId: 'h2', campo: 'valor' } }, create: expect.objectContaining({ origem: 'TERMO+PLANILHA+CONTROLE' }) })
  )
  // A linha do contrato, já preenchida, não foi tocada.
  expect(prisma.historicoContrato.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'h0' }) }))
})

it('campo preenchido por outra pessoa no meio do caminho (updateMany = 0): não registra origem', async () => {
  const prisma = prismaFake()
  prisma.historicoContrato.updateMany.mockResolvedValue({ count: 0 })
  const r = await aplicarValoresProvados(prisma as any, { aplicar: true })
  expect(prisma.origemCampoHistorico.upsert).not.toHaveBeenCalled()
  expect(r.valor).toBe(0)
})

it('identidade do termo: espécie + nº', () => {
  expect(termoDoTexto('TA 002/2025')).toBe('TA2')
  expect(termoDoTexto('T.A. 02')).toBe('TA2')
  expect(termoDoTexto('TA 184-SME-2025')).toBe('TA184')
  expect(termoDoTexto('TAP 003-2023')).toBe('TAP3')
  expect(termoDoTexto('TA XX')).toBeNull()
  expect(termoDoTexto(null, true)).toBe('TC0')
})

it('linha duplicada no histórico ("TA 001/2025" e "TA 02" do mesmo termo) não casa com a planilha nem com o controle', async () => {
  const prisma = prismaFake()
  const linhas = await prisma.historicoContrato.findMany()
  prisma.historicoContrato.findMany.mockResolvedValue([
    ...linhas,
    { ...linhas[1], id: 'h2b', numero: 'TA 002/2025', createdAt: new Date(Date.UTC(2026, 8, 3)) },
  ])
  prisma.fichaDocumento.findMany.mockResolvedValue([])
  const r = await aplicarValoresProvados(prisma as any, { aplicar: false })
  expect(r.gravacoes).toEqual([])
})

it('apostilamento (TAP 2) não casa com o TA 2 da planilha', async () => {
  const prisma = prismaFake()
  const linhas = await prisma.historicoContrato.findMany()
  prisma.historicoContrato.findMany.mockResolvedValue([linhas[0], { ...linhas[1], tipo: 'ADITIVO', numero: 'TAP 02' }])
  prisma.fichaDocumento.findMany.mockResolvedValue([])
  prisma.controleContrato.findMany.mockResolvedValue([])
  const r = await aplicarValoresProvados(prisma as any, { aplicar: false })
  expect(r.gravacoes).toEqual([])
})

it('controle com numeração diferente do órgão ("T.A. 02" × "TA 185-SVMA-2025"): casa pela única linha com o mesmo fim', async () => {
  const prisma = prismaFake()
  const linhas = await prisma.historicoContrato.findMany()
  prisma.historicoContrato.findMany.mockResolvedValue([
    linhas[0],
    { ...linhas[1], numero: 'TA 185-SVMA-2025', dataVencimento: new Date(Date.UTC(2026, 9, 31)) },
  ])
  prisma.fichaDocumento.findMany.mockResolvedValue([])
  prisma.linhaPlanilhaContratos.findMany.mockResolvedValue([])
  const r = await aplicarValoresProvados(prisma as any, { aplicar: false })
  expect(r.gravacoes).toContainEqual(expect.objectContaining({ linha: 'TA 185-SVMA-2025', campo: 'assinatura', origem: 'CONTROLE' }))
})

it('linha do mesmo termo mas com fim diferente do controle não é a do controle', async () => {
  const prisma = prismaFake()
  const linhas = await prisma.historicoContrato.findMany()
  prisma.historicoContrato.findMany.mockResolvedValue([linhas[0], { ...linhas[1], dataVencimento: new Date(Date.UTC(2025, 9, 31)) }])
  prisma.fichaDocumento.findMany.mockResolvedValue([])
  prisma.linhaPlanilhaContratos.findMany.mockResolvedValue([])
  const r = await aplicarValoresProvados(prisma as any, { aplicar: false })
  expect(r.gravacoes).toEqual([])
})

it('controle que não casa com nenhuma linha vira aviso', async () => {
  const prisma = prismaFake()
  const linhas = await prisma.historicoContrato.findMany()
  prisma.historicoContrato.findMany.mockResolvedValue([linhas[0], { ...linhas[1], dataVencimento: new Date(Date.UTC(2025, 9, 31)) }])
  const r = await aplicarValoresProvados(prisma as any, { aplicar: false })
  expect(r.avisos).toContainEqual({
    contrato: 'SMDHC TC 68/SMDHC/2020',
    linha: 'T.A. 02',
    aviso: 'o controle do faturamento de ago/2026 fala do T.A. 02 (fim 31/10/2026) e nenhuma linha do histórico confere',
  })
})
