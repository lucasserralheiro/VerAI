/**
 * Cache em memória (nível de módulo) do OCR em andamento por proposta — mesmo
 * padrão de `revisaoPortuguesEmAndamento.ts`: sair da aba no meio do OCR não
 * perde o progresso, e clicar em "Rodar OCR" de novo enquanto já está rodando
 * nunca dispara um segundo lote.
 */

export type EntradaOcr =
  | { status: 'rodando'; promise: Promise<string> }
  | { status: 'ok'; markdown: string }
  | { status: 'erro'; mensagem: string }

const cache = new Map<string, EntradaOcr>()

export function ocrAtual(propostaId: string): EntradaOcr | undefined {
  return cache.get(propostaId)
}

export function iniciarOcr(propostaId: string, rodar: () => Promise<string>): Promise<string> {
  const atual = cache.get(propostaId)
  if (atual?.status === 'rodando') return atual.promise

  const promise = rodar()
  cache.set(propostaId, { status: 'rodando', promise })
  promise.then(
    (markdown) => {
      if (cache.get(propostaId)?.status === 'rodando') cache.set(propostaId, { status: 'ok', markdown })
    },
    (erro) => {
      if (cache.get(propostaId)?.status === 'rodando') {
        cache.set(propostaId, { status: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) })
      }
    }
  )
  return promise
}

export function limparOcr(propostaId: string): void {
  cache.delete(propostaId)
}
