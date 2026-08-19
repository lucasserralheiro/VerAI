import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const totalDocumentos = await prisma.documento.count({ where: { clienteId: id } })
  if (totalDocumentos > 0) {
    return NextResponse.json(
      {
        error: `cliente tem ${totalDocumentos} documento(s) vinculado(s) — mescle com outro cliente em vez de excluir`,
      },
      { status: 409 }
    )
  }

  await prisma.cliente.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
