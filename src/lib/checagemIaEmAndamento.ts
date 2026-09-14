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
  /** O que o PDF diz nesse ponto (conferido no servidor contra o original).
   *  Ausente em checagem antiga ou quando não houve correspondente. */
  trechoOriginal?: string | null
  /** `true` quando `trechoOriginal` é o recorte específico do trecho —
   *  seguro pra usar como substituição direta. `false`/ausente quando é o
   *  fallback de página inteira: boa referência, grande demais pra trocar
   *  sozinho no lugar de um trecho pequeno. */
  trechoOriginalEspecifico?: boolean
  /** Substituição sugerida pra `trecho`, já validada no servidor contra o
   *  texto original da página. `null`/ausente quando não há correção segura
   *  pra aplicar — o item continua só informativo. */
  correcaoSugerida?: string | null
  /** A IA sugeriu, mas a sugestão não bate com o PDF e foi descartada. */
  correcaoDescartada?: boolean
}

export interface ResultadoChecagemIa {
  scoreExibido: number | null
  trechosSuspeitos: TrechoSuspeitoIa[]
  /** Páginas com imagem de conteúdo embutida (possível tabela/gráfico que
   *  não virou texto) — a IA não vê o pixel, só aponta onde olhar. */
  paginasComImagem: number[]
  /** Quando a checagem foi feita (ISO) — o resultado fica salvo na proposta
   *  e volta igual no F5; `null` em resposta antiga. */
  checadoEm: string | null
  /** true depois que "Corrigir N automaticamente" já foi usado nesta
   *  proposta — o painel para de oferecer esse botão em lote a partir daí
   *  (fica assim pra sempre, ver `marcarCorrecaoAutomaticaAplicada`). */
  correcaoAutomaticaAplicada: boolean
}

export type EntradaChecagemIa =
  | { status: 'rodando'; promise: Promise<ResultadoChecagemIa> }
  | { status: 'ok'; resultado: ResultadoChecagemIa }
  | { status: 'erro'; mensagem: string }

const cache = new Map<string, EntradaChecagemIa>()

export function checagemIaAtual(propostaId: string): EntradaChecagemIa | undefined {
  return cache.get(propostaId)
}

/** `refazer` ignora o resultado salvo no servidor e roda a checagem de novo
 *  ("Checar de novo"). Sem ele, o servidor devolve o que já tinha salvo,
 *  quando ainda vale (PDFs e documento sem mudança desde então).
 *  `conteudoMarkdown` manda checar contra o Markdown de AGORA — "Auditar PDF
 *  depois das mudanças" — em vez do que já está salvo na proposta; nunca
 *  serve do cache no servidor, sempre roda na hora. */
export function iniciarChecagemIa(
  propostaId: string,
  opcoes: { refazer?: boolean; conteudoMarkdown?: string } = {}
): Promise<ResultadoChecagemIa> {
  const atual = cache.get(propostaId)
  if (atual?.status === 'rodando') return atual.promise

  const url = `/api/propostas-comerciais/${propostaId}/checagem-ia${opcoes.refazer ? '?refazer=1' : ''}`
  const promise = (async (): Promise<ResultadoChecagemIa> => {
    const resposta = await fetch(url, {
      method: 'POST',
      ...(opcoes.conteudoMarkdown
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conteudoMarkdown: opcoes.conteudoMarkdown }),
          }
        : {}),
    })
    const corpo = await resposta.json().catch(() => null)
    if (!resposta.ok) {
      throw new Error(corpo?.error ?? 'Não foi possível checar a conversão.')
    }
    // Normaliza a resposta na borda — um corpo inesperado (endpoint com
    // versão diferente, mock de teste incompleto) não vira score/trecho
    // corrompido pro resto do app; vira "sem score" em vez de derrubar a tela.
    const scoreExibido = typeof corpo?.scoreExibido === 'number' ? corpo.scoreExibido : null
    const trechosSuspeitos = Array.isArray(corpo?.trechosSuspeitos) ? corpo.trechosSuspeitos : []
    const paginasComImagem = Array.isArray(corpo?.paginasComImagem) ? corpo.paginasComImagem : []
    const checadoEm = typeof corpo?.checadoEm === 'string' ? corpo.checadoEm : null
    const correcaoAutomaticaAplicada = corpo?.correcaoAutomaticaAplicada === true
    return { scoreExibido, trechosSuspeitos, paginasComImagem, checadoEm, correcaoAutomaticaAplicada }
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

/**
 * Grava que "Corrigir N automaticamente" já foi usado nesta proposta — sem
 * rodar checagem nenhuma, só marca a proposta (ver a rota). Chamado pelo
 * painel assim que a pessoa aplica a primeira leva de correções em lote;
 * dali em diante o servidor devolve `correcaoAutomaticaAplicada: true` em
 * toda checagem dessa proposta, e o painel para de mostrar o botão.
 * Atualiza o cache local na hora, sem esperar a próxima checagem, pra não
 * reaparecer se a pessoa auditar de novo antes da marca ter sido lida.
 */
export async function marcarCorrecaoAutomaticaAplicada(propostaId: string): Promise<void> {
  const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/checagem-ia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marcarCorrecaoAutomaticaAplicada: true }),
  })
  if (!resposta.ok) return
  const atual = cache.get(propostaId)
  if (atual?.status === 'ok') {
    cache.set(propostaId, { status: 'ok', resultado: { ...atual.resultado, correcaoAutomaticaAplicada: true } })
  }
}
