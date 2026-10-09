import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { exigirAdminApi } from '@/lib/api/admin'
import { criarWebhook } from '@/lib/api/apps'

const NovoWebhook = z.object({ url: z.string().trim().url(), eventos: z.array(z.string()).max(50) })

/** POST — cadastra um webhook no aplicativo; devolve o segredo de assinatura. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  const corpo = NovoWebhook.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ error: 'informe uma URL válida (http/https)' }, { status: 400 })
  return NextResponse.json(await criarWebhook((await params).id, corpo.data), { status: 201 })
}
