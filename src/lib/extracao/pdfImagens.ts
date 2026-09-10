import { deflateSync } from 'node:zlib'
import { getDocumentProxy, getResolvedPDFJS } from 'unpdf'

type PdfDocumento = Awaited<ReturnType<typeof getDocumentProxy>>

/** Imagem de CONTEÚDO encontrada numa página — já descartadas logo, rodapé,
 *  fundo de capa, ícone e espaçador (ver `ehDecoracao`). A posição usa as
 *  coordenadas nativas do PDF (origem no canto inferior esquerdo, Y crescendo
 *  pra cima), a mesma de `StructuredTextItem.x/y` do `unpdf` e de
 *  `SegmentoReto` — então dá pra intercalar imagem e texto pela posição. */
export interface ImagemLocalizada {
  /** Página onde a imagem é desenhada, começando em 0 — mesma base que `Linha.pagina`. */
  pagina: number
  x: number
  /** Y da BASE da imagem (borda inferior). */
  y: number
  largura: number
  altura: number
  /** Y do TOPO da imagem (`y + altura`) — é por ele que se decide qual linha de
   *  texto vem antes e qual vem depois da imagem no fluxo do documento. */
  topo: number
  larguraPx: number
  alturaPx: number
  /** Nome estável e previsível, derivado da posição: `pagina-23-imagem-1.png`. */
  nomeArquivo: string
}

export interface ImagemDeConteudo extends ImagemLocalizada {
  /** PNG já codificado, pronto pra gravar no storage. */
  png: Buffer
}

/** Por que uma imagem do PDF não entrou como figura do documento. Existe pra
 *  que a decisão seja auditável: rodando o conversor num monte de documentos
 *  diferentes, é isso que diz se um filtro está apertado ou frouxo demais —
 *  sem isso, uma figura que sumiu num documento qualquer vira adivinhação. */
export type MotivoDeDescarte =
  | 'pequena-demais'
  | 'faixa-ou-regua'
  | 'repetida-em-varias-paginas'
  | 'moldura-da-pagina'
  | 'arte-de-fundo'
  | 'camada-da-capa'

export interface ImagemDescartada {
  pagina: number
  largura: number
  altura: number
  larguraPx: number
  alturaPx: number
  motivo: MotivoDeDescarte
}

/** Uma imagem que cobre esta fração ou mais da área da página não é figura do
 *  texto: é arte de fundo/capa (o caso da capa "Visão do Negócio", um JPEG de
 *  página inteira com o título escrito por cima). */
const PROPORCAO_AREA_FUNDO = 0.6

/** ...com uma exceção: se a página quase não tem texto, a imagem de página
 *  inteira NÃO é fundo decorativo — é uma página escaneada, e aí ela é o único
 *  conteúdo que existe ali. Abaixo desta quantidade de caracteres, a imagem fica. */
const MIN_CARACTERES_PAGINA_COM_TEXTO = 120

/** Mesma imagem desenhada em pelo menos tantas páginas = elemento do modelo da
 *  página (cabeçalho, rodapé, marca d'água), não figura do documento. */
const PAGINAS_PARA_SER_RECORRENTE = 3

/** Faixa de cabeçalho/rodapé: esta fração da altura da página, em cima e
 *  embaixo. Sozinha ela não decide nada — só conta junto com "não tem texto
 *  nenhum além dela naquela direção" (ver `ehMolduraDaPagina`). */
const FAIXA_CABECALHO_RODAPE = 0.2

/** Abaixo deste tamanho DESENHADO na página (em pontos), a imagem é ícone,
 *  marcador de lista, carimbo de assinatura ou espaçador — nunca uma figura.
 *  Referência: o carimbo "SEI / processo eletrônico" ocupa 65x41pt; o menor
 *  diagrama de verdade destes documentos passa de 470pt de largura. */
const LARGURA_MINIMA_PT = 100
const ALTURA_MINIMA_PT = 60

/** Faixa muito mais larga que alta (ou o contrário) é régua/divisória/borda
 *  decorativa, não figura. */
const PROPORCAO_MAXIMA_FAIXA = 12

/** Códigos de `ImageKind` do pdf.js. */
const KIND_GRAYSCALE_1BPP = 1
const KIND_RGB_24BPP = 2
const KIND_RGBA_32BPP = 3

