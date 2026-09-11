import { getDocumentProxy, getResolvedPDFJS } from 'unpdf'

type PdfDocumento = Awaited<ReturnType<typeof getDocumentProxy>>

/** Segmento reto (horizontal ou vertical) desenhado na página, em coordenadas
 *  nativas do PDF — mesma origem/orientação (canto inferior esquerdo, Y
 *  crescendo pra cima) que `StructuredTextItem.x/y` do `unpdf` já usa, então
 *  dá pra comparar posição de texto e de traço diretamente. */
export interface SegmentoReto {
  x1: number
  y1: number
  x2: number
  y2: number
}

type Matriz = [number, number, number, number, number, number]

const IDENTIDADE: Matriz = [1, 0, 0, 1, 0, 0]

/** Composição de matrizes afins 2D no mesmo formato `[a,b,c,d,e,f]` do
 *  `transform` do PDF/canvas (x' = a·x + c·y + e; y' = b·x + d·y + f) —
 *  equivalente a `ctx.transform(...)`: aplica `m2` primeiro, depois `m1`. */
function multiplicar(m1: Matriz, m2: Matriz): Matriz {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function aplicar(m: Matriz, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/** Tolerância (em pontos) pra considerar um segmento horizontal ou vertical
 *  "reto de verdade", mesmo com pequeno erro de arredondamento. */
const TOLERANCIA_RETO = 0.75

/** Abaixo dessa dimensão mínima (largura OU altura do bounding box do path),
 *  um path PREENCHIDO (sem traço) ainda conta como candidato a traço — é o
 *  jeito comum de desenhar uma barra de sublinhado ou uma borda de tabela sem
 *  usar `stroke`. */
const DIMENSAO_MAX_PREENCHIMENTO_FINO = 3

/** Códigos de sub-operação dentro do buffer de um `constructPath`, conforme o
 *  pdf.js empacota internamente: moveTo/lineTo/curveTo/quadraticCurveTo/closePath. */
const SUBOP_MOVE_TO = 0
const SUBOP_LINE_TO = 1
const SUBOP_CURVE_TO = 2
const SUBOP_QUADRATIC_CURVE_TO = 3
const SUBOP_CLOSE_PATH = 4

/** Segmentos retos de uma página + a fração da área dela coberta por imagem —
 *  matéria-prima pra sublinhado/tabela (segmentos) e pra detectar página
 *  escaneada (cobertura de imagem), sem uma segunda passada pela página. */
export interface PaginaComTracos {
  segmentos: SegmentoReto[]
  /** Área somada de paintImageXObject/paintInlineImage/paintImageMaskXObject
   *  dividida pela área da página. Pode passar de 1 se imagens se sobrepõem —
   *  não é limitado, quem decide o que fazer com isso é quem consome. */
  fracaoAreaComImagem: number
}

/**
 * Extrai, de cada página do PDF, os segmentos retos (horizontais/verticais)
 * desenhados com traço (linha) ou preenchimento fino (barra) — matéria-prima
 * pra detectar sublinhado (`pdfMarkdown.ts`) e bordas de tabela
 * (`pdfTabelas.ts`) sem depender só da posição do texto — e a fração da área
 * da página coberta por imagem, usada pra detectar página escaneada.
 *
 * Lê a lista de operações de desenho de cada página (`page.getOperatorList()`)
 * e reconstrói a posição real de cada traço acompanhando a matriz de
 * transformação corrente (`save`/`restore`/`transform`) — os pontos dentro de
 * um `constructPath` vêm em coordenadas locais (do momento em que o traço foi
 * desenhado), não já convertidas pra página. Form XObjects entram nessa mesma
 * pilha: o desenho dentro deles tem uma matriz a mais por cima.
 */
export async function extrairSegmentosRetosPorPagina(
  pdf: PdfDocumento,
  totalPaginas: number
): Promise<PaginaComTracos[]> {
  const pdfjs = await getResolvedPDFJS()
  const OPS = pdfjs.OPS
  const operacoesComTraco = new Set([
    OPS.stroke,
    OPS.closeStroke,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ])

  const resultado: PaginaComTracos[] = []
  for (let numeroPagina = 1; numeroPagina <= totalPaginas; numeroPagina++) {
    const pagina = await pdf.getPage(numeroPagina)
    const operatorList = (await pagina.getOperatorList()) as {
      fnArray: number[]
      argsArray: unknown[]
    }
    const [, , larguraPagina, alturaPagina] = pagina.view as number[]
    resultado.push(extrairSegmentosDaPagina(operatorList, OPS, operacoesComTraco, larguraPagina, alturaPagina))
  }

  return resultado
}

/** Retângulo (largura x altura) ocupado por uma imagem desenhada dentro do
 *  quadrado unitário (0,0)-(1,1) transformado pela matriz corrente — mesmo
 *  cálculo de `pdfImagens.ts`, duplicado aqui de propósito (módulo pequeno,
 *  sem import cruzado) só pra medir área, não posição. */
function retanguloDaImagem(matriz: Matriz): { largura: number; altura: number } {
  const cantos = [aplicar(matriz, 0, 0), aplicar(matriz, 1, 0), aplicar(matriz, 0, 1), aplicar(matriz, 1, 1)]
  const xs = cantos.map((c) => c[0])
  const ys = cantos.map((c) => c[1])
  return { largura: Math.max(...xs) - Math.min(...xs), altura: Math.max(...ys) - Math.min(...ys) }
}

function extrairSegmentosDaPagina(
  operatorList: { fnArray: number[]; argsArray: unknown[] },
  OPS: Record<string, number>,
  operacoesComTraco: Set<number>,
  larguraPagina: number,
  alturaPagina: number
): PaginaComTracos {
  const segmentos: SegmentoReto[] = []
  const pilha: Matriz[] = []
  let atual: Matriz = IDENTIDADE
  let areaComImagem = 0
  const operacoesDeImagem = new Set([OPS.paintImageXObject, OPS.paintInlineImage, OPS.paintImageMaskXObject])

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i]

    if (fn === OPS.save) {
      pilha.push(atual)
    } else if (fn === OPS.restore) {
      atual = pilha.pop() ?? IDENTIDADE
    } else if (fn === OPS.transform) {
      const matrizAplicada = operatorList.argsArray[i] as Matriz
      atual = multiplicar(atual, matrizAplicada)
    } else if (fn === OPS.paintFormXObjectBegin) {
      // Form XObject é um sub-desenho reaproveitável com matriz própria: o
      // pdf.js empilha o estado e aplica essa matriz, igual a save+transform.
      // Sem tratar isso aqui, TODO traço desenhado dentro de um form sai na
      // posição errada — e some a borda de tabela ou o sublinhado daquela
      // página inteira.
      pilha.push(atual)
      const [matrizDoForm] = operatorList.argsArray[i] as [Matriz | null, unknown]
      if (matrizDoForm) atual = multiplicar(atual, matrizDoForm)
    } else if (fn === OPS.paintFormXObjectEnd) {
      atual = pilha.pop() ?? IDENTIDADE
    } else if (fn === OPS.constructPath) {
      const [tipoPintura, buffers, minMax] = operatorList.argsArray[i] as [
        number,
        [Float32Array | null],
        Float32Array | null,
      ]
      const desenhaTraco = operacoesComTraco.has(tipoPintura)
      const ehPreenchimentoFino =
        !desenhaTraco &&
        minMax !== null &&
        Math.min(minMax[2] - minMax[0], minMax[3] - minMax[1]) <= DIMENSAO_MAX_PREENCHIMENTO_FINO
      if ((desenhaTraco || ehPreenchimentoFino) && buffers[0]) {
        segmentos.push(...decodificarCaminho(buffers[0], atual))
      }
    } else if (operacoesDeImagem.has(fn)) {
      const { largura, altura } = retanguloDaImagem(atual)
      areaComImagem += Math.abs(largura * altura)
    }
  }

  const areaPagina = larguraPagina * alturaPagina
  const fracaoAreaComImagem = areaPagina > 0 ? areaComImagem / areaPagina : 0
  return { segmentos, fracaoAreaComImagem }
}

