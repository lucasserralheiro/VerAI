import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { exigirAdminApi } from '@/lib/api/admin'
import { criarApp } from '@/lib/api/apps'

const NovoApp = z.object({ nome: z.string().trim().min(2).max(80), descricao: z.string().max(300).nullish(), escopos: z.array(z.string()).max(50) })

/** POST — cria o aplicativo e devolve a chave INTEIRA (única vez em que ela aparece). */
export async function POST(request: NextRequest) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  const corpo = NovoApp.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ error: 'dê um nome ao aplicativo' }, { status: 400 })
  return NextResponse.json(await criarApp(corpo.data, admin.usuario.nome), { status: 201 })
}
