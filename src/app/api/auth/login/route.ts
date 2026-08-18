import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verificarSenha, criarSessao, AUTH_COOKIE_NAME, type Role } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = body?.email
  const senha = body?.senha

  if (typeof email !== 'string' || typeof senha !== 'string') {
    return NextResponse.json({ error: 'email e senha são obrigatórios' }, { status: 400 })
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  if (!usuario || !(await verificarSenha(senha, usuario.senhaHash))) {
    return NextResponse.json({ error: 'credenciais inválidas' }, { status: 401 })
  }

  const token = await criarSessao({ id: usuario.id, role: usuario.role as Role })

  const response = NextResponse.json({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
  })
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return response
}
