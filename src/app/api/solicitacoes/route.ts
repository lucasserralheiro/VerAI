import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import {
  ROTULOS_SOLICITACAO,
  SELECT_SOLICITACAO,
  esquemaNovaSolicitacao,
  sugestoesSolicitacao,
} from '@/app/api/demandas/esquema'

const LIMITE = 500

/** Lista cross-cliente (só clientes visíveis). Filtros: `?clienteId=&situacao=&q=`. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const params = request.nextUrl.searchParams
  const filtros: Prisma.SolicitacaoWhereInput[] = [{ cliente: await clientesVisiveisWhere(autenticado.usuario) }]
  const clienteId = params.get('clienteId')
  if (clienteId) filtros.push({ clienteId })
  const situacao = params.get('situacao')
  if (situacao) filtros.push({ situacao })
  const q = params.get('q')?.trim()
  if (q) {
    filtros.push({
      OR: [
        { descricao: { contains: q, mode: 'insensitive' } },
        { numero: { contains: q, mode: 'insensitive' } },
      ],
    })
  }

  const [solicitacoes, sugestoes] = await Promise.all([
    prisma.solicitacao.findMany({
      where: { AND: filtros },
      orderBy: [{ dataAbertura: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: LIMITE,
      select: SELECT_SOLICITACAO,
    }),
    sugestoesSolicitacao(),
  ])
  return NextResponse.json({ solicitacoes, sugestoes })
}

export async function POST(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const corpo = await lerCorpo(request, esquemaNovaSolicitacao, ROTULOS_SOLICITACAO)
  if ('erro' in corpo) return corpo.erro

  const negado = await verificarAcessoCliente(autenticado.usuario, corpo.dados.clienteId)
  if (negado) return negado

  try {
    const solicitacao = await prisma.solicitacao.create({ data: corpo.dados, select: SELECT_SOLICITACAO })
    return NextResponse.json(solicitacao, { status: 201 })
  } catch (erro) {
    return respostaErroPrisma(erro, 'cliente não encontrado')
  }
}
