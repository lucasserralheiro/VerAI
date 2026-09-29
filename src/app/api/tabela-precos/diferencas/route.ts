import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { carregarTabela } from '@/lib/tabela-precos/consultas'
import { diferencasEntreVersoes } from '@/lib/tabela-precos/diferencas'

// "O que mudou" entre duas versões da tabela de preços (?de=2026 v3.0&para=2026 v4.0).
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const de = request.nextUrl.searchParams.get('de')
  const para = request.nextUrl.searchParams.get('para')
  if (!de || !para) return NextResponse.json({ error: 'informe as versões ?de= e ?para=' }, { status: 400 })
  const antes = await carregarTabela(de)
  const depois = await carregarTabela(para)
  if (!antes || !depois) return NextResponse.json({ error: 'versão não encontrada' }, { status: 404 })
  return NextResponse.json(diferencasEntreVersoes(antes.itens, depois.itens))
}
