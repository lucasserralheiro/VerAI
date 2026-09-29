import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { carregarTabela } from '@/lib/tabela-precos/consultas'

// Tabela de preços (spec docs/superpowers/specs/2026-09-29-tabela-de-precos-design.md §7): pública para quem
// está logado — é a tabela publicada no DOC. ~315 itens: busca e filtro ficam no navegador.
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const versao = request.nextUrl.searchParams.get('versao') ?? undefined
  const carregada = await carregarTabela(versao)
  return NextResponse.json(carregada ?? { tabela: null, itens: [] })
}
