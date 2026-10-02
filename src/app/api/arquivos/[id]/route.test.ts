/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    arquivoCliente: { findFirst: jest.fn(), update: jest.fn() },
    acessoArquivo: { create: jest.fn() },
    documento: { findMany: jest.fn() },
    historicoContrato: { findMany: jest.fn(async () => []) },
    arquivoSharepoint: { findMany: jest.fn(async () => []) },
    propostaComercialArquivo: { findMany: jest.fn(async () => []) },
    usuario: { findUnique: jest.fn() },
  },
}))
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DELETE, GET, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'a1' }) }
const url = 'http://localhost/api/arquivos/a1'
const registro = {
  id: 'a1',
  clienteId: 'c1',
  nome: 'Medição agosto.xlsx',
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  urlBlob: 'https://x.public.blob.vercel-storage.com/clientes/c1/a1/Medicao_agosto.xlsx',
}
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c9' }] })
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(registro)
  ;(prisma.arquivoCliente.update as jest.Mock).mockResolvedValue({ id: 'a1', categoria: 'MEDICAO' })
  ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([])
  global.fetch = jest.fn().mockResolvedValue(
    new Response(new Blob(['xlsx']).stream(), { status: 200, headers: { 'content-length': '4' } })
  ) as jest.Mock
})

describe('acesso (vale pros três métodos)', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(url), contexto)).status).toBe(401)
  })

  it('404 inexistente ou removido', async () => {
    ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(404)
    expect(prisma.arquivoCliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1', removidoEm: null } })
    )
  })

  it('403 arquivo de cliente que o usuário não vê', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)).status).toBe(403)
  })
})

describe('GET /api/arquivos/[id]', () => {
  it('download: attachment com nome ASCII (fallback) + UTF-8, nosniff, e acesso "baixou"', async () => {
    const resposta = await GET(new NextRequest(url), contexto)

    expect(resposta.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(registro.urlBlob)
    expect(resposta.headers.get('Content-Type')).toBe(registro.contentType)
    expect(resposta.headers.get('Content-Disposition')).toBe(
      `attachment; filename="Medicao agosto.xlsx"; filename*=UTF-8''${encodeURIComponent('Medição agosto.xlsx')}`
    )
    expect(resposta.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(prisma.acessoArquivo.create).toHaveBeenCalledWith({ data: { arquivoId: 'a1', usuarioId: 'u1', acao: 'baixou' } })
    expect(Buffer.from(await resposta.arrayBuffer()).toString()).toBe('xlsx')
  })

  it('?modo=inline: inline e acesso "visualizou"', async () => {
    const resposta = await GET(new NextRequest(`${url}?modo=inline`), contexto)
    expect(resposta.headers.get('Content-Disposition')).toMatch(/^inline; /)
    expect(prisma.acessoArquivo.create).toHaveBeenCalledWith({ data: { arquivoId: 'a1', usuarioId: 'u1', acao: 'visualizou' } })
  })

  it('502 quando o storage falha ao ler (fetch rejeita) — sem registrar acesso', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('falhou'))

    const resposta = await GET(new NextRequest(url), contexto)

    expect(resposta.status).toBe(502)
    await expect(resposta.json()).resolves.toEqual({
      error: 'não foi possível ler o arquivo agora — tente de novo',
    })
    expect(prisma.acessoArquivo.create).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith('[arquivos] falha ao ler arquivo do storage', expect.any(Error))
    spy.mockRestore()
  })

  it('502 quando o storage responde com erro — sem registrar acesso', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 404 }))

    const resposta = await GET(new NextRequest(url), contexto)

    expect(resposta.status).toBe(502)
    expect(prisma.acessoArquivo.create).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith('[arquivos] falha ao ler arquivo do storage', expect.any(Error))
    spy.mockRestore()
  })
})

describe('PATCH /api/arquivos/[id]', () => {
  it('400 categoria inválida', async () => {
    expect((await PATCH(patch({ categoria: 'X' }), contexto)).status).toBe(400)
  })

  it('atualiza só a categoria — contrato/competência enviados são ignorados — e devolve com usos', async () => {
    const resposta = await PATCH(patch({ categoria: 'MEDICAO', contratoId: 'k1', competenciaAno: 2026, competenciaMes: 8 }), contexto)

    expect(resposta.status).toBe(200)
    expect(prisma.arquivoCliente.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' }, data: { categoria: 'MEDICAO' } })
    )
    await expect(resposta.json()).resolves.toEqual({ id: 'a1', categoria: 'MEDICAO', usos: [] })
  })

  it('400 sem categoria', async () => {
    const resposta = await PATCH(patch({}), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Categoria: categoria inválida' })
  })
})

describe('DELETE /api/arquivos/[id]', () => {
  it('409 com a lista de usos quando o arquivo está em uso — e não remove', async () => {
    ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([
      { arquivoId: 'a1', clienteId: 'c1', competenciaAno: 2026, competenciaMes: 6 },
    ])
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)

    expect(resposta.status).toBe(409)
    await expect(resposta.json()).resolves.toEqual({
      error: 'arquivo em uso',
      usos: [{ tipo: 'analise-documento', rotulo: 'Análise por IA · Junho/2026', href: '/clientes/c1/2026-06', contrato: null, competencia: { ano: 2026, mes: 6 } }],
    })
    expect(prisma.arquivoCliente.update).not.toHaveBeenCalled()
  })

  it('sem uso: remoção lógica', async () => {
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.arquivoCliente.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { removidoEm: expect.any(Date) } })
  })
})

describe('somente leitura', () => {
  beforeEach(() => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  })

  it('PATCH 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await PATCH(patch({ categoria: 'MEDICAO' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.arquivoCliente.update).not.toHaveBeenCalled()
  })

  it('DELETE 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.arquivoCliente.update).not.toHaveBeenCalled()
  })
})
