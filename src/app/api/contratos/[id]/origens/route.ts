import { NextRequest, NextResponse } from 'next/server'
import { carregarContratoComAcesso } from '@/app/api/contratos/carregar'
import { origensDoContrato } from '@/lib/valores-contratos/origens'

// De onde veio cada valor, vigência e assinatura preenchidos com prova no histórico do contrato (spec
// docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md §0): { [historicoId]: { valor?, vigencia?, assinatura? } }.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const carregado = await carregarContratoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  return NextResponse.json(await origensDoContrato(id))
}
