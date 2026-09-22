import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { ROTULOS_DEMANDA, SELECT_DEMANDA, esquemaNovaDemanda, sugestoesDemanda } from './esquema'

const LIMITE = 500

/** Lista cross-cliente (só clientes visíveis). Filtros: `?clienteId=&situacao=&q=&atribuidaNoImport=1`.
 *  Cada linha traz a posição/responsável/data do último trâmite; a resposta traz `sugestoes`. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const params = request.nextUrl.searchParams
  const filtros: Prisma.DemandaWhereInput[] = [{ cliente: await clientesVisiveisWhere(autenticado.usuario) }]
  const clienteId = params.get('clienteId')
  if (clienteId) filtros.push({ clienteId })
  const situacao = params.get('situacao')
  if (situacao) filtros.push({ situacao })
  const q = params.get('q')?.trim()
  if (q) {
    filtros.push({
      OR: (['assunto', 'documento', 'sei', 'responsavel'] as const).map((campo) => ({
        [campo]: { contains: q, mode: 'insensitive' as const },
      })),
    })
  }
  if (params.get('atribuidaNoImport') === '1') filtros.push({ notaImportacao: { not: null } })

  const [demandas, sugestoes] = await Promise.all([
    prisma.demanda.findMany({
      where: { AND: filtros },
      orderBy: [{ dataAbertura: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: LIMITE,
      select: {
        ...SELECT_DEMANDA,
        tramites: {
          orderBy: [{ data: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
          take: 1,
          select: { posicao: true, responsavelAtual: true, data: true },
        },
      },
    }),
    sugestoesDemanda(),
  ])

  return NextResponse.json({
    demandas: demandas.map(({ tramites, ...demanda }) => ({ ...demanda, ultimoTramite: tramites[0] ?? null })),
    sugestoes,
  })
}

export async function POST(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const corpo = await lerCorpo(request, esquemaNovaDemanda, ROTULOS_DEMANDA)
  if ('erro' in corpo) return corpo.erro

  const negado = await verificarAcessoCliente(autenticado.usuario, corpo.dados.clienteId)
  if (negado) return negado

  try {
    const demanda = await prisma.demanda.create({ data: corpo.dados, select: SELECT_DEMANDA })
    return NextResponse.json(demanda, { status: 201 })
  } catch (erro) {
    // P2003 aqui = cliente inexistente.
    return respostaErroPrisma(erro, 'cliente não encontrado')
  }
}
