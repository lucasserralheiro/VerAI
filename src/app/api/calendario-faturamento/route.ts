import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { calendarioDoAno } from '@/lib/calendario/consultas'

// Calendário de faturamento do ano (spec 2026-09-29-calendario-faturamento §7): qualquer usuário logado. `?ano=`
// (padrão: o ano atual, ou o mais recente que houver).
export async function GET(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const ano = Number(request.nextUrl.searchParams.get('ano')) || undefined
  return NextResponse.json(await calendarioDoAno(ano))
}
