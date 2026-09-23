/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    conversaAssistente: { findUnique: jest.fn(), update: jest.fn() },
    mensagemAssistente: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  },
}))
jest.mock('@/lib/assistente/configuracao', () => ({ configuracaoDoAssistente: jest.fn() }))
jest.mock('@/lib/assistente/agente', () => ({ MAX_HISTORICO: 6, executarAgente: jest.fn() }))
jest.mock('@/lib/assistente/contexto-pagina', () => ({
  interpretarRota: jest.fn(() => ({ clienteId: 'c1' })),
  descreverContexto: jest.fn(async () => ({ texto: 'Tela aberta: SMIT', rotulo: 'SMIT' })),
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { configuracaoDoAssistente } from '@/lib/assistente/configuracao'
import { executarAgente } from '@/lib/assistente/agente'
import { POST } from './route'

const params = { params: Promise.resolve({ id: 'conv' }) }
const req = (corpo: unknown) =>
  new NextRequest('http://localhost/api/assistente/conversas/conv/mensagens', { method: 'POST', body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'U', email: 'u@x', role: 'responsavel' })
  ;(configuracaoDoAssistente as jest.Mock).mockReturnValue({ provedor: 'deepseek', modelo: 'deepseek-chat', apiKey: 'k' })
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ usuarioId: 'u1' })
  ;(prisma.mensagemAssistente.count as jest.Mock).mockResolvedValue(0)
  ;(prisma.mensagemAssistente.findMany as jest.Mock).mockResolvedValue([
    { papel: 'assistente', conteudo: 'resposta antiga' },
    { papel: 'usuario', conteudo: 'pergunta antiga' },
  ])
  ;(executarAgente as jest.Mock).mockReturnValue({ toUIMessageStreamResponse: () => new Response('stream') })
})

it('503 sem configuração', async () => {
  ;(configuracaoDoAssistente as jest.Mock).mockReturnValue(null)
  const r = await POST(req({ pergunta: 'oi' }), params)
  expect(r.status).toBe(503)
  expect(await r.json()).toEqual({ error: 'Assistente não configurado' })
})

it('400 pergunta vazia ou longa demais', async () => {
  expect((await POST(req({ pergunta: '' }), params)).status).toBe(400)
  expect((await POST(req({ pergunta: 'x'.repeat(2001) }), params)).status).toBe(400)
})

it('404 conversa de outro usuário', async () => {
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ usuarioId: 'u2' })
  expect((await POST(req({ pergunta: 'oi' }), params)).status).toBe(404)
})

it('429 acima de 30 perguntas na hora', async () => {
  ;(prisma.mensagemAssistente.count as jest.Mock).mockResolvedValue(30)
  const r = await POST(req({ pergunta: 'oi' }), params)
  expect(r.status).toBe(429)
  expect(executarAgente).not.toHaveBeenCalled()
})

it('grava a pergunta, chama o agente com histórico em ordem e contexto, e grava a resposta ao terminar', async () => {
  const r = await POST(req({ pergunta: 'qual o saldo?', rota: '/clientes/c1' }), params)
  expect(await r.text()).toBe('stream')
  expect(prisma.mensagemAssistente.create).toHaveBeenCalledWith({ data: { conversaId: 'conv', papel: 'usuario', conteudo: 'qual o saldo?' } })

  const [entrada, aoTerminar] = (executarAgente as jest.Mock).mock.calls[0]
  expect(entrada.historico).toEqual([
    { papel: 'usuario', conteudo: 'pergunta antiga' },
    { papel: 'assistente', conteudo: 'resposta antiga' },
  ])
  expect(entrada.contexto).toMatch(/^Hoje é \d{2}\/\d{2}\/\d{4}\. Tela aberta: SMIT$/)

  await aoTerminar({ texto: 'R$ 10,00', ferramentas: [{ nome: 'resumoDoCliente', entrada: {} }], tokensEntrada: 5, tokensSaida: 2, tokensCache: 1 })
  expect(prisma.mensagemAssistente.create).toHaveBeenLastCalledWith({
    data: { conversaId: 'conv', papel: 'assistente', conteudo: 'R$ 10,00', ferramentas: [{ nome: 'resumoDoCliente', entrada: {} }], tokensEntrada: 5, tokensSaida: 2, tokensCache: 1 },
  })
  expect(prisma.conversaAssistente.update).toHaveBeenCalledWith({ where: { id: 'conv' }, data: { atualizadaEm: expect.any(Date) } })
})

it('resposta vazia (provedor abortou) não é gravada', async () => {
  await POST(req({ pergunta: 'oi' }), params)
  const [, aoTerminar] = (executarAgente as jest.Mock).mock.calls[0]
  ;(prisma.mensagemAssistente.create as jest.Mock).mockClear()
  await aoTerminar({ texto: '', ferramentas: [] })
  expect(prisma.mensagemAssistente.create).not.toHaveBeenCalled()
})
