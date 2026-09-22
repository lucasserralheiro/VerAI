import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { contratoForaDoCliente } from '@/app/api/contratos/carregar'
import { FATURAMENTO_NAO_ENCONTRADO, carregarFaturamentoComAcesso } from '../carregar'
import {
  ROTULOS_FATURAMENTO,
  SELECT_FATURAMENTO,
  SELECT_NOTA,
  esquemaEdicaoFaturamento,
  resumoDasNotas,
  serializarFaturamento,
  serializarNota,
} from '../esquema'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarFaturamentoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const [faturamento, notas, resumos] = await Promise.all([
    prisma.faturamento.findUnique({ where: { id }, select: SELECT_FATURAMENTO }),
    prisma.notaFiscal.findMany({
      where: { faturamentoId: id },
      orderBy: [{ dataEmissao: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      select: SELECT_NOTA,
    }),
    resumoDasNotas([id]),
  ])
  if (!faturamento) return NextResponse.json({ error: FATURAMENTO_NAO_ENCONTRADO }, { status: 404 })

  return NextResponse.json({ ...serializarFaturamento(faturamento, resumos.get(id)), notas: notas.map(serializarNota) })
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarFaturamentoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaEdicaoFaturamento, ROTULOS_FATURAMENTO)
  if ('erro' in corpo) return corpo.erro

  if (corpo.dados.contratoId) {
    const contratoInvalido = await contratoForaDoCliente(corpo.dados.contratoId, carregado.faturamento.clienteId)
    if (contratoInvalido) return contratoInvalido
  }

  try {
    const faturamento = await prisma.faturamento.update({ where: { id }, data: corpo.dados, select: SELECT_FATURAMENTO })
    const resumos = await resumoDasNotas([id])
    return NextResponse.json(serializarFaturamento(faturamento, resumos.get(id)))
  } catch (erro) {
    return respostaErroPrisma(erro, FATURAMENTO_NAO_ENCONTRADO)
  }
}
