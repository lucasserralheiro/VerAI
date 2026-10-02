/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    documento: { create: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({ buildUploadPath: jest.fn(), putUpload: jest.fn() }))
jest.mock('@/lib/extracao', () => ({ extrairConteudo: jest.fn() }))
jest.mock('@/lib/ia/analisar', () => ({ analisarDocumento: jest.fn(), PROMPT_VERSION_ATUAL: 'v' }))
jest.mock('@/lib/notificacao', () => ({ dispararNotificacoes: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }

describe('POST /api/documentos — somente leitura', () => {
  it('403 com motivo para quem vê mas não é da gerência', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
    const form = new FormData()
    form.set('arquivo', new File(['a;b'], 'medicao.csv', { type: 'text/csv' }))
    form.set('clienteId', 'c1')
    form.set('competenciaAno', '2026')
    form.set('competenciaMes', '8')
    const resposta = await POST(new NextRequest('http://localhost/api/documentos', { method: 'POST', body: form }))
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.documento.create).not.toHaveBeenCalled()
  })
})
