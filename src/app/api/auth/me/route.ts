import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  return NextResponse.json(usuario)
}
