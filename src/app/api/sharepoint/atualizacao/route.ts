import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// Quando os documentos vieram do SharePoint pela última vez (spec
// docs/superpowers/specs/2026-09-28-sharepoint-atualizado-em-design.md). É dado da biblioteca inteira,
// não de um cliente: qualquer usuário logado vê.
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const ultima = await prisma.atualizacaoSharepoint.findFirst({ orderBy: { iniciadaEm: 'desc' }, select: { iniciadaEm: true } })
  return NextResponse.json({ atualizadoEm: ultima?.iniciadaEm.toISOString() ?? null })
}
