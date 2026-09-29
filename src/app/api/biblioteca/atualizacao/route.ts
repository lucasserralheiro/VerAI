import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { BIBLIOTECA_DOCUMENTOS } from '@/lib/biblioteca/areas'

// "Atualizado em …" das telas da biblioteca Documentos (spec 2026-09-29-biblioteca-documentos-prodam §5.4).
// Dado da biblioteca inteira, não de um cliente: qualquer usuário logado vê.
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const ultima = await prisma.atualizacaoBiblioteca.findFirst({
    where: { biblioteca: BIBLIOTECA_DOCUMENTOS },
    orderBy: { iniciadaEm: 'desc' },
    select: { iniciadaEm: true },
  })
  return NextResponse.json({ atualizadoEm: ultima?.iniciadaEm.toISOString() ?? null })
}
