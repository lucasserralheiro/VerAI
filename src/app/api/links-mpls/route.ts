import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { listarLinks } from '@/lib/links-mpls/consultas'

// Tela "Links MPLS" (spec docs/superpowers/specs/2026-09-29-links-mpls-design.md §6.1/§8): relatórios do mês dos
// clientes que o usuário vê (sem contrato identificado, só admin); `?competencia=AAAA-MM` (padrão: a mais recente).
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const competencia = request.nextUrl.searchParams.get('competencia') ?? undefined
  return NextResponse.json(await listarLinks({ competencia, clienteIds: await clienteIdsPermitidos(usuario) }))
}
