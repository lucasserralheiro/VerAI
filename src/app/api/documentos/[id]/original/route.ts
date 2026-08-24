import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerDocumento } from '@/lib/visibilidade'
import { getUpload } from '@/lib/storage'

const CONTENT_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documento = await prisma.documento.findUnique({ where: { id } })
  if (!documento) {
    return NextResponse.json({ error: 'documento não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumento(usuario, documento)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const modoPreview = request.nextUrl.searchParams.get('modo') === 'preview'
  const buffer = await getUpload(documento.caminhoOriginal)

  if (!modoPreview) {
    await prisma.acessoDocumento.create({
      data: { documentoId: id, usuarioId: usuario.id, acao: 'baixou_original' },
    })
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': CONTENT_TYPES[documento.tipo] ?? 'application/octet-stream',
      'Content-Disposition': `${modoPreview ? 'inline' : 'attachment'}; filename="${documento.nomeArquivo}"`,
    },
  })
}
