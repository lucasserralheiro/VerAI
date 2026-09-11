/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn(), update: jest.fn() } },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PATCH } from './route'

const requisicao = (corpo: unknown) =>
  new NextRequest('http://localhost/api/propostas-comerciais/p1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('PATCH /api/propostas-comerciais/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({ id: 'p1' })
  })

  it('markdown com :::ocr-pendente salva e mantém rascunho', async () => {
    ;(prisma.propostaComercial.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))

    const resposta = await PATCH(
      requisicao({ conteudoMarkdown: 'texto\n\n:::ocr-pendente[arquivoId=a1 pagina=2]\ncorpo\n:::' }),
      contexto
    )

    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'rascunho' }) })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ status: 'rascunho' }))
  })

  it('markdown sem marcador vira concluído', async () => {
    ;(prisma.propostaComercial.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))

    const resposta = await PATCH(requisicao({ conteudoMarkdown: 'texto normal, sem marcador nenhum' }), contexto)

    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'concluido' }) })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ status: 'concluido' }))
  })
})
