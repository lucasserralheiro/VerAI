import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const destinoClienteId = body?.destinoClienteId

  if (typeof destinoClienteId !== 'string' || !destinoClienteId) {
    return NextResponse.json({ error: '"destinoClienteId" é obrigatório' }, { status: 400 })
  }
  if (destinoClienteId === id) {
    return NextResponse.json({ error: 'cliente de origem e destino não podem ser o mesmo' }, { status: 400 })
  }

  const [origem, destino] = await Promise.all([
    prisma.cliente.findUnique({ where: { id } }),
    prisma.cliente.findUnique({ where: { id: destinoClienteId } }),
  ])
  if (!origem || !destino) {
    return NextResponse.json({ error: 'cliente de origem ou destino não encontrado' }, { status: 404 })
  }

  try {
    await prisma.$transaction([
      prisma.documento.updateMany({ where: { clienteId: id }, data: { clienteId: destinoClienteId } }),
      prisma.analiseConsolidada.updateMany({ where: { clienteId: id }, data: { clienteId: destinoClienteId } }),
      prisma.analiseEvolucao.updateMany({ where: { clienteId: id }, data: { clienteId: destinoClienteId } }),
      prisma.cliente.delete({ where: { id } }),
    ])
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error:
            'o destino já tem uma análise consolidada/evolução na mesma competência que colide com a origem — resolva manualmente (apague uma das duas) antes de mesclar',
        },
        { status: 409 }
      )
    }
    throw error
  }

  return NextResponse.json({ ok: true })
}
