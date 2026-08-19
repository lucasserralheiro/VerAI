import { rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerDocumento } from '@/lib/visibilidade'
import { getUploadFullPath } from '@/lib/storage'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documento = await prisma.documento.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
      analise: true,
    },
  })

  if (!documento) {
    return NextResponse.json({ error: 'documento não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumento(usuario, documento)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  await prisma.acessoDocumento.create({
    data: { documentoId: id, usuarioId: usuario.id, acao: 'visualizou' },
  })

  return NextResponse.json(documento)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documento = await prisma.documento.findUnique({
    where: { id },
    include: { analise: { select: { caminhoRelatorioPdf: true } } },
  })
  if (!documento) {
    return NextResponse.json({ error: 'documento não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumento(usuario, documento)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const podeExcluir = usuario.role === 'admin' || documento.uploadedById === usuario.id
  if (!podeExcluir) {
    return NextResponse.json(
      { error: 'só o admin ou quem subiu o documento pode excluí-lo' },
      { status: 403 }
    )
  }

  await prisma.$transaction([
    prisma.acessoDocumento.deleteMany({ where: { documentoId: id } }),
    prisma.notificacao.deleteMany({ where: { documentoId: id } }),
    prisma.analise.deleteMany({ where: { documentoId: id } }),
    prisma.documento.delete({ where: { id } }),
  ])

  // Apaga a pasta inteira do documento (original + relatório PDF em cache) —
  // best-effort: se o arquivo já não existir, segue sem erro.
  const pastaDocumento = dirname(getUploadFullPath(documento.caminhoOriginal))
  await rm(pastaDocumento, { recursive: true, force: true }).catch(() => {})

  return NextResponse.json({ ok: true })
}
