/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/ia/revisarPortugues', () => ({ revisarPortugues: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revisarPortugues } from '@/lib/ia/revisarPortugues'
import { POST } from './route'

const requisicao = (corpo?: unknown) =>
  new NextRequest('http://localhost/api/propostas-comerciais/p1/revisao-portugues', {
    method: 'POST',
    ...(corpo !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      : {}),
  })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('POST /api/propostas-comerciais/[id]/revisao-portugues', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
  })

  it('retorna 401 sem autenticação', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(401)
  })

  it('retorna 404 quando a proposta não existe', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(404)
  })

  it('retorna 400 quando a proposta ainda não tem conteúdo', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', conteudoMarkdown: null })
    expect((await POST(requisicao(), contexto)).status).toBe(400)
  })

  it('retorna 200 com original e corrigido no caminho feliz', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'A proposta e boa.',
    })
    ;(revisarPortugues as jest.Mock).mockResolvedValue('A proposta é boa.')

    const resposta = await POST(requisicao(), contexto)

    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual({
      original: 'A proposta e boa.',
      corrigido: 'A proposta é boa.',
    })
  })

  it('revisa o texto enviado no corpo (editor com texto ainda não salvo)', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'texto salvo antigo',
    })
    ;(revisarPortugues as jest.Mock).mockResolvedValue('A proposta é boa.')

    const resposta = await POST(requisicao({ conteudoMarkdown: 'A proposta e boa.' }), contexto)

    expect(revisarPortugues).toHaveBeenCalledWith('A proposta e boa.')
    await expect(resposta.json()).resolves.toEqual({
      original: 'A proposta e boa.',
      corrigido: 'A proposta é boa.',
    })
  })

  it('retorna 422 quando a revisão altera um número', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Valor: 100',
    })
    ;(revisarPortugues as jest.Mock).mockResolvedValue('Valor: 200')

    const resposta = await POST(requisicao(), contexto)

    expect(resposta.status).toBe(422)
    await expect(resposta.json()).resolves.toEqual({
      error: expect.stringMatching(/número/i),
    })
  })
})
