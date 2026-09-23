import { NextRequest, NextResponse } from 'next/server'
import { sincronizarIndice } from '@/lib/assistente/indexacao/sincronizar'

export const maxDuration = 60

/** Chamado pelo Cron da Vercel (vercel.json) com `Authorization: Bearer $CRON_SECRET`. Público no
 *  middleware (não há cookie de sessão no cron) — o segredo é a única porta. */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  return NextResponse.json(await sincronizarIndice({ conferirVersao: true, limite: 30 }))
}
