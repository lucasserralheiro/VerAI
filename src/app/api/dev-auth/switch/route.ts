import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, criarSessao, AUTH_COOKIE_NAME, type Role } from '@/lib/auth'
import { devAuthEnabled, getImpersonatorId, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'

export async function POST(request: NextRequest) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: 'recurso desativado' }, { status: 403 })
  }

  const usuarioAtual = await getAuthUser(request)
  if (!usuarioAtual || usuarioAtual.role !== 'admin') {
    return NextResponse.json({ error: 'só o admin pode simular outro usuário' }, { status: 403 })
  }

  if (getImpersonatorId(request)) {
    return NextResponse.json(
      { error: 'já está simulando um usuário — volte para admin antes de trocar' },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const userId = body?.userId
  if (typeof userId !== 'string') {
    return NextResponse.json({ error: '"userId" é obrigatório' }, { status: 400 })
  }

  const alvo = await prisma.usuario.findUnique({ where: { id: userId } })
  if (!alvo) {
    return NextResponse.json({ error: 'usuário não encontrado' }, { status: 404 })
  }

  const sessionToken = await criarSessao({ id: alvo.id, role: alvo.role as Role })
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 8,
  }

  const response = NextResponse.json({
    id: alvo.id,
    nome: alvo.nome,
    email: alvo.email,
    role: alvo.role,
  })
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, cookieOpts)
  response.cookies.set(IMPERSONATOR_COOKIE_NAME, usuarioAtual.id, cookieOpts)
  return response
}
