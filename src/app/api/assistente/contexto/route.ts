import { NextRequest, NextResponse } from 'next/server'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { descreverContexto, interpretarRota } from '@/lib/assistente/contexto-pagina'

/** Rótulo do chip "Contexto: SMIT › Contrato 031/2023" no painel. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const rota = request.nextUrl.searchParams.get('rota') ?? ''
  const contexto = await descreverContexto(interpretarRota(rota), autenticado.usuario)
  return NextResponse.json({ rotulo: contexto?.rotulo ?? null })
}
