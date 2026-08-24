import { NextRequest, NextResponse } from 'next/server'
import type { AnaliseEvolucao } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { buildRelatorioEvolucaoPath, getUpload, putUpload } from '@/lib/storage'
import { gerarRelatorioEvolucaoPdf } from '@/lib/pdf/gerarRelatorioEvolucao'

async function obterBuffer(cliente: { nome: string }, analise: AnaliseEvolucao): Promise<Buffer> {
  if (analise.caminhoRelatorioPdf) {
    try {
      return await getUpload(analise.caminhoRelatorioPdf)
    } catch {
      // cache inválido — regenera abaixo
    }
  }

  const buffer = await gerarRelatorioEvolucaoPdf(cliente, analise)
  const caminhoRelativo = buildRelatorioEvolucaoPath(analise.id)
  const url = await putUpload(caminhoRelativo, buffer, 'application/pdf')
  await prisma.analiseEvolucao.update({
    where: { id: analise.id },
    data: { caminhoRelatorioPdf: url, relatorioGeradoEm: new Date() },
  })

  return buffer
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const analise = await prisma.analiseEvolucao.findUnique({
    where: { id },
    include: { cliente: { select: { nome: true } } },
  })
  if (!analise) {
    return NextResponse.json({ error: 'análise de evolução não encontrada' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, analise.clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const buffer = await obterBuffer(analise.cliente, analise)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="evolucao-${analise.cliente.nome}-${analise.competenciaAtualAno}-${analise.competenciaAtualMes}.pdf"`,
    },
  })
}
