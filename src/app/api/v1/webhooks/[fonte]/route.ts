import { after } from 'next/server'

import { erroApi, respostaApi } from '@/lib/api/resposta'
import { verificarAssinatura } from '@/lib/api/webhooks'
import { sincronizarFonte } from '@/lib/integracao/espelho'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300

/** POST /api/v1/webhooks/:fonte — recebe o aviso de uma FONTE EXTERNA cadastrada em /admin/api. Confere a
 *  assinatura com o segredo da fonte, responde 202 e puxa os recursos citados depois da resposta. */
export async function POST(request: Request, { params }: { params: Promise<{ fonte: string }> }) {
  const { fonte: slug } = await params
  const fonte = await prisma.fonteExterna.findUnique({ where: { slug } })
  if (!fonte || !fonte.ativa) return erroApi(404, 'fonte_inexistente', 'Nenhuma fonte ativa com esse endereço.')
  if (!fonte.segredoWebhook) return erroApi(403, 'sem_segredo', 'A fonte não tem segredo de webhook cadastrado.')
  const corpo = await request.text()
  if (!verificarAssinatura(fonte.segredoWebhook, corpo, request.headers.get('x-webhook-assinatura'))) {
    return erroApi(401, 'assinatura_invalida', 'Assinatura do webhook não confere.')
  }
  let evento: { tipo?: string; recursos?: unknown }
  try {
    evento = JSON.parse(corpo)
  } catch {
    return erroApi(400, 'corpo_invalido', 'Corpo não é JSON.')
  }
  if (evento.tipo === 'ping') return respostaApi({ objeto: 'recebido', tipo: 'ping' }, 202)
  const recursos = Array.isArray(evento.recursos) ? evento.recursos.filter((r): r is string => typeof r === 'string') : []
  after(async () => {
    const resumo = await sincronizarFonte(fonte, recursos)
    const erros = resumo.filter((r) => r.resultado === 'erro')
    if (erros.length) console.warn('[api] espelho após webhook com erro', erros)
  })
  return respostaApi({ objeto: 'recebido', tipo: evento.tipo ?? null, recursos }, 202)
}
