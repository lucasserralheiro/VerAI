import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { devAuthEnabled, getImpersonatorId } from '@/lib/dev-auth'

export async function GET(request: NextRequest) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ enabled: false, impersonating: false, users: [] })
  }

  const impersonating = getImpersonatorId(request) !== null
  const usuarioAtual = await getAuthUser(request)
  const podeVerLista = usuarioAtual?.role === 'admin' && !impersonating

  const users = podeVerLista
    ? await prisma.usuario.findMany({
        where: { role: { in: ['uploader', 'responsavel'] } },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true, email: true, role: true },
      })
    : []

  return NextResponse.json({ enabled: true, impersonating, users })
}
