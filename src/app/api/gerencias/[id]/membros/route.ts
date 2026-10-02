import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { decidirMudancaNaEquipe, PAPEIS, type PapelGerencia } from '@/lib/gerencias/permissao'
import { comErroGerencia } from '@/lib/gerencias/resposta'
import { gravarMembro, papelNaGerencia, removerMembro, vinculosDoUsuario } from '@/lib/gerencias/servico'

type Contexto = { params: Promise<{ id: string }> }
const esquema = z.object({
  usuarioId: z.string().min(1),
  papel: z.enum(PAPEIS as [PapelGerencia, ...PapelGerencia[]]),
})

async function decidir(request: NextRequest, gerenciaId: string, usuarioId: string, papelNovo: PapelGerencia | null) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado
  const { usuario } = autenticado
  const decisao = decidirMudancaNaEquipe({
    ehAdmin: usuario.role === 'admin',
    vinculos: usuario.role === 'admin' ? [] : await vinculosDoUsuario(usuario.id),
    gerenciaId,
    papelAtual: await papelNaGerencia(gerenciaId, usuarioId),
    papelNovo,
  })
  return decisao.ok ? autenticado : { erro: NextResponse.json({ error: decisao.motivo }, { status: 403 }) }
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const corpo = await lerCorpo(request, esquema, { usuarioId: 'Pessoa', papel: 'Papel' })
  if ('erro' in corpo) return corpo.erro
  const ok = await decidir(request, id, corpo.dados.usuarioId, corpo.dados.papel)
  if ('erro' in ok) return ok.erro
  return comErroGerencia(async () => {
    await gravarMembro(id, corpo.dados.usuarioId, corpo.dados.papel)
    return NextResponse.json({ ok: true })
  })
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const usuarioId = request.nextUrl.searchParams.get('usuarioId')
  if (!usuarioId) return NextResponse.json({ error: 'Pessoa: obrigatório' }, { status: 400 })
  const ok = await decidir(request, id, usuarioId, null)
  if ('erro' in ok) return ok.erro
  return comErroGerencia(async () => {
    await removerMembro(id, usuarioId)
    return NextResponse.json({ ok: true })
  })
}
