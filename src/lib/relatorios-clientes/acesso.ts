import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthUser, type AuthUser } from '@/lib/auth'
import { podeEditarCliente, podeVerCliente } from '@/lib/visibilidade'

type Resultado = { usuario: AuthUser } | { erro: NextResponse }

export async function exigirUsuario(request: NextRequest): Promise<Resultado> {
  const usuario = await getAuthUser(request)
  if (!usuario) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) }
  return { usuario }
}

export type ModoAcesso = 'ver' | 'editar'
export const MOTIVO_SOMENTE_LEITURA = 'Somente leitura: só a equipe da gerência deste cliente edita.'

export async function exigirAdmin(request: NextRequest): Promise<Resultado> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado
  if (autenticado.usuario.role !== 'admin') {
    return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) }
  }
  return autenticado
}

/** 403 pronto quando o usuário não pode `modo` o cliente; `null` quando pode. `'editar'` é obrigatório em todo
 *  método de gravação de cliente (régua em src/app/api/regua-edicao.test.ts). Para rotas `[id]` de subitem,
 *  que só sabem o `clienteId` depois de ler o registro. */
export async function verificarAcessoCliente(
  usuario: AuthUser,
  clienteId: string,
  modo: ModoAcesso = 'ver'
): Promise<NextResponse | null> {
  if (modo === 'editar') {
    if (await podeEditarCliente(usuario, clienteId)) return null
    return NextResponse.json({ error: 'acesso negado', motivo: MOTIVO_SOMENTE_LEITURA }, { status: 403 })
  }
  if (await podeVerCliente(usuario, clienteId)) return null
  return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
}

export async function exigirAcessoCliente(request: NextRequest, clienteId: string, modo: ModoAcesso = 'ver'): Promise<Resultado> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado
  const negado = await verificarAcessoCliente(autenticado.usuario, clienteId, modo)
  return negado ? { erro: negado } : autenticado
}
