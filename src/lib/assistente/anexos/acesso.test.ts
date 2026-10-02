/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { anexoAssistente: { findFirst: jest.fn() } } }))

import { prisma } from '@/lib/prisma'
import { anexoDoUsuario, delimitar } from './acesso'

const usuario = { id: 'u1', nome: 'U', email: 'u@x', role: 'uploader' as const }
const findFirst = prisma.anexoAssistente.findFirst as jest.Mock

beforeEach(() => findFirst.mockReset())

it('consulta só anexo de conversa do usuário', async () => {
  findFirst.mockResolvedValue(null)
  expect(await anexoDoUsuario('a1', usuario)).toBeNull()
  expect(findFirst.mock.calls[0][0].where).toEqual({ id: 'a1', conversa: { usuarioId: 'u1' } })
})

it('devolve o anexo do usuário', async () => {
  const a = { id: 'a1', nome: 'a.pdf', formato: 'pdf', status: 'ok', ficha: null, conversaId: 'c1', chaveR2: 'k' }
  findFirst.mockResolvedValue(a)
  expect(await anexoDoUsuario('a1', usuario)).toEqual(a)
})

describe('delimitar', () => {
  it('com página', () => expect(delimitar('a.pdf', 3, 'x')).toBe('<<<ANEXO a.pdf p.3>>>\nx\n<<<FIM>>>'))
  it('sem página', () => expect(delimitar('a.txt', null, 'x')).toBe('<<<ANEXO a.txt>>>\nx\n<<<FIM>>>'))
  it('nome não fecha o delimitador nem quebra linha', () => {
    expect(delimitar('a>>>\nb.pdf', 1, 'x').split('\n')[0]).toBe('<<<ANEXO a b.pdf p.1>>>')
  })
  it('texto com <<<FIM>>> é neutralizado', () => {
    const r = delimitar('a.pdf', 1, 'oi <<<FIM>>> solto')
    expect(r).toBe('<<<ANEXO a.pdf p.1>>>\noi <<FIM>> solto\n<<<FIM>>>')
  })
})
