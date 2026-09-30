/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: { indiceIpcFipe: { findMany: jest.fn(), createMany: jest.fn(), updateMany: jest.fn(), aggregate: jest.fn() } },
}))
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { compararComGravados, lerIndiceGravado, sincronizarIpcFipe } from './indice'

const db = prisma.indiceIpcFipe as unknown as Record<string, jest.Mock>

describe('compararComGravados', () => {
  it('separa novos, confirmados (mesmo valor com outra escrita) e divergentes', () => {
    const r = compararComGravados(
      [
        { mes: '2026-06', variacao: '0.18' },
        { mes: '2026-07', variacao: '-0.03' },
        { mes: '2026-08', variacao: '0.01' },
      ],
      new Map([
        ['2026-06', '0.1800'],
        ['2026-07', '-0.0400'],
      ])
    )
    expect(r.novos).toEqual([{ mes: '2026-08', variacao: '0.01' }])
    expect(r.confirmados).toEqual(['2026-06'])
    expect(r.divergentes).toEqual([{ mes: '2026-07', gravado: '-0.04', fonte: '-0.03' }])
  })
})

describe('sincronizarIpcFipe', () => {
  beforeEach(() => jest.clearAllMocks())

  it('grava só os novos, renova buscadoEm dos confirmados e não toca nos divergentes', async () => {
    db.findMany.mockResolvedValue([
      { mes: new Date('2026-06-01T00:00:00Z'), variacao: new Prisma.Decimal('0.18') },
      { mes: new Date('2026-07-01T00:00:00Z'), variacao: new Prisma.Decimal('-0.04') },
    ])
    const agora = new Date('2026-09-30T12:00:00Z')
    const r = await sincronizarIpcFipe({
      agora,
      buscar: async () => [
        { mes: '2026-06', variacao: '0.18' },
        { mes: '2026-07', variacao: '-0.03' },
        { mes: '2026-08', variacao: '0.01' },
      ],
    })
    expect(r).toEqual({ novos: 1, confirmados: 1, divergentes: [{ mes: '2026-07', gravado: '-0.04', fonte: '-0.03' }] })
    expect(db.createMany).toHaveBeenCalledWith({
      data: [{ mes: new Date('2026-08-01T00:00:00Z'), variacao: '0.01', fonte: expect.stringContaining('sgs.193'), buscadoEm: agora }],
      skipDuplicates: true,
    })
    expect(db.updateMany).toHaveBeenCalledWith({
      where: { mes: { in: [new Date('2026-06-01T00:00:00Z')] } },
      data: { buscadoEm: agora },
    })
  })

  it('falha da fonte sobe e nada é gravado', async () => {
    db.findMany.mockResolvedValue([])
    await expect(sincronizarIpcFipe({ buscar: async () => Promise.reject(new Error('502')) })).rejects.toThrow('502')
    expect(db.createMany).not.toHaveBeenCalled()
  })
})

describe('lerIndiceGravado', () => {
  it('devolve AAAA-MM com a variação sem zeros à direita e a última atualização', async () => {
    db.findMany.mockResolvedValue([{ mes: new Date('2026-08-01T00:00:00Z'), variacao: new Prisma.Decimal('0.0100') }])
    db.aggregate.mockResolvedValue({ _max: { buscadoEm: new Date('2026-09-30T12:00:00Z') } })
    await expect(lerIndiceGravado()).resolves.toEqual({
      meses: [{ mes: '2026-08', variacao: '0.01' }],
      atualizadoEm: '2026-09-30T12:00:00.000Z',
    })
  })
})
