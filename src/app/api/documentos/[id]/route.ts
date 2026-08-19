import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerDocumento } from '@/lib/visibilidade'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documento = await prisma.documento.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
      analise: true,
    },
  })

  if (!documento) {
    return NextResponse.json({ error: 'documento não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumento(usuario, documento)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  await prisma.acessoDocumento.create({
    data: { documentoId: id, usuarioId: usuario.id, acao: 'visualizou' },
  })

  return NextResponse.json(documento)
}
