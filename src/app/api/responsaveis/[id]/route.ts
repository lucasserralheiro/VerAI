import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { esquemaResponsavel } from '../esquema'

type Contexto = { params: Promise<{ id: string }> }

/** Autentica, acha o registro e checa acesso pelo `clienteId` dele (401 → 404 → 403). */
async function carregarComAcesso(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const responsavel = await prisma.responsavelCliente.findUnique({ where: { id }, select: { id: true, clienteId: true } })
  if (!responsavel) {
    return { erro: NextResponse.json({ error: 'responsável não encontrado' }, { status: 404 }) }
  }

  const negado = await verificarAcessoCliente(autenticado.usuario, responsavel.clienteId)
  return negado ? { erro: negado } : { responsavel }
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaResponsavel)
  if ('erro' in corpo) return corpo.erro

  const responsavel = await prisma.responsavelCliente.update({
    where: { id },
    data: corpo.dados,
    select: { id: true, nome: true, area: true, email: true, telefone: true, celular: true },
  })
  return NextResponse.json(responsavel)
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  await prisma.responsavelCliente.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
