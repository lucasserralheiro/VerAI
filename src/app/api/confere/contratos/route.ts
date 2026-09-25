import { NextRequest, NextResponse } from 'next/server'

import { buscarContratos } from '@/lib/confere/cadastro'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

/** Busca livre do "trocar contrato" do ConfereAI — só contratos de clientes que a pessoa vê. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const busca = request.nextUrl.searchParams.get('busca') ?? ''
  return NextResponse.json(await buscarContratos(autenticado.usuario, busca))
}
