import { NextRequest, NextResponse } from 'next/server'

import { exigirAdminApi } from '@/lib/api/admin'
import { sincronizarFonte } from '@/lib/integracao/espelho'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300

/** POST — "Atualizar agora": puxa todos os recursos escolhidos da fonte, sem esperar webhook. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  const fonte = await prisma.fonteExterna.findUnique({ where: { id: (await params).id } })
  if (!fonte) return NextResponse.json({ error: 'fonte não encontrada' }, { status: 404 })
  return NextResponse.json({ resumo: await sincronizarFonte(fonte) })
}
