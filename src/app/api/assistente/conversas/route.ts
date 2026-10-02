import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { esquemaPergunta, tituloDaPergunta } from '@/lib/assistente/conversas'

/** `somenteCriar`: o painel cria a conversa só para receber o primeiro anexo (título = nome do
 *  arquivo). Esta rota nunca grava a pergunta nem chama a IA — isso é de `…/[id]/mensagens`; a marca
 *  volta na resposta para a tela não seguir para a resposta da IA. */
const esquemaCriacao = esquemaPergunta.extend({ somenteCriar: z.boolean().optional() })

export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const conversas = await prisma.conversaAssistente.findMany({
    where: { usuarioId: autenticado.usuario.id },
    orderBy: { atualizadaEm: 'desc' },
    take: 30,
    select: { id: true, titulo: true, atualizadaEm: true },
  })
  return NextResponse.json({ conversas })
}

export async function POST(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const corpo = esquemaCriacao.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ error: corpo.error.issues[0]?.message ?? 'pergunta inválida' }, { status: 400 })
  const conversa = await prisma.conversaAssistente.create({
    data: {
      usuarioId: autenticado.usuario.id,
      titulo: tituloDaPergunta(corpo.data.pergunta),
      contextoInicial: corpo.data.rota ? { rota: corpo.data.rota } : undefined,
    },
    select: { id: true },
  })
  return NextResponse.json(corpo.data.somenteCriar ? { id: conversa.id, somenteCriar: true } : { id: conversa.id }, { status: 201 })
}
