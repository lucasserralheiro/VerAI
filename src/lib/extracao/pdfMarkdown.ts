import { extractTextItems, getDocumentProxy, type StructuredTextItem } from 'unpdf'
import { extrairSegmentosRetosPorPagina, type SegmentoReto } from './pdfTracos'
import { construirGradeDaPagina, detectarTabelaPorBordas, type GradeDeTabela } from './pdfTabelas'
import { extrairImagensDeConteudo, type ImagemDeConteudo } from './pdfImagens'
import { formatarBlocoOcrPendente } from '../ocr/marcadorOcrPendente'

/** Diferença máxima de Y (em pontos) pra dois itens contarem como a MESMA
 *  linha da página impressa.
 *
 *  Valor medido, não chutado: nas 45 páginas da proposta de referência, as
 *  2.150 distâncias entre alturas distintas de texto se separam em dois grupos
 *  sem nada no meio — 12 abaixo de 3pt (tremor de arredondamento dentro da
 *  mesma linha) e 2.138 acima de 6pt (entrelinha de verdade: mínima 10,2pt,
 *  mediana 10,8pt). Entre 3 e 6pt não cai NENHUMA medição, e 3 fica na borda
 *  segura dessa faixa vazia. Se for mexer aqui, refaça a medição no seu
 *  conjunto de documentos em vez de ajustar pelo caso da vez. */
const TOLERANCIA_MESMA_LINHA = 3

/** Gap horizontal (em pontos) que faz uma linha VIRAR CANDIDATA a linha de
 *  tabela. É só o primeiro peneiramento, nunca a decisão: texto justificado
 *  estica os espaços entre palavras e passa desse limiar o tempo todo. Quem
 *  decide são os corredores (`corredoresDoBloco`). */
const LIMIAR_GAP_COLUNA = 24

/** Largura mínima (em pontos) de um corredor vertical vazio pra ele contar como
 *  separação entre colunas.
 *
 *  Valor medido, não chutado: rodando `scripts/diagnostico-conversao.mts` nas
 *  propostas reais, o número de tabelas detectadas não muda em nada entre 12 e
 *  24 — abaixo disso começa a aparecer tabela falsa, acima começa a sumir
 *  tabela boa. 18 é o meio desse platô, o ponto mais distante dos dois lados.
 *  Se for mexer aqui, refaça essa varredura em cima do seu conjunto de
 *  documentos em vez de ajustar pelo caso da vez. */
const LARGURA_MINIMA_CORREDOR = 18

/** Num bloco de apenas DUAS linhas não há repetição suficiente pra confiar num
 *  corredor estreito: duas linhas de texto corrido podem alinhar os vãos por
 *  puro acaso. Aí só vale corredor claramente largo — do tamanho do próprio vão
 *  que qualifica a linha como candidata. Com três linhas ou mais, o acaso já
 *  fica improvável e o limite volta a ser `LARGURA_MINIMA_CORREDOR`. */
const LARGURA_MINIMA_CORREDOR_EM_BLOCO_CURTO = LIMIAR_GAP_COLUNA

/** Em quantas linhas do bloco o corredor precisa aparecer como espaço ENTRE
 *  dois trechos de texto — e não como sobra à direita de uma linha curta, que
 *  toda última linha de parágrafo tem. */
const LINHAS_PARA_CONFIRMAR_CORREDOR = 2

/** Acima desse tamanho, mesmo uma linha com fonte maior que o corpo do texto não
 *  vira título — título de verdade é curto; frase longa com fonte um pouco maior
 *  é ruído de medição da extração, não uma seção nova. */
const LIMIAR_TAMANHO_TITULO = 80

/** Abaixo desse tanto de caractere extraído na página, "não tem texto de
 *  verdade ali" — candidata a página escaneada. Valor do design aprovado em
 *  2026-08-31 (não medido neste projeto; ajustar com cautela). */
const LIMIAR_CHARS_PAGINA_IMAGEM = 50

/** Acima dessa fração de área da página coberta por imagem — combinado com
 *  pouco texto acima — a página é tratada como escaneada. */
const LIMIAR_COBERTURA_IMAGEM = 0.4

/** Distância (em pontos) abaixo da linha de base do texto onde um traço de
 *  sublinhado costuma ser desenhado. */
const DISTANCIA_MIN_SUBLINHADO = 0.5
const DISTANCIA_MAX_SUBLINHADO = 4
/** Fração mínima da largura do trecho que o traço precisa cobrir pra contar
 *  como sublinhado (evita marcar por causa de um traço decorativo curto). */
const COBERTURA_MIN_SUBLINHADO = 0.7

/** Distância (em pontos) pra um traço horizontal contar como "é esta linha da
 *  grade de bordas". Acompanha a tolerância de cluster da grade em
 *  `pdfTabelas.ts`: uma borda costuma ser um retângulo fino de ~2pt, e as duas
 *  arestas dele têm que cair na mesma linha de grade. */
