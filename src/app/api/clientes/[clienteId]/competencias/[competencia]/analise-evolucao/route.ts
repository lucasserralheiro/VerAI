import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { parseCompetencia, formatarCompetencia } from '@/lib/competencia'
import { calcularEvolucao, type MetricaDocumento } from '@/lib/analiseEvolucao/calcularEvolucao'
import { analisarEvolucao } from '@/lib/ia/evoluir'
import { PROMPT_VERSION_ATUAL } from '@/lib/ia/analisar'

async function metricasDaCompetencia(clienteId: string, ano: number, mes: number): Promise<MetricaDocumento[]> {
  const documentos = await prisma.documento.findMany({
    where: { clienteId, competenciaAno: ano, competenciaMes: mes, status: 'concluido' },
    include: { analise: true },
  })
  return documentos.flatMap((doc) => {
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
}

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

  const analise = await prisma.analiseEvolucao.findUnique({
    where: {
      clienteId_competenciaAtualAno_competenciaAtualMes: {
        clienteId,
        competenciaAtualAno: parsed.ano,
        competenciaAtualMes: parsed.mes,
      },
    },
  })

  return NextResponse.json(analise)
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

  const competenciaAnterior = await prisma.documento.findFirst({
    where: {
      clienteId,
      status: 'concluido',
      OR: [
        { competenciaAno: { lt: parsed.ano } },
        { competenciaAno: parsed.ano, competenciaMes: { lt: parsed.mes } },
      ],
    },
    orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
    select: { competenciaAno: true, competenciaMes: true },
  })

  if (!competenciaAnterior) {
    return NextResponse.json(
      { error: 'nenhuma competência anterior com documentos concluídos encontrada para esse cliente' },
      { status: 400 }
    )
  }

  const [metricasAtual, metricasAnterior] = await Promise.all([
    metricasDaCompetencia(clienteId, parsed.ano, parsed.mes),
    metricasDaCompetencia(clienteId, competenciaAnterior.competenciaAno, competenciaAnterior.competenciaMes),
  ])

  const metricasComparadas = calcularEvolucao(metricasAtual, metricasAnterior)

  const analiseGerada = await analisarEvolucao(
    metricasComparadas,
    formatarCompetencia(parsed.ano, parsed.mes),
    formatarCompetencia(competenciaAnterior.competenciaAno, competenciaAnterior.competenciaMes),
    PROMPT_VERSION_ATUAL
  )

  const analiseEvolucao = await prisma.analiseEvolucao.upsert({
    where: {
      clienteId_competenciaAtualAno_competenciaAtualMes: {
        clienteId,
        competenciaAtualAno: parsed.ano,
        competenciaAtualMes: parsed.mes,
      },
    },
    create: {
      clienteId,
      competenciaAtualAno: parsed.ano,
      competenciaAtualMes: parsed.mes,
      competenciaAnteriorAno: competenciaAnterior.competenciaAno,
      competenciaAnteriorMes: competenciaAnterior.competenciaMes,
      metricasComparadas: metricasComparadas as unknown as Prisma.InputJsonValue,
      resumo: analiseGerada.resumo,
      pontosAtencao: analiseGerada.pontosAtencao,
      melhorias: analiseGerada.melhorias,
      promptVersion: analiseGerada.promptVersion,
    },
    update: {
      competenciaAnteriorAno: competenciaAnterior.competenciaAno,
      competenciaAnteriorMes: competenciaAnterior.competenciaMes,
      metricasComparadas: metricasComparadas as unknown as Prisma.InputJsonValue,
      resumo: analiseGerada.resumo,
      pontosAtencao: analiseGerada.pontosAtencao,
      melhorias: analiseGerada.melhorias,
      promptVersion: analiseGerada.promptVersion,
      caminhoRelatorioPdf: null,
      relatorioGeradoEm: null,
    },
  })

  return NextResponse.json(analiseEvolucao, { status: 201 })
}
