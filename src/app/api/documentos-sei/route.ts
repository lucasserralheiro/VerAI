import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { documentosSeiVisiveisWhere, podeVerCliente } from '@/lib/visibilidade'
import { buildUploadPath, putUpload } from '@/lib/storage'
import { converterPdfParaMarkdown } from '@/lib/extracao/pdfMarkdown'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const clienteId = params.get('clienteId')
  const status = params.get('status')

  const filtros: Prisma.DocumentoSeiWhereInput = {}
  if (clienteId) filtros.clienteId = clienteId
  if (status) filtros.status = status

  const documentosSei = await prisma.documentoSei.findMany({
    where: { AND: [await documentosSeiVisiveisWhere(usuario), filtros] },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeArquivo: true,
      tamanhoBytes: true,
      status: true,
      mensagemErro: true,
      createdAt: true,
      uploadedById: true,
      uploadedBy: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
    },
  })

  return NextResponse.json(documentosSei)
}

export async function POST(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const formData = await request.formData().catch(() => null)
  const arquivo = formData?.get('arquivo')
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'campo "arquivo" é obrigatório' }, { status: 400 })
  }
  if (!arquivo.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'só é aceito arquivo PDF' }, { status: 400 })
  }

  const clienteId = formData?.get('clienteId')
  if (typeof clienteId !== 'string' || !clienteId) {
    return NextResponse.json({ error: '"clienteId" é obrigatório' }, { status: 400 })
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } })
  if (!cliente) {
    return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado a esse cliente' }, { status: 403 })
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer())

  const documentoSei = await prisma.documentoSei.create({
    data: {
      nomeArquivo: arquivo.name,
      tamanhoBytes: buffer.length,
      caminhoOriginal: '',
      uploadedById: usuario.id,
      clienteId,
      status: 'rascunho',
    },
  })

  const caminhoRelativo = buildUploadPath(documentoSei.id, 'pdf')
  const url = await putUpload(caminhoRelativo, buffer)

  let documentoSeiFinal
  try {
    const markdown = await converterPdfParaMarkdown(buffer)
    if (!markdown.trim()) {
      throw new Error(
        'não foi possível extrair texto deste PDF — parece ser um PDF escaneado sem texto selecionável'
      )
    }
    documentoSeiFinal = await prisma.documentoSei.update({
      where: { id: documentoSei.id },
      data: { caminhoOriginal: url, conteudoMarkdown: markdown, status: 'rascunho' },
    })
  } catch (error) {
    documentoSeiFinal = await prisma.documentoSei.update({
      where: { id: documentoSei.id },
      data: {
        caminhoOriginal: url,
        status: 'erro',
        mensagemErro: error instanceof Error ? error.message : String(error),
      },
    })
  }

  return NextResponse.json(documentoSeiFinal, { status: 201 })
}