/** Tempo máximo de espera pelo pixel de uma imagem: o pdf.js entrega os
 *  objetos de imagem de forma assíncrona, depois da lista de operações. Se um
 *  objeto nunca chegar (formato que o pdf.js não decodifica), a imagem é
 *  ignorada em vez de travar a conversão inteira. */
const TIMEOUT_OBJETO_MS = 15_000

type Matriz = [number, number, number, number, number, number]

const IDENTIDADE: Matriz = [1, 0, 0, 1, 0, 0]

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

/** Retângulo ocupado na página pela imagem: no PDF, toda imagem é desenhada
 *  dentro do quadrado unitário (0,0)-(1,1) transformado pela matriz corrente,
 *  então basta transformar os quatro cantos e pegar o bounding box. */
function retanguloDaImagem(matriz: Matriz) {
  const cantos = [aplicar(matriz, 0, 0), aplicar(matriz, 1, 0), aplicar(matriz, 0, 1), aplicar(matriz, 1, 1)]
  const xs = cantos.map((c) => c[0])
  const ys = cantos.map((c) => c[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, largura: Math.max(...xs) - x, altura: Math.max(...ys) - y }
}

interface OcorrenciaDeImagem {
  pagina: number
  objId: string
  x: number
  y: number
  largura: number
  altura: number
  larguraPx: number
  alturaPx: number
  /** Identidade da imagem ENTRE páginas — ver `chaveDoDesenho`. */
  chave: string
}

/** O `objId` do pdf.js NÃO identifica a mesma imagem em páginas diferentes: ele
 *  é gerado por página (`img_p22_1`) e ganha outro nome quando o pdf.js promove
 *  a imagem reaproveitada pro cache global (`g_d0_img_p30_1`) — o logo do
 *  cabeçalho aparece com um nome diferente em cada página. Como identidade
 *  usa-se então o DESENHO: mesma imagem de origem (largura x altura em pixels),
 *  no mesmo lugar e no mesmo tamanho da página. É isso que faz o cabeçalho
 *  repetido em 20 páginas ser reconhecido como um só elemento. */
function chaveDoDesenho(x: number, y: number, largura: number, altura: number, px: number, py: number): string {
  const arredondar = (valor: number) => Math.round(valor)
  return [arredondar(x), arredondar(y), arredondar(largura), arredondar(altura), px, py].join(':')
}

interface PaginaVarrida {
  ocorrencias: OcorrenciaDeImagem[]
  larguraPagina: number
  alturaPagina: number
  caracteresDeTexto: number
  /** Y do texto mais alto e do mais baixo da página — `null` quando a página
   *  não tem texto nenhum. Delimitam onde o corpo do documento começa e acaba. */
  topoDoTexto: number | null
  baseDoTexto: number | null
}

/**
 * Localiza as imagens de conteúdo de um PDF — as que fazem parte do documento
 * (diagrama, print de tela, tabela que veio como figura), não a moldura visual
 * das páginas — SEM decodificar os pixels. Use quando só interessa saber que
 * existe uma figura ali e em que ponto do texto ela entra.
 *
 * O texto de um PDF e as imagens dele vivem em canais separados: quem lê só os
 * itens de texto (`extractTextItems`) não enxerga imagem nenhuma e engole um
 * diagrama inteiro em silêncio — nada aparece, nem um aviso. Este módulo lê o
 * outro canal, a lista de operações de desenho da página
 * (`page.getOperatorList()`), acompanhando a matriz de transformação corrente
 * (`save`/`restore`/`transform` e os Form XObjects) pra saber ONDE cada imagem
 * foi desenhada.
 *
 * Devolve as imagens já filtradas e ordenadas na ordem de leitura (página, e
 * dentro da página de cima pra baixo).
 */
export async function localizarImagensDeConteudo(
  pdf: PdfDocumento,
  totalPaginas: number
): Promise<ImagemLocalizada[]> {
  const ocorrencias = await selecionarOcorrencias(pdf, totalPaginas)
  const contadorPorPagina = new Map<number, number>()

  return ocorrencias.map((ocorrencia) =>
    descrever(ocorrencia, contadorPorPagina, ocorrencia.larguraPx, ocorrencia.alturaPx)
  )
}

/**
 * O mesmo que `localizarImagensDeConteudo`, mas já com o bitmap de cada imagem
 * decodificado e codificado em PNG (buscado em `page.objs`/`commonObjs`),
 * pronto pra gravar no storage e virar um `![](url)` no Markdown.
 */
export async function extrairImagensDeConteudo(
  pdf: PdfDocumento,
  totalPaginas: number
): Promise<ImagemDeConteudo[]> {
  const ocorrencias = await selecionarOcorrencias(pdf, totalPaginas)
  const contadorPorPagina = new Map<number, number>()

  const imagens: ImagemDeConteudo[] = []
  for (const ocorrencia of ocorrencias) {
    const png = await codificarComoPng(pdf, ocorrencia)
    if (!png) continue // objeto que o pdf.js não entregou — a imagem é ignorada, não trava a conversão

    imagens.push({ ...descrever(ocorrencia, contadorPorPagina, png.largura, png.altura), png: png.buffer })
  }

  return imagens
}

function descrever(
  ocorrencia: OcorrenciaDeImagem,
  contadorPorPagina: Map<number, number>,
  larguraPx: number,
  alturaPx: number
): ImagemLocalizada {
  const sequencial = (contadorPorPagina.get(ocorrencia.pagina) ?? 0) + 1
  contadorPorPagina.set(ocorrencia.pagina, sequencial)

  return {
    pagina: ocorrencia.pagina,
    x: ocorrencia.x,
    y: ocorrencia.y,
    largura: ocorrencia.largura,
    altura: ocorrencia.altura,
    topo: ocorrencia.y + ocorrencia.altura,
    larguraPx,
    alturaPx,
    nomeArquivo: `pagina-${ocorrencia.pagina + 1}-imagem-${sequencial}.png`,
  }
}

/**
 * Todas as imagens do PDF, separadas entre as que são figura do documento e as
 * que foram descartadas, cada uma com o motivo. Serve pra conferir o filtro
 * rodando num conjunto grande de documentos, em vez de calibrar no olho em
 * cima de um exemplar só.
 */
export async function diagnosticarImagens(
  pdf: PdfDocumento,
  totalPaginas: number
): Promise<{ mantidas: ImagemLocalizada[]; descartadas: ImagemDescartada[] }> {
  const { selecionadas, descartadas } = await separarOcorrencias(pdf, totalPaginas)
  const contadorPorPagina = new Map<number, number>()

  return {
    mantidas: selecionadas.map((ocorrencia) =>
      descrever(ocorrencia, contadorPorPagina, ocorrencia.larguraPx, ocorrencia.alturaPx)
    ),
    descartadas,
  }
}

async function selecionarOcorrencias(pdf: PdfDocumento, totalPaginas: number): Promise<OcorrenciaDeImagem[]> {
  return (await separarOcorrencias(pdf, totalPaginas)).selecionadas
}

async function separarOcorrencias(
  pdf: PdfDocumento,
  totalPaginas: number
): Promise<{ selecionadas: OcorrenciaDeImagem[]; descartadas: ImagemDescartada[] }> {
  const pdfjs = await getResolvedPDFJS()
  const OPS = pdfjs.OPS

  const paginas: PaginaVarrida[] = []
  for (let numeroPagina = 1; numeroPagina <= totalPaginas; numeroPagina++) {
    paginas.push(await varrerPagina(pdf, numeroPagina, OPS))
  }

  const paginasPorDesenho = contarPaginasPorDesenho(paginas)

  const selecionadas: OcorrenciaDeImagem[] = []
  const descartadas: ImagemDescartada[] = []
  for (const pagina of paginas) {
    for (const ocorrencia of pagina.ocorrencias) {
      const motivo = motivoDeDescarte(ocorrencia, pagina, paginasPorDesenho)
      if (motivo === null) {
        selecionadas.push(ocorrencia)
        continue
      }
      descartadas.push({
        pagina: ocorrencia.pagina,
        largura: ocorrencia.largura,
        altura: ocorrencia.altura,
        larguraPx: ocorrencia.larguraPx,
        alturaPx: ocorrencia.alturaPx,
        motivo,
      })
    }
  }

  // Ordem de leitura: página a página e, dentro da página, de cima pra baixo.
  selecionadas.sort((a, b) => a.pagina - b.pagina || b.y + b.altura - (a.y + a.altura))
  return { selecionadas, descartadas }
}

async function varrerPagina(pdf: PdfDocumento, numeroPagina: number, OPS: Record<string, number>): Promise<PaginaVarrida> {
  const pagina = await pdf.getPage(numeroPagina)
  const [, , larguraPagina, alturaPagina] = pagina.view as number[]
  const operatorList = (await pagina.getOperatorList()) as { fnArray: number[]; argsArray: unknown[] }
  const conteudoTexto = await pagina.getTextContent()
  const itensComTexto = (conteudoTexto.items as { str?: string; transform?: number[] }[]).filter(
    (item) => (item.str?.trim().length ?? 0) > 0
  )
  const caracteresDeTexto = itensComTexto.reduce((soma, item) => soma + (item.str?.trim().length ?? 0), 0)
  const ysDoTexto = itensComTexto.map((item) => item.transform?.[5] ?? 0)
  const topoDoTexto = ysDoTexto.length > 0 ? Math.max(...ysDoTexto) : null
  const baseDoTexto = ysDoTexto.length > 0 ? Math.min(...ysDoTexto) : null

  const ocorrencias: OcorrenciaDeImagem[] = []
  const pilha: Matriz[] = []
  let atual: Matriz = IDENTIDADE

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i]

    if (fn === OPS.save) {
      pilha.push(atual)
    } else if (fn === OPS.restore) {
      atual = pilha.pop() ?? IDENTIDADE
    } else if (fn === OPS.transform) {
      atual = multiplicar(atual, operatorList.argsArray[i] as Matriz)
    } else if (fn === OPS.paintFormXObjectBegin) {
      // Form XObject é um "sub-desenho" com matriz própria: o pdf.js empilha o
      // estado e aplica a matriz, igual a save+transform. Sem tratar isso aqui,
      // toda imagem dentro de um form sai com a posição errada.
      pilha.push(atual)
      const [matriz] = operatorList.argsArray[i] as [Matriz | null, unknown]
      if (matriz) atual = multiplicar(atual, matriz)
    } else if (fn === OPS.paintFormXObjectEnd) {
      atual = pilha.pop() ?? IDENTIDADE
    } else if (fn === OPS.paintImageXObject) {
      const [objId, larguraPx, alturaPx] = operatorList.argsArray[i] as [string, number, number]
      const { x, y, largura, altura } = retanguloDaImagem(atual)
      ocorrencias.push({
        pagina: numeroPagina - 1,
        objId,
        x,
        y,
        largura,
        altura,
        larguraPx,
        alturaPx,
        chave: chaveDoDesenho(x, y, largura, altura, larguraPx, alturaPx),
      })
    }
    // `paintImageMaskXObject` (estêncil pintado com a cor corrente) e
    // `paintImageXObjectRepeat` (ladrilho de fundo) ficam de fora de propósito:
    // nesse tipo de documento são sempre moldura/preenchimento, nunca figura.
  }

  return { ocorrencias, larguraPagina, alturaPagina, caracteresDeTexto, topoDoTexto, baseDoTexto }
}

