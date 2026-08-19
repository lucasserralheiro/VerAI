import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { clientesVisiveisWhere } from '@/lib/visibilidade'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const clientes = await prisma.cliente.findMany({
    where: await clientesVisiveisWhere(usuario),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  })
  return NextResponse.json(clientes)
}
