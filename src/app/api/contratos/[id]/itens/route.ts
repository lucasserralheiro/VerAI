import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { CONTRATO_NAO_ENCONTRADO, carregarContratoComAcesso } from '../../carregar'
import {
  ERRO_VALOR_TOTAL,
  ROTULOS_ITEM,
  SELECT_ITEM,
  esquemaNovoItem,
  serializarItem,
  valorTotalDoItem,
} from '../../esquema'

type Contexto = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Contexto) {
  const { id: contratoId } = await params
  const carregado = await carregarContratoComAcesso(request, contratoId, 'editar')
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaNovoItem, ROTULOS_ITEM)
  if ('erro' in corpo) return corpo.erro

  const valorTotal = valorTotalDoItem(corpo.dados)
  if (!valorTotal) return NextResponse.json({ error: ERRO_VALOR_TOTAL }, { status: 400 })

  try {
    const item = await prisma.itemContrato.create({
      data: { contratoId, ...corpo.dados, valorTotal },
      select: SELECT_ITEM,
    })
    return NextResponse.json(serializarItem(item), { status: 201 })
  } catch (erro) {
    return respostaErroPrisma(erro, CONTRATO_NAO_ENCONTRADO)
  }
}
