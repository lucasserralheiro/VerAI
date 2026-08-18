import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, podeVerTodosDocumentos } from '@/lib/auth'
import { getUploadFullPath } from '@/lib/storage'

const CONTENT_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  pdf: 'application/pdf',
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

  const podeVer = podeVerTodosDocumentos(usuario.role) || documento.uploadedById === usuario.id
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const buffer = await readFile(getUploadFullPath(documento.caminhoOriginal))

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': CONTENT_TYPES[documento.tipo] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${documento.nomeArquivo}"`,
    },
  })
}
