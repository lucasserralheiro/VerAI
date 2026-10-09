import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { z } from 'zod'

import { exigirAdminApi } from '@/lib/api/admin'
import { sincronizarFonte } from '@/lib/integracao/espelho'
import { criarFonte } from '@/lib/integracao/fontes'

const NovaFonte = z.object({
  nome: z.string().trim().min(2).max(80),
  url: z.string().trim().url(),
  chave: z.string().trim().min(8),
  segredoWebhook: z.string().trim().nullish(),
  recursos: z.array(z.string().max(40)).max(50),
})

/** POST — cadastra uma fonte externa e já puxa os recursos escolhidos (depois da resposta). */
export async function POST(request: NextRequest) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  const corpo = NovaFonte.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ error: 'preencha nome, endereço e chave' }, { status: 400 })
  const fonte = await criarFonte(corpo.data)
  after(() => sincronizarFonte(fonte))
  return NextResponse.json({ id: fonte.id, slug: fonte.slug }, { status: 201 })
}