const TOLERANCIA_BORDA_DE_TABELA = 3.5

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

const REGEX_LISTA_NUMERADA = /^(\d+)([.)])\s+(.*)$/
const REGEX_LISTA_MARCADOR = /^[•\-*]\s+(.*)$/

/** Distância (em pontos) dentro da qual dois marcadores de lista contam como o
 *  MESMO nível de indentação.
 *
 *  Valor medido: na proposta de referência os marcadores começam em três
 *  posições — x≈42, x≈48-51 e x≈57 — com tremor de até 3pt dentro de cada uma
 *  e degrau de 6pt e 9pt entre elas. 4 é o único valor que absorve o tremor sem
 *  fundir dois níveis. */
const TOLERANCIA_NIVEL_MARCADOR = 4
/** Fim de frase/parágrafo: pontuação final, opcionalmente seguida de aspas/parêntese. */
const REGEX_PONTUACAO_FINAL = /[.:;!?]["'”)\]]?$/

/** Preposições/artigos/conjunções que um título em Title Case mantém em minúsculas
 *  (ex.: "Da Lei Geral de Proteção de Dados") — só a primeira palavra do título
 *  nunca entra aqui, mesmo que ela própria seja um desses conectivos. */
const CONECTIVOS_MINUSCULOS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'os', 'as', 'em', 'no', 'na',
  'nos', 'nas', 'para', 'por', 'com', 'sem', 'sob', 'sobre', 'entre', 'após',
  'ante', 'até', 'perante', 'um', 'uma', 'uns', 'umas', 'ou', 'à', 'às', 'ao',
  'aos', 'que',
])

/** Conjunções que nunca ABREM um título de verdade — diferente de "Do"/"Da" (que
 *  são contração de artigo+preposição e abrem título normalmente, ex. "Do Reajuste
 *  de Preços"), uma conjunção pura no início só aparece quando o PDF quebrou a
 *  linha no meio de uma frase/nome ("...4 TREINAMENTOS PADRÃO" / "E 1 AVANÇADO"). */
const CONJUNCOES_PROIBIDAS_NO_INICIO = new Set(['e', 'ou', 'mas', 'que', 'se', 'nem'])

/** Fonte igual ou um pouco maior que o corpo (ver `ehTitulo`) não é sinal
 *  suficiente sozinha — em seções onde corpo E título usam o mesmo tamanho de
 *  fonte (comum em introdução e cláusulas finais deste tipo de documento), só
 *  o PADRÃO DE CAPITALIZAÇÃO separa um título de uma frase comum: título tem
 *  cada palavra de conteúdo com inicial maiúscula (Title Case) ou está TUDO EM
 *  MAIÚSCULAS; frase comum começa com minúscula ou mistura maiúsculas só nos
 *  substantivos próprios/termos definidos, com o resto em minúsculas. */
