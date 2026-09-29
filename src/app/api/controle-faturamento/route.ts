import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { listarControles } from '@/lib/controles-contratos/consultas'

// Tela "Controle de faturamento" (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md §6.2):
// só os clientes que o usuário vê; `?mes=AAAA-MM` escolhe o mês do controle (padrão: o mais recente).
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const mes = request.nextUrl.searchParams.get('mes') ?? undefined
  return NextResponse.json(await listarControles({ mes, clienteIds: await clienteIdsPermitidos(usuario) }))
}
