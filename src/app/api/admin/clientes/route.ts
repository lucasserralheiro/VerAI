import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, createdAt: true },
  })
  return NextResponse.json(clientes)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''

  if (!nome) {
    return NextResponse.json({ error: '"nome" é obrigatório' }, { status: 400 })
  }

  try {
    const cliente = await prisma.cliente.create({
      data: { nome },
      select: { id: true, nome: true, createdAt: true },
    })
    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'já existe um cliente com esse nome' }, { status: 409 })
    }
    throw error
  }
}
