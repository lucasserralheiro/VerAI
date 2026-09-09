import { extractTextItems, getDocumentProxy, type StructuredTextItem } from 'unpdf'
import { extrairSegmentosRetosPorPagina, type SegmentoReto } from './pdfTracos'
import { construirGradeDaPagina, detectarTabelaPorBordas, type GradeDeTabela } from './pdfTabelas'

/** Gap horizontal (em pontos) acima do qual duas células passam a ser consideradas
 *  colunas separadas de uma tabela, em vez de duas palavras na mesma frase. */
const LIMIAR_GAP_COLUNA = 24

/** Tolerância (em pontos) pra tratar duas âncoras de coluna próximas como a mesma
 *  coluna, ao unificar as colunas detectadas em linhas diferentes de uma tabela
 *  (ex: cabeçalho e linhas de dados raramente alinham exatamente). */
const TOLERANCIA_ANCORA_COLUNA = 10

/** Acima desse tamanho, mesmo uma linha com fonte maior que o corpo do texto não
 *  vira título — título de verdade é curto; frase longa com fonte um pouco maior
 *  é ruído de medição da extração, não uma seção nova. */
const LIMIAR_TAMANHO_TITULO = 80

/** Distância (em pontos) abaixo da linha de base do texto onde um traço de
 *  sublinhado costuma ser desenhado. */
const DISTANCIA_MIN_SUBLINHADO = 0.5
const DISTANCIA_MAX_SUBLINHADO = 4
/** Fração mínima da largura do trecho que o traço precisa cobrir pra contar
 *  como sublinhado (evita marcar por causa de um traço decorativo curto). */
const COBERTURA_MIN_SUBLINHADO = 0.7

/** Folga mínima (em pontos) dos dois lados, e tolerância de simetria entre
 *  elas, pra uma linha curta contar como centralizada. */
const FOLGA_MINIMA_CENTRALIZADO = 8
const TOLERANCIA_SIMETRIA_CENTRALIZADO = 12
/** Uma linha "centralizada" também precisa ser bem mais estreita que a
 *  largura útil do documento — senão qualquer linha de corpo comum, com
 *  folgas pequenas e parecidas por acaso, seria marcada como centralizada. */
const LARGURA_MAXIMA_CENTRALIZADO = 0.85

/** Tolerância (em pontos) pra considerar que o fim de uma linha "toca" a
 *  margem direita do documento — sinal de parágrafo justificado. */
const TOLERANCIA_MARGEM_JUSTIFICADO = 4

