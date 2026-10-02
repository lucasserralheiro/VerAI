/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    demanda: { findMany: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const base = 'http://localhost/api/demandas'
const get = (query = '') => new NextRequest(`${base}${query}`)
const post = (corpo: unknown) =>
  new NextRequest(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  ;(prisma.demanda.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.demanda.groupBy as jest.Mock).mockImplementation(({ by }) =>
    by[0] === 'situacao' ? [{ situacao: 'Em andamento' }, { situacao: null }, { situacao: 'Concluído' }] : []
  )
})

describe('GET /api/demandas', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(get())).status).toBe(401)
  })

  it('usuário comum só vê demandas dos clientes permitidos', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    await GET(get())
    expect(prisma.demanda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ cliente: { id: { in: ['c1'] } } }] } })
    )
  })

  it('aplica os filtros de cliente, situação, busca e "atribuída no import"', async () => {
    await GET(get('?clienteId=c1&situacao=Em%20andamento&q=%20vpn%20&atribuidaNoImport=1'))
    expect(prisma.demanda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { cliente: {} },
            { clienteId: 'c1' },
            { situacao: 'Em andamento' },
            {
              OR: [
                { assunto: { contains: 'vpn', mode: 'insensitive' } },
                { documento: { contains: 'vpn', mode: 'insensitive' } },
                { sei: { contains: 'vpn', mode: 'insensitive' } },
                { responsavel: { contains: 'vpn', mode: 'insensitive' } },
              ],
            },
            { notaImportacao: { not: null } },
          ],
        },
      })
    )
  })

  it('cada linha traz a posição do último trâmite, e a resposta traz as sugestões', async () => {
    ;(prisma.demanda.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'd1',
        assunto: 'Liberação VPN',
        tramites: [{ posicao: 'Aguardando SMS', responsavelAtual: 'SMS', data: new Date('2026-09-01T03:00:00Z') }],
      },
      { id: 'd2', assunto: 'Sem trâmite', tramites: [] },
    ])
    const resposta = await GET(get())
    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()
    expect(corpo.demandas).toEqual([
      expect.objectContaining({
        id: 'd1',
        ultimoTramite: { posicao: 'Aguardando SMS', responsavelAtual: 'SMS', data: '2026-09-01T03:00:00.000Z' },
      }),
      expect.objectContaining({ id: 'd2', ultimoTramite: null }),
    ])
    expect(corpo.demandas[0]).not.toHaveProperty('tramites')
    expect(corpo.sugestoes.situacao).toEqual(['Em andamento', 'Concluído'])
  })
})

describe('POST /api/demandas', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ clienteId: 'c1', assunto: 'x' }))).status).toBe(401)
  })

  it('400 sem assunto, com rótulo em português', async () => {
    const resposta = await POST(post({ clienteId: 'c1' }))
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Assunto: campo obrigatório' })
  })

  it('403 ao criar em cliente sem permissão', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await POST(post({ clienteId: 'outro', assunto: 'x' }))).status).toBe(403)
    expect(prisma.demanda.create).not.toHaveBeenCalled()
  })

  it('400 quando o cliente não existe (P2003)', async () => {
    ;(prisma.demanda.create as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'teste' })
    )
    expect((await POST(post({ clienteId: 'c404', assunto: 'x' }))).status).toBe(400)
  })

  it('cria a demanda', async () => {
    ;(prisma.demanda.create as jest.Mock).mockImplementation(({ data }) => ({ id: 'd9', ...data }))
    const resposta = await POST(post({ clienteId: 'c1', assunto: ' Portal HSPM ', situacao: 'Em andamento', dataAbertura: '2026-09-22' }))
    expect(resposta.status).toBe(201)
    expect(prisma.demanda.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { clienteId: 'c1', assunto: 'Portal HSPM', situacao: 'Em andamento', dataAbertura: new Date('2026-09-22T00:00:00Z') },
      })
    )
  })
})

describe('somente leitura', () => {
  beforeEach(() => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  })

  it('POST 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await POST(post({ clienteId: 'c1', assunto: 'x' }))
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.demanda.create).not.toHaveBeenCalled()
  })
})
