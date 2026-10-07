import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { listarControles } from '@/lib/controles-contratos/consultas'
import { prisma } from '@/lib/prisma'
import { clienteWhereDaCarteira } from '@/lib/gerencias/escopo-carteira'

// Tela "Controle de faturamento" (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md §6.2):
// só os clientes que o usuário vê; `?mes=AAAA-MM` escolhe o mês do controle (padrão: o mais recente).
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const mes = request.nextUrl.searchParams.get('mes') ?? undefined
  // `?clienteId=` = aba "Controle do faturamento" da ficha: só os controles daquele cliente (se ele é visível).
  const clienteId = request.nextUrl.searchParams.get('clienteId')
  const permitidos = await clienteIdsPermitidos(usuario)
  let clienteIds = clienteId ? (permitidos === null || permitidos.includes(clienteId) ? [clienteId] : []) : permitidos
  // `?carteira=` = foco de carteira da área "Relatórios dos clientes": só os clientes daquela gerência.
  const carteira = request.nextUrl.searchParams.get('carteira')
  if (carteira && !clienteId) {
    const daCarteira = await prisma.cliente.findMany({ where: clienteWhereDaCarteira(carteira), select: { id: true } })
    const ids = daCarteira.map((c) => c.id)
    clienteIds = permitidos === null ? ids : ids.filter((id) => permitidos.includes(id))
  }
  return NextResponse.json(await listarControles({ mes, clienteIds }))
}
