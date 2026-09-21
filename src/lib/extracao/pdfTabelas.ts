import type { Linha } from './pdfHtml'
import { formatarTexto, montarTabelaHtml } from './pdfHtml'
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
// Borda de tabela raramente é uma linha: o Word e afins desenham um RETÂNGULO
// FINO (~2pt), e o extrator de traços devolve as duas arestas dele. Com uma
// tolerância menor que a espessura desse retângulo, cada borda vira duas linhas
// de grade, a grade sai com o dobro de linhas e colunas — cheia de faixas de
// 2pt onde nenhum texto cai — e a tabela é descartada por parecer vazia. Por
// isso a tolerância acompanha `DIMENSAO_MAX_PREENCHIMENTO_FINO` do pdfTracos: o
// que couber dentro da espessura de uma borda é a mesma borda.
const TOLERANCIA_CLUSTER_GRADE = 3.5
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
  // uma única célula de uma tabela HTML de 1 linha, perdendo a separação
  // em parágrafos. Tabela de dados de verdade sempre tem pelo menos 2 linhas
  // OU 2 colunas (cabeçalho + dado, ou várias colunas numa linha só).
  if (y.length < 3 && x.length < 3) return null

  return { y, x }
}

/**
 * Como `construirGradeDaPagina`, mas devolve UMA grade por tabela desenhada na
 * página, em vez de juntar todas as bordas da página numa grade só.
 *
 * Duas tabelas bordadas na mesma página (comum em proposta comercial: tabela
 * de preço seguida do cronograma físico-financeiro, com um parágrafo entre as
 * duas) não têm NENHUMA borda em comum. Por isso, antes de montar a grade, os
 * segmentos são agrupados por CONEXÃO (`agruparPorConexao`): bordas que se
 * tocam formam uma única tabela; bordas de tabelas diferentes nunca se tocam,
 * já que há espaço em branco — ou texto corrido — separando as duas.
 *
 * Sem esse agrupamento, `construirGradeDaPagina` tratava as bordas das duas
 * tabelas como uma grade só: a faixa Y entre o fim de uma e o começo da outra
 * virava uma "linha" gigante da tabela unificada, e qualquer parágrafo ou
 * título que caísse nessa faixa era engolido como célula. Foi exatamente o
 * que aconteceu com o parágrafo e o título "Cronograma Físico Financeiro"
 * entre as duas tabelas da proposta de referência.
 */
export function construirGradesDaPagina(segmentos: SegmentoReto[]): GradeDeTabela[] {
  const horizontais = segmentos.filter((s) => s.y1 === s.y2 && s.x2 - s.x1 >= COMPRIMENTO_MIN_LINHA_GRADE)
  const verticais = segmentos.filter((s) => s.x1 === s.x2 && s.y2 - s.y1 >= COMPRIMENTO_MIN_COLUNA_GRADE)
  const candidatos = [...horizontais, ...verticais]
  if (candidatos.length === 0) return []

  const grupos = agruparPorConexao(candidatos, TOLERANCIA_CLUSTER_GRADE)

  return grupos
    .map((grupo) => construirGradeDaPagina(grupo))
    .filter((grade): grade is GradeDeTabela => grade !== null)
}

/** Dois segmentos retos "se tocam" quando compartilham um ponto (dentro da
 *  tolerância): duas horizontais alinhadas com X sobreposto (mesma borda de
 *  linha), duas verticais alinhadas com Y sobreposto (mesma borda de coluna),
 *  ou uma horizontal cruzando/encontrando uma vertical num canto ou T da
 *  grade — é assim que as bordas de UMA tabela ficam todas ligadas entre si. */
function segmentosSeTocam(a: SegmentoReto, b: SegmentoReto, tolerancia: number): boolean {
  const aHorizontal = a.y1 === a.y2
  const bHorizontal = b.y1 === b.y2

  if (aHorizontal && bHorizontal) {
    if (Math.abs(a.y1 - b.y1) > tolerancia) return false
    return a.x1 <= b.x2 + tolerancia && b.x1 <= a.x2 + tolerancia
  }
  if (!aHorizontal && !bHorizontal) {
    if (Math.abs(a.x1 - b.x1) > tolerancia) return false
    return a.y1 <= b.y2 + tolerancia && b.y1 <= a.y2 + tolerancia
  }

  const horizontal = aHorizontal ? a : b
  const vertical = aHorizontal ? b : a
  const xDentro = vertical.x1 >= horizontal.x1 - tolerancia && vertical.x1 <= horizontal.x2 + tolerancia
  const yDentro = horizontal.y1 >= vertical.y1 - tolerancia && horizontal.y1 <= vertical.y2 + tolerancia
  return xDentro && yDentro
}

