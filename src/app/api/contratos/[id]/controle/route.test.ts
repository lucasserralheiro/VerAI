/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/app/api/contratos/carregar', () => ({ carregarContratoComAcesso: jest.fn() }))
jest.mock('@/lib/controles-contratos/consultas', () => ({ controleDoContrato: jest.fn() }))

import { carregarContratoComAcesso } from '@/app/api/contratos/carregar'
import { controleDoContrato } from '@/lib/controles-contratos/consultas'
import { GET } from './route'

const pedido = () => new NextRequest('http://localhost/api/contratos/k1/controle')
const ctx = { params: Promise.resolve({ id: 'k1' }) }

it('repassa a recusa do acesso (401/403/404 do contrato)', async () => {
  ;(carregarContratoComAcesso as jest.Mock).mockResolvedValue({ erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) })
  expect((await GET(pedido(), ctx)).status).toBe(403)
})

it('404 sem controle; 200 com o controle vigente', async () => {
  ;(carregarContratoComAcesso as jest.Mock).mockResolvedValue({ usuario: {}, contrato: { id: 'k1', clienteId: 'c1' } })
  ;(controleDoContrato as jest.Mock).mockResolvedValueOnce(null)
  expect((await GET(pedido(), ctx)).status).toBe(404)
  ;(controleDoContrato as jest.Mock).mockResolvedValueOnce({ controle: { mes: '2026-08' }, linhas: [] })
  await expect((await GET(pedido(), ctx)).json()).resolves.toEqual({ controle: { mes: '2026-08' }, linhas: [] })
  expect(controleDoContrato).toHaveBeenLastCalledWith('k1')
})
