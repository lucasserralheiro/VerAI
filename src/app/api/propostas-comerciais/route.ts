import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { buildUploadPath, putUpload } from '@/lib/storage'
import { converterPdfParaMarkdown } from '@/lib/extracao/pdfMarkdown'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get('status')
  const filtros: Prisma.PropostaComercialWhereInput = {}
  if (status) filtros.status = status

  const propostas = await prisma.propostaComercial.findMany({
    where: filtros,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeArquivo: true,
      tamanhoBytes: true,
      status: true,
      mensagemErro: true,
      createdAt: true,
    },
  })

  return NextResponse.json(propostas)
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

  const buffer = Buffer.from(await arquivo.arrayBuffer())

  const proposta = await prisma.propostaComercial.create({
    data: {
      nomeArquivo: arquivo.name,
      tamanhoBytes: buffer.length,
      caminhoOriginal: '',
      status: 'rascunho',
    },
  })

  const caminhoRelativo = buildUploadPath(proposta.id, 'pdf')
  const url = await putUpload(caminhoRelativo, buffer)

  let propostaFinal
  try {
    const markdown = await converterPdfParaMarkdown(buffer)
    if (!markdown.trim()) {
      throw new Error(
        'não foi possível extrair texto deste PDF — parece ser um PDF escaneado sem texto selecionável'
      )
    }
    propostaFinal = await prisma.propostaComercial.update({
      where: { id: proposta.id },
      data: { caminhoOriginal: url, conteudoMarkdown: markdown, status: 'rascunho' },
    })
  } catch (error) {
    propostaFinal = await prisma.propostaComercial.update({
      where: { id: proposta.id },
      data: {
        caminhoOriginal: url,
        status: 'erro',
        mensagemErro: error instanceof Error ? error.message : String(error),
      },
    })
  }

  return NextResponse.json(propostaFinal, { status: 201 })
}