/** Agrupa segmentos em componentes conexos (union-find): cada grupo reúne os
 *  segmentos ligados, direta ou transitivamente, por um ponto em comum — na
 *  prática, todas as bordas de uma única tabela desenhada na página. */
function agruparPorConexao(segmentos: SegmentoReto[], tolerancia: number): SegmentoReto[][] {
  const pai = segmentos.map((_, i) => i)
  function encontrar(i: number): number {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]]
      i = pai[i]
    }
    return i
  }
  function unir(i: number, j: number) {
    const raizI = encontrar(i)
    const raizJ = encontrar(j)
    if (raizI !== raizJ) pai[raizI] = raizJ
  }

  for (let i = 0; i < segmentos.length; i++) {
    for (let j = i + 1; j < segmentos.length; j++) {
      if (segmentosSeTocam(segmentos[i], segmentos[j], tolerancia)) unir(i, j)
    }
  }

  const grupos = new Map<number, SegmentoReto[]>()
  segmentos.forEach((segmento, i) => {
    const raiz = encontrar(i)
    const grupo = grupos.get(raiz) ?? []
    grupo.push(segmento)
    grupos.set(raiz, grupo)
  })

  return [...grupos.values()]
}

/**
 * Índice da faixa (entre dois limites consecutivos, em qualquer ordem) onde
 * `valor` cai — usado tanto pra linha (limites Y decrescentes) quanto coluna
 * (limites X crescentes) da grade.
 *
 * A faixa que CONTÉM o valor tem prioridade absoluta; a tolerância só entra
 * quando o valor não cai dentro de nenhuma. Aplicar a tolerância já na primeira
 * passada faria as faixas se sobreporem, e como quem varre de trás pra frente
 * devolve o primeiro acerto, todo texto que começa a menos de
 * `TOLERANCIA_DENTRO_DA_GRADE` depois de uma borda seria empurrado pra coluna
 * ANTERIOR. Era o que acontecia no cronograma da proposta de referência: a
 * borda em x=75,7 e o cabeçalho começando em x=77,2 jogavam
 * "A - SISTEMAS DE INFORMAÇÃO" na coluna do "Periodo" e deslocavam a linha de
 * cabeçalho inteira uma coluna pra esquerda, deixando a última vazia.
 */
function indiceDaFaixa(valor: number, limites: number[]): number | null {
  for (let i = 0; i < limites.length - 1; i++) {
    const min = Math.min(limites[i], limites[i + 1])
    const max = Math.max(limites[i], limites[i + 1])
    if (valor >= min && valor < max) return i
  }

  // Fora de todas as faixas, mas por pouco: linha de base de texto logo abaixo
  // da última borda, título encostado na primeira. Fica com a faixa mais perto.
  let maisProxima: number | null = null
  let menorDistancia = Infinity
  for (let i = 0; i < limites.length - 1; i++) {
    const min = Math.min(limites[i], limites[i + 1])
    const max = Math.max(limites[i], limites[i + 1])
    const distancia = valor < min ? min - valor : valor - max
    if (distancia <= TOLERANCIA_DENTRO_DA_GRADE && distancia < menorDistancia) {
      menorDistancia = distancia
      maisProxima = i
    }
  }
  return maisProxima
}

/**
 * Tenta montar uma tabela HTML a partir das bordas visuais desenhadas no
 * PDF, em vez de só posição de texto — bem mais confiável quando a tabela tem
 * linhas/colunas desenhadas (a maioria das tabelas em proposta comercial).
 * Devolve `null` quando a linha em `indiceInicial` não está dentro da área da
 * grade.
 */
export function detectarTabelaPorBordas(
  linhas: Linha[],
  indiceInicial: number,
  grade: GradeDeTabela
): { html: string; proximoIndice: number } | null {
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
  // HTML gigante e quase vazia, e todo o texto (títulos, pares
  // rótulo:valor, parágrafos) é picotado entre células. Uma tabela de dados
  // de verdade tem a maioria das células preenchida; uma grade de layout, não.
  const totalCelulas = numLinhas * numColunas
  const celulasComTexto = celulas.reduce((soma, linha) => soma + linha.filter(Boolean).length, 0)
  if (celulasComTexto / totalCelulas < FRACAO_MINIMA_CELULAS_PREENCHIDAS) return null

  return { html: montarTabelaHtml(celulas), proximoIndice: j }
}
