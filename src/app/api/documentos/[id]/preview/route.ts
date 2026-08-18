import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerDocumento } from '@/lib/visibilidade'
import { getUploadFullPath } from '@/lib/storage'
import { lerPlanilhaPreview } from '@/lib/extracao'

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

  if (documento.tipo !== 'xlsx' && documento.tipo !== 'csv') {
    return NextResponse.json({ error: 'preview estruturado só existe para xlsx/csv' }, { status: 400 })
  }

  const buffer = await readFile(getUploadFullPath(documento.caminhoOriginal))
  const preview = await lerPlanilhaPreview(buffer, documento.tipo)

  return NextResponse.json(preview)
}
