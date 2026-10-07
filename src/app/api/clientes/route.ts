import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { clientesDoEscopoWhere } from '@/lib/gerencias/escopo-carteira'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const clientes = await prisma.cliente.findMany({
    where: await clientesDoEscopoWhere(usuario, request),
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      siglaLegado: true,
      carteira: { select: { gerencia: { select: { id: true, nome: true } } } },
    },
  })
  return NextResponse.json(
    clientes.map(({ carteira, ...cliente }) => ({ ...cliente, gerencia: carteira?.gerencia ?? null })),
  )
}
