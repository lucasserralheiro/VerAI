import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { exigirAdmin } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo, textoOpcional } from '@/lib/relatorios-clientes/validacao'
import { clientesSemGerencia, criarGerencia, listarGerencias } from '@/lib/gerencias/servico'
import { comErroGerencia, nomeObrigatorio } from '@/lib/gerencias/resposta'

const esquema = z.object({ nome: nomeObrigatorio, sigla: textoOpcional })

export async function GET(request: NextRequest) {
  const admin = await exigirAdmin(request)
  if ('erro' in admin) return admin.erro
  const [gerencias, semGerencia] = await Promise.all([listarGerencias(), clientesSemGerencia()])
  return NextResponse.json({ gerencias, semGerencia: semGerencia.length })
}

export async function POST(request: NextRequest) {
  const admin = await exigirAdmin(request)
  if ('erro' in admin) return admin.erro
  const corpo = await lerCorpo(request, esquema, { nome: 'Nome', sigla: 'Sigla' })
  if ('erro' in corpo) return corpo.erro
  return comErroGerencia(async () => {
    const gerencia = await criarGerencia({ nome: corpo.dados.nome, sigla: corpo.dados.sigla ?? null })
    return NextResponse.json(gerencia, { status: 201 })
  })
}
