import { NextRequest, NextResponse } from 'next/server'
import { verificarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/login']
const PUBLIC_API_PREFIXES = ['/api/auth/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const sessao = token ? await verificarSessao(token) : null
  const isApi = pathname.startsWith('/api/')

  if (!sessao) {
    if (isApi) {
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
  if (isAdminRoute && sessao.role !== 'admin') {
    if (isApi) {
      return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/clientes', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
