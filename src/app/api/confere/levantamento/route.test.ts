/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/confere/cadastro', () => ({ identificarLevantamento: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { identificarLevantamento } from '@/lib/confere/cadastro'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }

function requisicao(campos: Record<string, File | string>) {
  const formData = new FormData()
  for (const [chave, valor] of Object.entries(campos)) formData.append(chave, valor)
  return new NextRequest('http://localhost/api/confere/levantamento', { method: 'POST', body: formData })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await POST(requisicao({ levantamento: new File(['x'], 'l.xlsx') }))).status).toBe(401)
})

it('400 sem a planilha', async () => {
  expect((await POST(requisicao({}))).status).toBe(400)
  expect(identificarLevantamento).not.toHaveBeenCalled()
})

it('devolve a identificação feita com os bytes da planilha', async () => {
  const resposta = { situacao: 'sem-referencia', leitura: { referencia: null, competencia: null } }
  ;(identificarLevantamento as jest.Mock).mockResolvedValue(resposta)
  const r = await POST(requisicao({ levantamento: new File(['conteudo'], 'l.xlsx') }))
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual(resposta)
  const [usuario, bytes] = (identificarLevantamento as jest.Mock).mock.calls[0]
  expect(usuario).toEqual(admin)
  expect(Buffer.from(bytes).toString()).toBe('conteudo')
})
