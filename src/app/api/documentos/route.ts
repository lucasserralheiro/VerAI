import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { documentosVisiveisWhere, podeVerCliente } from '@/lib/visibilidade'
import { buildUploadPath, putUpload } from '@/lib/storage'
import { extrairConteudo } from '@/lib/extracao'
import { analisarDocumento, PROMPT_VERSION_ATUAL } from '@/lib/ia/analisar'
import { dispararNotificacoes } from '@/lib/notificacao'

const TIPOS_SUPORTADOS = ['xlsx', 'csv', 'pdf', 'docx'] as const

function tipoDoArquivo(nomeArquivo: string): string | null {
  const extensao = nomeArquivo.split('.').pop()?.toLowerCase()
  return extensao && (TIPOS_SUPORTADOS as readonly string[]).includes(extensao) ? extensao : null
}

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const tipo = params.get('tipo')
  const status = params.get('status')
  const busca = params.get('busca')
  const de = params.get('de')
  const ate = params.get('ate')
  const clienteId = params.get('clienteId')
  const competenciaAno = params.get('competenciaAno')
  const competenciaMes = params.get('competenciaMes')

  const filtros: Prisma.DocumentoWhereInput = {}
  if (tipo) filtros.tipo = tipo
  if (status) filtros.status = status
  if (busca) filtros.nomeArquivo = { contains: busca, mode: 'insensitive' }
  if (de || ate) {
    filtros.createdAt = {
      ...(de ? { gte: new Date(de) } : {}),
      ...(ate ? { lte: new Date(ate) } : {}),
    }
  }
  if (clienteId) filtros.clienteId = clienteId
  if (competenciaAno) filtros.competenciaAno = Number(competenciaAno)
  if (competenciaMes) filtros.competenciaMes = Number(competenciaMes)

  const where: Prisma.DocumentoWhereInput = {
    AND: [await documentosVisiveisWhere(usuario), filtros],
  }

  const documentos = await prisma.documento.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeArquivo: true,
      tipo: true,
      status: true,
      mensagemErro: true,
      tamanhoBytes: true,
      createdAt: true,
      competenciaAno: true,
      competenciaMes: true,
      uploadedById: true,
      uploadedBy: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
      analise: { select: { id: true } },
    },
  })

  return NextResponse.json(documentos)
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

  const tipo = tipoDoArquivo(arquivo.name)
  if (!tipo) {
    return NextResponse.json(
      { error: `tipo de arquivo não suportado. Aceitos: ${TIPOS_SUPORTADOS.join(', ')}` },
      { status: 400 }
    )
  }

  const clienteId = formData?.get('clienteId')
  const competenciaAno = Number(formData?.get('competenciaAno'))
  const competenciaMes = Number(formData?.get('competenciaMes'))
  if (
    typeof clienteId !== 'string' ||
    !clienteId ||
    !Number.isInteger(competenciaAno) ||
    !Number.isInteger(competenciaMes) ||
    competenciaMes < 1 ||
    competenciaMes > 12
  ) {
    return NextResponse.json(
      { error: '"clienteId", "competenciaAno" e "competenciaMes" (1-12) são obrigatórios' },
      { status: 400 }
    )
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

  const documento = await prisma.documento.create({
    data: {
      nomeArquivo: arquivo.name,
      tipo,
      caminhoOriginal: '',
      tamanhoBytes: buffer.length,
      uploadedById: usuario.id,
      clienteId,
      competenciaAno,
      competenciaMes,
      status: 'processando',
    },
  })

  const caminhoRelativo = buildUploadPath(documento.id, tipo)
  const url = await putUpload(caminhoRelativo, buffer)
  await prisma.documento.update({
    where: { id: documento.id },
    data: { caminhoOriginal: url },
  })

  let documentoFinal
  try {
    const conteudoExtraido = await extrairConteudo(buffer, tipo)
    const analise = await analisarDocumento(conteudoExtraido, PROMPT_VERSION_ATUAL)

    await prisma.analise.create({
      data: {
        documentoId: documento.id,
        resumo: analise.resumo,
        pontosCriticos: analise.pontosCriticos,
        pontosPositivos: analise.pontosPositivos,
        metricasChave: analise.metricasChave ?? undefined,
        recomendacoes: analise.recomendacoes ?? undefined,
        promptVersion: analise.promptVersion,
      },
    })

    documentoFinal = await prisma.documento.update({
      where: { id: documento.id },
      data: { status: 'concluido' },
    })
  } catch (error) {
    documentoFinal = await prisma.documento.update({
      where: { id: documento.id },
      data: {
        status: 'erro',
        mensagemErro: error instanceof Error ? error.message : String(error),
      },
    })
  }

  await dispararNotificacoes(documentoFinal)

  return NextResponse.json(documentoFinal, { status: 201 })
}
