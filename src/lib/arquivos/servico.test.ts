/** @jest-environment node */
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    arquivoCliente: { findFirst: jest.fn(), create: jest.fn() },
    documento: { findMany: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  getUpload: jest.fn(),
  putUpload: jest.fn(),
  deleteUpload: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { deleteUpload, getUpload, putUpload } from '@/lib/storage'
import { registrarArquivo, sha256Hex, usosDosArquivos } from './servico'

const conteudo = Buffer.from('conteúdo do pdf')
const hash = sha256Hex(conteudo)
const tmp = 'https://x.public.blob.vercel-storage.com/tmp-arquivos/u-PC_01.pdf'
const dados = {
  clienteId: 'c1',
  urlTemporaria: tmp,
  nome: 'PC 01.pdf',
  categoria: 'PROPOSTA_COMERCIAL' as const,
  contratoId: 'k1',
  competenciaAno: null,
  competenciaMes: null,
  enviadoPorId: 'u1',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getUpload as jest.Mock).mockResolvedValue(conteudo)
  ;(putUpload as jest.Mock).mockResolvedValue('https://x.public.blob.vercel-storage.com/clientes/c1/id/PC_01.pdf')
  ;(deleteUpload as jest.Mock).mockResolvedValue(undefined)
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(null)
  ;(prisma.arquivoCliente.create as jest.Mock).mockImplementation(({ data }) => ({ id: data.id, nome: data.nome }))
})

describe('sha256Hex', () => {
  it('hex de 64 caracteres', () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('registrarArquivo', () => {
  it('arquivo novo: copia pro caminho final, grava com hash e apaga o temporário', async () => {
    const { arquivo, duplicado } = await registrarArquivo(dados)

    expect(duplicado).toBe(false)
    const { data } = (prisma.arquivoCliente.create as jest.Mock).mock.calls[0][0]
    expect(putUpload).toHaveBeenCalledWith(`clientes/c1/${data.id}/PC_01.pdf`, conteudo, 'application/pdf')
    expect(data).toMatchObject({
      clienteId: 'c1',
      contratoId: 'k1',
      categoria: 'PROPOSTA_COMERCIAL',
      nome: 'PC 01.pdf',
      extensao: 'pdf',
      contentType: 'application/pdf',
      tamanhoBytes: conteudo.length,
      sha256: hash,
      origem: 'upload',
      enviadoPorId: 'u1',
      urlBlob: 'https://x.public.blob.vercel-storage.com/clientes/c1/id/PC_01.pdf',
    })
    expect(arquivo.id).toBe(data.id)
    expect(deleteUpload).toHaveBeenCalledWith(tmp)
  })

  it('mesmo conteúdo já no cliente: devolve o existente, não grava nada e apaga o temporário', async () => {
    ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue({ id: 'a-existente' })

    const resultado = await registrarArquivo(dados)

    expect(resultado).toEqual({ arquivo: { id: 'a-existente' }, duplicado: true })
    expect(prisma.arquivoCliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clienteId: 'c1', sha256: hash, removidoEm: null } })
    )
    expect(putUpload).not.toHaveBeenCalled()
    expect(prisma.arquivoCliente.create).not.toHaveBeenCalled()
    expect(deleteUpload).toHaveBeenCalledWith(tmp)
  })

  it('corrida (P2002 no índice único): devolve o que o outro gravou, apaga blob final órfão', async () => {
    ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'a-outro' })
    ;(prisma.arquivoCliente.create as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' })
    )

    expect(await registrarArquivo(dados)).toEqual({ arquivo: { id: 'a-outro' }, duplicado: true })
    expect(deleteUpload).toHaveBeenCalledWith('https://x.public.blob.vercel-storage.com/clientes/c1/id/PC_01.pdf')
  })

  it('erro não-P2002 na criação: apaga blob final órfão e propaga', async () => {
    ;(prisma.arquivoCliente.create as jest.Mock).mockRejectedValue(new Error('db conectivity'))

    await expect(registrarArquivo(dados)).rejects.toThrow('db conectivity')
    expect(deleteUpload).toHaveBeenCalledWith('https://x.public.blob.vercel-storage.com/clientes/c1/id/PC_01.pdf')
  })

  it('falha em apagar o temporário não derruba o registro', async () => {
    ;(deleteUpload as jest.Mock).mockRejectedValue(new Error('blob fora'))
    await expect(registrarArquivo(dados)).resolves.toMatchObject({ duplicado: false })
  })
})

describe('usosDosArquivos', () => {
  it('Documento antigo vira "Análise por IA" com link pra competência', async () => {
    ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([
      { arquivoId: 'a1', clienteId: 'c1', competenciaAno: 2026, competenciaMes: 6 },
    ])

    const usos = await usosDosArquivos(['a1', 'a2'])

    expect(prisma.documento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { arquivoId: { in: ['a1', 'a2'] } } })
    )
    expect(usos.get('a1')).toEqual([
      { tipo: 'analise-documento', rotulo: 'Análise por IA · Junho/2026', href: '/clientes/c1/2026-06' },
    ])
    expect(usos.get('a2')).toEqual([])
  })

  it('lista vazia não consulta o banco', async () => {
    expect((await usosDosArquivos([])).size).toBe(0)
    expect(prisma.documento.findMany).not.toHaveBeenCalled()
  })
})
