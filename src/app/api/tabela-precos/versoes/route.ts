import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listarVersoes } from '@/lib/tabela-precos/consultas'

// Versões lidas da tabela de preços, a vigente primeiro.
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  return NextResponse.json(await listarVersoes())
}
