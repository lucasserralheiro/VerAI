/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { conversaAssistente: { findUnique: jest.fn(), delete: jest.fn() } } }))
jest.mock('@/lib/assistente/anexos/registrar', () => ({ apagarAnexosDaConversa: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { apagarAnexosDaConversa } from '@/lib/assistente/anexos/registrar'
import { prisma } from '@/lib/prisma'
import { DELETE, GET } from './route'

const params = { params: Promise.resolve({ id: 'c1' }) }
const req = () => new NextRequest('http://localhost/api/assistente/conversas/c1')
beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'U', email: 'u@x', role: 'responsavel' })
})

it('404 para conversa de outro usuário (mesmo sendo admin não vê a dos outros)', async () => {
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', usuarioId: 'u2', titulo: 't', mensagens: [] })
  expect((await GET(req(), params)).status).toBe(404)
  expect((await DELETE(req(), params)).status).toBe(404)
  expect(prisma.conversaAssistente.delete).not.toHaveBeenCalled()
})

it('GET devolve as mensagens em ordem', async () => {
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({
    id: 'c1', usuarioId: 'u1', titulo: 't', mensagens: [
      { id: 'm1', papel: 'usuario', conteudo: 'oi', conferencia: null },
      { id: 'm2', papel: 'assistente', conteudo: 'R$ 5,00', conferencia: { conferidos: [], naoConfirmados: ['R$ 5,00'] } },
    ], anexos: [],
  })
  expect(await (await GET(req(), params)).json()).toEqual({ id: 'c1', titulo: 't', mensagens: [
      { id: 'm1', papel: 'usuario', conteudo: 'oi', naoConfirmados: [] },
      { id: 'm2', papel: 'assistente', conteudo: 'R$ 5,00', naoConfirmados: ['R$ 5,00'] },
    ], anexos: [],
  })
})

it('DELETE apaga a própria', async () => {
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', usuarioId: 'u1', titulo: 't', mensagens: [] })
  expect(await (await DELETE(req(), params)).json()).toEqual({ ok: true })
  expect(prisma.conversaAssistente.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
})

it('DELETE apaga os arquivos dos anexos no R2 antes de apagar a conversa; de outro usuário, não', async () => {
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', usuarioId: 'u1', titulo: 't', mensagens: [] })
  await DELETE(req(), params)
  expect(apagarAnexosDaConversa).toHaveBeenCalledWith('c1')
  expect((apagarAnexosDaConversa as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    (prisma.conversaAssistente.delete as jest.Mock).mock.invocationCallOrder[0]
  )
  jest.clearAllMocks()
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', usuarioId: 'u2', titulo: 't', mensagens: [] })
  await DELETE(req(), params)
  expect(apagarAnexosDaConversa).not.toHaveBeenCalled()
})

it('GET devolve também os anexos da conversa, na ordem em que entraram', async () => {
  const ficha = { tipo: 'proposta', avisos: [] }
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({
    id: 'c1', usuarioId: 'u1', titulo: 't', mensagens: [],
    anexos: [{ id: 'a1', nome: 'proposta.pdf', formato: 'pdf', status: 'ok', paginas: 3, ocr: false, ficha }],
  })
  const corpo = await (await GET(req(), params)).json()
  expect(corpo.anexos).toEqual([{ id: 'a1', nome: 'proposta.pdf', formato: 'pdf', status: 'ok', paginas: 3, ocr: false, ficha }])
  expect((prisma.conversaAssistente.findUnique as jest.Mock).mock.calls[0][0].select.anexos).toEqual({
    orderBy: { createdAt: 'asc' },
    select: { id: true, nome: true, formato: true, status: true, paginas: true, ocr: true, ficha: true },
  })
})
