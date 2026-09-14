import { diffWordsWithSpace } from 'diff'

/**
 * Uma troca pontual num texto-base (o Markdown da proposta): `antes` sai,
 * `depois` entra, em cada uma das `posicoes` (offset no texto-base onde
 * `antes` começa). Serve tanto pra correção automática da checagem por IA
 * (uma mudança por trecho suspeito) quanto pra revisão de português (uma
 * mudança por palavra/grupo de palavras que a IA trocou).
 *
 * Tudo aqui é aplicado POR POSIÇÃO a partir de um texto-base fixo — nunca
 * por busca-e-troca em cascata. Isso garante duas coisas: uma correção nunca
 * "pega" o texto que outra acabou de inserir, e dá pra ligar/desligar
 * qualquer mudança isoladamente (desfazer uma só) recalculando do base.
 *
 * Sem import de `ai`/`zod` — roda no navegador.
 */
export interface Mudanca {
  id: string
  posicoes: number[]
  antes: string
  depois: string
  pagina?: number
  motivo?: string
}

export interface TrechoComCorrecao {
  trecho: string
  correcaoSugerida?: string | null
  pagina?: number
  motivo?: string
}

/**
 * Converte os trechos da checagem por IA em mudanças ancoradas no texto-base.
 * Ignora trecho sem correção, correção igual ao trecho, e trecho que não
 * existe mais no texto (a pessoa editou aquele ponto depois da checagem).
 *
 * Trecho AMBÍGUO — que aparece mais de uma vez no texto-base — também é
 * ignorado (não vira mudança), mesmo que todas as ocorrências estejam
 * livres. A correção foi ancorada só no texto original de UMA página
 * (`correcaoEhSegura` em `checarConversao.ts`), e o Markdown final não tem
 * marcador de fronteira de página pra restringir a busca a ela: aplicar a
 * mesma correção em toda ocorrência do trecho arriscaria corrigir um trecho
 * de OUTRA página que já estava certo (ex.: o mesmo valor monetário citado
 * em duas linhas diferentes, um errado e um certo). Nesses casos o item
 * sobra pra conferência manual em vez de arriscar aplicar no lugar errado.
 *
 * Se dois trechos (cada um já sem ambiguidade) se sobrepõem, o primeiro da
 * lista fica com a região e o segundo pula aquela ocorrência — evita aplicar
 * duas trocas no mesmo pedaço de texto.
 */
export function mudancasDaChecagem(base: string, trechos: TrechoComCorrecao[]): Mudanca[] {
  const ocupadas: Array<[number, number]> = []
  const mudancas: Mudanca[] = []

  trechos.forEach((item, indice) => {
    const { trecho, correcaoSugerida } = item
    if (!trecho || !correcaoSugerida || correcaoSugerida === trecho) return

    const candidatos: Array<[number, number]> = []
    let desde = 0
    for (;;) {
      const posicao = base.indexOf(trecho, desde)
      if (posicao === -1) break
      const fim = posicao + trecho.length
      const livre = !ocupadas.some(([a, b]) => posicao < b && fim > a)
      if (livre && !jaCorrigidoAqui(base, posicao, trecho, correcaoSugerida)) {
        candidatos.push([posicao, fim])
      }
      desde = fim
    }

    if (candidatos.length !== 1) return // nenhuma ocorrência livre, ou ambíguo demais pra confiar

    const [posicao, fim] = candidatos[0]
    ocupadas.push([posicao, fim])
    mudancas.push({
      id: `t${indice}`,
      posicoes: [posicao],
      antes: trecho,
      depois: correcaoSugerida,
      pagina: item.pagina,
      motivo: item.motivo,
    })
  })

  return mudancas
}

/**
 * Quando a correção CONTÉM o trecho (ex.: "R$ 100" → "R$ 100,00"), depois
 * de aplicada o trecho continua existindo no texto — sem essa checagem, um
 * segundo clique aplicaria de novo e viraria "R$ 100,00,00". Aqui a
 * ocorrência é pulada se, naquela posição, o texto já é a correção inteira.
 */
