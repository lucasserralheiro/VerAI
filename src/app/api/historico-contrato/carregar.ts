import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente, type ModoAcesso } from '@/lib/relatorios-clientes/acesso'

export const HISTORICO_NAO_ENCONTRADO = 'linha do histórico não encontrada'

/** Autentica, acha a linha e checa acesso pelo cliente do contrato dela (401 → 404 → 403). */
export async function carregarHistoricoComAcesso(request: NextRequest, id: string, modo: ModoAcesso = 'ver') {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const linha = await prisma.historicoContrato.findUnique({
    where: { id },
    select: { id: true, tipo: true, numero: true, proposta: true, contrato: { select: { clienteId: true } } },
  })
  if (!linha) return { erro: NextResponse.json({ error: HISTORICO_NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, linha.contrato.clienteId, modo)
  return negado ? { erro: negado } : { linha, usuario: autenticado.usuario }
}
