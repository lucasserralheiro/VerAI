import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { ROTULOS_TRAMITE, SELECT_TRAMITE, esquemaEdicaoTramite } from '@/app/api/demandas/esquema'

type Contexto = { params: Promise<{ id: string }> }

const NAO_ENCONTRADO = 'trâmite não encontrado'

/** Autentica, acha o trâmite e checa acesso pelo cliente da demanda dele (401 → 404 → 403). */
async function carregarComAcesso(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const tramite = await prisma.tramiteDemanda.findUnique({
    where: { id },
    select: { id: true, demanda: { select: { clienteId: true } } },
  })
  if (!tramite) return { erro: NextResponse.json({ error: NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, tramite.demanda.clienteId)
  return negado ? { erro: negado } : { tramite }
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaEdicaoTramite, ROTULOS_TRAMITE)
  if ('erro' in corpo) return corpo.erro

  try {
    const tramite = await prisma.tramiteDemanda.update({ where: { id }, data: corpo.dados, select: SELECT_TRAMITE })
    return NextResponse.json(tramite)
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  try {
    await prisma.tramiteDemanda.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}
