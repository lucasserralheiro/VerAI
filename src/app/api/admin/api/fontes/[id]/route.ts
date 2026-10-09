import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { z } from 'zod'

import { exigirAdminApi } from '@/lib/api/admin'
import { sincronizarFonte } from '@/lib/integracao/espelho'
import { atualizarFonte, excluirFonte } from '@/lib/integracao/fontes'

const Alteracao = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  url: z.string().trim().url().optional(),
  chave: z.string().trim().min(8).optional(),
  segredoWebhook: z.string().trim().nullable().optional(),
  recursos: z.array(z.string().max(40)).max(50).optional(),
  ativa: z.boolean().optional(),
})

/** PATCH — altera a fonte. Recurso desmarcado tem a cópia apagada; recurso novo é puxado na hora. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  const corpo = Alteracao.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })
  const fonte = await atualizarFonte((await params).id, corpo.data)
  if (fonte.ativa) after(() => sincronizarFonte(fonte))
  return NextResponse.json({ ok: true })
}

/** DELETE — exclui a fonte e toda a cópia que veio dela. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  await excluirFonte((await params).id)
  return NextResponse.json({ ok: true })
}
