import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarSessao, AUTH_COOKIE_NAME, type Role } from '@/lib/auth'
import { devAuthEnabled } from '@/lib/dev-auth'

export async function POST(request: NextRequest) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const token = body?.token

  if (typeof token !== 'string' || token !== process.env.DEV_AUTH_TOKEN) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 })
  }

  const admin = await prisma.usuario.findFirst({ where: { role: 'admin' } })
  if (!admin) {
    return NextResponse.json(
      { error: 'nenhum usuário admin encontrado — rode "npm run dev:seed"' },
      { status: 500 }
    )
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
  return response
}
