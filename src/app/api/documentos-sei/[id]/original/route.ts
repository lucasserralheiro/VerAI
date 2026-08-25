import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerDocumentoSei } from '@/lib/visibilidade'
import { getUpload } from '@/lib/storage'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documentoSei = await prisma.documentoSei.findUnique({ where: { id } })
  if (!documentoSei) {
    return NextResponse.json({ error: 'documento SEI não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumentoSei(usuario, documentoSei)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const modoPreview = request.nextUrl.searchParams.get('modo') === 'preview'
  const buffer = await getUpload(documentoSei.caminhoOriginal)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${modoPreview ? 'inline' : 'attachment'}; filename="${documentoSei.nomeArquivo}"`,
    },
  })
}
