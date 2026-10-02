import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { DEMANDA_NAO_ENCONTRADA, carregarDemandaComAcesso } from '../../carregar'
import { ROTULOS_TRAMITE, SELECT_TRAMITE, esquemaNovoTramite } from '../../esquema'

type Contexto = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Contexto) {
  const { id: demandaId } = await params
  const carregado = await carregarDemandaComAcesso(request, demandaId, 'editar')
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaNovoTramite, ROTULOS_TRAMITE)
  if ('erro' in corpo) return corpo.erro

  try {
    const tramite = await prisma.tramiteDemanda.create({ data: { demandaId, ...corpo.dados }, select: SELECT_TRAMITE })
    return NextResponse.json(tramite, { status: 201 })
  } catch (erro) {
    return respostaErroPrisma(erro, DEMANDA_NAO_ENCONTRADA)
  }
}
