/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(async () => {}), getUpload: jest.fn() }))

import { Prisma, type PrismaClient } from '@prisma/client'
import { deleteUpload } from '@/lib/storage'
import { registrarConteudo } from './registrar-conteudo'
import { sha256Hex } from './servico'

const conteudo = Buffer.from('%PDF termo')
const dados = { clienteId: 'c1', nome: 'TC 1-2023.pdf', conteudo, categoria: 'TERMO_CONTRATO' as const, origem: 'sharepoint' as const, enviadoPorId: null }

function db(existente: { id: string } | null = null) {
  return { arquivoCliente: { findFirst: jest.fn(async () => existente), create: jest.fn(async () => ({})) } }
}

it('mesmo conteúdo no mesmo cliente devolve o registro que já existe, sem subir nada', async () => {
  const banco = db({ id: 'a1' })
  const gravarBlob = jest.fn()
  expect(await registrarConteudo(banco as unknown as PrismaClient, dados, { gravarBlob })).toEqual({ id: 'a1', novo: false })
  expect(banco.arquivoCliente.findFirst).toHaveBeenCalledWith({ where: { clienteId: 'c1', sha256: sha256Hex(conteudo), removidoEm: null }, select: { id: true } })
  expect(gravarBlob).not.toHaveBeenCalled()
})

it('conteúdo novo sobe pro caminho final e grava com origem e categoria', async () => {
  const banco = db()
  const gravarBlob = jest.fn(async () => 'https://blob/final')
  const r = await registrarConteudo(banco as unknown as PrismaClient, dados, { gravarBlob })
  expect(r.novo).toBe(true)
  expect((gravarBlob.mock.calls[0] as unknown[])[0]).toMatch(new RegExp(`^clientes/c1/${r.id}/TC_1-2023\\.pdf$`))
  expect((banco.arquivoCliente.create.mock.calls[0] as unknown[])[0]).toMatchObject({
    data: {
      id: r.id, clienteId: 'c1', categoria: 'TERMO_CONTRATO', nome: 'TC 1-2023.pdf', extensao: 'pdf',
      contentType: 'application/pdf', tamanhoBytes: conteudo.length, sha256: sha256Hex(conteudo), urlBlob: 'https://blob/final',
      origem: 'sharepoint', enviadoPorId: null,
    },
  })
})

it('corrida com outro envio do mesmo conteúdo: apaga o blob e devolve o do outro', async () => {
  const banco = db()
  banco.arquivoCliente.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'a-outro' })
  banco.arquivoCliente.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('único', { code: 'P2002', clientVersion: 'x' }))
  const r = await registrarConteudo(banco as unknown as PrismaClient, dados, { gravarBlob: async () => 'https://blob/final' })
  expect(r).toEqual({ id: 'a-outro', novo: false })
  expect(deleteUpload).toHaveBeenCalledWith('https://blob/final')
})
