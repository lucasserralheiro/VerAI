import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const regras = await prisma.regraNotificacao.findMany({ orderBy: { id: 'desc' } })
  return NextResponse.json(regras)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { criterioTipo, criterioValor, destinatarios } = body ?? {}

  if (
    (criterioTipo !== 'tipoDocumento' && criterioTipo !== 'palavraChaveNome') ||
    typeof criterioValor !== 'string' ||
    !criterioValor ||
    !Array.isArray(destinatarios) ||
    destinatarios.length === 0
  ) {
    return NextResponse.json(
      { error: 'criterioTipo, criterioValor e destinatarios (lista) são obrigatórios' },
      { status: 400 }
    )
  }

  const regra = await prisma.regraNotificacao.create({
    data: { criterioTipo, criterioValor, destinatarios },
  })
  return NextResponse.json(regra, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const id = body?.id
  if (typeof id !== 'string') {
    return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })
  }

  const { criterioTipo, criterioValor, destinatarios } = body
  const regra = await prisma.regraNotificacao.update({
    where: { id },
    data: {
      ...(criterioTipo ? { criterioTipo } : {}),
      ...(criterioValor ? { criterioValor } : {}),
      ...(destinatarios ? { destinatarios } : {}),
    },
  })
  return NextResponse.json(regra)
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })
  }

  await prisma.regraNotificacao.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
