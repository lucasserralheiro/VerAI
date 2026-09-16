/**
 * Cache em memória (nível de módulo) da conferência de totais em andamento
 * por proposta — mesmo padrão de `checagemIaEmAndamento.ts`: iniciada
 * sozinha ao montar o card (ver `card-conferencia-totais.tsx`), sair da
 * aba no meio não perde o resultado, montar o card duas vezes não duplica
 * a chamada.
 */

export interface TotalConferidoCliente {
  /** Rótulo de exibição da fonte: "Página 3" (PDF) ou nome do arquivo (Word). */
  origem: string
  /** Número real da página — só quando a fonte é uma página de PDF (usado
   *  pra abrir "Ver no PDF"); `null` nos outros formatos. */
  pagina: number | null
  rotulo: string
  valorNoOriginal: string
  encontradoNoDocumento: boolean
  ocorrenciasNoDocumento: number
}

export interface CelulaConferidaCliente {
  texto: string
  ehValor: boolean
  encontradoNoDocumento?: boolean
}

/** Tabela reconstruída (mesma linha/coluna do original), pra pessoa bater o
 *  olho na mesma forma visual da tabela do PDF/planilha, não numa lista
 *  achatada de valor solto. */
export interface TabelaConferidaCliente {
  origem: string
  pagina: number | null
  linhas: CelulaConferidaCliente[][]
}

export interface ResultadoConferenciaTotais {
  totais: TotalConferidoCliente[]
  tabelas: TabelaConferidaCliente[]
  checadoEm: string | null
}

export type EntradaConferenciaTotais =
  | { status: 'rodando'; promise: Promise<ResultadoConferenciaTotais> }
  | { status: 'ok'; resultado: ResultadoConferenciaTotais }
  | { status: 'erro'; mensagem: string }

const cache = new Map<string, EntradaConferenciaTotais>()

export function conferenciaTotaisAtual(propostaId: string): EntradaConferenciaTotais | undefined {
  return cache.get(propostaId)
}

export function iniciarConferenciaTotais(propostaId: string): Promise<ResultadoConferenciaTotais> {
  const atual = cache.get(propostaId)
  if (atual?.status === 'rodando') return atual.promise

  const promise = (async (): Promise<ResultadoConferenciaTotais> => {
    const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/conferir-totais`, { method: 'POST' })
    const corpo = await resposta.json().catch(() => null)
    if (!resposta.ok) {
      throw new Error(corpo?.error ?? 'Não foi possível conferir os totais.')
    }
    // Normaliza na borda — corpo inesperado vira "sem totais" em vez de
    // corromper o resto da tela (mesmo padrão de `iniciarChecagemIa`).
    const totais = Array.isArray(corpo?.totais) ? corpo.totais : []
    const tabelas = Array.isArray(corpo?.tabelas) ? corpo.tabelas : []
    const checadoEm = typeof corpo?.checadoEm === 'string' ? corpo.checadoEm : null
    return { totais, tabelas, checadoEm }
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

export function limparConferenciaTotais(propostaId: string): void {
  cache.delete(propostaId)
}
