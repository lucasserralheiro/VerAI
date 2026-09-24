/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(), getUpload: jest.fn() }))

import type { PrismaClient } from '@prisma/client'
import { sha256Hex, type UsoArquivo } from '../servico'
import { sincronizarSharepoint, type ArquivoFonte } from './sincronizar'

const data = new Date('2026-09-24T10:00:00Z')
const pdfA = Buffer.from('termo A')
const pdfB = Buffer.from('termo B')

function fonte(arquivos: Record<string, Buffer>) {
  const lista: ArquivoFonte[] = Object.entries(arquivos).map(([caminho, c]) => ({ caminho, tamanhoBytes: c.length, modificadoEm: data }))
  return { listar: async () => lista, ler: jest.fn(async (caminho: string) => arquivos[caminho]) }
}

function prismaFake(estados: any[] = [], arquivosCliente: any[] = []) {
  return {
    cliente: { findMany: jest.fn(async () => [{ id: 'c-sms', nome: 'Saúde', siglaLegado: 'SMS' }]) },
    arquivoSharepoint: {
      findMany: jest.fn(async () => estados),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    arquivoCliente: {
      findFirst: jest.fn(async ({ where }: any) => arquivosCliente.find((a) => a.sha256 === where.sha256) ?? null),
      findMany: jest.fn(async ({ where }: any) => arquivosCliente.filter((a) => where.id.in.includes(a.id))),
      create: jest.fn(),
      update: jest.fn(),
    },
  }
}

const semUsos = async (ids: string[]) => new Map<string, UsoArquivo[]>(ids.map((id) => [id, []]))

it('grava arquivo novo com origem sharepoint e registra o estado', async () => {
  const prisma = prismaFake()
  const gravarBlob = jest.fn(async () => 'https://blob/x')
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    fonte: fonte({ 'SMS/TC 1-2023 - X/1) Inicial/TC 1-2023.pdf': pdfA }),
    gravarBlob,
    buscarUsos: semUsos,
  })
  expect(r.novos).toBe(1)
  expect((prisma.arquivoCliente.create as jest.Mock).mock.calls[0][0].data).toMatchObject({
    clienteId: 'c-sms',
    origem: 'sharepoint',
    categoria: 'TERMO_CONTRATO',
    sha256: sha256Hex(pdfA),
  })
  expect((prisma.arquivoSharepoint.upsert as jest.Mock).mock.calls[0][0].create).toMatchObject({ pastaContrato: 'TC 1-2023 - X' })
})

it('sem --aplicar não grava nada e reporta pasta sem cliente', async () => {
  const prisma = prismaFake()
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: false,
    fonte: fonte({ 'SMS/TC 1/a.pdf': pdfA, 'SMS/TC 2/a-copia.pdf': pdfA, 'SPTURIS/TC 9/b.pdf': pdfB }),
    buscarUsos: semUsos,
  })
  expect(r).toMatchObject({ novos: 1, reaproveitados: 1, semCliente: { SPTURIS: 1 } })
  expect(prisma.arquivoCliente.create).not.toHaveBeenCalled()
  expect(prisma.arquivoSharepoint.upsert).not.toHaveBeenCalled()
})

it('não relê arquivo com tamanho e data iguais', async () => {
  const estado = { id: 'e1', caminho: 'SMS/TC 1/a.pdf', tamanhoBytes: pdfA.length, modificadoEm: data, sha256: sha256Hex(pdfA), arquivoId: 'a1', removidoNaOrigemEm: null }
  const prisma = prismaFake([estado])
  const f = fonte({ 'SMS/TC 1/a.pdf': pdfA })
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, fonte: f, buscarUsos: semUsos })
  expect(r.inalterados).toBe(1)
  expect(f.ler).not.toHaveBeenCalled()
})

it('arquivo movido de pasta não é removido', async () => {
  const estado = { id: 'e1', caminho: 'SMS/TC 1/a.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: sha256Hex(pdfA), arquivoId: 'a1', removidoNaOrigemEm: null }
  const prisma = prismaFake([estado], [{ id: 'a1', sha256: sha256Hex(pdfA), origem: 'sharepoint' }])
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    fonte: fonte({ 'SMS/TC 1/Finalizados/a.pdf': pdfA }),
    buscarUsos: semUsos,
  })
  expect(r).toMatchObject({ reaproveitados: 1, sumiramDaOrigem: 1, removidos: 0 })
  expect(prisma.arquivoCliente.update).not.toHaveBeenCalled()
})

it('apagado na origem e sem uso vira remoção lógica; em uso fica', async () => {
  const estados = [
    { id: 'e1', caminho: 'SMS/TC 1/a.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: 'x', arquivoId: 'a1', removidoNaOrigemEm: null },
    { id: 'e2', caminho: 'SMS/TC 1/b.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: 'y', arquivoId: 'a2', removidoNaOrigemEm: null },
    { id: 'e3', caminho: 'SMS/TC 1/c.pdf', tamanhoBytes: pdfB.length, modificadoEm: data, sha256: sha256Hex(pdfB), arquivoId: 'a3', removidoNaOrigemEm: null },
  ]
  const prisma = prismaFake(estados, [
    { id: 'a1', sha256: 'x', origem: 'sharepoint' },
    { id: 'a2', sha256: 'y', origem: 'sharepoint' },
  ])
  const usos = async () =>
    new Map<string, UsoArquivo[]>([['a1', []], ['a2', [{ tipo: 'analise-documento', rotulo: 'Análise', href: '/' }]]])
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    fonte: fonte({ 'SMS/TC 1/c.pdf': pdfB, 'SMS/TC 1/d.pdf': pdfA }),
    buscarUsos: usos,
  })
  expect(r.removidos).toBe(1)
  expect(r.mantidosEmUso).toEqual([{ arquivoId: 'a2', motivo: 'Análise' }])
  expect(prisma.arquivoCliente.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { removidoEm: expect.any(Date) } })
})

it('suspende remoção quando a pasta volta quase vazia', async () => {
  const estados = Array.from({ length: 10 }, (_, i) => ({
    id: `e${i}`, caminho: `SMS/TC 1/${i}.pdf`, tamanhoBytes: 1, modificadoEm: data, sha256: `h${i}`, arquivoId: `a${i}`, removidoNaOrigemEm: null,
  }))
  const prisma = prismaFake(estados)
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, fonte: fonte({}), buscarUsos: semUsos })
  expect(r.remocaoSuspensa).not.toBeNull()
  expect(r.sumiramDaOrigem).toBe(0)
})
