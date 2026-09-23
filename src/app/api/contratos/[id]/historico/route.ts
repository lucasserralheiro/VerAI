import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { vincularItensDoContrato } from '@/lib/relatorios-clientes/vincular-itens'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { CONTRATO_NAO_ENCONTRADO, carregarContratoComAcesso } from '../../carregar'
import { ROTULOS_HISTORICO, SELECT_HISTORICO, esquemaNovoHistorico, serializarHistorico } from '../../esquema'

type Contexto = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Contexto) {
  const { id: contratoId } = await params
  const carregado = await carregarContratoComAcesso(request, contratoId)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaNovoHistorico, ROTULOS_HISTORICO)
  if ('erro' in corpo) return corpo.erro

  try {
    const linha = await prisma.historicoContrato.create({
      data: { contratoId, ...corpo.dados },
      select: SELECT_HISTORICO,
    })
    // O número da linha (termo/aditivo) também é referência que os itens do legado citam.
    await vincularItensDoContrato(prisma, contratoId)
    return NextResponse.json(serializarHistorico(linha), { status: 201 })
  } catch (erro) {
    return respostaErroPrisma(erro, CONTRATO_NAO_ENCONTRADO)
  }
}
