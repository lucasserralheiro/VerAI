import { NextRequest, NextResponse } from 'next/server'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { candidatosDaEquipe, vinculosDoUsuario } from '@/lib/gerencias/servico'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Contexto) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { usuario } = autenticado
  const { id } = await params
  if (usuario.role !== 'admin') {
    const vinculos = await vinculosDoUsuario(usuario.id)
    if (!vinculos.some((v) => v.gerenciaId === id && v.papel === 'manager')) {
      return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
    }
  }
  return NextResponse.json(await candidatosDaEquipe(id))
}
