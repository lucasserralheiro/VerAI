import { NextRequest, NextResponse } from 'next/server'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { vinculosDoUsuario } from '@/lib/gerencias/servico'

export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  return NextResponse.json(await vinculosDoUsuario(autenticado.usuario.id))
}
