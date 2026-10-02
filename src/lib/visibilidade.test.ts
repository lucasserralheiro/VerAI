/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { usuario: { findUnique: jest.fn() } } }))
import { prisma } from '@/lib/prisma'
import { podeEditarCliente } from './visibilidade'

const comum = { id: 'u2', nome: 'C', email: 'c@x', role: 'responsavel' as const }
const achar = prisma.usuario.findUnique as jest.Mock
beforeEach(() => jest.clearAllMocks())

describe('podeEditarCliente', () => {
  it('admin edita sem consultar', async () => {
    await expect(podeEditarCliente({ ...comum, role: 'admin' }, 'c1')).resolves.toBe(true)
    expect(achar).not.toHaveBeenCalled()
  })
  it('membro da gerência dona edita', async () => {
    achar.mockResolvedValue({ clientesPermitidos: [], gerencias: [{ gerenciaId: 'g1' }] })
    await expect(podeEditarCliente(comum, 'c1')).resolves.toBe(true)
  })
  it('liberado do jeito antigo edita na transição', async () => {
    achar.mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
    await expect(podeEditarCliente(comum, 'c1')).resolves.toBe(true)
  })
  it('liberado para OUTRO cliente não edita', async () => {
    achar.mockResolvedValue({ clientesPermitidos: [{ id: 'outro' }], gerencias: [] })
    await expect(podeEditarCliente(comum, 'c1')).resolves.toBe(false)
  })
  it('consulta só gerências ativas que têm o cliente', async () => {
    achar.mockResolvedValue(null)
    await podeEditarCliente(comum, 'c1')
    expect(achar.mock.calls[0][0].select.gerencias.where).toEqual({ gerencia: { ativa: true, carteira: { some: { clienteId: 'c1' } } } })
  })
})
