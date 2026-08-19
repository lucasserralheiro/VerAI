import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUploadFullPath } from '@/lib/storage'
import { extrairConteudo } from '@/lib/extracao'
import { analisarDocumento, PROMPT_VERSION_ATUAL } from '@/lib/ia/analisar'
import { dispararNotificacoes } from '@/lib/notificacao'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documento = await prisma.documento.findUnique({ where: { id } })
  if (!documento) {
    return NextResponse.json({ error: 'documento não encontrado' }, { status: 404 })
  }

  await prisma.documento.update({ where: { id }, data: { status: 'processando', mensagemErro: null } })

  let documentoFinal
  try {
    const buffer = await readFile(getUploadFullPath(documento.caminhoOriginal))
    const conteudoExtraido = await extrairConteudo(buffer, documento.tipo)
    const analise = await analisarDocumento(conteudoExtraido, PROMPT_VERSION_ATUAL)

    await prisma.analise.upsert({
      where: { documentoId: id },
      create: {
        documentoId: id,
        resumo: analise.resumo,
        pontosCriticos: analise.pontosCriticos,
        pontosPositivos: analise.pontosPositivos,
        metricasChave: analise.metricasChave ?? undefined,
        recomendacoes: analise.recomendacoes ?? undefined,
        promptVersion: analise.promptVersion,
      },
      update: {
        resumo: analise.resumo,
        pontosCriticos: analise.pontosCriticos,
        pontosPositivos: analise.pontosPositivos,
        metricasChave: analise.metricasChave ?? undefined,
        recomendacoes: analise.recomendacoes ?? undefined,
        promptVersion: analise.promptVersion,
        caminhoRelatorioPdf: null,
        relatorioGeradoEm: null,
      },
    })

    documentoFinal = await prisma.documento.update({ where: { id }, data: { status: 'concluido' } })
  } catch (error) {
    documentoFinal = await prisma.documento.update({
      where: { id },
      data: {
        status: 'erro',
        mensagemErro: error instanceof Error ? error.message : String(error),
      },
    })
  }

  await dispararNotificacoes(documentoFinal)

  return NextResponse.json(documentoFinal)
}
