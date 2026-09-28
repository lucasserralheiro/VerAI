/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/r2', () => ({ getR2: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getR2 } from '@/lib/r2'
import { GET } from './route'

const pedir = (id: string, indice: string, nome: string) =>
  GET(new NextRequest(`http://localhost/api/propostas-comerciais/${id}/imagens/${indice}/${nome}`), {
    params: Promise.resolve({ id, indice, nome }),
  })

describe('GET /api/propostas-comerciais/[id]/imagens/[indice]/[nome] — imagem do PDF guardada no R2', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'user' })
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({ id: 'p1' })
    ;(getR2 as jest.Mock).mockResolvedValue(new Response('PNG', { status: 200, headers: { 'content-length': '3' } }))
  })

  it('sem login devolve 401 e não lê o R2', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)

    const resposta = await pedir('p1', '0', 'pagina-2-imagem-1.png')

    expect(resposta.status).toBe(401)
    expect(getR2).not.toHaveBeenCalled()
  })

  it('entrega a imagem lida do R2, na chave da proposta', async () => {
    const resposta = await pedir('p1', '0', 'pagina-2-imagem-1.png')

    expect(getR2).toHaveBeenCalledWith('propostas-comerciais/p1/0/imagens/pagina-2-imagem-1.png')
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('content-type')).toBe('image/png')
    await expect(resposta.text()).resolves.toBe('PNG')
  })

  it('nome fora do formato das imagens extraídas devolve 404, sem ler o R2', async () => {
    for (const [indice, nome] of [
      ['0', '..%2F..%2Fclientes%2Fc1%2Fx.pdf'],
      ['0', 'contrato.pdf'],
      ['x', 'pagina-1-imagem-1.png'],
    ]) {
      const resposta = await pedir('p1', indice, nome)
      expect(resposta.status).toBe(404)
    }
    expect(getR2).not.toHaveBeenCalled()
  })

  it('proposta que não existe mais devolve 404', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue(null)

    const resposta = await pedir('sumiu', '0', 'pagina-1-imagem-1.png')

    expect(resposta.status).toBe(404)
    expect(getR2).not.toHaveBeenCalled()
  })

  it('imagem que não está no R2 devolve 404', async () => {
    ;(getR2 as jest.Mock).mockResolvedValue(new Response(null, { status: 404 }))

    const resposta = await pedir('p1', '0', 'pagina-1-imagem-1.png')

    expect(resposta.status).toBe(404)
  })
})