const REGEX_LISTA_NUMERADA = /^(\d+)[.)]\s+(.*)$/
const REGEX_LISTA_MARCADOR = /^[•\-*]\s+(.*)$/
/** Fim de frase/parágrafo: pontuação final, opcionalmente seguida de aspas/parêntese. */
const REGEX_PONTUACAO_FINAL = /[.:;!?]["'”)\]]?$/

export interface ItemLinha {
  texto: string
  x: number
  width: number
  negrito: boolean
  italico: boolean
  sublinhado: boolean
}

export interface Linha {
  itens: ItemLinha[]
  fontSizeMedio: number
  y: number
  pagina: number
}

interface Margens {
  esquerda: number
  direita: number
}

/**
 * Converte o conteúdo de um PDF em Markdown, preservando negrito, itálico,
 * sublinhado, alinhamento, título, lista e tabela detectados a partir da
 * fonte, posição e traços vetoriais de cada página — sem usar IA. É uma
 * extração best-effort: negrito/itálico/título são confiáveis (comparação
 * direta de fonte/tamanho); tabela e sublinhado usam as bordas/traços
 * desenhados no PDF quando existem (mais confiável) e caem pra heurística de
 * posição de texto quando não. É esperado que a pessoa ajuste o resultado
 * manualmente antes de copiar.
 *
 * O `hasEOL` do unpdf marca fim de LINHA VISUAL (onde o PDF quebra a linha na
 * página), não fim de parágrafo — por isso linhas consecutivas são reunidas num
 * mesmo bloco até a última linha absorvida terminar em pontuação final (ou até
 * a próxima linha já começar um item de lista/título/tabela novo).
 */
export async function converterPdfParaMarkdown(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { items, totalPages } = await extractTextItems(pdf)
  const segmentosPorPagina = await extrairSegmentosRetosPorPagina(pdf, totalPages)

  const todasAsLinhas: Linha[] = []
  items.forEach((itensDaPagina, pagina) => {
    todasAsLinhas.push(...agruparEmLinhas(itensDaPagina, pagina, segmentosPorPagina[pagina] ?? []))
  })

  // Nenhuma linha é descartada — a Proposta Comercial exige que o texto final
  // seja idêntico ao original, então nem rodapé de paginação ("Page N of M",
  // "Página N de N") é removido: se estava no PDF, entra no Markdown.
  if (todasAsLinhas.length === 0) return ''

  const tamanhoCorpo = calcularTamanhoCorpo(todasAsLinhas)
  const margens = calcularMargens(todasAsLinhas)
  const gradesPorPagina = new Map<number, GradeDeTabela>()
  segmentosPorPagina.forEach((segmentos, pagina) => {
    const grade = construirGradeDaPagina(segmentos)
    if (grade) gradesPorPagina.set(pagina, grade)
  })

  return montarMarkdown(todasAsLinhas, tamanhoCorpo, margens, gradesPorPagina)
}

function agruparEmLinhas(itens: StructuredTextItem[], pagina: number, segmentosDaPagina: SegmentoReto[]): Linha[] {
  const linhas: Linha[] = []
  let atual: StructuredTextItem[] = []

  for (const item of itens) {
    if (item.str.trim().length === 0 && atual.length === 0) continue
    atual.push(item)
    if (item.hasEOL) {
      linhas.push(construirLinha(atual, pagina, segmentosDaPagina))
      atual = []
    }
  }
  if (atual.length > 0) linhas.push(construirLinha(atual, pagina, segmentosDaPagina))

  return linhas
}

function construirLinha(itensBrutos: StructuredTextItem[], pagina: number, segmentosDaPagina: SegmentoReto[]): Linha {
  const itensComTexto = itensBrutos.filter((item) => item.str.trim().length > 0)
  const y = itensComTexto[0]?.y ?? 0

  const itens: ItemLinha[] = itensComTexto.map((item) => ({
    texto: item.str,
    x: item.x,
    width: item.width,
    negrito: /bold|negrito/i.test(item.fontFamily),
    italico: /italic|oblique|itálico/i.test(item.fontFamily),
    sublinhado: temTracoDeSublinhado(item, y, segmentosDaPagina),
  }))
  const fontSizeMedio =
    itensBrutos.reduce((soma, item) => soma + item.fontSize, 0) / (itensBrutos.length || 1)
  return { itens, fontSizeMedio, y, pagina }
}

function temTracoDeSublinhado(item: StructuredTextItem, y: number, segmentosDaPagina: SegmentoReto[]): boolean {
  const inicio = item.x
  const fim = item.x + item.width
  return segmentosDaPagina.some((segmento) => {
    if (segmento.y1 !== segmento.y2) return false // só interessa traço horizontal
    const distancia = y - segmento.y1
    if (distancia < DISTANCIA_MIN_SUBLINHADO || distancia > DISTANCIA_MAX_SUBLINHADO) return false
    const sobreposicao = Math.min(fim, segmento.x2) - Math.max(inicio, segmento.x1)
    return sobreposicao >= (fim - inicio) * COBERTURA_MIN_SUBLINHADO
  })
}

/** Tamanho de fonte predominante do documento, usado como referência de "corpo do
 *  texto" pra decidir o que é título — a moda ponderada pela quantidade de caracteres. */
function calcularTamanhoCorpo(linhas: Linha[]): number {
  const contagem = new Map<number, number>()
  for (const linha of linhas) {
    const texto = linha.itens.map((item) => item.texto).join('')
    const arredondado = Math.round(linha.fontSizeMedio)
    contagem.set(arredondado, (contagem.get(arredondado) ?? 0) + texto.length)
  }

  let tamanhoMaisComum = 0
  let maiorContagem = 0
  for (const [tamanho, contagemCaracteres] of contagem) {
    if (contagemCaracteres > maiorContagem) {
      maiorContagem = contagemCaracteres
      tamanhoMaisComum = tamanho
    }
  }
  return tamanhoMaisComum || 12
}

/** Margens esquerda/direita "úteis" do documento — esquerda é a posição X
 *  mais à esquerda entre todas as linhas, direita é a posição X mais à
 *  direita — usadas como referência pra detectar linha centralizada e
 *  parágrafo justificado. */
function calcularMargens(linhas: Linha[]): Margens {
  let esquerda = Infinity
  let direita = -Infinity
  for (const linha of linhas) {
    if (linha.itens.length === 0) continue
    const primeiro = linha.itens[0]
    const ultimo = linha.itens[linha.itens.length - 1]
    esquerda = Math.min(esquerda, primeiro.x)
    direita = Math.max(direita, ultimo.x + ultimo.width)
  }
  return { esquerda: Number.isFinite(esquerda) ? esquerda : 0, direita: Number.isFinite(direita) ? direita : 0 }
}

function ehCentralizado(linha: Linha, margens: Margens): boolean {
  const larguraTotal = margens.direita - margens.esquerda
  if (larguraTotal <= 0 || linha.itens.length === 0) return false

  const primeiro = linha.itens[0]
  const ultimo = linha.itens[linha.itens.length - 1]
  const inicio = primeiro.x
  const fim = ultimo.x + ultimo.width
  const folgaEsquerda = inicio - margens.esquerda
  const folgaDireita = margens.direita - fim
  const larguraLinha = fim - inicio

  return (
    folgaEsquerda > FOLGA_MINIMA_CENTRALIZADO &&
    folgaDireita > FOLGA_MINIMA_CENTRALIZADO &&
    Math.abs(folgaEsquerda - folgaDireita) <= TOLERANCIA_SIMETRIA_CENTRALIZADO &&
    larguraLinha < larguraTotal * LARGURA_MAXIMA_CENTRALIZADO
  )
}

/** Justificado: parágrafo com 2+ linhas onde todas menos a última terminam
 *  bem perto da margem direita — texto comum alinhado à esquerda tem borda
 *  direita irregular (ragged-right); texto justificado, não. */
function ehJustificado(linhasDoBloco: Linha[], margens: Margens): boolean {
  if (margens.direita <= margens.esquerda) return false
  if (linhasDoBloco.length < 2) return false
  return linhasDoBloco.slice(0, -1).every((linha) => {
    if (linha.itens.length === 0) return false
    const ultimo = linha.itens[linha.itens.length - 1]
    const fim = ultimo.x + ultimo.width
    return margens.direita - fim <= TOLERANCIA_MARGEM_JUSTIFICADO
  })
}

function detectarColunas(linha: Linha): number[] | null {
  if (linha.itens.length < 2) return null

  const anchors = [linha.itens[0].x]
  for (let i = 1; i < linha.itens.length; i++) {
    const anterior = linha.itens[i - 1]
    const atual = linha.itens[i]
    const gap = atual.x - (anterior.x + anterior.width)
    if (gap > LIMIAR_GAP_COLUNA) {
      anchors.push(atual.x)
    }
  }
  return anchors.length >= 2 ? anchors : null
}

/** Adiciona uma âncora de coluna à lista, a não ser que já exista uma âncora bem
 *  próxima — evita duplicar colunas quase-iguais quando cabeçalho e linhas de
 *  dados de uma mesma tabela não alinham exatamente no eixo X. */
function incluirAncora(ancoras: number[], valor: number): void {
  if (!ancoras.some((ancora) => Math.abs(ancora - valor) <= TOLERANCIA_ANCORA_COLUNA)) {
    ancoras.push(valor)
  }
}

/** Aplica negrito/itálico/sublinhado a um trecho de texto — fonte única desse
 *  formato, reaproveitada tanto pra parágrafo comum quanto pra célula de
 *  tabela (posição ou borda). */
export function formatarTexto(item: ItemLinha): string {
  let texto = item.texto
  if (item.negrito && item.italico) texto = `***${texto}***`
  else if (item.negrito) texto = `**${texto}**`
  else if (item.italico) texto = `*${texto}*`
  if (item.sublinhado) texto = `<u>${texto}</u>`
  return texto
}

function linhaParaColunas(linha: Linha, anchors: number[]): string[] {
  const celulas: string[] = anchors.map(() => '')
  for (const item of linha.itens) {
    let indiceColuna = 0
    for (let j = anchors.length - 1; j >= 0; j--) {
      if (item.x >= anchors[j] - 1) {
        indiceColuna = j
        break
      }
    }
    const texto = formatarTexto(item)
    celulas[indiceColuna] = celulas[indiceColuna] ? `${celulas[indiceColuna]} ${texto}` : texto
  }
  return celulas
}

export function montarTabelaMarkdown(linhas: string[][]): string {
  const [cabecalho, ...resto] = linhas
  const separador = cabecalho.map(() => '---')
  return [cabecalho, separador, ...resto].map((linha) => `| ${linha.join(' | ')} |`).join('\n')
}

function extrairTextoLinha(linha: Linha): string {
  return linha.itens.map((item) => formatarTexto(item)).join(' ').trim()
}

function terminaComPontuacaoFinal(texto: string): boolean {
  return REGEX_PONTUACAO_FINAL.test(texto.trim())
}

function ehMarcadorDeLista(texto: string): boolean {
  return REGEX_LISTA_NUMERADA.test(texto) || REGEX_LISTA_MARCADOR.test(texto)
}

/** Título de verdade é curto (ver `LIMIAR_TAMANHO_TITULO`) — frase longa com fonte
 *  um pouco maior é ruído de medição da extração, não uma seção nova do documento. */
function ehTitulo(linha: Linha, tamanhoCorpo: number): boolean {
  const texto = extrairTextoLinha(linha)
  if (texto.length === 0 || texto.length > LIMIAR_TAMANHO_TITULO) return false
  if (ehMarcadorDeLista(texto)) return false
  return linha.fontSizeMedio >= tamanhoCorpo * 1.15
}

function formatarTitulo(linha: Linha, tamanhoCorpo: number, margens: Margens): string {
  const texto = extrairTextoLinha(linha)
  const nivel = linha.fontSizeMedio >= tamanhoCorpo * 1.5 ? 1 : 2
  if (ehCentralizado(linha, margens)) {
    return `<h${nivel} align="center">${texto}</h${nivel}>`
  }
  return `${'#'.repeat(nivel)} ${texto}`
}

function formatarBlocoDeTexto(textos: string[], linhasDoBloco: Linha[], margens: Margens): string {
  const textoCompleto = textos.join(' ')

  const numerada = textoCompleto.match(REGEX_LISTA_NUMERADA)
  if (numerada) return `${numerada[1]}. ${numerada[2]}`

  const marcada = textoCompleto.match(REGEX_LISTA_MARCADOR)
  if (marcada) return `- ${marcada[1]}`

  if (linhasDoBloco.length === 1 && ehCentralizado(linhasDoBloco[0], margens)) {
    return `<p align="center">${textoCompleto}</p>`
  }
  if (linhasDoBloco.length >= 2 && ehJustificado(linhasDoBloco, margens)) {
    return `<p align="justify">${textoCompleto}</p>`
  }

  return textoCompleto
}

/** Reúne, a partir de `indiceInicial`, todas as linhas que ainda fazem parte do
 *  mesmo parágrafo/item de lista: continua absorvendo linhas seguintes enquanto
 *  o texto já absorvido não terminar em pontuação final e a próxima linha não for,
 *  ela mesma, o início de um marcador de lista, um título ou uma linha de tabela. */
function absorverBloco(
  linhas: Linha[],
  indiceInicial: number,
  tamanhoCorpo: number
): { textos: string[]; linhasConsumidas: Linha[]; proximoIndice: number } {
  const linhasConsumidas = [linhas[indiceInicial]]
  const textos = [extrairTextoLinha(linhas[indiceInicial])]
  let j = indiceInicial + 1

  while (j < linhas.length) {
    if (terminaComPontuacaoFinal(textos[textos.length - 1])) break

    const candidata = linhas[j]
    const textoCandidata = extrairTextoLinha(candidata)
    if (ehMarcadorDeLista(textoCandidata)) break
    if (ehTitulo(candidata, tamanhoCorpo)) break
    if (detectarColunas(candidata)) break

    textos.push(textoCandidata)
    linhasConsumidas.push(candidata)
    j++
  }

  return { textos, linhasConsumidas, proximoIndice: j }
}

/** Reúne, a partir de `indiceInicial`, uma sequência de linhas que parecem linhas
 *  de tabela por POSIÇÃO de texto (têm colunas detectáveis), unificando as âncoras
 *  de coluna de todas elas. Fallback usado só quando a página não tem uma grade de
 *  bordas visuais reconhecível (`detectarTabelaPorBordas` devolveu `null`). */
function absorverTabelaPorPosicao(
  linhas: Linha[],
  indiceInicial: number
): { markdown: string; proximoIndice: number } | null {
  const ancorasIniciais = detectarColunas(linhas[indiceInicial])
  if (!ancorasIniciais) return null

  const linhasDaTabela = [linhas[indiceInicial]]
  const ancorasUnificadas = [...ancorasIniciais]
  let j = indiceInicial + 1

  while (j < linhas.length) {
    const ancorasCandidata = detectarColunas(linhas[j])
    if (!ancorasCandidata) break
    linhasDaTabela.push(linhas[j])
    for (const ancora of ancorasCandidata) incluirAncora(ancorasUnificadas, ancora)
    j++
  }

  if (linhasDaTabela.length < 2) return null

  ancorasUnificadas.sort((a, b) => a - b)
  const linhasFormatadas = linhasDaTabela.map((linha) => linhaParaColunas(linha, ancorasUnificadas))
  return { markdown: montarTabelaMarkdown(linhasFormatadas), proximoIndice: j }
}

function montarMarkdown(
  linhas: Linha[],
  tamanhoCorpo: number,
  margens: Margens,
  gradesPorPagina: Map<number, GradeDeTabela>
): string {
  const blocos: string[] = []
  let i = 0

  while (i < linhas.length) {
    const grade = gradesPorPagina.get(linhas[i].pagina)
    const tabelaPorBordas = grade ? detectarTabelaPorBordas(linhas, i, grade) : null
    if (tabelaPorBordas) {
      blocos.push(tabelaPorBordas.markdown)
      i = tabelaPorBordas.proximoIndice
      continue
    }

    const tabelaPorPosicao = absorverTabelaPorPosicao(linhas, i)
    if (tabelaPorPosicao) {
      blocos.push(tabelaPorPosicao.markdown)
      i = tabelaPorPosicao.proximoIndice
      continue
    }

    if (ehTitulo(linhas[i], tamanhoCorpo)) {
      blocos.push(formatarTitulo(linhas[i], tamanhoCorpo, margens))
      i++
      continue
    }

    const { textos, linhasConsumidas, proximoIndice } = absorverBloco(linhas, i, tamanhoCorpo)
    blocos.push(formatarBlocoDeTexto(textos, linhasConsumidas, margens))
    i = proximoIndice
  }

  return blocos.filter((bloco) => bloco.length > 0).join('\n\n')
}
