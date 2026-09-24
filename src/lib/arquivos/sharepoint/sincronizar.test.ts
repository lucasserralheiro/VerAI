/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(async () => {}), getUpload: jest.fn() }))

import type { PrismaClient } from '@prisma/client'
import { sha256Hex, type UsoArquivo } from '../servico'
import { sincronizarSharepoint, type ArquivoFonte } from './sincronizar'

const data = new Date('2026-09-24T10:00:00Z')
const pdfA = Buffer.from('termo A')
const pdfB = Buffer.from('termo B')

/* eslint-disable @typescript-eslint/no-explicit-any */

function fonte(arquivos: Record<string, Buffer>) {
  const lista: ArquivoFonte[] = Object.entries(arquivos).map(([caminho, c]) => ({ caminho, tamanhoBytes: c.length, modificadoEm: data }))
  return { listar: async () => lista, ler: jest.fn(async (caminho: string) => arquivos[caminho]) }
}

function prismaFake(estados: any[] = [], arquivosCliente: any[] = []) {
  let n = 0
  return {
    cliente: {
      findMany: jest.fn(async () => [{ id: 'c-sms', nome: 'Saúde', siglaLegado: 'SMS' }]),
      create: jest.fn(async ({ data }: any) => ({ id: `c-${data.siglaLegado}` })),
      update: jest.fn(),
    },
    contrato: { findMany: jest.fn(async () => []) },
    historicoContrato: { count: jest.fn(async () => 0), updateMany: jest.fn(async () => ({ count: 0 })) },
    arquivoSharepoint: {
      // Sem `where`: carga do estado. Com `where`: conferência (caminhos ativos).
      findMany: jest.fn(async (args: any) => (args?.where ? estados.filter((e) => e.removidoNaOrigemEm === null).map((e) => ({ caminho: e.caminho })) : estados)),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    arquivoCliente: {
      findFirst: jest.fn(async ({ where }: any) => arquivosCliente.find((a) => a.sha256 === where.sha256) ?? null),
      findMany: jest.fn(async ({ where }: any) => arquivosCliente.filter((a) => where.id.in.includes(a.id))),
      create: jest.fn(async () => ({ id: `a-${++n}` })),
      update: jest.fn(),
    },
  }
}

const semUsos = async (ids: string[]) => new Map<string, UsoArquivo[]>(ids.map((id) => [id, []]))
const importarVazio = jest.fn(async () => ({
  contratosCriados: 0, contratosCompletados: 0, linhasCriadas: 0, linhasCompletadas: 0, anexosLigados: 0, avisos: [] as string[],
  contratoPorCaminho: new Map<string, string>(), linhaPorCaminho: new Map<string, string>(),
}))
const base = { buscarUsos: semUsos, importar: importarVazio }

beforeEach(() => jest.clearAllMocks())

it('recusa rodar com migração pendente', async () => {
  const prisma = prismaFake()
  prisma.historicoContrato.count.mockResolvedValue(3)
  await expect(sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, fonte: fonte({}), ...base })).rejects.toThrow(/migrar-sharepoint-lugar-certo/)
})

it('WORK e categoria pelo papel: termo do contrato inicial é TERMO_CONTRATO, memória de cálculo é PLANILHA', async () => {
  const prisma = prismaFake()
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    gravarBlob: async () => 'https://blob/x',
    fonte: fonte({ 'SMS/TC 1-2023 - X/1) Inicial/TC 1-2023.pdf': pdfA, 'SMS/TC 1-2023 - X/1) Inicial/WORK/Mem_Calc v1.xlsx': pdfB }),
    ...base,
  })
  expect(r.novos).toBe(2)
  const criados = prisma.arquivoCliente.create.mock.calls.map((c: any) => c[0].data)
  expect(criados.find((d: any) => d.nome === 'TC 1-2023.pdf')).toMatchObject({ categoria: 'TERMO_CONTRATO', origem: 'sharepoint', sha256: sha256Hex(pdfA) })
  expect(criados.find((d: any) => d.nome === 'Mem_Calc v1.xlsx')).toMatchObject({ categoria: 'PLANILHA' })
})

