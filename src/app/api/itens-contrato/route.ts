import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { podeVerItensSemContrato } from '@/app/api/contratos/carregar'
import { SELECT_ITEM, serializarItem } from '@/app/api/contratos/esquema'

const LIMITE = 100

/** `?semContrato=1&q=` — itens importados do GRC-1 sem vínculo com contrato (design doc §3.6),
 *  pra reconciliação na tela do contrato ("Vincular itens importados"). */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const params = request.nextUrl.searchParams
  if (params.get('semContrato') !== '1') {
    return NextResponse.json({ error: 'use ?semContrato=1' }, { status: 400 })
  }
  if (!(await podeVerItensSemContrato(autenticado.usuario))) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const q = params.get('q')?.trim()
  const filtros: Prisma.ItemContratoWhereInput[] = [{ contratoId: null }]
  if (q) {
    filtros.push({
      OR: [
        { contratoTextoLegado: { contains: q, mode: 'insensitive' } },
        { descricao: { contains: q, mode: 'insensitive' } },
      ],
    })
  }
  // `?contratoId=`: só os itens que PODEM ir pra esse contrato — os do mesmo cliente (sigla do
  // legado) ou sem cliente definido. Item de outro cliente nem aparece (e o PATCH recusa).
  const contratoId = params.get('contratoId')
  if (contratoId) {
    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: { clienteId: true, cliente: { select: { siglaLegado: true } } },
    })
    if (!contrato) return NextResponse.json({ error: 'Contrato: não encontrado' }, { status: 400 })
    const negado = await verificarAcessoCliente(autenticado.usuario, contrato.clienteId)
    if (negado) return negado
    const sigla = contrato.cliente.siglaLegado?.trim()
    filtros.push(
      sigla
        ? { OR: [{ clienteSiglaLegado: { equals: sigla, mode: 'insensitive' } }, { clienteSiglaLegado: null }] }
        : { clienteSiglaLegado: null }
    )
  }
  const where: Prisma.ItemContratoWhereInput = filtros.length === 1 ? filtros[0] : { AND: filtros }

  const itens = await prisma.itemContrato.findMany({
    where,
    orderBy: [{ contratoTextoLegado: 'asc' }, { descricao: 'asc' }],
    take: LIMITE,
    select: SELECT_ITEM,
  })
  return NextResponse.json(itens.map(serializarItem))
}