function jaCorrigidoAqui(base: string, posicao: number, trecho: string, correcao: string): boolean {
  let deslocamento = correcao.indexOf(trecho)
  while (deslocamento !== -1) {
    const inicio = posicao - deslocamento
    if (inicio >= 0 && base.startsWith(correcao, inicio)) return true
    deslocamento = correcao.indexOf(trecho, deslocamento + 1)
  }
  return false
}

/**
 * Quebra a diferença entre dois textos inteiros (ex.: original × revisado
 * pela IA) em mudanças pontuais — cada grupo contíguo de palavras
 * removidas/adicionadas vira uma mudança. Usa `diffWordsWithSpace` (espaço
 * conta como token) pra que reaplicar todas as mudanças no original devolva
 * EXATAMENTE o corrigido, byte a byte.
 */
export function mudancasEntreTextos(original: string, corrigido: string): Mudanca[] {
  if (original === corrigido) return []

  const mudancas: Mudanca[] = []
  let offset = 0
  let atual: { inicio: number; antes: string; depois: string } | null = null

  function fechar() {
    if (!atual) return
    mudancas.push({ id: `m${mudancas.length}`, posicoes: [atual.inicio], antes: atual.antes, depois: atual.depois })
    atual = null
  }

  for (const parte of diffWordsWithSpace(original, corrigido)) {
    if (parte.removed) {
      atual ??= { inicio: offset, antes: '', depois: '' }
      atual.antes += parte.value
      offset += parte.value.length
    } else if (parte.added) {
      atual ??= { inicio: offset, antes: '', depois: '' }
      atual.depois += parte.value
    } else {
      fechar()
      offset += parte.value.length
    }
  }
  fechar()

  return mudancas
}

/**
 * Aplica no texto-base só as mudanças cujo id está em `ativas` (todas, se
 * `ativas` não for passado). As posições nunca se sobrepõem (garantido por
 * quem gera as mudanças), então é só costurar os pedaços em ordem.
 */
export function aplicarMudancas(base: string, mudancas: Mudanca[], ativas?: ReadonlySet<string>): string {
  const trocas = mudancas
    .filter((m) => !ativas || ativas.has(m.id))
    .flatMap((m) => m.posicoes.map((posicao) => ({ posicao, antes: m.antes, depois: m.depois })))
    .sort((a, b) => a.posicao - b.posicao)

  let resultado = ''
  let cursor = 0
  for (const { posicao, antes, depois } of trocas) {
    resultado += base.slice(cursor, posicao) + depois
    cursor = posicao + antes.length
  }
  return resultado + base.slice(cursor)
}

/**
 * Pedaço do texto em volta de uma mudança, pra quem está conferindo saber
 * ONDE ela está no documento. Fica sempre na mesma linha do Markdown (não
 * atravessa parágrafo/linha de tabela) e corta em fronteira de palavra.
 */
export function contextoDaMudanca(
  base: string,
  posicao: number,
  tamanhoAntes: number,
  folga = 48
): { antes: string; depois: string } {
  const inicioLinha = base.lastIndexOf('\n', posicao - 1) + 1
  const fimTrecho = posicao + tamanhoAntes
  const quebra = base.indexOf('\n', fimTrecho)
  const fimLinha = quebra === -1 ? base.length : quebra

  let de = Math.max(inicioLinha, posicao - folga)
  if (de > inicioLinha) {
    const espaco = base.indexOf(' ', de)
    if (espaco !== -1 && espaco < posicao) de = espaco + 1
  }

  let ate = Math.min(fimLinha, fimTrecho + folga)
  if (ate < fimLinha) {
    const espaco = base.lastIndexOf(' ', ate)
    if (espaco > fimTrecho) ate = espaco
  }

  return {
    antes: (de > inicioLinha ? '…' : '') + base.slice(de, posicao),
    depois: base.slice(fimTrecho, ate) + (ate < fimLinha ? '…' : ''),
  }
}
