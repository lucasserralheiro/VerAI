import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { buildUploadPath, getUploadFullPath } from '@/lib/storage'
import { extrairConteudo } from '@/lib/extracao'
import { analisarDocumento, PROMPT_VERSION_ATUAL } from '@/lib/ia/analisar'
import { notImplemented } from '@/lib/not-implemented'

const TIPOS_SUPORTADOS = ['xlsx', 'csv', 'pdf'] as const

function tipoDoArquivo(nomeArquivo: string): string | null {
  const extensao = nomeArquivo.split('.').pop()?.toLowerCase()
  return extensao && (TIPOS_SUPORTADOS as readonly string[]).includes(extensao) ? extensao : null
}

export async function GET() {
  return notImplemented()
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

  const buffer = Buffer.from(await arquivo.arrayBuffer())

  const documento = await prisma.documento.create({
    data: {
      nomeArquivo: arquivo.name,
      tipo,
      caminhoOriginal: '',
      tamanhoBytes: buffer.length,
      uploadedById: usuario.id,
      status: 'processando',
    },
  })

  const caminhoRelativo = buildUploadPath(documento.id, tipo)
  const caminhoCompleto = getUploadFullPath(caminhoRelativo)
  await mkdir(dirname(caminhoCompleto), { recursive: true })
  await writeFile(caminhoCompleto, buffer)
  await prisma.documento.update({
    where: { id: documento.id },
    data: { caminhoOriginal: caminhoRelativo },
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

  return NextResponse.json(documentoFinal, { status: 201 })
}
