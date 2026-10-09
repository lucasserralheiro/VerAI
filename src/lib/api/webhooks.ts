import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

import { prisma } from '@/lib/prisma'

import { escopoDeLeitura } from './autenticar'

// Webhooks da API de plataforma — formato IGUAL nos dois sistemas (spec 2026-10-08-api-plataforma §5):
//
//   POST <url do app>
//   X-Webhook-Id: <uuid>            X-Webhook-Origem: verai
//   X-Webhook-Assinatura: t=<unix>,v1=<hex HMAC-SHA256(segredo, "<t>.<corpo>")>
//   { "id", "tipo": "recursos.alterados" | "ping", "origem": "verai", "recursos": [...], "ocorridoEm" }
//
// O aviso só diz O QUE mudou; quem recebe busca os dados pela API com a própria chave. Assim o webhook
// nunca carrega dado sensível e um aviso perdido não perde nada (a passada periódica do outro lado pega).

export const ORIGEM = 'verai'
const TOLERANCIA_S = 300
const ENTREGAS_GUARDADAS = 50

export function assinar(segredo: string, corpo: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac('sha256', segredo).update(`${t}.${corpo}`).digest('hex')}`
}

/** Confere a assinatura de um webhook RECEBIDO (de uma fonte externa). Rejeita fora de 5 min (replay). */
export function verificarAssinatura(segredo: string, corpo: string, cabecalho: string | null, agora = Date.now()): boolean {
  if (!cabecalho) return false
  const partes = Object.fromEntries(cabecalho.split(',').map((p) => p.trim().split('=') as [string, string]))
  const t = Number(partes.t)
  if (!Number.isFinite(t) || Math.abs(agora / 1000 - t) > TOLERANCIA_S || !partes.v1) return false
  const esperado = Buffer.from(createHmac('sha256', segredo).update(`${t}.${corpo}`).digest('hex'))
  const recebido = Buffer.from(partes.v1)
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}

interface WebhookAlvo {
  id: string
  url: string
  segredo: string
}

/** Envia um evento a um webhook e registra a entrega. Nunca lança. */
export async function enviarWebhook(hook: WebhookAlvo, tipo: 'recursos.alterados' | 'ping', recursos: string[]): Promise<{ ok: boolean; status: number | null; erro: string | null }> {
  const corpo = JSON.stringify({ id: randomUUID(), tipo, origem: ORIGEM, recursos, ocorridoEm: new Date().toISOString() })
  const inicio = Date.now()
  let status: number | null = null
  let erro: string | null = null
  try {
    const resposta = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-id': randomUUID(),
        'x-webhook-origem': ORIGEM,
        'x-webhook-assinatura': assinar(hook.segredo, corpo),
      },
      body: corpo,
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    status = resposta.status
    if (!resposta.ok) erro = `HTTP ${resposta.status}`
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e)
  }
  await prisma.apiWebhookEntrega
    .create({ data: { webhookId: hook.id, recursos: tipo === 'ping' ? ['ping'] : recursos, status, erro: erro?.slice(0, 300) ?? null, duracaoMs: Date.now() - inicio } })
    .catch(() => undefined)
  return { ok: !erro, status, erro }
}

/** Avisa todo webhook ativo, de app ativo, que assina algum dos recursos mudados — e só dos recursos que
 *  o app pode ler. Chamado pelo aviso automático (src/lib/integracao/aviso.ts). Nunca lança. */
export async function dispararWebhooks(recursos: string[]): Promise<void> {
  if (recursos.length === 0) return
  try {
    const hooks = await prisma.apiWebhook.findMany({
      where: { ativo: true, app: { ativo: true }, eventos: { hasSome: recursos } },
      select: { id: true, url: true, segredo: true, eventos: true, app: { select: { escopos: true } } },
    })
    await Promise.all(
      hooks.map(async (h) => {
        const alvo = recursos.filter((r) => h.eventos.includes(r) && h.app.escopos.includes(escopoDeLeitura(r)))
        if (alvo.length === 0) return
        await enviarWebhook(h, 'recursos.alterados', alvo)
        await podarEntregas(h.id)
      })
    )
  } catch (e) {
    console.warn('[api] webhooks não saíram', e)
  }
}

async function podarEntregas(webhookId: string) {
  const velhas = await prisma.apiWebhookEntrega.findMany({
    where: { webhookId },
    orderBy: { criadoEm: 'desc' },
    skip: ENTREGAS_GUARDADAS,
    select: { id: true },
  })
  if (velhas.length) await prisma.apiWebhookEntrega.deleteMany({ where: { id: { in: velhas.map((v) => v.id) } } })
}
