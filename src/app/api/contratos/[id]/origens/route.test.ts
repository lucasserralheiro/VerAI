/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/app/api/contratos/carregar', () => ({ carregarContratoComAcesso: jest.fn() }))
jest.mock('@/lib/valores-contratos/origens', () => ({ origensDoContrato: jest.fn() }))

import { carregarContratoComAcesso } from '@/app/api/contratos/carregar'
import { origensDoContrato } from '@/lib/valores-contratos/origens'
import { GET } from './route'

const pedido = () => new NextRequest('http://localhost/api/contratos/k1/origens')
const ctx = { params: Promise.resolve({ id: 'k1' }) }

it('repassa a recusa do acesso (401/403/404 do contrato)', async () => {
  ;(carregarContratoComAcesso as jest.Mock).mockResolvedValue({ erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) })
  expect((await GET(pedido(), ctx)).status).toBe(403)
  expect(origensDoContrato).not.toHaveBeenCalled()
})

it('devolve as origens do contrato pedido', async () => {
  ;(carregarContratoComAcesso as jest.Mock).mockResolvedValue({ usuario: {}, contrato: { id: 'k1', clienteId: 'c1' } })
  ;(origensDoContrato as jest.Mock).mockResolvedValue({ h1: { valor: 'Preenchido automaticamente: lido do termo' } })
  await expect((await GET(pedido(), ctx)).json()).resolves.toEqual({ h1: { valor: 'Preenchido automaticamente: lido do termo' } })
  expect(origensDoContrato).toHaveBeenCalledWith('k1')
})
