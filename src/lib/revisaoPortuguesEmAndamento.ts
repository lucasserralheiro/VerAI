/**
 * Cache em memória (nível de módulo) da revisão de português por proposta.
 *
 * A chamada de revisão é lenta; se o usuário clica em "Revisar português" e sai
 * da aba, o componente desmonta — sem isso a requisição seria perdida e ele
 * teria que clicar de novo (nova chamada). Aqui a requisição continua rodando
 * e, ao voltar pra aba, o painel recupera o resultado (ou o "carregando").
 *
 * Uma única revisão por proposta fica em andamento: clicar de novo enquanto
 * roda devolve a MESMA promise, nunca dispara uma segunda chamada.
 *
 * Vive só na sessão do navegador (some no reload da página).
 */

export interface ResultadoRevisao {
  original: string
  corrigido: string
}

export type EntradaRevisao =
  | { status: 'rodando'; promise: Promise<ResultadoRevisao> }
  | { status: 'ok'; resultado: ResultadoRevisao }
  | { status: 'erro'; mensagem: string }

const cache = new Map<string, EntradaRevisao>()

export function revisaoAtual(propostaId: string): EntradaRevisao | undefined {
  return cache.get(propostaId)
}

export function iniciarRevisao(propostaId: string, markdown: string): Promise<ResultadoRevisao> {
  const atual = cache.get(propostaId)
  if (atual?.status === 'rodando') return atual.promise

  const promise = (async (): Promise<ResultadoRevisao> => {
    const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/revisao-portugues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudoMarkdown: markdown }),
    })
    const corpo = await resposta.json().catch(() => null)
    if (!resposta.ok) {
      throw new Error(corpo?.error ?? 'Não foi possível revisar o texto.')
    }
    return { original: corpo.original as string, corrigido: corpo.corrigido as string }
  })()

  cache.set(propostaId, { status: 'rodando', promise })
  promise.then(
    (resultado) => {
      if (cache.get(propostaId)?.status === 'rodando') cache.set(propostaId, { status: 'ok', resultado })
    },
    (erro) => {
      if (cache.get(propostaId)?.status === 'rodando') {
        cache.set(propostaId, { status: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) })
      }
    }
  )
  return promise
}

/** Esquece a revisão dessa proposta — chamado quando o usuário aceita ou
 *  descarta o resultado, pra o próximo "Revisar" começar do zero. */
export function limparRevisao(propostaId: string): void {
  cache.delete(propostaId)
}