/** Quantas páginas DIFERENTES desenham a mesma imagem, na mesma posição — é o
 *  que separa o logo do cabeçalho (aparece em todas) de um diagrama (aparece
 *  numa só). */
function contarPaginasPorDesenho(paginas: PaginaVarrida[]): Map<string, number> {
  const paginasPorChave = new Map<string, Set<number>>()
  for (const pagina of paginas) {
    for (const ocorrencia of pagina.ocorrencias) {
      const conjunto = paginasPorChave.get(ocorrencia.chave) ?? new Set<number>()
      conjunto.add(ocorrencia.pagina)
      paginasPorChave.set(ocorrencia.chave, conjunto)
    }
  }
  return new Map([...paginasPorChave].map(([chave, conjunto]) => [chave, conjunto.size]))
}

/** O pdf.js promove pro cache global (prefixo `g_`) a imagem reaproveitada
 *  entre páginas — é de lá que o bitmap dela tem que ser buscado. */
function ehObjetoGlobal(objId: string): boolean {
  return objId.startsWith('g_')
}

/** Devolve o motivo pelo qual a imagem NÃO é figura do documento, ou `null`
 *  quando ela é. */
function motivoDeDescarte(
  ocorrencia: OcorrenciaDeImagem,
  pagina: PaginaVarrida,
  paginasPorDesenho: Map<string, number>
): MotivoDeDescarte | null {
  const { largura, altura } = ocorrencia

  // Pequena demais pra ser figura: ícone, marcador, carimbo, espaçador.
  if (largura < LARGURA_MINIMA_PT || altura < ALTURA_MINIMA_PT) return 'pequena-demais'

  // Faixa/régua: barra decorativa muito mais larga que alta (ou o contrário).
  const proporcao = Math.max(largura / altura, altura / largura)
  if (proporcao > PROPORCAO_MAXIMA_FAIXA) return 'faixa-ou-regua'

  // Repetida em várias páginas: cabeçalho, rodapé, marca d'água.
  if ((paginasPorDesenho.get(ocorrencia.chave) ?? 1) >= PAGINAS_PARA_SER_RECORRENTE) {
    return 'repetida-em-varias-paginas'
  }

  if (ehMolduraDaPagina(ocorrencia, pagina)) return 'moldura-da-pagina'

  // Arte de fundo/capa: ocupa quase a página inteira COM texto escrito por
  // cima. Numa página quase sem texto a mesma imagem é o oposto disso — é uma
  // página escaneada, e a figura é o único conteúdo que existe ali.
  const areaPagina = pagina.larguraPagina * pagina.alturaPagina
  const cobreQuaseTudo = areaPagina > 0 && (largura * altura) / areaPagina >= PROPORCAO_AREA_FUNDO
  const paginaTemTexto = pagina.caracteresDeTexto >= MIN_CARACTERES_PAGINA_COM_TEXTO
  if (cobreQuaseTudo && paginaTemTexto) return 'arte-de-fundo'

  // Página de capa: se ela tem uma arte de fundo, as outras imagens dali são
  // camadas da mesma arte (sombra, degradê, faixa), não figuras do texto.
  if (!cobreQuaseTudo && paginaTemTexto) {
    const temArteDeFundo = pagina.ocorrencias.some(
      (outra) => areaPagina > 0 && (outra.largura * outra.altura) / areaPagina >= PROPORCAO_AREA_FUNDO
    )
    if (temArteDeFundo) return 'camada-da-capa'
  }

  return null
}

