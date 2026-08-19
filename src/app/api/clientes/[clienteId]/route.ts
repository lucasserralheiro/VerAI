import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'

export async function GET(request: NextRequest, { params }: { params: Promise<{ clienteId: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { clienteId } = await params
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true } })
  if (!cliente) {
    return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, cliente.id)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  return NextResponse.json(cliente)
}
