import { NextRequest, NextResponse } from 'next/server'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { podeEditarCliente } from '@/lib/visibilidade'
import { gerenciaDoCliente } from '@/lib/gerencias/servico'

type Contexto = { params: Promise<{ clienteId: string }> }

export async function GET(request: NextRequest, { params }: Contexto) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { clienteId } = await params
  const [gerencia, podeEditar] = await Promise.all([
    gerenciaDoCliente(clienteId),
    podeEditarCliente(autenticado.usuario, clienteId),
  ])
  return NextResponse.json({ gerencia, podeEditar })
}
