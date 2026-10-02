import { NextRequest, NextResponse } from 'next/server'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { podeVerDetalheGerencia } from '@/lib/gerencias/permissao'
import { detalheGerencia, vinculosDoUsuario } from '@/lib/gerencias/servico'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Contexto) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { usuario } = autenticado
  const { id } = await params
  const ehAdmin = usuario.role === 'admin'
  const vinculos = ehAdmin ? [] : await vinculosDoUsuario(usuario.id)
  if (!podeVerDetalheGerencia(ehAdmin, vinculos, id)) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }
  const detalhe = await detalheGerencia(id)
  if (!detalhe) return NextResponse.json({ error: 'Gerência não encontrada.' }, { status: 404 })
  const ehManager = vinculos.some((v) => v.gerenciaId === id && v.papel === 'manager')
  return NextResponse.json({ ...detalhe, podeGerirEquipe: ehAdmin || ehManager, podeNomearManager: ehAdmin })
}
