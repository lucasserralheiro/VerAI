import { NextRequest, NextResponse } from 'next/server'
import { sincronizarIpcFipe } from '@/lib/reajuste/indice'

export const maxDuration = 60

/** Cron da Vercel (vercel.json), `Authorization: Bearer $CRON_SECRET`. Público no middleware — o
 *  segredo é a única porta. Erro da fonte sai no log da Vercel (spec §4). */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  const resultado = await sincronizarIpcFipe()
  if (resultado.divergentes.length > 0) console.warn('[reajuste] IPC-Fipe divergente', resultado.divergentes)
  return NextResponse.json(resultado)
}