/** Moldura da página (logo, timbre, faixa institucional): a imagem está numa
 *  das pontas da página E não tem texto nenhum além dela naquela direção —
 *  ninguém escreve acima do timbre nem abaixo do rodapé.
 *
 *  As duas condições juntas são o que dá segurança: só "estar no alto" acabaria
 *  descartando uma figura que abre a página, e só "não ter texto acima"
 *  descartaria uma figura com legenda embaixo. Uma figura do texto sempre
 *  falha em pelo menos uma das duas. */
function ehMolduraDaPagina(ocorrencia: OcorrenciaDeImagem, pagina: PaginaVarrida): boolean {
  const { y, altura } = ocorrencia
  const faixa = pagina.alturaPagina * FAIXA_CABECALHO_RODAPE

  const noAltoDaPagina = y >= pagina.alturaPagina - faixa
  const acimaDeTodoOTexto = pagina.topoDoTexto === null || y >= pagina.topoDoTexto
  if (noAltoDaPagina && acimaDeTodoOTexto) return true

  const noPeDaPagina = y + altura <= faixa
  const abaixoDeTodoOTexto = pagina.baseDoTexto === null || y + altura <= pagina.baseDoTexto
  return noPeDaPagina && abaixoDeTodoOTexto
}

interface PngCodificado {
  buffer: Buffer
  largura: number
  altura: number
}

