import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { contratoForaDoCliente } from '@/app/api/contratos/carregar'
import {
  ANO,
  MES,
  ROTULOS_FATURAMENTO,
  SELECT_FATURAMENTO,
  esquemaNovoFaturamento,
  principalRepetido,
  resumoDasNotas,
  serializarFaturamento,
} from '@/app/api/faturamentos/esquema'

type Contexto = { params: Promise<{ clienteId: string }> }

async function clienteExiste(clienteId: string) {
  return (await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })) !== null
}

function clienteNaoEncontrado() {
  return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
}

/** Filtros `?ano=&mes=&contratoId=` (todos opcionais). */
function lerFiltros(params: URLSearchParams): { where: Prisma.FaturamentoWhereInput } | { erro: NextResponse } {
  const where: Prisma.FaturamentoWhereInput = {}
  for (const [chave, campo, esquema, rotulo] of [
    ['ano', 'competenciaAno', ANO, 'Ano'],
    ['mes', 'competenciaMes', MES, 'Mês'],
  ] as const) {
    const bruto = params.get(chave)
    if (!bruto) continue
    const lido = esquema.safeParse(bruto)
    if (!lido.success) {
      return { erro: NextResponse.json({ error: `${rotulo}: ${lido.error.issues[0].message}` }, { status: 400 }) }
    }
    where[campo] = lido.data
  }
  const contratoId = params.get('contratoId')
  if (contratoId) where.contratoId = contratoId
  return { where }
}

export async function GET(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) return clienteNaoEncontrado()

  const filtros = lerFiltros(request.nextUrl.searchParams)
  if ('erro' in filtros) return filtros.erro

  const faturamentos = await prisma.faturamento.findMany({
    where: { clienteId, ...filtros.where },
    orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }, { createdAt: 'desc' }],
    select: SELECT_FATURAMENTO,
  })
  const resumos = await resumoDasNotas(faturamentos.map((f) => f.id))
  return NextResponse.json(faturamentos.map((f) => serializarFaturamento(f, resumos.get(f.id))))
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) return clienteNaoEncontrado()

  const corpo = await lerCorpo(request, esquemaNovoFaturamento, ROTULOS_FATURAMENTO)
  if ('erro' in corpo) return corpo.erro

  const contratoInvalido = await contratoForaDoCliente(corpo.dados.contratoId, clienteId)
  if (contratoInvalido) return contratoInvalido

  const repetido = await principalRepetido(corpo.dados)
  if (repetido) return repetido

  const faturamento = await prisma.faturamento.create({ data: { clienteId, ...corpo.dados }, select: SELECT_FATURAMENTO })
  return NextResponse.json(serializarFaturamento(faturamento), { status: 201 })
}
