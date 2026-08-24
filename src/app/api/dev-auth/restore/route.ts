import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarSessao, AUTH_COOKIE_NAME, type Role } from '@/lib/auth'
import { devAuthEnabled, getImpersonatorId, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'

export async function POST(request: NextRequest) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: 'recurso desativado' }, { status: 403 })
  }

  const adminId = getImpersonatorId(request)
  if (!adminId) {
    return NextResponse.json({ error: 'não há simulação ativa' }, { status: 403 })
  }

  const admin = await prisma.usuario.findUnique({ where: { id: adminId } })
  if (!admin) {
    return NextResponse.json({ error: 'usuário admin original não encontrado' }, { status: 404 })
  }

  const sessionToken = await criarSessao({ id: admin.id, role: admin.role as Role })

  const response = NextResponse.json({
    id: admin.id,
    nome: admin.nome,
    email: admin.email,
    role: admin.role,
  })
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  response.cookies.set(IMPERSONATOR_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return response
}
