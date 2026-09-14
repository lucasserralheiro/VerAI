/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@vercel/blob/client', () => ({ handleUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { handleUpload } from '@vercel/blob/client'
import { POST } from './route'

const requisicao = (corpo: unknown) =>
  new NextRequest('http://localhost/api/propostas-comerciais/upload-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

/** Isto existe porque uma função serverless da Vercel rejeita (413) qualquer
 *  corpo de requisição acima de 4,5 MB — PDF de proposta real passa disso
 *  com frequência. O navegador pede um token aqui e sobe o arquivo DIRETO
 *  pro Blob, sem passar pela função serverless (ver o comentário em
 *  `../route.ts`). */
describe('POST /api/propostas-comerciais/upload-token', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(handleUpload as jest.Mock).mockResolvedValue({ type: 'blob.generate-client-token', clientToken: 'token-fake' })
  })

  it('sem autenticação devolve 401, sem gerar token nenhum', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)

    const resposta = await POST(requisicao({ type: 'blob.generate-client-token', payload: {} }))

    expect(resposta.status).toBe(401)
    expect(handleUpload).not.toHaveBeenCalled()
  })

  it('autenticado, delega pro handleUpload do Vercel Blob e devolve o resultado dele', async () => {
    const resposta = await POST(requisicao({ type: 'blob.generate-client-token', payload: {} }))

    expect(handleUpload).toHaveBeenCalledTimes(1)
    await expect(resposta.json()).resolves.toEqual({ type: 'blob.generate-client-token', clientToken: 'token-fake' })
  })

  it('o onBeforeGenerateToken passado pro handleUpload limita tipo e tamanho do arquivo', async () => {
    await POST(requisicao({ type: 'blob.generate-client-token', payload: {} }))

    const opcoes = (handleUpload as jest.Mock).mock.calls[0][0]
    const config = await opcoes.onBeforeGenerateToken('tmp-uploads/qualquer.pdf', null, false)

    expect(config.maximumSizeInBytes).toBeGreaterThan(4.5 * 1024 * 1024) // acima do limite que motivou isto
    expect(config.allowedContentTypes.length).toBeGreaterThan(0)
  })

  it('erro do handleUpload (ex.: token inválido) devolve 400 com a mensagem', async () => {
    ;(handleUpload as jest.Mock).mockRejectedValue(new Error('corpo da requisição inválido'))

    const resposta = await POST(requisicao({ type: 'blob.generate-client-token', payload: {} }))

    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ error: 'corpo da requisição inválido' }))
  })
})
