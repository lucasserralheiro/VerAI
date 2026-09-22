/** @jest-environment node */
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    itemContrato: { groupBy: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { saldosDosContratos } from './saldos-contratos'

beforeEach(() => jest.clearAllMocks())

describe('saldosDosContratos', () => {
  it('soma itens e notas fiscais por contrato e devolve o saldo de cada um', async () => {
    ;(prisma.itemContrato.groupBy as jest.Mock).mockResolvedValue([
      { contratoId: 'k1', _sum: { valorTotal: new Prisma.Decimal('1000') } },
    ])
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { contratoId: 'k1', faturado: new Prisma.Decimal('400') },
      { contratoId: 'k2', faturado: new Prisma.Decimal('90') },
    ])

    const saldos = await saldosDosContratos(['k1', 'k2', 'k3'])

    expect(prisma.itemContrato.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['contratoId'], where: { contratoId: { in: ['k1', 'k2', 'k3'] } } })
    )
    expect(saldos.get('k1')).toEqual({ valorItens: '1000', faturado: '400', saldo: '600', percentualFaturado: '40.00' })
    // k2 faturou mas não tem item vinculado: saldo não calculável.
    expect(saldos.get('k2')).toEqual({ valorItens: '0', faturado: '90', saldo: null, percentualFaturado: null })
    expect(saldos.get('k3')).toEqual({ valorItens: '0', faturado: '0', saldo: null, percentualFaturado: null })
  })

  it('lista vazia não consulta o banco', async () => {
    expect((await saldosDosContratos([])).size).toBe(0)
    expect(prisma.itemContrato.groupBy).not.toHaveBeenCalled()
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })
})
