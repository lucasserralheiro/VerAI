/** @jest-environment node */
jest.mock('@vercel/blob', () => ({ put: jest.fn(), del: jest.fn(), list: jest.fn() }))
jest.mock('./r2', () => ({
  ...jest.requireActual('./r2'),
  getR2: jest.fn(),
  deleteR2: jest.fn(async () => {}),
}))

import { del } from '@vercel/blob'
import { deleteR2, getR2 } from './r2'
import { abrirUpload, deleteUpload, getUpload } from './storage'

// Endereço `r2:<chave>` (arquivos da biblioteca do SharePoint, spec sharepoint-lugar-certo §11) é lido
// e apagado no Cloudflare R2; URL https continua no Vercel Blob.

const fetchOriginal = global.fetch
beforeEach(() => jest.clearAllMocks())
afterEach(() => {
  global.fetch = fetchOriginal
})

it('getUpload lê do R2 quando o endereço é r2:', async () => {
  ;(getR2 as jest.Mock).mockResolvedValue(new Response('%PDF', { status: 200 }))
  expect((await getUpload('r2:clientes/c1/a1/TC 1.pdf')).toString()).toBe('%PDF')
  expect(getR2).toHaveBeenCalledWith('clientes/c1/a1/TC 1.pdf')
})

it('getUpload do R2 com erro vira exceção com o status', async () => {
  ;(getR2 as jest.Mock).mockResolvedValue(new Response(null, { status: 403 }))
  await expect(getUpload('r2:x.pdf')).rejects.toThrow(/403/)
})

it('abrirUpload devolve a resposta em streaming, do R2 ou do Blob', async () => {
  const doR2 = new Response('r2', { status: 200 })
  ;(getR2 as jest.Mock).mockResolvedValue(doR2)
  expect(await abrirUpload('r2:x.pdf')).toBe(doR2)
  const doBlob = new Response('blob', { status: 200 })
  global.fetch = jest.fn(async () => doBlob) as unknown as typeof fetch
  expect(await abrirUpload('https://abc.public.blob.vercel-storage.com/x.pdf')).toBe(doBlob)
})

it('deleteUpload apaga no R2 ou no Blob conforme o endereço', async () => {
  await deleteUpload('r2:clientes/c1/a1/x.pdf')
  expect(deleteR2).toHaveBeenCalledWith('clientes/c1/a1/x.pdf')
  expect(del).not.toHaveBeenCalled()
  await deleteUpload('https://abc.public.blob.vercel-storage.com/x.pdf')
  expect(del).toHaveBeenCalledWith('https://abc.public.blob.vercel-storage.com/x.pdf')
})