it('publicação do DOC vai pro cliente da sigla no nome; sigla sem cliente vai pro relatório', async () => {
  const prisma = prismaFake()
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    gravarBlob: async () => 'https://blob/x',
    rotearPeloNome: ['1. PUBLICAÇÕES NO DOC'],
    fonte: fonte({
      '1. PUBLICAÇÕES NO DOC/2026.09.17 - SMS - Arbitragem - Despacho.pdf': pdfA,
      '1. PUBLICAÇÕES NO DOC/2026.09.17 - SUB-ST - LINC. - eXTRATO.pdf': pdfB,
    }),
    ...base,
  })
  expect((prisma.arquivoCliente.create.mock.calls[0] as any[])[0].data).toMatchObject({ clienteId: 'c-sms', categoria: 'PUBLICACAO_DOC' })
  expect(r.semCliente).toEqual({ '1. PUBLICAÇÕES NO DOC → SUB-ST': 1 })
  expect(prisma.cliente.create).not.toHaveBeenCalled()
})

it('grava onde cada arquivo caiu (contrato e linha) para os contratos processados', async () => {
  const prisma = prismaFake()
  const caminho = 'SMS/TC 1-2023 - X/1) Inicial/TC 1-2023.pdf'
  const importar = jest.fn(async () => ({
    ...(await importarVazio()),
    contratoPorCaminho: new Map([[caminho, 'k1']]),
    linhaPorCaminho: new Map([[caminho, 'h1']]),
  }))
  await sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, gravarBlob: async () => 'u', fonte: fonte({ [caminho]: pdfA }), buscarUsos: semUsos, importar })
  expect((importar.mock.calls[0] as any[])[1].contratos[0].termos[0]).toMatchObject({ termoPdf: caminho, hashes: [sha256Hex(pdfA)] })
  expect(prisma.arquivoSharepoint.update).toHaveBeenCalledWith({ where: { caminho }, data: { contratoId: 'k1', historicoId: 'h1' } })
})

it('sem mudança nenhuma não relê arquivo nem processa contrato', async () => {
  const caminho = 'SMS/TC 1-2023/1) Inicial/a.pdf'
  const estado = { id: 'e1', caminho, tamanhoBytes: pdfA.length, modificadoEm: data, sha256: sha256Hex(pdfA), arquivoId: 'a1', historicoId: 'h1', removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } }
  const prisma = prismaFake([estado])
  const f = fonte({ [caminho]: pdfA })
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, fonte: f, ...base })
  expect(r.inalterados).toBe(1)
  expect(f.ler).not.toHaveBeenCalled()
  expect((importarVazio.mock.calls[0] as any[])[1].contratos).toEqual([])
})

it('arquivo movido de pasta: mesmo arquivo, nada removido, contrato reprocessado', async () => {
  // "TC 1-2023" (com ano): sem número + ano a pasta não vira contrato na estrutura.
  const estado = { id: 'e1', caminho: 'SMS/TC 1-2023/1) Inicial/a.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: sha256Hex(pdfA), arquivoId: 'a1', historicoId: 'h1', removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } }
  const prisma = prismaFake([estado], [{ id: 'a1', sha256: sha256Hex(pdfA), origem: 'sharepoint' }])
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    fonte: fonte({ 'SMS/Contratos Finalizados/TC 1-2023/1) Inicial/a.pdf': pdfA }),
    ...base,
  })
  expect(r).toMatchObject({ reaproveitados: 1, sumiramDaOrigem: 1, removidos: 0 })
  expect(prisma.arquivoCliente.update).not.toHaveBeenCalled()
  expect((importarVazio.mock.calls[0] as any[])[1].contratos).toHaveLength(1)
})

