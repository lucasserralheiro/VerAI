import { NextRequest, NextResponse } from 'next/server'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { documentosVisiveisWhere, podeVerCliente } from '@/lib/visibilidade'

/**
 * Destino dos links curtos `tipo:id` que o assistente escreve (spec 2026-09-25-assistente-base-economica
 * §6): acha o registro, confere a permissão e redireciona para a tela certa.
 */
type Contexto = { params: Promise<{ tipo: string; id: string }> }

async function doCliente(usuario: AuthUser, clienteId: string | null | undefined, caminho: (clienteId: string) => string) {
  return clienteId && (await podeVerCliente(usuario, clienteId)) ? caminho(clienteId) : null
}

/** `null` = inexistente ou sem permissão. */
const DESTINOS: Record<string, (id: string, usuario: AuthUser) => Promise<string | null>> = {
  cliente: async (id, u) => doCliente(u, (await prisma.cliente.findUnique({ where: { id }, select: { id: true } }))?.id, (c) => `/clientes/${c}`),
  contrato: async (id, u) =>
    doCliente(u, (await prisma.contrato.findUnique({ where: { id }, select: { clienteId: true } }))?.clienteId, (c) => `/clientes/${c}/contratos/${id}`),
  faturamento: async (id, u) =>
    doCliente(u, (await prisma.faturamento.findUnique({ where: { id }, select: { clienteId: true } }))?.clienteId, (c) => `/clientes/${c}/faturamentos/${id}`),
  demanda: async (id, u) => doCliente(u, (await prisma.demanda.findUnique({ where: { id }, select: { clienteId: true } }))?.clienteId, () => `/demandas/${id}`),
  documento: async (id, u) =>
    (await prisma.documento.findFirst({ where: { AND: [{ id }, await documentosVisiveisWhere(u)] }, select: { id: true } })) ? `/documentos/${id}` : null,
  proposta: async (id) => ((await prisma.propostaComercial.findUnique({ where: { id }, select: { id: true } })) ? `/propostas-comerciais/${id}` : null),
  confere: async (id) => ((await prisma.confereExecucao.findUnique({ where: { id }, select: { id: true } })) ? `/confere/historico/${id}` : null),
  fornecedor: async (id) => ((await prisma.fornecedor.findUnique({ where: { id }, select: { id: true } })) ? `/fornecedores/${id}` : null),
}

export async function GET(request: NextRequest, { params }: Contexto) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { tipo, id } = await params
  const destino = Object.hasOwn(DESTINOS, tipo) ? await DESTINOS[tipo](id, autenticado.usuario) : null
  // Mesma resposta para inexistente e sem permissão: não revela que o registro existe.
  if (!destino) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  return NextResponse.redirect(new URL(destino, request.url))
}