function decodificarCaminho(buffer: Float32Array, matriz: Matriz): SegmentoReto[] {
  const segmentos: SegmentoReto[] = []
  let i = 0
  let pontoAtual: [number, number] | null = null
  let inicioSubcaminho: [number, number] | null = null

  while (i < buffer.length) {
    const subop = buffer[i]
    i++

    if (subop === SUBOP_MOVE_TO) {
      pontoAtual = aplicar(matriz, buffer[i], buffer[i + 1])
      inicioSubcaminho = pontoAtual
      i += 2
    } else if (subop === SUBOP_LINE_TO) {
      const destino = aplicar(matriz, buffer[i], buffer[i + 1])
      if (pontoAtual) segmentos.push(...paraSegmentoReto(pontoAtual, destino))
      pontoAtual = destino
      i += 2
    } else if (subop === SUBOP_CURVE_TO) {
      const destino = aplicar(matriz, buffer[i + 4], buffer[i + 5])
      if (pontoAtual) segmentos.push(...paraSegmentoReto(pontoAtual, destino))
      pontoAtual = destino
      i += 6
    } else if (subop === SUBOP_QUADRATIC_CURVE_TO) {
      const destino = aplicar(matriz, buffer[i + 2], buffer[i + 3])
      if (pontoAtual) segmentos.push(...paraSegmentoReto(pontoAtual, destino))
      pontoAtual = destino
      i += 4
    } else if (subop === SUBOP_CLOSE_PATH) {
      if (pontoAtual && inicioSubcaminho) segmentos.push(...paraSegmentoReto(pontoAtual, inicioSubcaminho))
      pontoAtual = inicioSubcaminho
    } else {
      break // formato de buffer inesperado — para em vez de interpretar lixo
    }
  }

  return segmentos
}

/** Um trecho reto (moveTo→lineTo, ou o "salto" de uma curva degenerada usada
 *  como acabamento de linha) só vira segmento aproveitável se for horizontal
 *  ou vertical de verdade — diagonal não interessa pra sublinhado/tabela. */
function paraSegmentoReto(origem: [number, number], destino: [number, number]): SegmentoReto[] {
  const [x1, y1] = origem
  const [x2, y2] = destino
  if (Math.abs(y1 - y2) <= TOLERANCIA_RETO && Math.abs(x1 - x2) > TOLERANCIA_RETO) {
    const y = (y1 + y2) / 2
    return [{ x1: Math.min(x1, x2), y1: y, x2: Math.max(x1, x2), y2: y }]
  }
  if (Math.abs(x1 - x2) <= TOLERANCIA_RETO && Math.abs(y1 - y2) > TOLERANCIA_RETO) {
    const x = (x1 + x2) / 2
    return [{ x1: x, y1: Math.min(y1, y2), x2: x, y2: Math.max(y1, y2) }]
  }
  return []
}
