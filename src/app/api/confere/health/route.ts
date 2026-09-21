import { NextResponse } from 'next/server'

/** Teto do ping. Acima disso a resposta não interessa mais: o objetivo é só
 *  **acordar** o serviço, e o despertar segue acontecendo do lado do Render
 *  mesmo depois de desistirmos de esperar. */
const TIMEOUT_MS = 8_000

/** Acima disso o serviço estava hibernando (medido acordado: ~200ms). O
 *  número não decide nada crítico — só faz a tela dizer "acordando o serviço"
 *  em vez de prometer 25 segundos que virariam 85. */
const LIMIAR_DE_HIBERNACAO_MS = 3_000

/**
 * Ping no `/health` do Confere, usado para **pré-aquecer** o serviço.
 *
 * O Confere roda no plano free do Render, que hiberna o contêiner depois de
 * alguns minutos parado: a primeira requisição do dia paga ~1min de cold start
 * **antes** de começar os ~25s de geração. Chamando isto quando a pessoa
 * escolhe o primeiro arquivo, o despertar acontece enquanto ela escolhe o
 * segundo e confere o que selecionou — tempo que já era dela.
 *
 * `/health` é isento do segredo compartilhado do lado do Confere (é o endpoint
 * que a própria hospedagem usa para monitorar), então não há o que injetar
 * aqui. A rota existe mesmo assim para o navegador nunca conhecer a URL do
 * serviço.
 */
export async function GET() {
  const baseUrl = process.env.CONFERE_SERVICE_URL
  if (!baseUrl) {
    return NextResponse.json({ ok: false, dormindo: false, ms: 0 })
  }

  const inicio = Date.now()
  try {
    const resposta = await fetch(`${baseUrl}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const ms = Date.now() - inicio
    return NextResponse.json({
      ok: resposta.ok,
      dormindo: ms > LIMIAR_DE_HIBERNACAO_MS,
      ms,
    })
  } catch {
    // Falha e estouro do teto caem no mesmo lugar, e os dois significam a
    // mesma coisa para quem chamou: não dá para prometer resposta rápida.
    return NextResponse.json({ ok: false, dormindo: true, ms: Date.now() - inicio })
  }
}
