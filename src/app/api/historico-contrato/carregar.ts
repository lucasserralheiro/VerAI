import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'

export const HISTORICO_NAO_ENCONTRADO = 'linha do histórico não encontrada'

/** Autentica, acha a linha e checa acesso pelo cliente do contrato dela (401 → 404 → 403). */
export async function carregarHistoricoComAcesso(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const linha = await prisma.historicoContrato.findUnique({
    where: { id },
    select: { id: true, numero: true, proposta: true, contrato: { select: { clienteId: true } } },
  })
  if (!linha) return { erro: NextResponse.json({ error: HISTORICO_NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, linha.contrato.clienteId)
  return negado ? { erro: negado } : { linha }
}