async function codificarComoPng(pdf: PdfDocumento, ocorrencia: OcorrenciaDeImagem): Promise<PngCodificado | null> {
  const objeto = await buscarObjetoDeImagem(pdf, ocorrencia)
  if (!objeto?.data || !objeto.width || !objeto.height) return null

  const { width, height, kind, data } = objeto
  if (kind === KIND_GRAYSCALE_1BPP) {
    if (data.length < ((width + 7) >> 3) * height) return null
    return { buffer: montarPng(width, height, 0, expandirCinza1Bpp(width, height, data)), largura: width, altura: height }
  }

  const tipoDeCor = kind === KIND_RGB_24BPP ? 2 : kind === KIND_RGBA_32BPP ? 6 : null
  if (tipoDeCor === null) return null
  // Formato inesperado (linha com preenchimento, decodificação parcial): melhor
  // ignorar a imagem do que gravar um PNG embaralhado.
  if (data.length < width * height * CANAIS_POR_TIPO_DE_COR[tipoDeCor]) return null

  return { buffer: montarPng(width, height, tipoDeCor, data), largura: width, altura: height }
}

interface ObjetoDeImagem {
  width?: number
  height?: number
  kind?: number
  data?: Uint8Array | Uint8ClampedArray
}

/** O pdf.js resolve o bitmap de forma assíncrona; `objs.get(id, callback)`
 *  chama de volta quando ele chega. Objeto reaproveitado entre páginas vai
 *  parar em `commonObjs` (prefixo `g_`), o resto fica no `objs` da página. */
