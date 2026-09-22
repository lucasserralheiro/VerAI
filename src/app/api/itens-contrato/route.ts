import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
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
  const where: Prisma.ItemContratoWhereInput = q
    ? {
        contratoId: null,
        OR: [
          { contratoTextoLegado: { contains: q, mode: 'insensitive' } },
          { descricao: { contains: q, mode: 'insensitive' } },
        ],
      }
    : { contratoId: null }

  const itens = await prisma.itemContrato.findMany({
    where,
    orderBy: [{ contratoTextoLegado: 'asc' }, { descricao: 'asc' }],
    take: LIMITE,
    select: SELECT_ITEM,
  })
  return NextResponse.json(itens.map(serializarItem))
}
