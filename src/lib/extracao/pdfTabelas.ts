import type { Linha } from './pdfMarkdown'
import { formatarTexto, montarTabelaMarkdown } from './pdfMarkdown'
import type { SegmentoReto } from './pdfTracos'

/** Grade de bordas visuais de uma página: posições Y das linhas horizontais
 *  (limites de linha da tabela, ordenadas do topo pro fim — Y decrescente,
 *  já que o eixo Y do PDF cresce de baixo pra cima) e X das verticais
 *  (limites de coluna, da esquerda pra direita — X crescente). */
export interface GradeDeTabela {
  y: number[]
  x: number[]
}

const COMPRIMENTO_MIN_LINHA_GRADE = 20
const COMPRIMENTO_MIN_COLUNA_GRADE = 8
const TOLERANCIA_CLUSTER_GRADE = 1.5
const TOLERANCIA_DENTRO_DA_GRADE = 2

/** Fração mínima de células com texto pra uma grade de bordas contar como
 *  tabela de dados. Abaixo disso é grade de layout de formulário (bordas
 *  organizando campos numa página), não uma tabela — cai pro fluxo de texto. */
const FRACAO_MINIMA_CELULAS_PREENCHIDAS = 0.25

/** Agrupa valores próximos (dentro de `tolerancia`) numa única âncora — linhas
 *  de borda quase-coincidentes (erro de arredondamento do PDF) viram uma só. */
function clusterizar(valores: number[], tolerancia: number): number[] {
  const ordenados = [...valores].sort((a, b) => a - b)
  const grupos: number[] = []
  for (const valor of ordenados) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo === undefined || valor - ultimo > tolerancia) {
      grupos.push(valor)
    }
  }
  return grupos
}

/**
 * Monta a grade de linhas/colunas de bordas visuais de uma página, a partir
 * dos segmentos retos extraídos do PDF (`pdfTracos.ts`). Só considera
 * segmentos compridos o bastante pra serem borda de tabela (não sublinhado de
 * uma palavra, nem risco decorativo curto). Devolve `null` quando a página
 * não tem uma grade reconhecível (menos de 2 linhas ou 2 colunas) — quem
 * chama cai pro fallback de posição (`absorverTabelaPorPosicao`).
 *
 * Simplificação assumida: trata todas as bordas da página como uma única
 * grade. Uma página com mais de uma tabela com bordas pode, nesse caso,
 * juntar as duas numa só — caso raro, corrigido na edição manual.
 */
export function construirGradeDaPagina(segmentos: SegmentoReto[]): GradeDeTabela | null {
  const ysHorizontais = segmentos
    .filter((s) => s.y1 === s.y2 && s.x2 - s.x1 >= COMPRIMENTO_MIN_LINHA_GRADE)
    .map((s) => s.y1)
  const xsVerticais = segmentos
    .filter((s) => s.x1 === s.x2 && s.y2 - s.y1 >= COMPRIMENTO_MIN_COLUNA_GRADE)
    .map((s) => s.x1)

  const y = clusterizar(ysHorizontais, TOLERANCIA_CLUSTER_GRADE).sort((a, b) => b - a)
  const x = clusterizar(xsVerticais, TOLERANCIA_CLUSTER_GRADE)

  if (y.length < 2 || x.length < 2) return null

  // Uma grade 1x1 (só 2 linhas e 2 colunas de borda — ou seja, uma única
  // caixa fechada, sem divisória interna nenhuma) não é uma tabela de dados:
  // é uma MOLDURA decorativa em volta de um bloco de texto corrido (comum em
  // proposta comercial pra destacar uma seção). Sem essa checagem, todo o
  // texto ali dentro — que pode ser várias frases e itens de lista — vira
  // uma única célula de uma tabela Markdown de 1 linha, perdendo a separação
  // em parágrafos. Tabela de dados de verdade sempre tem pelo menos 2 linhas
  // OU 2 colunas (cabeçalho + dado, ou várias colunas numa linha só).
  if (y.length < 3 && x.length < 3) return null

  return { y, x }
}

/** Índice da faixa (entre dois limites consecutivos, em qualquer ordem) onde
 *  `valor` cai — usado tanto pra linha (limites Y decrescentes) quanto coluna
 *  (limites X crescentes) da grade. */
function indiceDaFaixa(valor: number, limites: number[]): number | null {
  for (let i = 0; i < limites.length - 1; i++) {
    const min = Math.min(limites[i], limites[i + 1]) - TOLERANCIA_DENTRO_DA_GRADE
    const max = Math.max(limites[i], limites[i + 1]) + TOLERANCIA_DENTRO_DA_GRADE
    if (valor >= min && valor <= max) return i
  }
  return null
}

/**
 * Tenta montar uma tabela Markdown a partir das bordas visuais desenhadas no
 * PDF, em vez de só posição de texto — bem mais confiável quando a tabela tem
 * linhas/colunas desenhadas (a maioria das tabelas em proposta comercial).
 * Devolve `null` quando a linha em `indiceInicial` não está dentro da área da
 * grade.
 */
export function detectarTabelaPorBordas(
  linhas: Linha[],
  indiceInicial: number,
  grade: GradeDeTabela
): { markdown: string; proximoIndice: number } | null {
  const primeiraLinha = linhas[indiceInicial]
  const limiteSuperior = grade.y[0]
  const limiteInferior = grade.y[grade.y.length - 1]
  if (primeiraLinha.y > limiteSuperior + TOLERANCIA_DENTRO_DA_GRADE) return null
  if (primeiraLinha.y < limiteInferior - TOLERANCIA_DENTRO_DA_GRADE) return null

  const numLinhas = grade.y.length - 1
  const numColunas = grade.x.length - 1
  const celulas: string[][] = Array.from({ length: numLinhas }, () => Array(numColunas).fill(''))

  let j = indiceInicial
  let algumaCelulaPreenchida = false
  while (j < linhas.length) {
    const linha = linhas[j]
    if (linha.pagina !== primeiraLinha.pagina) break
    if (linha.y < limiteInferior - TOLERANCIA_DENTRO_DA_GRADE) break

    const indiceLinhaGrade = indiceDaFaixa(linha.y, grade.y)
    if (indiceLinhaGrade === null) {
      j++
      continue
    }

    for (const item of linha.itens) {
      const indiceColunaGrade = indiceDaFaixa(item.x, grade.x)
      if (indiceColunaGrade === null) continue
      const texto = formatarTexto(item)
      const atual = celulas[indiceLinhaGrade][indiceColunaGrade]
      celulas[indiceLinhaGrade][indiceColunaGrade] = atual ? `${atual} ${texto}` : texto
      algumaCelulaPreenchida = true
    }
    j++
  }

  if (!algumaCelulaPreenchida) return null

  // Guarda contra "grade de layout": um formulário (ficha SEI, etc.) tem
  // bordas por toda a página só pra organizar visualmente os campos — não é
  // uma tabela de dados. Sem essa checagem, a página inteira vira uma tabela
  // Markdown gigante e quase vazia, e todo o texto (títulos, pares
  // rótulo:valor, parágrafos) é picotado entre células. Uma tabela de dados
  // de verdade tem a maioria das células preenchida; uma grade de layout, não.
  const totalCelulas = numLinhas * numColunas
  const celulasComTexto = celulas.reduce((soma, linha) => soma + linha.filter(Boolean).length, 0)
  if (celulasComTexto / totalCelulas < FRACAO_MINIMA_CELULAS_PREENCHIDAS) return null

  return { markdown: montarTabelaMarkdown(celulas), proximoIndice: j }
}
