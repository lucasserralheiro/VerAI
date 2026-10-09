import { after, NextRequest, NextResponse } from 'next/server'
import { sincronizarFontesSeVelhas } from '@/lib/integracao/espelho'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { carregarPainelCarteiras } from '@/lib/relatorios-clientes/painel-carteiras'

/** Totais por cliente, por carteira (gerência) e geral para a lista de clientes — mesma regra de contrato
 *  de todas as telas (`consolidarContratos`), somada no servidor. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  // Rede de segurança do espelho das fontes externas (API de plataforma): depois da resposta, no máximo a cada 15 min.
  after(() => sincronizarFontesSeVelhas())
  return NextResponse.json(await carregarPainelCarteiras(autenticado.usuario))
}
