/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@vercel/blob/client', () => ({ handleUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { handleUpload } from '@vercel/blob/client'
import { POST } from './route'

const requisicao = () =>
  new NextRequest('http://localhost/api/arquivos/upload-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'blob.generate-client-token', payload: {} }),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
  ;(handleUpload as jest.Mock).mockResolvedValue({ type: 'blob.generate-client-token', clientToken: 't' })
})

describe('POST /api/arquivos/upload-token', () => {
  it('401 sem usuário, sem gerar token', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao())).status).toBe(401)
    expect(handleUpload).not.toHaveBeenCalled()
  })

  it('devolve o que o handleUpload devolve', async () => {
    await expect((await POST(requisicao())).json()).resolves.toEqual({ type: 'blob.generate-client-token', clientToken: 't' })
  })

  it('token só pra caminho temporário, com teto de 50 MB e validade de 1h', async () => {
    await POST(requisicao())
    const { onBeforeGenerateToken } = (handleUpload as jest.Mock).mock.calls[0][0]

    await expect(onBeforeGenerateToken('clientes/c1/x.pdf')).rejects.toThrow('caminho de upload inválido')
    const opcoes = await onBeforeGenerateToken('tmp-arquivos/u-x.pdf')
    expect(opcoes).toMatchObject({ addRandomSuffix: true, maximumSizeInBytes: 50 * 1024 * 1024 })
    expect(opcoes.validUntil).toBeGreaterThan(Date.now() + 59 * 60 * 1000)
  })

  it('erro do handleUpload vira 400', async () => {
    ;(handleUpload as jest.Mock).mockRejectedValue(new Error('caminho de upload inválido'))
    const resposta = await POST(requisicao())
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'caminho de upload inválido' })
  })
})
