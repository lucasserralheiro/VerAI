/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { atualizacaoBiblioteca: { findFirst: jest.fn() } } }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const pedido = () => new NextRequest('http://localhost/api/biblioteca/atualizacao')

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido())).status).toBe(401)
})

it('a passada completa mais recente da biblioteca Documentos', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'uploader' })
  ;(prisma.atualizacaoBiblioteca.findFirst as jest.Mock).mockResolvedValue({ iniciadaEm: new Date('2026-09-29T13:30:00.000Z') })
  await expect((await GET(pedido())).json()).resolves.toEqual({ atualizadoEm: '2026-09-29T13:30:00.000Z' })
  expect(prisma.atualizacaoBiblioteca.findFirst).toHaveBeenCalledWith({
    where: { biblioteca: 'DOCUMENTOS' },
    orderBy: { iniciadaEm: 'desc' },
    select: { iniciadaEm: true },
  })
})
