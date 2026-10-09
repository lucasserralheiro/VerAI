import { autenticarApp, exigirLeitura } from '@/lib/api/autenticar'
import { erroApi, respostaApi } from '@/lib/api/resposta'
import { obterRegistro, RECURSOS } from '@/lib/integracao/feed'

export const maxDuration = 60

/** GET /api/v1/:recurso/:id — um registro (escopo `<recurso>:ler`). */
export async function GET(request: Request, { params }: { params: Promise<{ recurso: string; id: string }> }) {
  const auth = await autenticarApp(request)
  if ('erro' in auth) return auth.erro
  const { recurso, id } = await params
  if (!RECURSOS.includes(recurso)) return erroApi(404, 'recurso_inexistente', `Recurso desconhecido: ${recurso}.`)
  const negado = exigirLeitura(auth.app, recurso)
  if (negado) return negado
  const registro = await obterRegistro(recurso, decodeURIComponent(id))
  if (!registro) return erroApi(404, 'nao_encontrado', `Nenhum registro ${id} em ${recurso}.`)
  return respostaApi({ objeto: 'registro', recurso, data: registro })
}
