import { extractTextItems, getDocumentProxy, type StructuredTextItem } from 'unpdf'

/** Gap horizontal (em pontos) acima do qual duas células passam a ser consideradas
 *  colunas separadas de uma tabela, em vez de duas palavras na mesma frase. */
const LIMIAR_GAP_COLUNA = 24

const REGEX_LISTA_NUMERADA = /^(\d+)[.)]\s+(.*)$/
const REGEX_LISTA_MARCADOR = /^[•\-*]\s+(.*)$/

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
 */
export async function converterPdfParaMarkdown(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { items } = await extractTextItems(pdf)

  const todasAsLinhas: Linha[] = []
  for (const itensDaPagina of items) {
    todasAsLinhas.push(...agruparEmLinhas(itensDaPagina))
  }

  if (todasAsLinhas.length === 0) return ''

  const tamanhoCorpo = calcularTamanhoCorpo(todasAsLinhas)
  return montarMarkdown(todasAsLinhas, tamanhoCorpo)
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

function montarLinhaSimples(linha: Linha, tamanhoCorpo: number): string {
  const texto = linha.itens
    .map((item) => (item.negrito ? `**${item.texto}**` : item.texto))
    .join(' ')
    .trim()

  if (texto.length === 0) return ''

  const numerada = texto.match(REGEX_LISTA_NUMERADA)
  if (numerada) return `${numerada[1]}. ${numerada[2]}`

  const marcada = texto.match(REGEX_LISTA_MARCADOR)
  if (marcada) return `- ${marcada[1]}`

  if (linha.fontSizeMedio >= tamanhoCorpo * 1.5) return `# ${texto}`
  if (linha.fontSizeMedio >= tamanhoCorpo * 1.15) return `## ${texto}`

  return texto
}

function montarMarkdown(linhas: Linha[], tamanhoCorpo: number): string {
  const blocos: string[] = []
  let i = 0

  while (i < linhas.length) {
    const anchors = detectarColunas(linhas[i])

    if (anchors) {
      const bloco: string[][] = [linhaParaColunas(linhas[i], anchors)]
      let j = i + 1
      while (j < linhas.length) {
        const proximasColunas = detectarColunas(linhas[j])
        if (!proximasColunas || proximasColunas.length !== anchors.length) break
        bloco.push(linhaParaColunas(linhas[j], anchors))
        j++
      }
      if (bloco.length >= 2) {
        blocos.push(montarTabelaMarkdown(bloco))
        i = j
        continue
      }
    }

    blocos.push(montarLinhaSimples(linhas[i], tamanhoCorpo))
    i++
  }

  return blocos.filter((bloco) => bloco.length > 0).join('\n\n')
}
