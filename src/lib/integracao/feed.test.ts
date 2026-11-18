/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    tabelaPrecos: { findFirst: jest.fn() },
    itemTabelaPrecos: { findMany: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { listarRecurso } from './feed'

describe('recurso tabelaPrecos', () => {
  it('devolve um registro por item da versão vigente, sem chave de cliente/gerência', async () => {
    ;(prisma.tabelaPrecos.findFirst as jest.Mock).mockResolvedValue({ id: 'tab1' })
    ;(prisma.itemTabelaPrecos.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'item1',
        codigo: '14.046.00008.00',
        descricao: 'PLATAFORMA DE BANCO DE DADOS - POSTGRESQL - PERFIL A',
        grupo: 'E',
        secoes: 'E - PLATAFORMAS > E1. BANCO DE DADOS',
        unidade: 'PLATAFORMA/MÊS',
      },
    ])

    const lista = await listarRecurso('tabelaPrecos')

    expect(lista?.total).toBe(1)
    expect(lista?.registros[0]).toMatchObject({
      id: 'item1',
      chaveCliente: null,
      chaveGerencia: null,
      dados: {
        codigo: '14.046.00008.00',
        descricao: 'PLATAFORMA DE BANCO DE DADOS - POSTGRESQL - PERFIL A',
        grupo: 'E',
      },
    })
    expect(prisma.itemTabelaPrecos.findMany).toHaveBeenCalledWith({
      where: { tabelaId: 'tab1' },
      orderBy: { posicao: 'asc' },
    })
  })

  it('sem versão vigente, lista vazia (nunca erro)', async () => {
    ;(prisma.tabelaPrecos.findFirst as jest.Mock).mockResolvedValue(null)

    const lista = await listarRecurso('tabelaPrecos')

    expect(lista?.total).toBe(0)
  })
})
