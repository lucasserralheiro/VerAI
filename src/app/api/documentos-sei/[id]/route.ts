import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerDocumentoSei } from '@/lib/visibilidade'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documentoSei = await prisma.documentoSei.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
    },
  })
  if (!documentoSei) {
    return NextResponse.json({ error: 'documento SEI não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumentoSei(usuario, documentoSei)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  return NextResponse.json(documentoSei)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documentoSei = await prisma.documentoSei.findUnique({ where: { id } })
  if (!documentoSei) {
    return NextResponse.json({ error: 'documento SEI não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumentoSei(usuario, documentoSei)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  if (documentoSei.status === 'concluido') {
    return NextResponse.json({ error: 'documento já concluído não pode ser editado' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const conteudoMarkdown = body?.conteudoMarkdown
  if (typeof conteudoMarkdown !== 'string' || !conteudoMarkdown.trim()) {
    return NextResponse.json({ error: '"conteudoMarkdown" é obrigatório' }, { status: 400 })
  }

  const documentoSeiFinal = await prisma.documentoSei.update({
    where: { id },
    data: { conteudoMarkdown, status: 'concluido' },
  })

  return NextResponse.json(documentoSeiFinal)
}
