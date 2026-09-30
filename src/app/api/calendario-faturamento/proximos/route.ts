import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { proximosDoFaturamento } from '@/lib/calendario/consultas'

// Próximos prazos do faturamento (spec 2026-09-29-calendario-faturamento §6–7): `?n=3`.
export async function GET(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const n = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get('n')) || 3))
  return NextResponse.json({ proximos: await proximosDoFaturamento(n) })
}
