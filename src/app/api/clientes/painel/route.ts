import { NextRequest, NextResponse } from 'next/server'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { carregarPainelCarteiras } from '@/lib/relatorios-clientes/painel-carteiras'

/** Totais por cliente, por carteira (gerência) e geral para a lista de clientes — mesma regra de contrato
 *  de todas as telas (`consolidarContratos`), somada no servidor. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  return NextResponse.json(await carregarPainelCarteiras(autenticado.usuario))
}
