import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { clientesVisiveisWhere } from '@/lib/visibilidade'

/**
 * Escopo de carteira das telas de "Relatórios dos clientes" (lista de clientes, demandas, solicitações,
 * relatórios, documentos, controle do faturamento, fornecedores): `?carteira=<gerênciaId>` restringe aos
 * clientes daquela gerência, `?carteira=sem` aos que ainda não têm carteira, sem parâmetro = todos.
 *
 * NÃO é permissão — todo usuário logado vê todos os clientes (spec 2026-10-02-gerencias §0.1); é só o foco
 * de trabalho. A visibilidade continua vindo de `clientesVisiveisWhere`, e o escopo entra por cima (AND).
 */

export const SEM_CARTEIRA = 'sem'

export function clienteWhereDaCarteira(carteira: string | null | undefined): Prisma.ClienteWhereInput {
  const valor = carteira?.trim()
  if (!valor) return {}
  if (valor === SEM_CARTEIRA) return { carteira: { is: null } }
  return { carteira: { is: { gerenciaId: valor } } }
}

export function carteiraDaRequisicao(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get('carteira')?.trim() || null
}

/** Clientes visíveis ao usuário E dentro da carteira pedida em `?carteira=`. */
export async function clientesDoEscopoWhere(usuario: AuthUser, request: NextRequest): Promise<Prisma.ClienteWhereInput> {
  const visiveis = await clientesVisiveisWhere(usuario)
  const carteira = carteiraDaRequisicao(request)
  if (!carteira) return visiveis
  return { AND: [visiveis, clienteWhereDaCarteira(carteira)] }
}
