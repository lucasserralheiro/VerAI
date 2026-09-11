/**
 * Cache em memória (nível de módulo) da checagem por IA em andamento por
 * proposta — mesmo padrão de `revisaoPortuguesEmAndamento.ts`/
 * `ocrEmAndamento.ts`, mas iniciada sozinha (não por clique): sair da aba no
 * meio não perde o resultado, e montar o painel duas vezes não dispara duas
 * chamadas.
 */

export interface TrechoSuspeitoIa {
  pagina: number
  trecho: string
  motivo: string
}

export interface ResultadoChecagemIa {
  scoreExibido: number | null
  trechosSuspeitos: TrechoSuspeitoIa[]
}

export type EntradaChecagemIa =
  | { status: 'rodando'; promise: Promise<ResultadoChecagemIa> }
  | { status: 'ok'; resultado: ResultadoChecagemIa }
  | { status: 'erro'; mensagem: string }

const cache = new Map<string, EntradaChecagemIa>()

export function checagemIaAtual(propostaId: string): EntradaChecagemIa | undefined {
  return cache.get(propostaId)
}

export function iniciarChecagemIa(propostaId: string): Promise<ResultadoChecagemIa> {
  const atual = cache.get(propostaId)
  if (atual?.status === 'rodando') return atual.promise

  const promise = (async (): Promise<ResultadoChecagemIa> => {
    const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/checagem-ia`, { method: 'POST' })
    const corpo = await resposta.json().catch(() => null)
    if (!resposta.ok) {
      throw new Error(corpo?.error ?? 'Não foi possível checar a conversão.')
    }
    return corpo as ResultadoChecagemIa
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

export function limparChecagemIa(propostaId: string): void {
  cache.delete(propostaId)
}
