/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    faturamento: { findUnique: jest.fn(), update: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  ...jest.requireActual('@/lib/storage'),
  putUpload: jest.fn(),
  deleteUpload: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { putUpload } from '@/lib/storage'
import { DELETE, POST } from './route'

const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'f1' }) }
const url = 'http://localhost/api/faturamentos/f1/pdf'

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
  ;(prisma.faturamento.findUnique as jest.Mock).mockResolvedValue({ id: 'f1', clienteId: 'c1' })
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
})

describe('somente leitura', () => {
  it('POST 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await POST(new NextRequest(url, { method: 'POST' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(putUpload).not.toHaveBeenCalled()
    expect(prisma.faturamento.update).not.toHaveBeenCalled()
  })

  it('DELETE 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.faturamento.update).not.toHaveBeenCalled()
  })
})
