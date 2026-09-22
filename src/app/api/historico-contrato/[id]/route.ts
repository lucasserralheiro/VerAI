import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import {
  ROTULOS_HISTORICO,
  SELECT_HISTORICO,
  esquemaEdicaoHistorico,
  serializarHistorico,
} from '@/app/api/contratos/esquema'

type Contexto = { params: Promise<{ id: string }> }

const NAO_ENCONTRADO = 'linha do histórico não encontrada'

/** Autentica, acha a linha e checa acesso pelo cliente do contrato dela (401 → 404 → 403). */
async function carregarComAcesso(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const linha = await prisma.historicoContrato.findUnique({
    where: { id },
    select: { id: true, contrato: { select: { clienteId: true } } },
  })
  if (!linha) return { erro: NextResponse.json({ error: NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, linha.contrato.clienteId)
  return negado ? { erro: negado } : { linha }
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaEdicaoHistorico, ROTULOS_HISTORICO)
  if ('erro' in corpo) return corpo.erro

  try {
    const linha = await prisma.historicoContrato.update({ where: { id }, data: corpo.dados, select: SELECT_HISTORICO })
    return NextResponse.json(serializarHistorico(linha))
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  try {
    await prisma.historicoContrato.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}
