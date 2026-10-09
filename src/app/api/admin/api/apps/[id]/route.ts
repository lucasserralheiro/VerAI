import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { exigirAdminApi } from '@/lib/api/admin'
import { atualizarApp, excluirApp } from '@/lib/api/apps'

const Alteracao = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  descricao: z.string().max(300).nullable().optional(),
  ativo: z.boolean().optional(),
  escopos: z.array(z.string()).max(50).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  const corpo = Alteracao.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })
  await atualizarApp((await params).id, corpo.data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  await excluirApp((await params).id)
  return NextResponse.json({ ok: true })
}
