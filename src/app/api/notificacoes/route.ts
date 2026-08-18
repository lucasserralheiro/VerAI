import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const notificacoes = await prisma.notificacao.findMany({
    where: { destinatario: usuario.email, canal: 'dashboard' },
    orderBy: { createdAt: 'desc' },
    include: { documento: { select: { nomeArquivo: true } } },
  })

  return NextResponse.json(notificacoes)
}

export async function PATCH(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const id = body?.id
  if (typeof id !== 'string') {
    return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })
  }

  const notificacao = await prisma.notificacao.findUnique({ where: { id } })
  if (!notificacao || notificacao.destinatario !== usuario.email) {
    return NextResponse.json({ error: 'notificação não encontrada' }, { status: 404 })
  }

  const atualizada = await prisma.notificacao.update({ where: { id }, data: { lida: true } })
  return NextResponse.json(atualizada)
}
