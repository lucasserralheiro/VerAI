import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'

/** Item importado sem contrato não tem cliente pra checar: vê (e reconcilia) quem é admin ou
 *  enxerga ao menos um cliente. */
export async function podeVerItensSemContrato(usuario: AuthUser): Promise<boolean> {
  if (usuario.role === 'admin') return true
  return (await prisma.cliente.count({ where: await clientesVisiveisWhere(usuario) })) > 0
}

export const CONTRATO_NAO_ENCONTRADO = 'contrato não encontrado'

/** Autentica, acha o contrato e checa acesso pelo cliente dele (401 → 404 → 403). Usado pelas
 *  rotas `/api/contratos/[id]/...`. */
export async function carregarContratoComAcesso(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const contrato = await prisma.contrato.findUnique({ where: { id }, select: { id: true, clienteId: true } })
  if (!contrato) return { erro: NextResponse.json({ error: CONTRATO_NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, contrato.clienteId)
  return negado ? { erro: negado } : { usuario: autenticado.usuario, contrato }
}
