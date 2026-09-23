import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { esquemaPergunta, tituloDaPergunta } from '@/lib/assistente/conversas'

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
  const corpo = esquemaPergunta.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ error: corpo.error.issues[0]?.message ?? 'pergunta inválida' }, { status: 400 })
  const conversa = await prisma.conversaAssistente.create({
    data: {
      usuarioId: autenticado.usuario.id,
      titulo: tituloDaPergunta(corpo.data.pergunta),
      contextoInicial: corpo.data.rota ? { rota: corpo.data.rota } : undefined,
    },
    select: { id: true },
  })
  return NextResponse.json({ id: conversa.id }, { status: 201 })
}