function pareceTituloPelaCapitalizacao(texto: string): boolean {
  const palavras = texto.split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return false

  const primeiraLimpa = palavras[0].replace(/^[-–("'“]+|[-–)"'”,;:]+$/g, '')
  if (CONJUNCOES_PROIBIDAS_NO_INICIO.has(primeiraLimpa.toLowerCase())) return false

  return palavras.every((palavra, indice) => {
    const limpa = palavra.replace(/^[-–("'“]+|[-–)"'”,;:]+$/g, '')
    const letraInicial = limpa.match(/\p{L}/u)?.[0]
    if (!letraInicial) return true // token sem letra (número, "-", "/") não desqualifica
    if (indice > 0 && CONECTIVOS_MINUSCULOS.has(limpa.toLowerCase())) return true
    return letraInicial === letraInicial.toUpperCase() && letraInicial !== letraInicial.toLowerCase()
  })
}

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

/** Imagem já gravada no storage, pronta pra entrar no Markdown: guarda o
 *  Markdown final (`![...](url)`) e a posição na página que decide em que ponto
 *  do texto ela entra. */
interface ImagemPosicionada {
  pagina: number
  topo: number
  markdown: string
}

export interface OpcoesConversaoPdf {
  /** Grava a imagem em algum lugar (storage, disco, banco) e devolve a URL que
   *  vai no `![](url)` do Markdown. É a única forma de as imagens do PDF
   *  aparecerem no resultado: sem esta função, elas são ignoradas — o
   *  conversor não decide sozinho onde gravar arquivo nenhum.
   *
   *  Devolver `null` descarta aquela imagem sem interromper a conversão. */
  salvarImagem?: (imagem: ImagemDeConteudo) => Promise<string | null>
}

/**
 * Converte o conteúdo de um PDF em Markdown, preservando negrito, itálico,
 * sublinhado, alinhamento, título, lista, tabela e IMAGEM detectados a partir
 * da fonte, posição, traços vetoriais e operações de desenho de cada página —
 * sem usar IA. É uma extração best-effort: negrito/itálico/título são
 * confiáveis (comparação direta de fonte/tamanho); tabela e sublinhado usam as
 * bordas/traços desenhados no PDF quando existem (mais confiável) e caem pra
 * heurística de posição de texto quando não. É esperado que a pessoa ajuste o
 * resultado manualmente antes de copiar.
 *
 * O `hasEOL` do unpdf marca fim de LINHA VISUAL (onde o PDF quebra a linha na
 * página), não fim de parágrafo — por isso linhas consecutivas são reunidas num
 * mesmo bloco até a última linha absorvida terminar em pontuação final (ou até
 * a próxima linha já começar um item de lista/título/tabela novo).
 *
 * Sobre imagem: texto e imagem são canais separados dentro do PDF, e ler só o
 * texto significa perder diagrama, print de tela e tabela que veio como figura
 * sem nenhum aviso — o Markdown sai "completo" e faltando uma página inteira de
 * conteúdo. Passando `opcoes.salvarImagem`, cada imagem de conteúdo (ver
 * `pdfImagens.ts`, que separa figura de logo/rodapé/capa) é gravada e entra no
 * Markdown como `![](url)`, no meio do texto, na posição em que aparece na
 * página.
 */
export interface PaginaConvertida {
  /** 1-indexada, como `paginasImagem`. */
  pagina: number
  textoOriginal: string
  markdown: string
}

export interface ResultadoConversaoPdf {
  markdown: string
  /** Páginas (1-indexadas) sem camada de texto reconhecível — candidatas a
   *  OCR. Vazio pra qualquer PDF com texto normal. */
  paginasImagem: number[]
  /** Uma entrada por página com texto nativo (exclui as de `paginasImagem`) —
   *  usada só pela checagem por IA, pra comparar texto original x Markdown
   *  gerado sem precisar reler o PDF de novo em outro lugar. */
  paginasConvertidas: PaginaConvertida[]
}

export async function converterPdfParaMarkdown(
  buffer: Buffer,
  opcoes: OpcoesConversaoPdf = {}
): Promise<ResultadoConversaoPdf> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { items, totalPages } = await extractTextItems(pdf)
  const segmentosPorPagina = await extrairSegmentosRetosPorPagina(pdf, totalPages)
  const imagens = await prepararImagens(pdf, totalPages, opcoes.salvarImagem)

  const paginasImagem0 = new Set<number>()
  for (let pagina = 0; pagina < totalPages; pagina++) {
    const caracteresDaPagina = (items[pagina] ?? []).reduce((soma, item) => soma + (item.str?.length ?? 0), 0)
    const cobertura = segmentosPorPagina[pagina]?.fracaoAreaComImagem ?? 0
    if (caracteresDaPagina < LIMIAR_CHARS_PAGINA_IMAGEM && cobertura > LIMIAR_COBERTURA_IMAGEM) {
      paginasImagem0.add(pagina)
    }
  }
  const paginasImagem = [...paginasImagem0].sort((a, b) => a - b).map((p) => p + 1)
  // A página escaneada não deve virar figura crua (![Imagem...]) — ela some
  // como imagem e reaparece como marcador de OCR, na mesma posição.
  const imagensFiltradas = imagens.filter((imagem) => !paginasImagem0.has(imagem.pagina))

  // A grade de bordas vem antes das linhas porque o detector de sublinhado
  // precisa saber quais traços são borda de tabela pra não confundir os dois.
  const gradesPorPagina = new Map<number, GradeDeTabela>()
  segmentosPorPagina.forEach(({ segmentos }, pagina) => {
    const grade = construirGradeDaPagina(segmentos)
    if (grade) gradesPorPagina.set(pagina, grade)
  })

  const todasAsLinhas: Linha[] = []
  items.forEach((itensDaPagina, pagina) => {
    const segmentos = segmentosPorPagina[pagina]?.segmentos ?? []
    const paraSublinhado = segmentosSemBordaDeTabela(segmentos, gradesPorPagina.get(pagina))
    todasAsLinhas.push(...agruparEmLinhas(itensDaPagina, pagina, paraSublinhado))
  })

  const paginasOcrOrdenadas = [...paginasImagem0].sort((a, b) => a - b)

  // Nenhuma linha é descartada — a Proposta Comercial exige que o texto final
  // seja idêntico ao original, então nem rodapé de paginação ("Page N of M",
  // "Página N de N") é removido: se estava no PDF, entra no Markdown.
  if (todasAsLinhas.length === 0) {
    // PDF só de imagem (página escaneada) não tem linha nenhuma, mas ainda tem
    // conteúdo — devolver vazio aqui apagaria o documento inteiro. Página
    // marcada pra OCR vira o marcador; o resto (se houver) segue como figura.
    const blocosOcr = paginasOcrOrdenadas.map((p) => formatarBlocoOcrPendente(p + 1))
    const restante = imagensFiltradas.map((imagem) => imagem.markdown)
    return { markdown: [...blocosOcr, ...restante].join('\n\n'), paginasImagem, paginasConvertidas: [] }
  }

  const tamanhoCorpo = calcularTamanhoCorpo(todasAsLinhas)
  const margens = calcularMargens(todasAsLinhas)

  const { markdown, blocosPorPagina } = montarMarkdown(
    todasAsLinhas,
    tamanhoCorpo,
    margens,
    gradesPorPagina,
    imagensFiltradas,
    paginasOcrOrdenadas
  )

  const textoOriginalPorPagina = new Map<number, string[]>()
  for (const linha of todasAsLinhas) {
    const lista = textoOriginalPorPagina.get(linha.pagina) ?? []
    lista.push(extrairTextoLinha(linha))
    textoOriginalPorPagina.set(linha.pagina, lista)
  }

  const paginasConvertidas: PaginaConvertida[] = [...textoOriginalPorPagina.entries()]
    .filter(([pagina]) => !paginasImagem0.has(pagina))
    .map(([pagina, linhasTexto]) => ({
      pagina: pagina + 1,
      textoOriginal: linhasTexto.join('\n'),
      markdown: (blocosPorPagina.get(pagina) ?? []).join('\n\n'),
    }))
    .sort((a, b) => a.pagina - b.pagina)

  return { markdown, paginasImagem, paginasConvertidas }
}

/** Extrai as imagens de conteúdo, manda gravar cada uma e devolve as que
 *  viraram URL — na mesma ordem de leitura em que saíram do PDF. */
async function prepararImagens(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  totalPaginas: number,
  salvarImagem: OpcoesConversaoPdf['salvarImagem']
): Promise<ImagemPosicionada[]> {
  if (!salvarImagem) return []

  const posicionadas: ImagemPosicionada[] = []
  for (const imagem of await extrairImagensDeConteudo(pdf, totalPaginas)) {
    const url = await salvarImagem(imagem)
    if (!url) continue
    posicionadas.push({
      pagina: imagem.pagina,
      topo: imagem.topo,
      markdown: `![Imagem da página ${imagem.pagina + 1}](${url})`,
    })
  }
  return posicionadas
}

/**
 * Reúne os itens de uma página nas LINHAS da página impressa, em ordem de
 * leitura — de cima pra baixo, da esquerda pra direita.
 *
 * A ordem em que os itens saem do PDF é a ordem em que foram DESENHADOS
 * (content stream), não a ordem em que se lê a página. Nas 45 páginas da
 * proposta que serviu de referência, 45 saem fora de ordem: o rodapé
 * "Page N of 45" é o primeiro item de toda página, e na página 43 a tabela do
 * cronograma é desenhada DEPOIS dos parágrafos que na folha vêm abaixo dela.
 * Reproduzir essa ordem embaralha o documento — foi o que colocou a tabela do
 * cronograma financeiro no fim da seção errada.
 *
 * O `hasEOL` do pdf.js também não basta como fronteira de linha. Ele marca fim
 * de TRECHO desenhado, e no mesmo documento isso quebra dos dois lados: 114
 * linhas de tabela saem partidas em dois trechos com o mesmo Y (o cabeçalho
 * "CÓD. PRODUTO UNIDADE PREÇO" ⟂ "QUANT PERÍODO TOTAL (R$)"), e um trecho só
 * cola um título com a célula de uma tabela 594pt acima dele ("TERMOS E
 * CONDIÇÕES DE CONTRATAÇÃO" ⟂ "Periodo"). Por isso o Y é a autoridade: o
 * `hasEOL` continua abrindo linha nova, mas um trecho que atravessa faixas de
 * Y diferentes é quebrado em uma linha por faixa.
 *
 * A ordenação é estável e só reordena o que está fora de ordem de fato — itens
 * sem posição distinta (mesmo Y, mesmo X) mantêm a ordem em que chegaram.
 */
function agruparEmLinhas(itens: StructuredTextItem[], pagina: number, segmentosDaPagina: SegmentoReto[]): Linha[] {
  const trechos: StructuredTextItem[][] = []
  let atual: StructuredTextItem[] = []

  for (const item of itens) {
    if (item.str.trim().length === 0 && atual.length === 0) continue
    atual.push(item)
    if (item.hasEOL) {
      trechos.push(atual)
      atual = []
    }
  }
  if (atual.length > 0) trechos.push(atual)

  const linhas = trechos
    .flatMap(separarPorFaixaDeY)
    .map((itensDaLinha) => construirLinha(ordenarPorX(itensDaLinha), pagina, segmentosDaPagina))
    .filter((linha) => linha.itens.length > 0)

  return ordenarPorLeitura(linhas)
}

/** Quebra um trecho desenhado em uma lista por faixa de Y — na prática só faz
 *  algo quando o PDF desenhou, num trecho só, texto de alturas diferentes. */
function separarPorFaixaDeY(trecho: StructuredTextItem[]): StructuredTextItem[][] {
  const comTexto = trecho.filter((item) => item.str.trim().length > 0)
  if (comTexto.length <= 1) return comTexto.length === 1 ? [trecho] : []

  const faixas: StructuredTextItem[][] = []
  for (const item of comTexto) {
    const faixa = faixas.find((candidata) => Math.abs(candidata[0].y - item.y) <= TOLERANCIA_MESMA_LINHA)
    if (faixa) faixa.push(item)
    else faixas.push([item])
  }
  return faixas
}

/** Ordem horizontal dentro da linha. Sem isso, uma célula desenhada fora de
 *  ordem sai com os pedaços trocados — foi o que gerou "279.663,46 R$" no
 *  lugar de "R$ 279.663,46" na tabela do cronograma. */
function ordenarPorX(itens: StructuredTextItem[]): StructuredTextItem[] {
  return [...itens].sort((a, b) => a.x - b.x)
}

/** Ordem vertical da página: Y decrescente, porque o eixo Y do PDF cresce de
 *  baixo pra cima. Empate no Y (linha de tabela partida em dois trechos)
 *  desempata pelo X do primeiro item, que é a ordem de leitura da linha. */
function ordenarPorLeitura(linhas: Linha[]): Linha[] {
  return [...linhas].sort((a, b) => {
    if (Math.abs(a.y - b.y) > TOLERANCIA_MESMA_LINHA) return b.y - a.y
    return (a.itens[0]?.x ?? 0) - (b.itens[0]?.x ?? 0)
  })
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

/**
 * Tira da lista de candidatos a sublinhado os traços que são BORDA DE TABELA.
 *
 * A linha horizontal que fecha uma célula cai a poucos pontos abaixo da linha
 * de base do texto que está dentro dela — exatamente a faixa onde um sublinhado
 * é desenhado (`DISTANCIA_MIN/MAX_SUBLINHADO`). Sem esta exclusão, TODA célula
 * de tabela sai como `<u>...</u>`: na proposta de referência eram 191 marcações
 * de sublinhado, todas falsas, num documento que não tem uma única palavra
 * sublinhada. Formatação inventada é tão grave quanto texto perdido.
 */
function segmentosSemBordaDeTabela(segmentos: SegmentoReto[], grade?: GradeDeTabela): SegmentoReto[] {
  if (!grade) return segmentos
  return segmentos.filter((segmento) => {
    if (segmento.y1 !== segmento.y2) return true // vertical nunca vira sublinhado
    return !grade.y.some((yDaGrade) => Math.abs(yDaGrade - segmento.y1) <= TOLERANCIA_BORDA_DE_TABELA)
  })
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

/** Só diz que a linha TEM algum vão largo entre trechos — o suficiente pra ela
 *  entrar como candidata a linha de tabela, nada além disso. */
function temVaoLargo(linha: Linha): boolean {
  for (let i = 1; i < linha.itens.length; i++) {
    const anterior = linha.itens[i - 1]
    const atual = linha.itens[i]
    if (atual.x - (anterior.x + anterior.width) > LIMIAR_GAP_COLUNA) return true
  }
  return false
}

interface Intervalo {
  inicio: number
  fim: number
}

function intervalosOcupados(linha: Linha): Intervalo[] {
  return linha.itens
    .map((item) => ({ inicio: item.x, fim: item.x + item.width }))
    .sort((a, b) => a.inicio - b.inicio)
}

/** Recorta de `livres` tudo que `ocupados` cobre — o que sobra é espaço em
 *  branco. */
function subtrairIntervalos(livres: Intervalo[], ocupados: Intervalo[]): Intervalo[] {
  let resultado = livres
  for (const ocupado of ocupados) {
    const proximo: Intervalo[] = []
    for (const livre of resultado) {
      if (ocupado.fim <= livre.inicio || ocupado.inicio >= livre.fim) {
        proximo.push(livre)
        continue
      }
      if (ocupado.inicio > livre.inicio) proximo.push({ inicio: livre.inicio, fim: ocupado.inicio })
      if (ocupado.fim < livre.fim) proximo.push({ inicio: ocupado.fim, fim: livre.fim })
    }
    resultado = proximo
  }
  return resultado
}

/** O corredor é espaço ENTRE textos nesta linha (tem conteúdo dos dois lados),
 *  e não a sobra à direita de uma linha que simplesmente acabou antes. */
function ehEspacoEntreTextos(corredor: Intervalo, linha: Linha): boolean {
  const ocupados = intervalosOcupados(linha)
  return (
    ocupados.some((item) => item.fim <= corredor.inicio) &&
    ocupados.some((item) => item.inicio >= corredor.fim)
  )
}

/**
 * Corredores verticais que atravessam TODAS as linhas do bloco sem encostar em
 * texto nenhum — é isso que separa coluna de tabela de espaço esticado de
 * parágrafo justificado.
 *
 * Num parágrafo justificado os vãos entre palavras são largos, mas caem num X
 * diferente a cada linha; empilhadas, uma linha tapa o vão da outra e não sobra
 * corredor. Numa tabela as colunas ficam sempre no mesmo lugar, então o
 * corredor atravessa o bloco inteiro de cima a baixo.
 *
 * O corredor ainda precisa ser espaço entre textos em pelo menos duas linhas
 * (`LINHAS_PARA_CONFIRMAR_CORREDOR`): sem isso, a área vazia à direita das
 * linhas curtas de um parágrafo comum viraria "coluna".
 */
function corredoresDoBloco(linhas: Linha[], larguraMinima: number): Intervalo[] {
  const inicios = linhas.flatMap((linha) => linha.itens.map((item) => item.x))
  const fins = linhas.flatMap((linha) => linha.itens.map((item) => item.x + item.width))
  if (inicios.length === 0) return []

  let livres: Intervalo[] = [{ inicio: Math.min(...inicios), fim: Math.max(...fins) }]
  for (const linha of linhas) livres = subtrairIntervalos(livres, intervalosOcupados(linha))

  return livres.filter((corredor) => {
    if (corredor.fim - corredor.inicio < larguraMinima) return false
    const confirmacoes = linhas.filter((linha) => ehEspacoEntreTextos(corredor, linha)).length
    return confirmacoes >= LINHAS_PARA_CONFIRMAR_CORREDOR
  })
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

/** Distribui os trechos da linha entre as colunas delimitadas pelos corredores.
 *  Usa o MEIO do corredor como divisor, então funciona igual pra coluna
 *  alinhada à esquerda e pra coluna alinhada à direita (valor em R$, por
 *  exemplo), onde o começo do texto muda de linha pra linha. */
function linhaParaColunas(linha: Linha, divisores: number[]): string[] {
  const celulas: string[] = Array(divisores.length + 1).fill('')
  for (const item of linha.itens) {
    const indiceColuna = divisores.filter((divisor) => item.x >= divisor).length
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
 *  um pouco maior é ruído de medição da extração, não uma seção nova do documento.
 *  Título também nunca termina em pontuação final — é o início de algo novo, não o
 *  fim de uma frase.
 *
 *  Fonte NOTAVELMENTE maior que o corpo (>= 1.3x) já basta sozinha: nesse caso não
 *  há ambiguidade. Mas o documento pode ter seções inteiras (introdução, cláusulas
 *  finais) onde o corpo do texto inteiro usa uma fonte só um pouco maior que o
 *  resto do documento — nesse caso comparar só o tamanho da fonte classificaria
 *  toda frase comum daquela seção como título. Por isso, fonte apenas igual ou um
 *  pouco maior (>= 0.95x) só conta como título se o TEXTO também tiver cara de
 *  título (Title Case ou TUDO EM MAIÚSCULAS) — ver `pareceTituloPelaCapitalizacao`. */
function ehTitulo(linha: Linha, tamanhoCorpo: number): boolean {
  const texto = extrairTextoLinha(linha)
  if (texto.length === 0 || texto.length > LIMIAR_TAMANHO_TITULO) return false
  if (ehMarcadorDeLista(texto)) return false
  if (terminaComPontuacaoFinal(texto)) return false

  if (linha.fontSizeMedio >= tamanhoCorpo * 1.3) return true
  return linha.fontSizeMedio >= tamanhoCorpo * 0.95 && pareceTituloPelaCapitalizacao(texto)
}

function formatarTitulo(linha: Linha, tamanhoCorpo: number, margens: Margens): string {
  const texto = extrairTextoLinha(linha)
  const nivel = linha.fontSizeMedio >= tamanhoCorpo * 1.5 ? 1 : 2
  if (ehCentralizado(linha, margens)) {
    return `<h${nivel} align="center">${texto}</h${nivel}>`
  }
  return `${'#'.repeat(nivel)} ${texto}`
}

/**
 * Posições X onde os marcadores de lista do documento começam, uma por nível de
 * indentação, da esquerda pra direita — é o que transforma "está mais pra
 * dentro na folha" em "é sub-item".
 *
 * Só entram posições que se REPETEM: um nível de verdade é usado várias vezes,
 * enquanto um hífen solto no meio de uma frase aparece uma vez só e criaria um
 * nível fantasma lá no fundo da página.
 */
function ancorasDeNivelDeMarcador(linhas: Linha[]): number[] {
  const contagemPorX = new Map<number, number>()
  for (const linha of linhas) {
    const primeiro = linha.itens[0]
    if (!primeiro || !REGEX_LISTA_MARCADOR.test(extrairTextoLinha(linha))) continue
    const x = Math.round(primeiro.x)
    contagemPorX.set(x, (contagemPorX.get(x) ?? 0) + 1)
  }

  const ancoras: number[] = []
  const repetidos = [...contagemPorX.entries()]
    .filter(([, vezes]) => vezes > 1)
    .map(([x]) => x)
    .sort((a, b) => a - b)
  for (const x of repetidos) {
    const ultima = ancoras[ancoras.length - 1]
    // Compara com a ÂNCORA, não com o valor anterior: comparando com o anterior,
    // uma escadinha de 1 em 1 ponto encadearia níveis distintos num só.
    if (ultima === undefined || x - ultima > TOLERANCIA_NIVEL_MARCADOR) ancoras.push(x)
  }
  return ancoras
}

/** Nível de indentação (0 = mais externo) do marcador que começa em `x`. */
function nivelDoMarcador(x: number, ancoras: number[]): number {
  const nivel = ancoras.filter((ancora) => x >= ancora - TOLERANCIA_NIVEL_MARCADOR).length - 1
  return Math.max(0, nivel)
}

function formatarBlocoDeTexto(
  textos: string[],
  linhasDoBloco: Linha[],
  margens: Margens,
  ancorasDeMarcador: number[]
): string {
  const textoCompleto = textos.join(' ')

  // O número da cláusula é escapado (`1\.`) de propósito, pra sair como
  // parágrafo e não como lista Markdown: numa lista quem numera é o
  // renderizador, e uma sequência que no PDF é 1, 2, 4, 5 seria reescrita como
  // 1, 2, 3, 4. Em contrato, trocar o número da cláusula é trocar o conteúdo.
  const numerada = textoCompleto.match(REGEX_LISTA_NUMERADA)
  if (numerada) return `${numerada[1]}\\${numerada[2]} ${numerada[3]}`

  const marcada = textoCompleto.match(REGEX_LISTA_MARCADOR)
  if (marcada) {
    const x = linhasDoBloco[0]?.itens[0]?.x ?? 0
    return `${'  '.repeat(nivelDoMarcador(x, ancorasDeMarcador))}- ${marcada[1]}`
  }

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
  tamanhoCorpo: number,
  gradesPorPagina: Map<number, GradeDeTabela>
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
    if (iniciaTabela(linhas, j, gradesPorPagina)) break

    textos.push(textoCandidata)
    linhasConsumidas.push(candidata)
    j++
  }

  return { textos, linhasConsumidas, proximoIndice: j }
}

/**
 * Tenta montar uma tabela a partir da POSIÇÃO do texto — fallback pra quando a
 * página não tem grade de bordas desenhada (`detectarTabelaPorBordas` devolveu
 * `null`).
 *
 * A tabela é definida como a MAIOR sequência de linhas que compartilha pelo
 * menos um corredor vertical: a cada linha nova, os corredores são recalculados
 * com ela dentro, e a linha só entra se ainda sobrar corredor. É isso que dá o
 * limite certo do bloco — quando a tabela acaba e começa o parágrafo seguinte,
 * a primeira linha de texto corrido tapa os corredores e o bloco fecha ali.
 *
 * Sem esse critério incremental, bastava a linha ter vão largo pra ser
 * absorvida, e o bloco da tabela seguia engolindo o texto justificado logo
 * abaixo dela — a tabela saía com parágrafos inteiros picados como se fossem
 * mais linhas dela.
 *
 * Deliberadamente NÃO se descarta o bloco por "parecer justificado" (todas as
 * linhas terminando na margem direita): tabela de preço tem a última coluna
 * alinhada à direita e termina na margem em toda linha, e essa regra apagava
 * justamente a tabela financeira da proposta.
 */
function absorverTabelaPorPosicao(
  linhas: Linha[],
  indiceInicial: number
): { markdown: string; proximoIndice: number } | null {
  if (!temVaoLargo(linhas[indiceInicial])) return null

  const linhasDaTabela: Linha[] = [linhas[indiceInicial]]
  let j = indiceInicial + 1
  while (j < linhas.length && temVaoLargo(linhas[j])) {
    // Na hora de crescer o bloco vale o limite normal: o critério mais duro do
    // bloco de duas linhas é aplicado no fim, sobre o bloco já fechado — senão
    // uma tabela de três linhas morreria logo no segundo passo.
    if (corredoresDoBloco([...linhasDaTabela, linhas[j]], LARGURA_MINIMA_CORREDOR).length === 0) break
    linhasDaTabela.push(linhas[j])
    j++
  }

  if (linhasDaTabela.length < 2) return null

  const larguraExigida =
    linhasDaTabela.length <= 2 ? LARGURA_MINIMA_CORREDOR_EM_BLOCO_CURTO : LARGURA_MINIMA_CORREDOR
  const corredores = corredoresDoBloco(linhasDaTabela, larguraExigida)
  if (corredores.length === 0) return null

  const divisores = corredores.map((corredor) => (corredor.inicio + corredor.fim) / 2).sort((a, b) => a - b)
  const linhasFormatadas = linhasDaTabela.map((linha) => linhaParaColunas(linha, divisores))
  return { markdown: montarTabelaMarkdown(linhasFormatadas), proximoIndice: j }
}

/** Uma tabela (por bordas ou por posição) começa exatamente nesta linha? É o
 *  que interrompe a absorção de um parágrafo — antes bastava a linha TER vão
 *  largo, e com isso todo parágrafo justificado se partia no meio sem que
 *  tabela nenhuma chegasse a ser gerada. */
function iniciaTabela(
  linhas: Linha[],
  indice: number,
  gradesPorPagina: Map<number, GradeDeTabela>
): boolean {
  const grade = gradesPorPagina.get(linhas[indice].pagina)
  if (grade && detectarTabelaPorBordas(linhas, indice, grade)) return true
  return absorverTabelaPorPosicao(linhas, indice) !== null
}

/** Uma imagem entra no Markdown ANTES de uma linha quando está numa página
 *  anterior, ou quando o TOPO dela fica acima da linha de base do texto na mesma
 *  página — ou seja, quando na página impressa ela vem antes daquela linha. */
function imagemVemAntesDaLinha(imagem: ImagemPosicionada, linha: Linha): boolean {
  if (imagem.pagina !== linha.pagina) return imagem.pagina < linha.pagina
  return imagem.topo >= linha.y
}

function montarMarkdown(
  linhas: Linha[],
  tamanhoCorpo: number,
  margens: Margens,
  gradesPorPagina: Map<number, GradeDeTabela>,
  imagens: ImagemPosicionada[] = [],
  paginasOcr: number[] = []
): { markdown: string; blocosPorPagina: Map<number, string[]> } {
  const blocos: string[] = []
  const blocosPorPagina = new Map<number, string[]>()
  // Registra o bloco na posição da página, além de empilhá-lo — é o que
  // permite montar `paginasConvertidas` (texto original x markdown por
  // página, usado pela checagem por IA) sem uma segunda passada.
  const registrar = (pagina: number, bloco: string) => {
    blocos.push(bloco)
    if (bloco.length === 0) return
    const lista = blocosPorPagina.get(pagina) ?? []
    lista.push(bloco)
    blocosPorPagina.set(pagina, lista)
  }
  const imagensPendentes = [...imagens]
  const paginasOcrPendentes = [...paginasOcr]
  const ancorasDeMarcador = ancorasDeNivelDeMarcador(linhas)
  let i = 0

  // Página marcada pra OCR não tem Linha nenhuma (é por isso que está
  // marcada) — entra na posição certa comparando só o número da página, igual
  // ao mecanismo de imagem logo abaixo. Não entra em `blocosPorPagina`: não é
  // conteúdo checável (a checagem por IA pula página de OCR).
  const despejarOcrAntesDe = (pagina: number) => {
    while (paginasOcrPendentes.length > 0 && paginasOcrPendentes[0] <= pagina) {
      blocos.push(formatarBlocoOcrPendente(paginasOcrPendentes.shift()! + 1))
    }
  }

  // As imagens são despejadas nas quebras de bloco: assim uma figura nunca
  // parte um parágrafo ou uma tabela no meio, e mesmo assim cai no ponto certo
  // do fluxo de leitura.
  const despejarImagensAntesDe = (linha: Linha) => {
    while (imagensPendentes.length > 0 && imagemVemAntesDaLinha(imagensPendentes[0], linha)) {
      const imagem = imagensPendentes.shift()!
      registrar(imagem.pagina, imagem.markdown)
    }
  }

  while (i < linhas.length) {
    despejarOcrAntesDe(linhas[i].pagina)
    despejarImagensAntesDe(linhas[i])

    const grade = gradesPorPagina.get(linhas[i].pagina)
    const tabelaPorBordas = grade ? detectarTabelaPorBordas(linhas, i, grade) : null
    if (tabelaPorBordas) {
      registrar(linhas[i].pagina, tabelaPorBordas.markdown)
      i = tabelaPorBordas.proximoIndice
      continue
    }

    const tabelaPorPosicao = absorverTabelaPorPosicao(linhas, i)
    if (tabelaPorPosicao) {
      registrar(linhas[i].pagina, tabelaPorPosicao.markdown)
      i = tabelaPorPosicao.proximoIndice
      continue
    }

    if (ehTitulo(linhas[i], tamanhoCorpo)) {
      registrar(linhas[i].pagina, formatarTitulo(linhas[i], tamanhoCorpo, margens))
      i++
      continue
    }

    const { textos, linhasConsumidas, proximoIndice } = absorverBloco(linhas, i, tamanhoCorpo, gradesPorPagina)
    registrar(linhas[i].pagina, formatarBlocoDeTexto(textos, linhasConsumidas, margens, ancorasDeMarcador))
    i = proximoIndice
  }

  // Página de OCR ou imagem depois da última linha de texto do documento
  // (figura/anexo de fechamento) não pode ficar de fora.
  for (const pagina of paginasOcrPendentes) blocos.push(formatarBlocoOcrPendente(pagina + 1))
  for (const imagem of imagensPendentes) registrar(imagem.pagina, imagem.markdown)

  return { markdown: blocos.filter((bloco) => bloco.length > 0).join('\n\n'), blocosPorPagina }
}
