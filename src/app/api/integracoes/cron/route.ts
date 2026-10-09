import { NextResponse } from 'next/server'

import { sincronizarTodasAsFontes } from '@/lib/integracao/espelho'

export const maxDuration = 300

/** Cron da Vercel (vercel.json), `Authorization: Bearer $CRON_SECRET`: passada completa de todas as fontes
 *  externas uma vez por dia, além dos webhooks e da passada de 15 min na lista de clientes. */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  return NextResponse.json(await sincronizarTodasAsFontes())
}
