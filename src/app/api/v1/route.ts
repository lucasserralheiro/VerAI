import { autenticarApp, podeLer } from '@/lib/api/autenticar'
import { respostaApi } from '@/lib/api/resposta'
import { RECURSOS, RECURSOS_DO_VERAI } from '@/lib/integracao/feed'

/** GET /api/v1 — descoberta: quem é o aplicativo da chave e o que ele pode ler. */
export async function GET(request: Request) {
  const auth = await autenticarApp(request)
  if ('erro' in auth) return auth.erro
  return respostaApi({
    objeto: 'api',
    sistema: 'verai',
    versao: 1,
    app: { nome: auth.app.nome },
    documentacao: '/api/v1/openapi.json',
    recursos: RECURSOS.map((recurso) => ({ recurso, ...RECURSOS_DO_VERAI[recurso], permitido: podeLer(auth.app, recurso) })),
  })
}
