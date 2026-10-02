import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente, type ModoAcesso } from '@/lib/relatorios-clientes/acesso'

export const FATURAMENTO_NAO_ENCONTRADO = 'faturamento não encontrado'

/** Autentica, acha o faturamento e checa acesso pelo cliente dele (401 → 404 → 403). */
export async function carregarFaturamentoComAcesso(request: NextRequest, id: string, modo: ModoAcesso = 'ver') {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const faturamento = await prisma.faturamento.findUnique({ where: { id }, select: { id: true, clienteId: true } })
  if (!faturamento) return { erro: NextResponse.json({ error: FATURAMENTO_NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, faturamento.clienteId, modo)
  return negado ? { erro: negado } : { faturamento }
}
