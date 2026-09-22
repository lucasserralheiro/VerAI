/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    solicitacao: { findMany: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const base = 'http://localhost/api/solicitacoes'
const get = (query = '') => new NextRequest(`${base}${query}`)
const post = (corpo: unknown) =>
  new NextRequest(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  ;(prisma.solicitacao.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.solicitacao.groupBy as jest.Mock).mockImplementation(({ by }) =>
    by[0] === 'tipo' ? [{ tipo: 'RDM' }, { tipo: 'Solicitação' }] : []
  )
})

describe('GET /api/solicitacoes', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(get())).status).toBe(401)
  })

  it('usuário comum só vê as dos clientes permitidos, com filtros', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    await GET(get('?clienteId=c1&situacao=Aberta&q=sharepoint'))
    expect(prisma.solicitacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { cliente: { id: { in: ['c1'] } } },
            { clienteId: 'c1' },
            { situacao: 'Aberta' },
            {
              OR: [
                { descricao: { contains: 'sharepoint', mode: 'insensitive' } },
                { numero: { contains: 'sharepoint', mode: 'insensitive' } },
              ],
            },
          ],
        },
      })
    )
  })

  it('devolve a lista e as sugestões', async () => {
    ;(prisma.solicitacao.findMany as jest.Mock).mockResolvedValue([{ id: 's1', numero: '1615977' }])
    const corpo = await (await GET(get())).json()
    expect(corpo).toEqual({ solicitacoes: [{ id: 's1', numero: '1615977' }], sugestoes: { tipo: ['RDM', 'Solicitação'], situacao: [] } })
  })
})

describe('POST /api/solicitacoes', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ clienteId: 'c1', descricao: 'x' }))).status).toBe(401)
  })

  it('400 sem assunto', async () => {
    const resposta = await POST(post({ clienteId: 'c1' }))
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Assunto: campo obrigatório' })
  })

  it('403 em cliente sem permissão', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await POST(post({ clienteId: 'outro', descricao: 'x' }))).status).toBe(403)
    expect(prisma.solicitacao.create).not.toHaveBeenCalled()
  })

  it('cria a solicitação', async () => {
    ;(prisma.solicitacao.create as jest.Mock).mockImplementation(({ data }) => ({ id: 's9', ...data }))
    const resposta = await POST(post({ clienteId: 'c1', descricao: 'Aumento Sharepoint', numero: '1615977', tipo: 'RDM', comVisita: false }))
    expect(resposta.status).toBe(201)
    expect(prisma.solicitacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { clienteId: 'c1', descricao: 'Aumento Sharepoint', numero: '1615977', tipo: 'RDM', comVisita: false },
      })
    )
  })
})
