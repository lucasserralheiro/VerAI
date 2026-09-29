import { NextRequest, NextResponse } from 'next/server'
import { carregarContratoComAcesso } from '@/app/api/contratos/carregar'
import { controleDoContrato } from '@/lib/controles-contratos/consultas'

// Controle do faturamento vigente do contrato (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md
// §6.1): o do mês mais recente, com as linhas conferidas.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const carregado = await carregarContratoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const controle = await controleDoContrato(id)
  return controle ? NextResponse.json(controle) : NextResponse.json({ error: 'sem controle' }, { status: 404 })
}
