import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'

export const DEMANDA_NAO_ENCONTRADA = 'demanda não encontrada'

/** Autentica, acha a demanda e checa acesso pelo cliente dela (401 → 404 → 403). */
export async function carregarDemandaComAcesso(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const demanda = await prisma.demanda.findUnique({ where: { id }, select: { id: true, clienteId: true } })
  if (!demanda) return { erro: NextResponse.json({ error: DEMANDA_NAO_ENCONTRADA }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, demanda.clienteId)
  return negado ? { erro: negado } : { usuario: autenticado.usuario, demanda }
}
