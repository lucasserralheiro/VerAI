import { rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUploadFullPath } from '@/lib/storage'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const forcar = request.nextUrl.searchParams.get('forcar') === 'true'

  const documentos = await prisma.documento.findMany({
    where: { clienteId: id },
    select: { id: true, caminhoOriginal: true },
  })

  if (documentos.length > 0 && !forcar) {
    return NextResponse.json(
      {
        error: `cliente tem ${documentos.length} documento(s) vinculado(s) — mescle com outro cliente, ou exclua com forcar=true`,
      },
      { status: 409 }
    )
  }

  const documentoIds = documentos.map((d) => d.id)

  await prisma.$transaction([
    prisma.acessoDocumento.deleteMany({ where: { documentoId: { in: documentoIds } } }),
    prisma.notificacao.deleteMany({ where: { documentoId: { in: documentoIds } } }),
    prisma.analise.deleteMany({ where: { documentoId: { in: documentoIds } } }),
    prisma.documento.deleteMany({ where: { id: { in: documentoIds } } }),
    prisma.analiseConsolidada.deleteMany({ where: { clienteId: id } }),
    prisma.analiseEvolucao.deleteMany({ where: { clienteId: id } }),
    prisma.cliente.delete({ where: { id } }),
  ])

  // Apaga as pastas de cada documento no disco — best-effort, fora da transação
  // (é IO de arquivo, não de banco).
  for (const documento of documentos) {
    const pasta = dirname(getUploadFullPath(documento.caminhoOriginal))
    await rm(pasta, { recursive: true, force: true }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
