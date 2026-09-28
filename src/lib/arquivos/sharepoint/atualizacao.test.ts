/** @jest-environment node */
import type { PrismaClient } from '@prisma/client'
import { motivoIncompleta, registrarAtualizacao } from './atualizacao'

const COMPLETA = {
  conferencia: [
    { cliente: 'SMS', noSharepoint: 1000, noVerai: 1000, faltando: [] },
    { cliente: 'SGM', noSharepoint: 176, noVerai: 176, faltando: [] },
  ],
  remocaoSuspensa: null,
  falhas: [],
}
const INICIO = new Date('2026-09-28T13:30:00.000Z')

function prismaFalso(create = jest.fn().mockResolvedValue({})) {
  return { prisma: { atualizacaoSharepoint: { create } } as unknown as PrismaClient, create }
}

describe('motivoIncompleta', () => {
  it('passada completa da biblioteca inteira vale', () => {
    expect(motivoIncompleta(COMPLETA, { aplicar: true })).toBeNull()
  })

  it.each([
    ['só listagem', COMPLETA, { aplicar: false }],
    ['só parte dos clientes', COMPLETA, { aplicar: true, clientes: ['SMS'] }],
    ['sem conferência', { ...COMPLETA, conferencia: null }, { aplicar: true }],
    [
      'conferência com divergência',
      { ...COMPLETA, conferencia: [{ cliente: 'SMS', noSharepoint: 2, noVerai: 1, faltando: ['SMS/a.pdf'] }] },
      { aplicar: true },
    ],
    ['remoção suspensa', { ...COMPLETA, remocaoSuspensa: 'a pasta listou 0 arquivos' }, { aplicar: true }],
    ['1 arquivo(s) com falha', { ...COMPLETA, falhas: [{ caminho: 'SMS/a.pdf', motivo: 'EBUSY' }] }, { aplicar: true }],
  ])('não vale: %s', (motivo, r, opcoes) => {
    expect(motivoIncompleta(r, opcoes)).toBe(motivo)
  })

  it('lista de clientes vazia conta como biblioteca inteira', () => {
    expect(motivoIncompleta(COMPLETA, { aplicar: true, clientes: [] })).toBeNull()
  })
})

describe('registrarAtualizacao', () => {
  const pronto = { bancoPronto: () => Promise.resolve(true) }

  it('grava o início da passada e o total de arquivos conferidos', async () => {
    const { prisma, create } = prismaFalso()
    const texto = await registrarAtualizacao(prisma, COMPLETA, { aplicar: true, iniciadaEm: INICIO }, pronto)
    expect(create).toHaveBeenCalledWith({ data: { iniciadaEm: INICIO, arquivos: 1176 } })
    expect(texto).toMatch(/^data das telas: atualizada/)
  })

  it('passada incompleta não grava e diz por quê', async () => {
    const { prisma, create } = prismaFalso()
    const r = { ...COMPLETA, remocaoSuspensa: 'OneDrive pausado' }
    const texto = await registrarAtualizacao(prisma, r, { aplicar: true, iniciadaEm: INICIO }, pronto)
    expect(create).not.toHaveBeenCalled()
    expect(texto).toBe('data das telas: não atualizada — remoção suspensa')
  })

  it('banco sem a migração (produção num deploy anterior): pula sem gravar', async () => {
    const { prisma, create } = prismaFalso()
    const texto = await registrarAtualizacao(prisma, COMPLETA, { aplicar: true, iniciadaEm: INICIO }, { bancoPronto: () => Promise.resolve(false) })
    expect(create).not.toHaveBeenCalled()
    expect(texto).toMatch(/^data das telas: pulada — migração 20260928120000_atualizacao_sharepoint/)
  })

  it('erro do banco vira texto — nunca muda o código de saída da sincronização', async () => {
    const { prisma } = prismaFalso(jest.fn().mockRejectedValue(new Error('conexão caiu')))
    await expect(registrarAtualizacao(prisma, COMPLETA, { aplicar: true, iniciadaEm: INICIO }, pronto)).resolves.toBe(
      'data das telas: falhou — conexão caiu (a próxima rodada tenta de novo)'
    )
  })
})
