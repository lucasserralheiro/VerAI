/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    contrato: { findUnique: jest.fn() },
    arquivoCliente: { findMany: jest.fn(), aggregate: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/arquivos/servico', () => ({
  ...jest.requireActual('@/lib/arquivos/servico'),
  registrarArquivo: jest.fn(),
  usosDosArquivos: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarArquivo, usosDosArquivos } from '@/lib/arquivos/servico'
import { GET, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = (clienteId = 'c1') => ({ params: Promise.resolve({ clienteId }) })
const base = 'http://localhost/api/clientes/c1/arquivos'
const tmp = 'https://x.public.blob.vercel-storage.com/tmp-arquivos/u-PC_01.pdf'
const post = (corpo: unknown) =>
  new NextRequest(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.arquivoCliente.aggregate as jest.Mock).mockResolvedValue({ _count: { _all: 0 }, _sum: { tamanhoBytes: null } })
  ;(usosDosArquivos as jest.Mock).mockResolvedValue(new Map())
  ;(registrarArquivo as jest.Mock).mockResolvedValue({ arquivo: { id: 'a1' }, duplicado: false })
})

describe('GET /api/clientes/[clienteId]/arquivos', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(base), contexto())).status).toBe(401)
  })

  it('403 sem acesso ao cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await GET(new NextRequest(base), contexto('c9'))).status).toBe(403)
  })

  it('404 cliente inexistente', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(base), contexto())).status).toBe(404)
  })

  it('lista os não removidos, mais recentes primeiro, com usos e resumo', async () => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([{ id: 'a1', nome: 'x.pdf' }])
    ;(usosDosArquivos as jest.Mock).mockResolvedValue(new Map([['a1', [{ tipo: 'analise-documento', rotulo: 'r', href: 'h' }]]]))
    ;(prisma.arquivoCliente.aggregate as jest.Mock).mockResolvedValue({ _count: { _all: 1 }, _sum: { tamanhoBytes: 2048 } })

    const corpo = await (await GET(new NextRequest(base), contexto())).json()

    expect(prisma.arquivoCliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clienteId: 'c1', removidoEm: null }, orderBy: { createdAt: 'desc' } })
    )
    const select = (prisma.arquivoCliente.findMany as jest.Mock).mock.calls[0][0].select
    expect(select.urlBlob).toBeUndefined()
    expect(corpo).toEqual({
      arquivos: [{ id: 'a1', nome: 'x.pdf', usos: [{ tipo: 'analise-documento', rotulo: 'r', href: 'h' }] }],
      resumo: { total: 1, bytes: 2048 },
    })
  })
})

describe('POST /api/clientes/[clienteId]/arquivos', () => {
  const valido = { urlTemporaria: tmp, nome: 'PC 01.pdf', categoria: 'PROPOSTA_COMERCIAL', contratoId: 'k1' }

  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post(valido), contexto())).status).toBe(401)
  })

  it('403 sem acesso', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await POST(post(valido), contexto('c9'))).status).toBe(403)
  })

  it.each([
    [{ ...valido, urlTemporaria: 'https://evil.example.com/tmp-arquivos/x.pdf' }, 'Arquivo: upload inválido'],
    [{ ...valido, categoria: 'QUALQUER' }, 'Categoria: categoria inválida'],
    [{ ...valido, nome: '  ' }, 'Nome: campo obrigatório'],
    [{ ...valido, competenciaAno: 2026 }, 'Competência: informe mês e ano juntos'],
    [{ ...valido, competenciaAno: 2026, competenciaMes: 13 }, 'Mês: deve ser um número inteiro entre 1 e 12'],
  ])('400 com corpo inválido (%#)', async (corpo, mensagem) => {
    const resposta = await POST(post(corpo), contexto())
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: mensagem })
    expect(registrarArquivo).not.toHaveBeenCalled()
  })

  it('400 quando o contrato é de outro cliente', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c2' })
    const resposta = await POST(post(valido), contexto())
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Contrato: não pertence a este cliente' })
  })

  it('201 registra com o usuário como autor', async () => {
    const resposta = await POST(post({ ...valido, competenciaAno: '2026', competenciaMes: '8' }), contexto())

    expect(resposta.status).toBe(201)
    expect(registrarArquivo).toHaveBeenCalledWith({
      clienteId: 'c1',
      urlTemporaria: tmp,
      nome: 'PC 01.pdf',
      categoria: 'PROPOSTA_COMERCIAL',
      contratoId: 'k1',
      competenciaAno: 2026,
      competenciaMes: 8,
      enviadoPorId: 'u1',
    })
    await expect(resposta.json()).resolves.toEqual({ arquivo: { id: 'a1', usos: [] }, duplicado: false })
  })

  it('200 quando o conteúdo já estava no cliente', async () => {
    ;(registrarArquivo as jest.Mock).mockResolvedValue({ arquivo: { id: 'a-velho' }, duplicado: true })
    const resposta = await POST(post({ ...valido, contratoId: '' }), contexto())
    expect(resposta.status).toBe(200)
    expect((registrarArquivo as jest.Mock).mock.calls[0][0].contratoId).toBeNull()
    await expect(resposta.json()).resolves.toMatchObject({ duplicado: true })
  })

  it('502 quando falha ao ler o upload temporário', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(registrarArquivo as jest.Mock).mockRejectedValue(new Error('Falha ao baixar arquivo do storage (404)'))
    const resposta = await POST(post(valido), contexto())
    expect(resposta.status).toBe(502)
    await expect(resposta.json()).resolves.toEqual({ error: 'não foi possível ler o arquivo enviado — envie de novo' })
  })
})
