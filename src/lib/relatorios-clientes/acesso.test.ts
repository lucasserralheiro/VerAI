/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findUnique: jest.fn() } },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente, exigirAdmin, exigirUsuario, MOTIVO_SOMENTE_LEITURA, verificarAcessoCliente } from './acesso'

const requisicao = () => new NextRequest('http://localhost/api/qualquer')
const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }

beforeEach(() => jest.clearAllMocks())

describe('exigirUsuario', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const resultado = await exigirUsuario(requisicao())
    if (!('erro' in resultado)) throw new Error('esperava erro')
    expect(resultado.erro.status).toBe(401)
    await expect(resultado.erro.json()).resolves.toEqual({ error: 'não autenticado' })
  })

  it('devolve o usuário autenticado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    await expect(exigirUsuario(requisicao())).resolves.toEqual({ usuario: admin })
  })
})

describe('exigirAcessoCliente', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const resultado = await exigirAcessoCliente(requisicao(), 'c1')
    if (!('erro' in resultado)) throw new Error('esperava erro')
    expect(resultado.erro.status).toBe(401)
  })

  it('403 quando o usuário não tem o cliente liberado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'outro' }] })
    const resultado = await exigirAcessoCliente(requisicao(), 'c1')
    if (!('erro' in resultado)) throw new Error('esperava erro')
    expect(resultado.erro.status).toBe(403)
    await expect(resultado.erro.json()).resolves.toEqual({ error: 'acesso negado' })
  })

  it('ok com admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    await expect(exigirAcessoCliente(requisicao(), 'c1')).resolves.toEqual({ usuario: admin })
  })

  it('ok com usuário que tem o cliente liberado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
    await expect(exigirAcessoCliente(requisicao(), 'c1')).resolves.toEqual({ usuario: comum })
  })
})

describe('verificarAcessoCliente', () => {
  it('null quando pode, 403 quando não pode', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    await expect(verificarAcessoCliente(admin, 'c1')).resolves.toBeNull()
    const negado = await verificarAcessoCliente(comum, 'c1')
    expect(negado?.status).toBe(403)
  })
})

describe('modo editar', () => {
  it('403 com motivo quando vê mas não edita', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
    const resultado = await exigirAcessoCliente(requisicao(), 'c1', 'editar')
    if (!('erro' in resultado)) throw new Error('esperava erro')
    expect(resultado.erro.status).toBe(403)
    await expect(resultado.erro.json()).resolves.toEqual({ error: 'acesso negado', motivo: MOTIVO_SOMENTE_LEITURA })
  })
  it('ok para membro da gerência', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [{ gerenciaId: 'g1' }] })
    await expect(exigirAcessoCliente(requisicao(), 'c1', 'editar')).resolves.toEqual({ usuario: comum })
  })
})

describe('exigirAdmin', () => {
  it('403 para quem não é admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    const r = await exigirAdmin(requisicao())
    if (!('erro' in r)) throw new Error('esperava erro')
    expect(r.erro.status).toBe(403)
  })
  it('ok para admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    await expect(exigirAdmin(requisicao())).resolves.toEqual({ usuario: admin })
  })
})
