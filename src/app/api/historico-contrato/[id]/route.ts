import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { vincularItensDoContrato } from '@/lib/relatorios-clientes/vincular-itens'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { HISTORICO_NAO_ENCONTRADO as NAO_ENCONTRADO, carregarHistoricoComAcesso as carregarComAcesso } from '../carregar'
import {
  ROTULOS_HISTORICO,
  SELECT_HISTORICO,
  esquemaEdicaoHistorico,
  serializarHistorico,
} from '@/app/api/contratos/esquema'

type Contexto = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaEdicaoHistorico, ROTULOS_HISTORICO)
  if ('erro' in corpo) return corpo.erro

  try {
    const linha = await prisma.historicoContrato.update({ where: { id }, data: corpo.dados, select: SELECT_HISTORICO })
    // Nº da linha pode ter mudado — é referência que os itens do legado citam (igual ao POST).
    await vincularItensDoContrato(prisma, linha.contratoId)
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
