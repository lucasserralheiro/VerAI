/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/app/api/contratos/carregar', () => ({ carregarContratoComAcesso: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { contrato: { findUnique: jest.fn(async () => ({ id: 'k1', numeroTermo: 'TC 16/CGM/2024' })) } } }))
jest.mock('@/lib/links-mpls/consultas', () => ({ linksDoContrato: jest.fn(), resumoDosLinksDoContrato: jest.fn() }))

import { carregarContratoComAcesso } from '@/app/api/contratos/carregar'
import { linksDoContrato, resumoDosLinksDoContrato } from '@/lib/links-mpls/consultas'
import { GET } from './route'

const ctx = { params: Promise.resolve({ contratoId: 'k1' }) }
const pedido = (q = '') => new NextRequest(`http://localhost/api/links-mpls/contrato/k1${q}`)

it('repassa a recusa do acesso ao contrato', async () => {
  ;(carregarContratoComAcesso as jest.Mock).mockResolvedValue({ erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) })
  expect((await GET(pedido(), ctx)).status).toBe(403)
  expect(linksDoContrato).not.toHaveBeenCalled()
})

it('série e links do mês; resumo=1 para o cartão (404 sem relatório)', async () => {
  ;(carregarContratoComAcesso as jest.Mock).mockResolvedValue({ usuario: {}, contrato: { id: 'k1', clienteId: 'c1' } })
  ;(linksDoContrato as jest.Mock).mockResolvedValue({ serie: [], competencias: ['2026-09'], competencia: '2026-09', relatorios: [] })
  const r = await (await GET(pedido('?competencia=2026-09'), ctx)).json()
  expect(r).toMatchObject({ contrato: { numeroTermo: 'TC 16/CGM/2024' }, competencia: '2026-09' })
  expect(linksDoContrato).toHaveBeenCalledWith('k1', '2026-09')
  ;(resumoDosLinksDoContrato as jest.Mock).mockResolvedValueOnce(null)
  expect((await GET(pedido('?resumo=1'), ctx)).status).toBe(404)
  ;(resumoDosLinksDoContrato as jest.Mock).mockResolvedValueOnce({ competencia: '2026-09', ativos: 12, categorias: ['SOLUCAO'] })
  expect(await (await GET(pedido('?resumo=1'), ctx)).json()).toEqual({ competencia: '2026-09', ativos: 12, categorias: ['SOLUCAO'] })
})
