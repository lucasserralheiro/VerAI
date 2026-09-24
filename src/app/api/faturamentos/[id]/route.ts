import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
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
  principalRepetido,
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

  // Um principal por contrato + competência: confere com o estado FINAL (o que veio + o que já está gravado).
  const atual = await prisma.faturamento.findUnique({
    where: { id },
    select: { contratoId: true, competenciaAno: true, competenciaMes: true, complementar: true, situacao: true },
  })
  if (atual) {
    const repetido = await principalRepetido({
      contratoId: corpo.dados.contratoId ?? atual.contratoId,
      competenciaAno: corpo.dados.competenciaAno ?? atual.competenciaAno,
      competenciaMes: corpo.dados.competenciaMes ?? atual.competenciaMes,
      complementar: corpo.dados.complementar === undefined ? atual.complementar : corpo.dados.complementar,
      situacao: corpo.dados.situacao === undefined ? atual.situacao : corpo.dados.situacao,
      ignorarId: id,
    })
    if (repetido) return repetido
  }

  try {
    const faturamento = await prisma.faturamento.update({ where: { id }, data: corpo.dados, select: SELECT_FATURAMENTO })
    const resumos = await resumoDasNotas([id])
    return NextResponse.json(serializarFaturamento(faturamento, resumos.get(id)))
  } catch (erro) {
    return respostaErroPrisma(erro, FATURAMENTO_NAO_ENCONTRADO)
  }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarFaturamentoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  try {
    await prisma.faturamento.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
      if (erro.code === 'P2025') return NextResponse.json({ error: FATURAMENTO_NAO_ENCONTRADO }, { status: 404 })
      if (erro.code === 'P2003') {
        return NextResponse.json({ error: 'Não é possível excluir: há notas fiscais vinculadas a este faturamento.' }, { status: 409 })
      }
    }
    throw erro
  }
}
