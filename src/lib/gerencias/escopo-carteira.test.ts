/** @jest-environment node */
jest.mock('@/lib/visibilidade', () => ({ clientesVisiveisWhere: jest.fn().mockResolvedValue({}) }))

import { NextRequest } from 'next/server'
import { clienteWhereDaCarteira, clientesDoEscopoWhere } from './escopo-carteira'

describe('escopo de carteira', () => {
  it('sem parâmetro não filtra; "sem" pega quem não tem carteira; id pega a gerência', () => {
    expect(clienteWhereDaCarteira(null)).toEqual({})
    expect(clienteWhereDaCarteira(' ')).toEqual({})
    expect(clienteWhereDaCarteira('sem')).toEqual({ carteira: { is: null } })
    expect(clienteWhereDaCarteira('g1')).toEqual({ carteira: { is: { gerenciaId: 'g1' } } })
  })

  it('junta a carteira da URL com a visibilidade do usuário', async () => {
    const usuario = { id: 'u1', nome: 'A', email: 'a@x', role: 'admin' as const }
    await expect(clientesDoEscopoWhere(usuario, new NextRequest('http://x/api?carteira=g1'))).resolves.toEqual({
      AND: [{}, { carteira: { is: { gerenciaId: 'g1' } } }],
    })
    await expect(clientesDoEscopoWhere(usuario, new NextRequest('http://x/api'))).resolves.toEqual({})
  })
})
