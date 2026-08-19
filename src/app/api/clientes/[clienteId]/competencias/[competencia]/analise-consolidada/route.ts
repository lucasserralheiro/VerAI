import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { parseCompetencia } from '@/lib/competencia'
import { calcularMetricasComparadas, type MetricaDocumento } from '@/lib/analiseConsolidada/calcularMetricas'
import { analisarConsolidado } from '@/lib/ia/consolidar'
import { PROMPT_VERSION_ATUAL } from '@/lib/ia/analisar'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string; competencia: string }> }
) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { clienteId, competencia } = await params
  const parsed = parseCompetencia(competencia)
  if (!parsed) {
    return NextResponse.json({ error: 'competência inválida (esperado AAAA-MM)' }, { status: 400 })
  }

  const podeVer = await podeVerCliente(usuario, clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const analises = await prisma.analiseConsolidada.findMany({
    where: { clienteId, competenciaAno: parsed.ano, competenciaMes: parsed.mes },
    orderBy: { createdAt: 'desc' },
    include: { documentos: { select: { id: true, nomeArquivo: true } } },
  })
  return NextResponse.json(analises)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string; competencia: string }> }
) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { clienteId, competencia } = await params
  const parsed = parseCompetencia(competencia)
  if (!parsed) {
    return NextResponse.json({ error: 'competência inválida (esperado AAAA-MM)' }, { status: 400 })
  }

  const podeVer = await podeVerCliente(usuario, clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const documentoIds: unknown = body?.documentoIds
  if (
    !Array.isArray(documentoIds) ||
    documentoIds.length === 0 ||
    !documentoIds.every((id) => typeof id === 'string')
  ) {
    return NextResponse.json(
      { error: '"documentoIds" (array de ids, não-vazio) é obrigatório' },
      { status: 400 }
    )
  }

  const documentos = await prisma.documento.findMany({
    where: {
      id: { in: documentoIds },
      clienteId,
      competenciaAno: parsed.ano,
      competenciaMes: parsed.mes,
      status: 'concluido',
    },
    include: { analise: true },
  })

  if (documentos.length !== documentoIds.length) {
    return NextResponse.json(
      {
        error:
          'algum documento selecionado não existe, não pertence a esse cliente/competência, ou ainda não tem análise concluída',
      },
      { status: 400 }
    )
  }

  const metricasPorDocumento: MetricaDocumento[] = documentos.flatMap((doc) => {
    const metricas =
      (doc.analise?.metricasChave as
        | Array<{ label: string; valorNumerico: number | null; unidade: string | null; valorExibicao: string }>
        | null) ?? []
    return metricas.map((m) => ({
      documentoId: doc.id,
      nomeArquivo: doc.nomeArquivo,
      label: m.label,
      valorNumerico: m.valorNumerico,
      unidade: m.unidade,
      valorExibicao: m.valorExibicao,
    }))
  })

  const metricasComparadas = calcularMetricasComparadas(metricasPorDocumento)

  const resumos = documentos.map((doc) => ({
    nomeArquivo: doc.nomeArquivo,
    resumo: doc.analise!.resumo,
  }))

  const analiseGerada = await analisarConsolidado(resumos, metricasComparadas, PROMPT_VERSION_ATUAL)
  const selecaoAssinatura = [...documentoIds].sort().join(',')

  const analiseConsolidada = await prisma.analiseConsolidada.upsert({
    where: {
      clienteId_competenciaAno_competenciaMes_selecaoAssinatura: {
        clienteId,
        competenciaAno: parsed.ano,
        competenciaMes: parsed.mes,
        selecaoAssinatura,
      },
    },
    create: {
      clienteId,
      competenciaAno: parsed.ano,
      competenciaMes: parsed.mes,
      selecaoAssinatura,
      resumo: analiseGerada.resumo,
      pontosCriticos: analiseGerada.pontosCriticos,
      pontosPositivos: analiseGerada.pontosPositivos,
      metricasComparadas: metricasComparadas as unknown as Prisma.InputJsonValue,
      recomendacoes: analiseGerada.recomendacoes ?? undefined,
      promptVersion: analiseGerada.promptVersion,
      documentos: { connect: documentoIds.map((id) => ({ id })) },
    },
    update: {
      resumo: analiseGerada.resumo,
      pontosCriticos: analiseGerada.pontosCriticos,
      pontosPositivos: analiseGerada.pontosPositivos,
      metricasComparadas: metricasComparadas as unknown as Prisma.InputJsonValue,
      recomendacoes: analiseGerada.recomendacoes ?? undefined,
      promptVersion: analiseGerada.promptVersion,
      caminhoRelatorioPdf: null,
      relatorioGeradoEm: null,
      documentos: { set: documentoIds.map((id) => ({ id })) },
    },
    include: { documentos: { select: { id: true, nomeArquivo: true } } },
  })

  return NextResponse.json(analiseConsolidada, { status: 201 })
}
