import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { lerIndiceGravado, sincronizarIpcFipe } from '@/lib/reajuste/indice'
import { FonteIndiceIndisponivel } from '@/lib/reajuste/serie-bcb'

/** Tabela do IPC-Fipe guardada no VerAI (GET) e o botão "Atualizar agora" (POST). */
export async function GET(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  return NextResponse.json(await lerIndiceGravado())
}

export async function POST(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  try {
    return NextResponse.json(await sincronizarIpcFipe())
  } catch (erro) {
    if (erro instanceof FonteIndiceIndisponivel) return NextResponse.json({ error: erro.message }, { status: 502 })
    throw erro
  }
}
