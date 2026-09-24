/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/relatorios-clientes/contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))

import type { PrismaClient } from '@prisma/client'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { auditarNoBanco } from './auditoria-banco'

it('usa o mesmo consolidado das telas e devolve os achados por cliente', async () => {
  const banco = {
    contrato: {
      findMany: jest.fn(async () => [
        { id: 'k1', numeroTermo: 'TC 52/SMIT/2024', situacao: 'Finalizado', dataVencimento: null, cliente: { siglaLegado: 'SMIT' }, historico: [{ tipo: 'CONTRATO', numero: 'TC 52/SMIT/2024' }] },
      ]),
    },
  }
  ;(consolidarContratos as jest.Mock).mockResolvedValue(
    new Map([['k1', { ativo: false, vazio: false, vigenciaFim: new Date('2027-06-30'), valorBase: '9256707.23' }]])
  )
  const achados = await auditarNoBanco(banco as unknown as PrismaClient, ['c-smit'], new Date('2026-09-24'))
  expect((banco.contrato.findMany.mock.calls[0] as unknown[])[0]).toMatchObject({ where: { clienteId: { in: ['c-smit'] } } })
  expect(achados).toEqual([expect.objectContaining({ tipo: 'finalizado-vigente', cliente: 'SMIT', contrato: 'TC 52/SMIT/2024' })])
})
