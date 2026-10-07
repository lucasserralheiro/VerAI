import { diffArrays, type ArrayChange } from 'diff'
import type { PaginaConvertida } from '../pdfHtml'

/**
 * Fidelidade do HTML ao texto do PDF — a pergunta "saiu EXATAMENTE igual?"
 * reduzida ao que dá pra medir sem olho humano: tudo o que estava escrito na
 * página está no HTML, na mesma ordem, e nada apareceu do nada.
 *
 * As outras métricas da régua (tabela de 1 coluna, aritmética da linha...)
 * procuram SINTOMA de defeito conhecido. Esta não depende de saber qual é o
 * defeito: célula engolida, parágrafo duplicado na quebra de página, valor
 * que trocou de lugar com o vizinho — tudo vira palavra perdida, sobrando ou
 * fora de ordem.
 *
 * Base da comparação: `paginasConvertidas[].textoOriginal` (linhas da página
 * em ordem de leitura, já com o reparo da camada de texto) × o texto visível
 * de `paginasConvertidas[].html`. Página que foi pro OCR fica de fora dos dois
 * lados — o marcador de OCR pendente não é palavra inventada.
 *
 * O número absoluto tem ruído conhecido e ESTÁVEL (hifenização juntada,
 * "BRL269,00" grudado no PDF e separado em célula no HTML); o que a régua
 * compara é o antes × depois do mesmo arquivo. Número (`\d…`) é medido à
 * parte porque é o invariante que não se negocia: valor, código de serviço e
 * data nunca podem sumir nem aparecer.
 */
export interface Fidelidade {
  palavrasNoPdf: number
  palavrasPerdidas: number
  palavrasSobrando: number
  /** Palavras presentes dos dois lados, mas em outra posição no HTML. */
  palavrasForaDeOrdem: number
  /** `false` quando a diferença era grande demais pra medir ordem a tempo. */
  ordemMedida: boolean
  numerosNoPdf: number
  numerosPerdidos: number
  numerosSobrando: number
  /** Até 5 de cada, pra pessoa achar o ponto no documento. */
  exemploNumerosPerdidos: string[]
  exemploNumerosSobrando: string[]
  exemploPalavrasPerdidas: string[]
}

/** Acima disso o diff de ordem desiste (custo O(N·D)) e a ordem fica "não medida". */
const MAXIMO_EDICOES_ORDEM = 4000
const EXEMPLOS = 5

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

