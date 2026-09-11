import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { buildDocumentoPrefix, deleteUploadPrefix } from '@/lib/storage'
import { temBlocoOcrPendente } from '@/lib/ocr/marcadorOcrPendente'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({
    where: { id },
    include: { arquivos: { orderBy: { ordem: 'asc' } } },
  })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  return NextResponse.json(proposta)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({ where: { id } })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const conteudoMarkdown = body?.conteudoMarkdown
  if (typeof conteudoMarkdown !== 'string' || !conteudoMarkdown.trim()) {
    return NextResponse.json({ error: '"conteudoMarkdown" é obrigatório' }, { status: 400 })
  }

  const propostaFinal = await prisma.propostaComercial.update({
    where: { id },
    data: { conteudoMarkdown, status: temBlocoOcrPendente(conteudoMarkdown) ? 'rascunho' : 'concluido' },
  })

  return NextResponse.json(propostaFinal)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({ where: { id } })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  // O relacionamento com PropostaComercialArquivo tem onDelete: Cascade, então
  // apagar a proposta já apaga as linhas dos arquivos junto.
  await prisma.propostaComercial.delete({ where: { id } })

  // Apaga os blobs de todos os arquivos da proposta — best-effort, se já não
  // existirem (ou o storage estiver indisponível) a exclusão segue sem erro.
  const prefixo = buildDocumentoPrefix(proposta.id, proposta.createdAt)
  await deleteUploadPrefix(prefixo).catch(() => {})

  return NextResponse.json({ ok: true })
}
