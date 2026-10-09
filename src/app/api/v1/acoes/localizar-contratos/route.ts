import { z } from 'zod'

import { autenticarApp, exigirLeitura } from '@/lib/api/autenticar'
import { erroApi, respostaApi } from '@/lib/api/resposta'
import { localizarContratos, MAXIMO_DE_LOCALIZACOES } from '@/lib/integracao/consultas'

const Pedido = z.object({
  contratos: z
    .array(z.object({ numero: z.string().trim().min(1).max(120), cliente: z.string().trim().max(60).nullish() }))
    .min(1)
    .max(MAXIMO_DE_LOCALIZACOES),
})

/** POST /api/v1/acoes/localizar-contratos — resolve o número de contrato como o outro sistema escreve
 *  ("17/2025-SGM") para o contrato do VerAI, pela regra do Confere. Escopo `contratos:ler`. Nunca escolhe
 *  entre dois candidatos (`ambiguo`). */
export async function POST(request: Request) {
  const auth = await autenticarApp(request)
  if ('erro' in auth) return auth.erro
  const negado = exigirLeitura(auth.app, 'contratos')
  if (negado) return negado
  const corpo = Pedido.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return erroApi(400, 'corpo_invalido', 'Envie { contratos: [{ numero, cliente? }] } (até 500).')
  return respostaApi({ objeto: 'lista', data: await localizarContratos(corpo.data.contratos) })
}
