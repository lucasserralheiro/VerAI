/** @jest-environment node */
import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findUnique: jest.fn() },
    itemContrato: { findMany: jest.fn(), createMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }

async function planilha(linhas: unknown[][]) {
  const workbook = new ExcelJS.Workbook()
  const aba = workbook.addWorksheet('Itens')
  linhas.forEach((linha) => aba.addRow(linha))
  return new File([await workbook.xlsx.writeBuffer()], 'itens.xlsx')
}

function enviar(arquivo: File | null, confirmar = false) {
  const corpo = new FormData()
  if (arquivo) corpo.set('arquivo', arquivo)
  if (confirmar) corpo.set('confirmar', '1')
  return POST(new NextRequest('http://localhost/api/contratos/k1/itens/importar', { method: 'POST', body: corpo }), {
    params: Promise.resolve({ id: 'k1' }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ id: 'k1', clienteId: 'c1' })
  ;(prisma.itemContrato.findMany as jest.Mock).mockResolvedValue([])
})

describe('POST /api/contratos/[id]/itens/importar', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await enviar(await planilha([['Descrição', 'Valor total']]))).status).toBe(401)
  })

  it('404 quando o contrato não existe', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await enviar(await planilha([['Descrição', 'Valor total']]))).status).toBe(404)
  })

  it('400 sem arquivo ou com extensão inválida', async () => {
    expect((await enviar(null)).status).toBe(400)
    expect((await enviar(new File(['x'], 'itens.pdf'))).status).toBe(400)
  })

  it('sem confirmar: devolve a prévia e não grava', async () => {
    ;(prisma.itemContrato.findMany as jest.Mock).mockResolvedValue([
      { descricao: 'X', quantidade: null, valorUnitario: null, valorTotal: '1' },
      { descricao: 'Y', quantidade: null, valorUnitario: null, valorTotal: '2' },
      { descricao: 'Z', quantidade: null, valorUnitario: null, valorTotal: '3' },
    ])
    const resposta = await enviar(await planilha([['Descrição', 'Valor total'], ['A', 100], ['B', 50.5]]))
    const corpo = await resposta.json()
    expect(corpo).toMatchObject({ confirmado: false, itensExistentes: 3, erros: [] })
    expect(corpo.linhas).toHaveLength(2)
    expect(prisma.itemContrato.createMany).not.toHaveBeenCalled()
  })

  it('confirmar com planilha válida grava tudo no contrato', async () => {
    const resposta = await enviar(await planilha([['Descrição', 'Valor total'], ['A', 100], ['B', 50.5]]), true)
    expect(resposta.status).toBe(201)
    expect(await resposta.json()).toMatchObject({ confirmado: true, criados: 2 })
    expect(prisma.itemContrato.createMany).toHaveBeenCalledWith({
      data: [
        { contratoId: 'k1', descricao: 'A', quantidade: null, valorUnitario: null, valorTotal: '100' },
        { contratoId: 'k1', descricao: 'B', quantidade: null, valorUnitario: null, valorTotal: '50.5' },
      ],
    })
  })

  it('confirmar com qualquer erro não grava nada (tudo ou nada)', async () => {
    const resposta = await enviar(await planilha([['Descrição', 'Valor total'], ['A', 100], ['B', 'xx']]), true)
    const corpo = await resposta.json()
    expect(corpo.confirmado).toBe(false)
    expect(corpo.erros).toHaveLength(1)
    expect(prisma.itemContrato.createMany).not.toHaveBeenCalled()
  })

  it('importar a mesma planilha de novo não duplica: linha igual a item existente é ignorada', async () => {
    ;(prisma.itemContrato.findMany as jest.Mock).mockResolvedValue([
      { descricao: 'A', quantidade: null, valorUnitario: null, valorTotal: '100.00' },
    ])
    const arquivo = await planilha([['Descrição', 'Valor total'], ['a ', 100], ['B', 50.5]])
    const previa = await (await enviar(arquivo)).json()
    expect(previa.repetidas).toEqual([2])

    const resposta = await enviar(await planilha([['Descrição', 'Valor total'], ['a ', 100], ['B', 50.5]]), true)
    expect(await resposta.json()).toMatchObject({ confirmado: true, criados: 1, ignoradas: 1 })
    expect(prisma.itemContrato.createMany).toHaveBeenCalledWith({
      data: [{ contratoId: 'k1', descricao: 'B', quantidade: null, valorUnitario: null, valorTotal: '50.5' }],
    })
  })
})

describe('POST somente leitura', () => {
  it('403 com motivo para quem vê mas não é da gerência', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
    const resposta = await enviar(await planilha([['Descrição', 'Valor total']]), true)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.itemContrato.createMany).not.toHaveBeenCalled()
  })
})
