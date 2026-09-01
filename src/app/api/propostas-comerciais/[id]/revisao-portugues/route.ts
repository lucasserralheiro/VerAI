import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { revisarPortugues } from '@/lib/ia/revisarPortugues'
import { validarRevisaoPortugues } from '@/lib/propostas/validarRevisaoPortugues'

/**
 * Revisão ortográfica sob demanda da Proposta Comercial. Stateless: lê o
 * `conteudoMarkdown` atual, manda pro modelo, roda o guardrail e devolve as
 * duas versões pro front mostrar o diff. Nada é gravado aqui — aplicar a
 * versão corrigida é o `PATCH` normal da proposta.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({ where: { id } })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  // O editor manda o texto em edição (ainda não salvo) no corpo; a tela final
  // não manda corpo e a revisão roda em cima do que está gravado.
  const corpo = await request.json().catch(() => null)
  const markdownDoCorpo =
    corpo && typeof corpo.conteudoMarkdown === 'string' && corpo.conteudoMarkdown.trim()
      ? (corpo.conteudoMarkdown as string)
      : null

  const original = markdownDoCorpo ?? proposta.conteudoMarkdown
  if (!original || !original.trim()) {
    return NextResponse.json({ error: 'a proposta ainda não tem conteúdo pra revisar' }, { status: 400 })
  }

  let corrigido: string
  try {
    corrigido = await revisarPortugues(original)
  } catch (erro) {
    console.error('revisão de português falhou:', erro)
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return NextResponse.json(
      { error: `não foi possível revisar o texto agora (${detalhe})` },
      { status: 502 }
    )
  }

  const problema = validarRevisaoPortugues(original, corrigido)
  if (problema) {
    return NextResponse.json(
      { error: `${problema} — não é seguro aplicar automaticamente. Revise o texto manualmente em "Editar novamente".` },
      { status: 422 }
    )
  }

  return NextResponse.json({ original, corrigido })
}