it('apagado no SharePoint: solta a coluna do SharePoint e remove; uso do VerAI segura, uso da sincronização não', async () => {
  const estados = [
    { id: 'e1', caminho: 'SMS/TC 1/a.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: 'x', arquivoId: 'a1', historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } },
    { id: 'e2', caminho: 'SMS/TC 1/b.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: 'y', arquivoId: 'a2', historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } },
    { id: 'e3', caminho: 'SMS/TC 1/c.pdf', tamanhoBytes: pdfB.length, modificadoEm: data, sha256: sha256Hex(pdfB), arquivoId: 'a3', historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } },
  ]
  const prisma = prismaFake(estados, [
    { id: 'a1', sha256: 'x', origem: 'sharepoint' },
    { id: 'a2', sha256: 'y', origem: 'migrado' },
  ])
  const usos = async () =>
    new Map<string, UsoArquivo[]>([
      ['a1', [{ tipo: 'historico-contrato', rotulo: 'TC/TA', href: '/', contrato: null, competencia: null, daSincronizacao: true }]],
      ['a2', [{ tipo: 'analise-documento', rotulo: 'Análise', href: '/', contrato: null, competencia: null }]],
    ])
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    fonte: fonte({ 'SMS/TC 1/c.pdf': pdfB, 'SMS/TC 1/d.pdf': pdfA }),
    gravarBlob: async () => 'u',
    buscarUsos: usos,
    importar: importarVazio,
  })
  expect(prisma.historicoContrato.updateMany).toHaveBeenCalledWith({
    where: { termoArquivoId: { in: ['a1', 'a2'] }, termoDoSharepoint: true },
    data: { termoArquivoId: null, termoDoSharepoint: false },
  })
  expect(r.removidos).toBe(1)
  expect(r.mantidosEmUso).toEqual([{ arquivoId: 'a2', motivo: 'Análise' }])
  expect(prisma.arquivoCliente.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { removidoEm: expect.any(Date) } })
})

it('--clientes restringe listagem E remoção ao cliente escolhido', async () => {
  const estados = [
    { id: 'e1', caminho: 'SGM/TC 9/a.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: 'x', arquivoId: 'a1', historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sgm' } },
  ]
  const prisma = prismaFake(estados)
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    clientes: ['SMS'],
    gravarBlob: async () => 'u',
    fonte: fonte({ 'SMS/TC 1/1) Inicial/a.pdf': pdfA, 'SGM/TC 2/b.pdf': pdfB }),
    ...base,
  })
  expect(r.novos).toBe(1)
  expect(r.sumiramDaOrigem).toBe(0)
  expect(prisma.arquivoSharepoint.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e1' } }))
})

it('suspende remoção quando a pasta volta quase vazia', async () => {
  const estados = Array.from({ length: 10 }, (_, i) => ({
    id: `e${i}`, caminho: `SMS/TC 1/${i}.pdf`, tamanhoBytes: 1, modificadoEm: data, sha256: `h${i}`, arquivoId: `a${i}`, historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' },
  }))
  const prisma = prismaFake(estados)
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, fonte: fonte({}), ...base })
  expect(r.remocaoSuspensa).not.toBeNull()
  expect(r.sumiramDaOrigem).toBe(0)
})

it('sem --aplicar não grava nada', async () => {
  const prisma = prismaFake()
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: false,
    fonte: fonte({ 'SMS/TC 1/a.pdf': pdfA, 'SMS/TC 2/a-copia.pdf': pdfA, 'SPTURIS/TC 9/b.pdf': pdfB }),
    ...base,
  })
  expect(r).toMatchObject({ novos: 2, reaproveitados: 1, conferencia: null })
  expect(r.clientes.criados).toEqual(['SPTURIS — SPTURIS'])
  expect(prisma.cliente.create).not.toHaveBeenCalled()
  expect(prisma.arquivoCliente.create).not.toHaveBeenCalled()
  expect(prisma.arquivoSharepoint.upsert).not.toHaveBeenCalled()
})
