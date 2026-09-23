/** @jest-environment node */
import { migrarDocumentos } from './migracao-documentos'
import { sha256Hex } from './servico'

jest.mock('@/lib/prisma', () => ({ prisma: {} }))

const doc = (id: string, conteudo: string, extra: Record<string, unknown> = {}) => ({
  id,
  clienteId: 'c1',
  nomeArquivo: `${id}.xlsx`,
  tipo: 'xlsx',
  caminhoOriginal: `https://x.public.blob.vercel-storage.com/2026/06/${id}/original.xlsx`,
  tamanhoBytes: conteudo.length,
  uploadedById: 'u1',
  competenciaAno: 2026,
  competenciaMes: 6,
  createdAt: new Date('2026-06-10T12:00:00Z'),
  conteudo,
  ...extra,
})

function prismaFalso(documentos: ReturnType<typeof doc>[]) {
  const arquivos: Array<Record<string, unknown>> = []
  return {
    arquivos,
    documento: {
      findMany: jest.fn().mockResolvedValue(documentos),
      update: jest.fn().mockResolvedValue({}),
    },
    arquivoCliente: {
      findFirst: jest.fn(({ where }) => arquivos.find((a) => a.clienteId === where.clienteId && a.sha256 === where.sha256) ?? null),
      create: jest.fn(({ data }) => {
        arquivos.push(data)
        return data
      }),
    },
  }
}

describe('migrarDocumentos', () => {
  it('sem --aplicar só conta, não grava nada', async () => {
    const documentos = [doc('d1', 'A')]
    const prisma = prismaFalso(documentos)
    const baixar = jest.fn(async (url: string) => Buffer.from(documentos.find((d) => url.includes(d.id))!.conteudo))

    const resultado = await migrarDocumentos(prisma as never, { aplicar: false, baixar })

    expect(resultado).toEqual({ total: 1, criados: 1, reaproveitados: 0, falhas: [] })
    expect(prisma.arquivoCliente.create).not.toHaveBeenCalled()
    expect(prisma.documento.update).not.toHaveBeenCalled()
  })

  it('com --aplicar cria apontando pro MESMO blob, e conteúdo repetido reaproveita', async () => {
    const documentos = [doc('d1', 'A'), doc('d2', 'A'), doc('d3', 'B', { tipo: 'pdf', nomeArquivo: 'd3.pdf' })]
    const prisma = prismaFalso(documentos)
    const baixar = jest.fn(async (url: string) => Buffer.from(documentos.find((d) => url.includes(d.id))!.conteudo))

    const resultado = await migrarDocumentos(prisma as never, { aplicar: true, baixar })

    expect(resultado).toEqual({ total: 3, criados: 2, reaproveitados: 1, falhas: [] })
    expect(prisma.documento.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { arquivoId: null } }))
    expect(prisma.arquivos[0]).toMatchObject({
      clienteId: 'c1',
      categoria: 'PLANILHA',
      nome: 'd1.xlsx',
      extensao: 'xlsx',
      urlBlob: documentos[0].caminhoOriginal,
      sha256: sha256Hex(Buffer.from('A')),
      origem: 'migrado',
      enviadoPorId: 'u1',
      createdAt: documentos[0].createdAt,
    })
    expect(prisma.arquivos[0]).not.toHaveProperty('competenciaAno')
    expect(prisma.arquivos[0]).not.toHaveProperty('competenciaMes')
    expect(prisma.arquivos[1]).toMatchObject({ categoria: 'OUTRO', contentType: 'application/pdf' })
    const idDoA = prisma.arquivos[0].id
    expect(prisma.documento.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { arquivoId: idDoA } })
    expect(prisma.documento.update).toHaveBeenCalledWith({ where: { id: 'd2' }, data: { arquivoId: idDoA } })
  })

  it('blob que não baixa vira falha e não interrompe os outros', async () => {
    const documentos = [doc('d1', 'A'), doc('d2', 'B')]
    const prisma = prismaFalso(documentos)
    const baixar = jest.fn(async (url: string) => {
      if (url.includes('d1')) throw new Error('404')
      return Buffer.from('B')
    })

    const resultado = await migrarDocumentos(prisma as never, { aplicar: true, baixar })

    expect(resultado).toEqual({ total: 2, criados: 1, reaproveitados: 0, falhas: [{ documentoId: 'd1', motivo: '404' }] })
  })
})
