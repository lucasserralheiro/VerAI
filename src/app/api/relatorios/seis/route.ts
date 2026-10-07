import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { clientesDoEscopoWhere } from '@/lib/gerencias/escopo-carteira'

const LIMITE = 1000
const CLIENTE = { select: { id: true, nome: true, siglaLegado: true } } as const

/** SEIs por cliente: os do contrato (cliente, PRODAM, link) e os de cada faturamento. Só linhas com
 *  algum SEI preenchido. Filtro `?clienteId=`. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const filtroCliente: Prisma.ClienteWhereInput = await clientesDoEscopoWhere(autenticado.usuario, request)
  const clienteId = request.nextUrl.searchParams.get('clienteId')
  const doCliente = clienteId ? { clienteId } : {}

  const [contratos, faturamentos] = await Promise.all([
    prisma.contrato.findMany({
      where: {
        cliente: filtroCliente,
        ...doCliente,
        OR: [{ seiCliente: { not: null } }, { seiProdam: { not: null } }, { linkSei: { not: null } }],
      },
      orderBy: [{ cliente: { nome: 'asc' } }, { numeroTermo: 'asc' }],
      take: LIMITE,
      select: { id: true, numeroTermo: true, seiCliente: true, seiProdam: true, linkSei: true, cliente: CLIENTE },
    }),
    prisma.faturamento.findMany({
      where: { cliente: filtroCliente, ...doCliente, sei: { not: null } },
      orderBy: [{ cliente: { nome: 'asc' } }, { competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
      take: LIMITE,
      select: {
        id: true,
        competenciaAno: true,
        competenciaMes: true,
        sei: true,
        contrato: { select: { id: true, numeroTermo: true } },
        cliente: CLIENTE,
      },
    }),
  ])

  return NextResponse.json({ contratos, faturamentos })
}
