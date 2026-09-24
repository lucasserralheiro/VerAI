import type { PrismaClient } from '@prisma/client'
import { garantirClientes } from './clientes'

function db() {
  return {
    cliente: {
      findMany: jest.fn(async () => [
        { id: 'c-sms', nome: 'SMS', siglaLegado: 'SMS' },
        { id: 'c-sgm', nome: 'Secretaria de Governo', siglaLegado: 'SGM' },
      ]),
      create: jest.fn(async ({ data }: { data: { siglaLegado: string } }) => ({ id: `novo-${data.siglaLegado}` })),
      update: jest.fn(),
    },
  }
}

it('cria o cliente que falta pela sigla (mapa vale), corrige nome que é só a sigla e ignora pasta nula', async () => {
  const banco = db()
  const r = await garantirClientes(banco as unknown as PrismaClient, {
    aplicar: true,
    pastas: ['SMS', 'SGM - CASA CIVIL', 'SUB-ITAM PAULISTA', 'IGNORAR'],
    mapa: { 'SGM - CASA CIVIL': 'SGM', 'SUB-ITAM PAULISTA': 'SUB-ITP', IGNORAR: null },
    nomes: { SMS: 'Secretaria Municipal da Saúde', 'SUB-ITP': 'Subprefeitura Itaim Paulista' },
  })
  expect(r.criados).toEqual(['SUB-ITP — Subprefeitura Itaim Paulista'])
  expect(banco.cliente.create).toHaveBeenCalledWith({ data: { nome: 'Subprefeitura Itaim Paulista', siglaLegado: 'SUB-ITP' }, select: { id: true } })
  expect(r.clientes.get('SUB-ITP')).toEqual({ id: 'novo-SUB-ITP', nome: 'Subprefeitura Itaim Paulista' })
  expect(r.renomeados).toEqual(['SMS → Secretaria Municipal da Saúde'])
  expect(r.clientes.has('IGNORAR')).toBe(false)
})

it('sem --aplicar não grava e devolve id simulado', async () => {
  const banco = db()
  const r = await garantirClientes(banco as unknown as PrismaClient, { aplicar: false, pastas: ['SPTURIS'], mapa: {}, nomes: {} })
  expect(r.clientes.get('SPTURIS')?.id).toBe('simulado:SPTURIS')
  expect(r.semNomeOficial).toEqual(['SPTURIS'])
  expect(banco.cliente.create).not.toHaveBeenCalled()
})
