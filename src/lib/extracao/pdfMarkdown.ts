import { extractTextItems, getDocumentProxy, type StructuredTextItem } from 'unpdf'

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

const REGEX_LISTA_NUMERADA = /^(\d+)[.)]\s+(.*)$/
const REGEX_LISTA_MARCADOR = /^[•\-*]\s+(.*)$/
const REGEX_RODAPE_PAGINA = /^page\s+\d+\s+of\s+\d+$/i
/** Fim de frase/parágrafo: pontuação final, opcionalmente seguida de aspas/parêntese. */
const REGEX_PONTUACAO_FINAL = /[.:;!?]["'”)\]]?$/

interface ItemLinha {
  texto: string
  x: number
  width: number
  negrito: boolean
}

interface Linha {
  itens: ItemLinha[]
  fontSizeMedio: number
}

/**
 * Converte o conteúdo de um PDF em Markdown, preservando negrito, título, lista
 * e tabela detectados a partir da fonte e da posição de cada trecho de texto —
 * sem usar IA. É uma extração best-effort: negrito e título são confiáveis
 * (comparação direta de fonte/tamanho); tabela funciona bem em grades simples
 * e pode sair desalinhada em casos complexos. É esperado que a pessoa ajuste
 * o resultado manualmente antes de copiar.
 *
 * O `hasEOL` do unpdf marca fim de LINHA VISUAL (onde o PDF quebra a linha na
 * página), não fim de parágrafo — por isso linhas consecutivas são reunidas num
 * mesmo bloco até a última linha absorvida terminar em pontuação final (ou até
 * a próxima linha já começar um item de lista/título/tabela novo).
 */
export async function converterPdfParaMarkdown(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { items } = await extractTextItems(pdf)

  const todasAsLinhas: Linha[] = []
  for (const itensDaPagina of items) {
    todasAsLinhas.push(...agruparEmLinhas(itensDaPagina))
  }

  const linhasSemRodape = todasAsLinhas.filter((linha) => !ehRodapeDePagina(linha))
  if (linhasSemRodape.length === 0) return ''

  const tamanhoCorpo = calcularTamanhoCorpo(linhasSemRodape)
  return montarMarkdown(linhasSemRodape, tamanhoCorpo)
}

function ehRodapeDePagina(linha: Linha): boolean {
  return REGEX_RODAPE_PAGINA.test(extrairTextoLinha(linha))
}

function agruparEmLinhas(itens: StructuredTextItem[]): Linha[] {
  const linhas: Linha[] = []
  let atual: StructuredTextItem[] = []

  for (const item of itens) {
    if (item.str.trim().length === 0 && atual.length === 0) continue
    atual.push(item)
    if (item.hasEOL) {
      linhas.push(construirLinha(atual))
      atual = []
    }
  }
  if (atual.length > 0) linhas.push(construirLinha(atual))

  return linhas
}

function construirLinha(itensBrutos: StructuredTextItem[]): Linha {
  const itens: ItemLinha[] = itensBrutos
    .filter((item) => item.str.trim().length > 0)
    .map((item) => ({
      texto: item.str,
      x: item.x,
      width: item.width,
      negrito: /bold|negrito/i.test(item.fontFamily),
    }))
  const fontSizeMedio =
    itensBrutos.reduce((soma, item) => soma + item.fontSize, 0) / (itensBrutos.length || 1)
  return { itens, fontSizeMedio }
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
    const texto = item.negrito ? `**${item.texto}**` : item.texto
    celulas[indiceColuna] = celulas[indiceColuna] ? `${celulas[indiceColuna]} ${texto}` : texto
  }
  return celulas
}

function montarTabelaMarkdown(linhas: string[][]): string {
  const [cabecalho, ...resto] = linhas
  const separador = cabecalho.map(() => '---')
  return [cabecalho, separador, ...resto].map((linha) => `| ${linha.join(' | ')} |`).join('\n')
}

function extrairTextoLinha(linha: Linha): string {
  return linha.itens
    .map((item) => (item.negrito ? `**${item.texto}**` : item.texto))
    .join(' ')
    .trim()
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

function formatarTitulo(linha: Linha, tamanhoCorpo: number): string {
  const texto = extrairTextoLinha(linha)
  return linha.fontSizeMedio >= tamanhoCorpo * 1.5 ? `# ${texto}` : `## ${texto}`
}

function formatarBlocoDeTexto(textos: string[]): string {
  const textoCompleto = textos.join(' ')

  const numerada = textoCompleto.match(REGEX_LISTA_NUMERADA)
  if (numerada) return `${numerada[1]}. ${numerada[2]}`

  const marcada = textoCompleto.match(REGEX_LISTA_MARCADOR)
  if (marcada) return `- ${marcada[1]}`

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
): { textos: string[]; proximoIndice: number } {
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
    j++
  }

  return { textos, proximoIndice: j }
}

/** Reúne, a partir de `indiceInicial`, uma sequência de linhas que parecem linhas
 *  de tabela (têm colunas detectáveis), unificando as âncoras de coluna de todas
 *  elas — assim cabeçalho e linhas de dados com layouts de coluna levemente
 *  diferentes ainda formam uma única tabela, em vez de a tabela ser descartada. */
function absorverTabela(
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

function montarMarkdown(linhas: Linha[], tamanhoCorpo: number): string {
  const blocos: string[] = []
  let i = 0

  while (i < linhas.length) {
    const tabela = absorverTabela(linhas, i)
    if (tabela) {
      blocos.push(tabela.markdown)
      i = tabela.proximoIndice
      continue
    }

    if (ehTitulo(linhas[i], tamanhoCorpo)) {
      blocos.push(formatarTitulo(linhas[i], tamanhoCorpo))
      i++
      continue
    }

    const { textos, proximoIndice } = absorverBloco(linhas, i, tamanhoCorpo)
    blocos.push(formatarBlocoDeTexto(textos))
    i = proximoIndice
  }

  return blocos.filter((bloco) => bloco.length > 0).join('\n\n')
}
