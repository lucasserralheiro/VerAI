import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildDocumentoPrefix, deleteUploadPrefix } from '@/lib/storage'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const forcar = request.nextUrl.searchParams.get('forcar') === 'true'

  const documentos = await prisma.documento.findMany({
    where: { clienteId: id },
    select: { id: true, caminhoOriginal: true, createdAt: true },
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

  // Apaga os blobs de cada documento no storage — best-effort, fora da transação
  // (é IO externo, não de banco).
  for (const documento of documentos) {
    const prefixo = buildDocumentoPrefix(documento.id, documento.createdAt)
    await deleteUploadPrefix(prefixo).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
