import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { DEMANDA_NAO_ENCONTRADA, carregarDemandaComAcesso } from '../carregar'
import { ROTULOS_DEMANDA, SELECT_DEMANDA, SELECT_TRAMITE, esquemaEdicaoDemanda, sugestoesTramite } from '../esquema'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarDemandaComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const [demanda, tramites, sugestoes] = await Promise.all([
    prisma.demanda.findUnique({ where: { id }, select: SELECT_DEMANDA }),
    prisma.tramiteDemanda.findMany({
      where: { demandaId: id },
      orderBy: [{ data: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      select: SELECT_TRAMITE,
    }),
    sugestoesTramite(),
  ])
  if (!demanda) return NextResponse.json({ error: DEMANDA_NAO_ENCONTRADA }, { status: 404 })

  return NextResponse.json({ ...demanda, tramites, sugestoes })
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarDemandaComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaEdicaoDemanda, ROTULOS_DEMANDA)
  if ('erro' in corpo) return corpo.erro

  // Trocar de cliente: o usuário tem que ver o cliente novo também. E a troca é justamente a
  // correção de uma demanda que o import atribuiu à SMS — a nota de importação deixa de valer.
  const trocaCliente = corpo.dados.clienteId !== undefined && corpo.dados.clienteId !== carregado.demanda.clienteId
  if (trocaCliente) {
    const negado = await verificarAcessoCliente(carregado.usuario, corpo.dados.clienteId!)
    if (negado) return negado
  }

  try {
    const demanda = await prisma.demanda.update({
      where: { id },
      data: trocaCliente ? { ...corpo.dados, notaImportacao: null } : corpo.dados,
      select: SELECT_DEMANDA,
    })
    return NextResponse.json(demanda)
  } catch (erro) {
    return respostaErroPrisma(erro, DEMANDA_NAO_ENCONTRADA)
  }
}
