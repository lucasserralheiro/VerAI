import { NextRequest, NextResponse } from 'next/server'
import { carregarContratoComAcesso } from '@/app/api/contratos/carregar'
import { prisma } from '@/lib/prisma'
import { linksDoContrato, resumoDosLinksDoContrato } from '@/lib/links-mpls/consultas'

// Links MPLS de um contrato (spec 2026-09-29-links-mpls §6.2/§8): série mês a mês e os links do mês pedido, com o que
// entrou e saiu. `?resumo=1` devolve só o mês mais recente (cartão no detalhe do contrato).
export async function GET(request: NextRequest, { params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params
  const carregado = await carregarContratoComAcesso(request, contratoId)
  if ('erro' in carregado) return carregado.erro
  if (request.nextUrl.searchParams.get('resumo') === '1') {
    const resumo = await resumoDosLinksDoContrato(contratoId)
    return resumo ? NextResponse.json(resumo) : NextResponse.json({ error: 'sem relatório de links' }, { status: 404 })
  }
  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    select: { id: true, clienteId: true, numeroTermo: true, seiProdam: true, cliente: { select: { nome: true, siglaLegado: true } } },
  })
  return NextResponse.json({ contrato, ...(await linksDoContrato(contratoId, request.nextUrl.searchParams.get('competencia') ?? undefined)) })
}
