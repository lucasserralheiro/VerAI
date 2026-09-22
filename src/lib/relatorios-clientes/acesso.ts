import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthUser, type AuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'

type Resultado = { usuario: AuthUser } | { erro: NextResponse }

export async function exigirUsuario(request: NextRequest): Promise<Resultado> {
  const usuario = await getAuthUser(request)
  if (!usuario) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) }
  return { usuario }
}

/** 403 pronto quando o usuário não tem o cliente liberado; `null` quando pode. Para rotas
 *  `[id]` de subitem, que só sabem o `clienteId` depois de ler o registro. */
export async function verificarAcessoCliente(usuario: AuthUser, clienteId: string): Promise<NextResponse | null> {
  if (await podeVerCliente(usuario, clienteId)) return null
  return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
}

export async function exigirAcessoCliente(request: NextRequest, clienteId: string): Promise<Resultado> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado
  const negado = await verificarAcessoCliente(autenticado.usuario, clienteId)
  return negado ? { erro: negado } : autenticado
}
