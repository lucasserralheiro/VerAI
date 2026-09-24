import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { excluirCliente } from '@/lib/relatorios-clientes/excluir-cliente'
import { lerCorpo, textoObrigatorio, textoOpcional } from '@/lib/relatorios-clientes/validacao'

const SELECAO_CLIENTE = { id: true, nome: true, siglaLegado: true, endereco: true, numero: true, bairro: true } as const

export async function GET(request: NextRequest, { params }: { params: Promise<{ clienteId: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { clienteId } = await params
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: SELECAO_CLIENTE })
  if (!cliente) {
    return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, cliente.id)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  return NextResponse.json(cliente)
}

const esquemaCliente = z.object({
  nome: textoObrigatorio,
  siglaLegado: textoOpcional.transform((sigla) => (sigla ? sigla.toUpperCase() : sigla)),
  endereco: textoOpcional,
  numero: textoOpcional,
  bairro: textoOpcional,
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro

  const corpo = await lerCorpo(request, esquemaCliente)
  if ('erro' in corpo) return corpo.erro

  try {
    const cliente = await prisma.cliente.update({ where: { id: clienteId }, data: corpo.dados, select: SELECAO_CLIENTE })
    return NextResponse.json(cliente)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'já existe cliente com esse nome/sigla' }, { status: 409 })
      }
    }
    throw error
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  // Excluir cliente apaga contratos, faturamento, demandas e arquivos: só admin — a mesma regra de
  // "Gerenciar clientes" (criar cliente também é só admin).
  if (acesso.usuario.role !== 'admin') {
    return NextResponse.json({ error: 'Só administrador pode excluir cliente.' }, { status: 403 })
  }

  try {
    // Regra única (excluir-cliente.ts): a mesma de /api/admin/clientes/[id]. Destrutivo e
    // irreversível — a confirmação fica por conta da tela.
    await excluirCliente(clienteId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Não é possível excluir: ainda há dados vinculados a este cliente.' },
          { status: 409 }
        )
      }
    }
    throw error
  }
}
