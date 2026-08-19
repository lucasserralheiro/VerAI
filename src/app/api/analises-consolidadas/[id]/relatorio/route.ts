import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import type { AnaliseConsolidada } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { buildRelatorioConsolidadoPath, getUploadFullPath } from '@/lib/storage'
import { gerarRelatorioConsolidadoPdf } from '@/lib/pdf/gerarRelatorioConsolidado'

async function obterBuffer(
  cliente: { nome: string },
  documentos: Array<{ nomeArquivo: string }>,
  analise: AnaliseConsolidada
): Promise<Buffer> {
  if (analise.caminhoRelatorioPdf) {
    try {
      return await readFile(getUploadFullPath(analise.caminhoRelatorioPdf))
    } catch {
      // cache inválido — regenera abaixo
    }
  }

  const buffer = await gerarRelatorioConsolidadoPdf(cliente, documentos, analise)
  const caminhoRelativo = buildRelatorioConsolidadoPath(analise.id)
  const caminhoCompleto = getUploadFullPath(caminhoRelativo)
  await mkdir(dirname(caminhoCompleto), { recursive: true })
  await writeFile(caminhoCompleto, buffer)
  await prisma.analiseConsolidada.update({
    where: { id: analise.id },
    data: { caminhoRelatorioPdf: caminhoRelativo, relatorioGeradoEm: new Date() },
  })

  return buffer
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const analise = await prisma.analiseConsolidada.findUnique({
    where: { id },
    include: {
      cliente: { select: { nome: true } },
      documentos: { select: { nomeArquivo: true } },
    },
  })
  if (!analise) {
    return NextResponse.json({ error: 'análise consolidada não encontrada' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, analise.clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const buffer = await obterBuffer(analise.cliente, analise.documentos, analise)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="consolidado-${analise.cliente.nome}-${analise.competenciaAno}-${analise.competenciaMes}.pdf"`,
    },
  })
}
