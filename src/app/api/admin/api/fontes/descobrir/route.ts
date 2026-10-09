import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { exigirAdminApi } from '@/lib/api/admin'
import { descobrirFonte } from '@/lib/integracao/fontes'

const Pedido = z.object({ url: z.string().trim().url(), chave: z.string().trim().min(8) })

/** POST { url, chave } — testa a fonte e lista o que a chave pode ler, antes de cadastrar. */
export async function POST(request: NextRequest) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  const corpo = Pedido.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ ok: false, erro: 'informe endereço e chave' })
  return NextResponse.json(await descobrirFonte(corpo.data.url, corpo.data.chave))
}
