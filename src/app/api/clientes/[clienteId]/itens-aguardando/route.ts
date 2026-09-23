import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { itensAguardandoDoCliente } from '@/lib/relatorios-clientes/itens-aguardando'

/** Itens do legado que pertencem a este cliente (pela sigla) e ainda esperam um contrato. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { siglaLegado: true } })
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  return NextResponse.json(await itensAguardandoDoCliente(prisma, cliente))
}
