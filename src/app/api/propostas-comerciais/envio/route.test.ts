/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { ehEnderecoDeEnvio } from '@/lib/propostas/envio'
import { POST } from './route'

const pedido = (corpo: unknown) =>
  new NextRequest('http://localhost/api/propostas-comerciais/envio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

const R2 = { R2_ACCOUNT_ID: 'conta', R2_BUCKET: 'verai-documentos', R2_ACCESS_KEY_ID: 'id', R2_SECRET_ACCESS_KEY: 'segredo' }

describe('POST /api/propostas-comerciais/envio', () => {
  const envOriginal = { ...process.env }

  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(process.env, R2)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'user' })
  })

  afterEach(() => {
    process.env = { ...envOriginal }
  })

  it('sem login devolve 401', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)

    const resposta = await POST(pedido({ nome: 'proposta.pdf', tamanhoBytes: 1000 }))

    expect(resposta.status).toBe(401)
  })

  it('devolve o link de PUT no R2, o endereço temporário e o tipo a mandar', async () => {
    const resposta = await POST(pedido({ nome: 'Proposta Final.PDF', tamanhoBytes: 6_000_000 }))

    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()
    expect(ehEnderecoDeEnvio(corpo.endereco)).toBe(true)
    expect(corpo.endereco).toMatch(/\.pdf$/)
    expect(corpo.contentType).toBe('application/pdf')
    const url = new URL(corpo.url)
    expect(`${url.origin}${url.pathname}`).toBe(
      `https://conta.r2.cloudflarestorage.com/verai-documentos/${corpo.endereco.slice('r2:'.length)}`
    )
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
  })

  it('formato que a conversão não aceita devolve 400', async () => {
    const resposta = await POST(pedido({ nome: 'malware.exe', tamanhoBytes: 1000 }))

    expect(resposta.status).toBe(400)
  })

  it.each([0, -1, 1.5, '1000', undefined])('tamanho %p devolve 400', async (tamanhoBytes) => {
    const resposta = await POST(pedido({ nome: 'proposta.pdf', tamanhoBytes }))

    expect(resposta.status).toBe(400)
  })

  it('acima de 50 MB devolve 400', async () => {
    const resposta = await POST(pedido({ nome: 'proposta.pdf', tamanhoBytes: 50 * 1024 * 1024 + 1 }))

    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: expect.stringContaining('50 MB') })
  })

  it('sem R2 configurado devolve 503', async () => {
    delete process.env.R2_SECRET_ACCESS_KEY

    const resposta = await POST(pedido({ nome: 'proposta.pdf', tamanhoBytes: 1000 }))

    expect(resposta.status).toBe(503)
  })
})
