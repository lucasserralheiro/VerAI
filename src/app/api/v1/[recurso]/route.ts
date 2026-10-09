import { autenticarApp, exigirLeitura } from '@/lib/api/autenticar'
import { erroApi, respostaApi } from '@/lib/api/resposta'
import { listarRecurso, RECURSOS } from '@/lib/integracao/feed'

export const maxDuration = 60

/** GET /api/v1/:recurso?pagina=&limite=&cliente=&gerencia= — página do recurso (escopo `<recurso>:ler`). */
export async function GET(request: Request, { params }: { params: Promise<{ recurso: string }> }) {
  const auth = await autenticarApp(request)
  if ('erro' in auth) return auth.erro
  const { recurso } = await params
  if (!RECURSOS.includes(recurso)) return erroApi(404, 'recurso_inexistente', `Recurso desconhecido: ${recurso}.`, { recursos: RECURSOS })
  const negado = exigirLeitura(auth.app, recurso)
  if (negado) return negado
  const q = new URL(request.url).searchParams
  try {
    const lista = await listarRecurso(recurso, {
      pagina: Number(q.get('pagina') ?? '1') || 1,
      limite: Number(q.get('limite') ?? '100') || 100,
      cliente: q.get('cliente'),
      gerencia: q.get('gerencia'),
    })
    if (!lista) return erroApi(404, 'recurso_inexistente', `Recurso desconhecido: ${recurso}.`)
    const { registros, ...resto } = lista
    return respostaApi({ objeto: 'lista', ...resto, data: registros })
  } catch (erro) {
    console.error('[api] lista', recurso, erro)
    return erroApi(500, 'falha_interna', 'Falha ao montar a lista.')
  }
}
