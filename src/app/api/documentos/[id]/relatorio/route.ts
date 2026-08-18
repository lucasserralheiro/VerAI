import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import type { Analise, Documento } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser, podeVerTodosDocumentos } from '@/lib/auth'
import { buildRelatorioPath, getUploadFullPath } from '@/lib/storage'
import { gerarRelatorioPdf } from '@/lib/pdf/gerarRelatorio'

async function obterBufferRelatorio(
  documento: Documento & { uploadedBy: { nome: string } },
  analise: Analise
): Promise<Buffer> {
  if (analise.caminhoRelatorioPdf) {
    try {
      return await readFile(getUploadFullPath(analise.caminhoRelatorioPdf))
    } catch {
      // cache inválido (arquivo não existe mais) — regenera abaixo
    }
  }

  const buffer = await gerarRelatorioPdf(documento, analise)
  const caminhoRelativo = buildRelatorioPath(documento.id)
  const caminhoCompleto = getUploadFullPath(caminhoRelativo)
  await mkdir(dirname(caminhoCompleto), { recursive: true })
  await writeFile(caminhoCompleto, buffer)
  await prisma.analise.update({
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
  const documento = await prisma.documento.findUnique({
    where: { id },
    include: { uploadedBy: { select: { nome: true } }, analise: true },
  })
  if (!documento) {
    return NextResponse.json({ error: 'documento não encontrado' }, { status: 404 })
  }

  const podeVer = podeVerTodosDocumentos(usuario.role) || documento.uploadedById === usuario.id
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  if (documento.status !== 'concluido' || !documento.analise) {
    return NextResponse.json(
      { error: 'relatório só está disponível para documentos com análise concluída' },
      { status: 400 }
    )
  }

  const buffer = await obterBufferRelatorio(documento, documento.analise)

  await prisma.acessoDocumento.create({
    data: { documentoId: id, usuarioId: usuario.id, acao: 'baixou_relatorio' },
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-${documento.nomeArquivo}.pdf"`,
    },
  })
}
