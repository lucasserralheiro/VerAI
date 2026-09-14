import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarSessao, AUTH_COOKIE_NAME, type Role } from '@/lib/auth'
import { devAuthEnabled } from '@/lib/dev-auth'

/**
 * Confere o token digitado na tela de login contra DEV_AUTH_TOKEN.
 * O valor fica só no servidor (sem prefixo NEXT_PUBLIC_), então nunca vai
 * parar no bundle do navegador. Sem token configurado, ninguém entra.
 * A comparação é sobre o hash pra ter o mesmo tamanho dos dois lados e não
 * vazar nada pelo tempo de resposta.
 */
function tokenValido(tokenInformado: unknown): boolean {
  const esperado = process.env.DEV_AUTH_TOKEN ?? ''
  if (!esperado || typeof tokenInformado !== 'string' || !tokenInformado) return false
  const hash = (valor: string) => createHash('sha256').update(valor).digest()
  return timingSafeEqual(hash(tokenInformado), hash(esperado))
}

export async function POST(request: NextRequest) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!tokenValido(body?.token)) {
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
