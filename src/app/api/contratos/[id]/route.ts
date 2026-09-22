import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { saldosDosContratos } from '@/lib/relatorios-clientes/saldos-contratos'
import { CONTRATO_NAO_ENCONTRADO, carregarContratoComAcesso } from '../carregar'
import {
  ROTULOS_CONTRATO,
  SELECT_CONTRATO,
  SELECT_HISTORICO,
  SELECT_ITEM,
  esquemaContrato,
  serializarContrato,
  serializarHistorico,
  serializarItem,
} from '../esquema'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarContratoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const [contrato, historico, itens, saldos] = await Promise.all([
    prisma.contrato.findUnique({ where: { id }, select: SELECT_CONTRATO }),
    prisma.historicoContrato.findMany({
      where: { contratoId: id },
      orderBy: [{ data: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      select: SELECT_HISTORICO,
    }),
    prisma.itemContrato.findMany({ where: { contratoId: id }, orderBy: { createdAt: 'asc' }, select: SELECT_ITEM }),
    saldosDosContratos([id]),
  ])
  if (!contrato) return NextResponse.json({ error: CONTRATO_NAO_ENCONTRADO }, { status: 404 })

  return NextResponse.json({
    ...serializarContrato(contrato, saldos.get(id)!),
    historico: historico.map(serializarHistorico),
    itens: itens.map(serializarItem),
  })
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarContratoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaContrato, ROTULOS_CONTRATO)
  if ('erro' in corpo) return corpo.erro

  try {
    const contrato = await prisma.contrato.update({ where: { id }, data: corpo.dados, select: SELECT_CONTRATO })
    const saldos = await saldosDosContratos([id])
    return NextResponse.json(serializarContrato(contrato, saldos.get(id)!))
  } catch (erro) {
    return respostaErroPrisma(erro, CONTRATO_NAO_ENCONTRADO)
  }
}