/** Texto que a pessoa VÊ no HTML: sem tag, sem imagem, entidades resolvidas. */
export function textoVisivelDoHtml(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Palavras, sem a pontuação das pontas: "(1.200,00)." → "1.200,00". Token só
 *  de pontuação/marcador ("•", "-", "|") não conta — vira estrutura no HTML. */
export function palavras(texto: string): string[] {
  return texto
    .split(/\s+/)
    .map((t) => t.normalize('NFC').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((t) => t.length > 0)
}

/** Números como aparecem escritos — "1.234,56", "12.074.00005.00", "01/02/2024"
 *  são UM número cada. Achados no texto corrido, então "BRL269,00" dá "269,00". */
export function numeros(texto: string): string[] {
  return texto.match(/\d+(?:[.,/:]\d+)*/g) ?? []
}

/** O que está em `a` e falta em `b`, contando repetição. */
function faltandoEm(a: string[], b: string[]): string[] {
  const contagem = new Map<string, number>()
  for (const t of b) contagem.set(t, (contagem.get(t) ?? 0) + 1)
  const faltando: string[] = []
  for (const t of a) {
    const resta = contagem.get(t) ?? 0
    if (resta > 0) contagem.set(t, resta - 1)
    else faltando.push(t)
  }
  return faltando
}

function unicos(lista: string[], limite: number): string[] {
  return [...new Set(lista)].slice(0, limite)
}

export function medirFidelidade(paginas: Pick<PaginaConvertida, 'textoOriginal' | 'html'>[]): Fidelidade {
  // `textoOriginal` sai de `formatarTexto`: traz <strong>/<em>/<u> e texto escapado — limpa igual ao HTML.
  const original = paginas.map((p) => textoVisivelDoHtml(p.textoOriginal)).join('\n')
  const convertido = paginas.map((p) => textoVisivelDoHtml(p.html)).join(' ')

  const noPdf = palavras(original)
  const noHtml = palavras(convertido)
  const perdidas = faltandoEm(noPdf, noHtml)
  const sobrando = faltandoEm(noHtml, noPdf)

  // Diff de sequência (Myers): o que ele marca como removido e NÃO está entre
  // as perdidas existe no HTML — só que em outro lugar.
  // Com `maxEditLength` o jsdiff devolve `undefined` quando desiste — os tipos não contam isso.
  const mudancas = diffArrays(noPdf, noHtml, { maxEditLength: MAXIMO_EDICOES_ORDEM }) as ArrayChange<string>[] | undefined
  const removidas = mudancas?.filter((m) => m.removed).reduce((n, m) => n + m.value.length, 0) ?? 0

  const numerosPdf = numeros(original)
  const numerosHtml = numeros(convertido)
  const numerosPerdidos = faltandoEm(numerosPdf, numerosHtml)
  const numerosSobrando = faltandoEm(numerosHtml, numerosPdf)

  return {
    palavrasNoPdf: noPdf.length,
    palavrasPerdidas: perdidas.length,
    palavrasSobrando: sobrando.length,
    palavrasForaDeOrdem: mudancas ? Math.max(0, removidas - perdidas.length) : 0,
    ordemMedida: Boolean(mudancas),
    numerosNoPdf: numerosPdf.length,
    numerosPerdidos: numerosPerdidos.length,
    numerosSobrando: numerosSobrando.length,
    exemploNumerosPerdidos: unicos(numerosPerdidos, EXEMPLOS),
    exemploNumerosSobrando: unicos(numerosSobrando, EXEMPLOS),
    exemploPalavrasPerdidas: unicos(perdidas, EXEMPLOS),
  }
}

// ─── Conferência do texto na tela da proposta ─────────────────────────────────

/** Uma fonte de texto original: página de PDF (`pagina` = número) ou arquivo Word (`pagina` = null). */
export interface FonteDeTexto {
  origem: string
  pagina: number | null
  textoOriginal: string
}

export interface NumeroPerdido {
  numero: string
  origem: string
  pagina: number | null
  /** A linha do original onde o número está — o "no PDF" da comparação. */
  contexto: string
}

/**
 * O que o usuário vê na tela da proposta: TODO número do original (valor, código de serviço, data,
 * quantidade, item) está no documento atual, quantas vezes aparece lá? Diferente da conferência de
 * totais, que olha só valor monetário e só pergunta "existe em algum lugar": aqui um valor que
 * aparecia 3 vezes e ficou 2 é acusado, e o código de serviço e a data também entram.
 *
 * É a régua da conversão (`npm run regua:conversao`) rodando em cada documento real, sem ninguém
 * precisar rodar nada — e comparando com o documento como está AGORA, depois das edições.
 * `compararSobra` só quando o documento tem uma fonte só: com vários arquivos juntos, número "a mais"
 * pode ser de um arquivo que não entrou na conta (planilha, título com o nome do arquivo).
 */
export interface ConferenciaDeTexto {
  numerosNoOriginal: number
  /** Quantos sumiram — a lista abaixo para em 50. */
  quantidadeNumerosPerdidos: number
  numerosPerdidos: NumeroPerdido[]
  quantidadeNumerosSobrando: number
  numerosSobrando: string[]
  palavrasNoOriginal: number
  palavrasPerdidas: number
  exemploPalavrasPerdidas: string[]
}

const LIMITE_LISTA = 50

export function conferirTextoDoOriginal(
  fontes: FonteDeTexto[],
  documentoHtml: string,
  { compararSobra }: { compararSobra: boolean }
): ConferenciaDeTexto {
  const documento = textoVisivelDoHtml(documentoHtml)

  // Cada número do original com de onde veio, na ordem de leitura.
  const doOriginal: { numero: string; fonte: FonteDeTexto; linha: string }[] = []
  for (const fonte of fontes) {
    for (const linha of fonte.textoOriginal.split('\n').map(textoVisivelDoHtml)) {
      for (const numero of numeros(linha)) doOriginal.push({ numero, fonte, linha })
    }
  }
  const noDocumento = numeros(documento)
  const quantosPerdidos = new Map<string, number>()
  for (const n of faltandoEm(doOriginal.map((o) => o.numero), noDocumento)) {
    quantosPerdidos.set(n, (quantosPerdidos.get(n) ?? 0) + 1)
  }

  // QUAL ocorrência sumiu: o alinhamento em ordem (Myers) aponta a posição; se desistir, ficam as últimas.
  const alinhamento = diffArrays(
    doOriginal.map((o) => o.numero),
    noDocumento,
    { maxEditLength: MAXIMO_EDICOES_ORDEM }
  ) as ArrayChange<string>[] | undefined
  const posicoesRemovidas: number[] = []
  if (alinhamento) {
    let posicao = 0
    for (const parte of alinhamento) {
      if (parte.added) continue
      if (parte.removed) for (let i = 0; i < parte.value.length; i++) posicoesRemovidas.push(posicao + i)
      posicao += parte.value.length
    }
  }
  const usadas = new Set<number>()
  const escolher = (posicao: number) => {
    const { numero } = doOriginal[posicao]
    const resta = quantosPerdidos.get(numero) ?? 0
    if (resta === 0 || usadas.has(posicao)) return
    quantosPerdidos.set(numero, resta - 1)
    usadas.add(posicao)
  }
  for (const posicao of posicoesRemovidas) escolher(posicao)
  // Quem o alinhamento não apontou (ou se ele desistiu) entra pela última ocorrência.
  for (let posicao = doOriginal.length - 1; posicao >= 0; posicao--) escolher(posicao)

  const perdidos: NumeroPerdido[] = [...usadas]
    .sort((a, b) => a - b)
    .map((posicao) => {
      const { numero, fonte, linha } = doOriginal[posicao]
      return { numero, origem: fonte.origem, pagina: fonte.pagina, contexto: linha.slice(0, 300) }
    })

  const palavrasOriginal = palavras(fontes.map((f) => textoVisivelDoHtml(f.textoOriginal)).join(' '))
  const palavrasPerdidas = faltandoEm(palavrasOriginal, palavras(documento))
  const sobrando = compararSobra ? faltandoEm(noDocumento, doOriginal.map((o) => o.numero)) : []

  return {
    numerosNoOriginal: doOriginal.length,
    quantidadeNumerosPerdidos: perdidos.length,
    numerosPerdidos: perdidos.slice(0, LIMITE_LISTA),
    quantidadeNumerosSobrando: sobrando.length,
    numerosSobrando: unicos(sobrando, LIMITE_LISTA),
    palavrasNoOriginal: palavrasOriginal.length,
    palavrasPerdidas: palavrasPerdidas.length,
    exemploPalavrasPerdidas: unicos(palavrasPerdidas, 20),
  }
}