async function buscarObjetoDeImagem(pdf: PdfDocumento, ocorrencia: OcorrenciaDeImagem): Promise<ObjetoDeImagem | null> {
  const pagina = await pdf.getPage(ocorrencia.pagina + 1)
  const deposito = ehObjetoGlobal(ocorrencia.objId)
    ? (pagina as unknown as { commonObjs: DepositoDeObjetos }).commonObjs
    : (pagina as unknown as { objs: DepositoDeObjetos }).objs

  return new Promise((resolve) => {
    const relogio = setTimeout(() => resolve(null), TIMEOUT_OBJETO_MS)
    try {
      deposito.get(ocorrencia.objId, (objeto: ObjetoDeImagem | null) => {
        clearTimeout(relogio)
        resolve(objeto ?? null)
      })
    } catch {
      clearTimeout(relogio)
      resolve(null)
    }
  })
}

interface DepositoDeObjetos {
  get(objId: string, callback: (objeto: ObjetoDeImagem | null) => void): unknown
}

function expandirCinza1Bpp(largura: number, altura: number, data: Uint8Array | Uint8ClampedArray): Uint8Array {
  const bytesPorLinha = (largura + 7) >> 3
  const saida = new Uint8Array(largura * altura)
  for (let linha = 0; linha < altura; linha++) {
    for (let coluna = 0; coluna < largura; coluna++) {
      const byte = data[linha * bytesPorLinha + (coluna >> 3)] ?? 0
      const bit = byte & (128 >> (coluna & 7))
      saida[linha * largura + coluna] = bit ? 255 : 0
    }
  }
  return saida
}

const CANAIS_POR_TIPO_DE_COR: Record<number, number> = { 0: 1, 2: 3, 6: 4 }

/** Codificador PNG mínimo (IHDR/IDAT/IEND, 8 bits por canal, sem filtro de
 *  linha) — o `zlib` do Node já faz a compressão, então não é preciso trazer
 *  nenhuma dependência nova só pra salvar a imagem. */
function montarPng(largura: number, altura: number, tipoDeCor: number, pixels: Uint8Array | Uint8ClampedArray): Buffer {
  const canais = CANAIS_POR_TIPO_DE_COR[tipoDeCor]
  const bytesPorLinha = largura * canais
  const bruto = Buffer.allocUnsafe((bytesPorLinha + 1) * altura)
  for (let linha = 0; linha < altura; linha++) {
    const destino = linha * (bytesPorLinha + 1)
    bruto[destino] = 0 // filtro "None"
    Buffer.from(pixels.buffer, pixels.byteOffset + linha * bytesPorLinha, bytesPorLinha).copy(bruto, destino + 1)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = tipoDeCor
  // bytes 10..12 já são zero: compressão deflate, filtro padrão, sem entrelaçamento

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(bruto, { level: 6 })),
    bloco('IEND', Buffer.alloc(0)),
  ])
}

function bloco(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length, 0)
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const verificacao = Buffer.alloc(4)
  verificacao.writeUInt32BE(crc32(corpo), 0)
  return Buffer.concat([tamanho, corpo, verificacao])
}

const TABELA_CRC32 = (() => {
  const tabela = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let valor = i
    for (let bit = 0; bit < 8; bit++) valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1
    tabela[i] = valor >>> 0
  }
  return tabela
})()

function crc32(dados: Buffer): number {
  let valor = 0xffffffff
  for (let i = 0; i < dados.length; i++) valor = TABELA_CRC32[(valor ^ dados[i]) & 0xff] ^ (valor >>> 8)
  return (valor ^ 0xffffffff) >>> 0
}
