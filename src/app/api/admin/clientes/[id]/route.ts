import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { excluirCliente } from '@/lib/relatorios-clientes/excluir-cliente'

/** "Gerenciar clientes" (admin — o middleware barra quem não é). Mesma exclusão da ficha do cliente
 *  (`excluir-cliente.ts`); aqui só pede `?forcar=true` quando há dado vinculado, pra tela confirmar. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const forcar = request.nextUrl.searchParams.get('forcar') === 'true'

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: { _count: { select: { documentos: true, contratos: true, faturamentos: true, demandas: true, arquivos: true } } },
  })
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const { documentos, contratos, faturamentos, demandas, arquivos } = cliente._count
  const vinculados = [
    documentos && `${documentos} documento(s)`,
    contratos && `${contratos} contrato(s)`,
    faturamentos && `${faturamentos} faturamento(s)`,
    demandas && `${demandas} demanda(s)`,
    arquivos && `${arquivos} arquivo(s)`,
  ].filter(Boolean)
  if (vinculados.length > 0 && !forcar) {
    return NextResponse.json(
      { error: `cliente tem ${vinculados.join(', ')} — mescle com outro cliente, ou exclua com forcar=true` },
      { status: 409 }
    )
  }

  try {
    await excluirCliente(id)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
    }
    throw error
  }
  return NextResponse.json({ ok: true })
}
