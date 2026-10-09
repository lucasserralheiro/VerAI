import { NextRequest, NextResponse } from 'next/server'

import { exigirAdminApi } from '@/lib/api/admin'
import { descobrirFonte } from '@/lib/integracao/fontes'
import { prisma } from '@/lib/prisma'

/** POST — pergunta de novo à fonte (com a chave guardada) o que ela libera para o VerAI. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  const fonte = await prisma.fonteExterna.findUnique({ where: { id: (await params).id }, select: { url: true, chave: true } })
  if (!fonte) return NextResponse.json({ ok: false, erro: 'fonte não encontrada' }, { status: 404 })
  return NextResponse.json(await descobrirFonte(fonte.url, fonte.chave))
}
