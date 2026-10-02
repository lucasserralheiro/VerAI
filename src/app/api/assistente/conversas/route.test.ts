/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { conversaAssistente: { findMany: jest.fn(), create: jest.fn() } } }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from './route'

const usuario = { id: 'u1', nome: 'U', email: 'u@x', role: 'responsavel' }
beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario)
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/assistente/conversas'))).status).toBe(401)
})

it('GET lista só as do usuário, mais recentes primeiro', async () => {
  ;(prisma.conversaAssistente.findMany as jest.Mock).mockResolvedValue([{ id: 'c', titulo: 't', atualizadaEm: new Date('2026-09-23T00:00:00Z') }])
  const r = await GET(new NextRequest('http://localhost/api/assistente/conversas'))
  expect((prisma.conversaAssistente.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({ where: { usuarioId: 'u1' }, orderBy: { atualizadaEm: 'desc' }, take: 30 })
  expect((await r.json()).conversas).toHaveLength(1)
})

it('POST cria com título da pergunta e a rota como contexto inicial', async () => {
  ;(prisma.conversaAssistente.create as jest.Mock).mockResolvedValue({ id: 'nova' })
  const r = await POST(new NextRequest('http://localhost/api/assistente/conversas', { method: 'POST', body: JSON.stringify({ pergunta: 'saldo do smit', rota: '/clientes/c1' }) }))
  expect(r.status).toBe(201)
  expect(await r.json()).toEqual({ id: 'nova' })
  expect((prisma.conversaAssistente.create as jest.Mock).mock.calls[0][0].data).toEqual({ usuarioId: 'u1', titulo: 'saldo do smit', contextoInicial: { rota: '/clientes/c1' } })
})

it('POST 400 sem pergunta', async () => {
  const r = await POST(new NextRequest('http://localhost/api/assistente/conversas', { method: 'POST', body: JSON.stringify({}) }))
  expect(r.status).toBe(400)
})

it('POST com somenteCriar cria a conversa (título = nome do anexo) e o devolve com a marca — sem gravar pergunta', async () => {
  ;(prisma.conversaAssistente.create as jest.Mock).mockResolvedValue({ id: 'nova' })
  const r = await POST(
    new NextRequest('http://localhost/api/assistente/conversas', {
      method: 'POST',
      body: JSON.stringify({ pergunta: 'contrato-smit.pdf', rota: '/confere', somenteCriar: true }),
    })
  )
  expect(r.status).toBe(201)
  expect(await r.json()).toEqual({ id: 'nova', somenteCriar: true })
  expect((prisma.conversaAssistente.create as jest.Mock).mock.calls[0][0].data).toEqual({ usuarioId: 'u1', titulo: 'contrato-smit.pdf', contextoInicial: { rota: '/confere' } })
})

it('POST 400 com somenteCriar que não é booleano', async () => {
  const r = await POST(new NextRequest('http://localhost/api/assistente/conversas', { method: 'POST', body: JSON.stringify({ pergunta: 'x', somenteCriar: 'sim' }) }))
  expect(r.status).toBe(400)
})
