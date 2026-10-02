import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { exigirAdmin } from '@/lib/relatorios-clientes/acesso'
import { booleanoOpcional, lerCorpo, textoOpcional } from '@/lib/relatorios-clientes/validacao'
import { atualizarGerencia } from '@/lib/gerencias/servico'
import { comErroGerencia, nomeObrigatorio } from '@/lib/gerencias/resposta'

type Contexto = { params: Promise<{ id: string }> }
const esquema = z.object({ nome: nomeObrigatorio.optional(), sigla: textoOpcional, ativa: booleanoOpcional })

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const admin = await exigirAdmin(request)
  if ('erro' in admin) return admin.erro
  const { id } = await params
  const corpo = await lerCorpo(request, esquema, { nome: 'Nome', sigla: 'Sigla', ativa: 'Ativa' })
  if ('erro' in corpo) return corpo.erro
  const { nome, sigla, ativa } = corpo.dados
  return comErroGerencia(async () => {
    await atualizarGerencia(id, {
      ...(nome !== undefined ? { nome } : {}),
      ...(sigla !== undefined ? { sigla } : {}),
      ...(ativa !== undefined && ativa !== null ? { ativa } : {}),
    })
    return NextResponse.json({ ok: true })
  })
}
