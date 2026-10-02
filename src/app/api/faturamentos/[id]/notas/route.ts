import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { FATURAMENTO_NAO_ENCONTRADO, carregarFaturamentoComAcesso } from '../../carregar'
import { ROTULOS_NOTA, SELECT_NOTA, esquemaNovaNota, serializarNota } from '../../esquema'

type Contexto = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Contexto) {
  const { id: faturamentoId } = await params
  const carregado = await carregarFaturamentoComAcesso(request, faturamentoId, 'editar')
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaNovaNota, ROTULOS_NOTA)
  if ('erro' in corpo) return corpo.erro

  try {
    const nota = await prisma.notaFiscal.create({ data: { faturamentoId, ...corpo.dados }, select: SELECT_NOTA })
    return NextResponse.json(serializarNota(nota), { status: 201 })
  } catch (erro) {
    return respostaErroPrisma(erro, FATURAMENTO_NAO_ENCONTRADO)
  }
}
