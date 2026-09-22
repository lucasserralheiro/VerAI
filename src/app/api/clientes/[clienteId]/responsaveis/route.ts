import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { esquemaResponsavel } from '@/app/api/responsaveis/esquema'

type Contexto = { params: Promise<{ clienteId: string }> }

async function clienteExiste(clienteId: string) {
  return (await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })) !== null
}

export async function GET(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) {
    return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  }

  const responsaveis = await prisma.responsavelCliente.findMany({
    where: { clienteId },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, area: true, email: true, telefone: true, celular: true },
  })
  return NextResponse.json(responsaveis)
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) {
    return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  }

  const corpo = await lerCorpo(request, esquemaResponsavel)
  if ('erro' in corpo) return corpo.erro

  const responsavel = await prisma.responsavelCliente.create({
    data: { clienteId, ...corpo.dados },
    select: { id: true, nome: true, area: true, email: true, telefone: true, celular: true },
  })
  return NextResponse.json(responsavel, { status: 201 })
}
