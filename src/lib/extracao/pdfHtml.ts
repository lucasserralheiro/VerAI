import { extractTextItems, getDocumentProxy, type StructuredTextItem } from 'unpdf'
import { extrairSegmentosRetosPorPagina, type SegmentoReto } from './pdfTracos'
import { construirGradesDaPagina, detectarTabelaPorBordas, type GradeDeTabela } from './pdfTabelas'
import { extrairImagensDeConteudo, type ImagemDeConteudo } from './pdfImagens'
import { obterEstilosDeFontePorPagina, type EstiloDeFonte } from './pdfFontes'
import { formatarBlocoOcrPendente } from '../ocr/marcadorOcrPendente'
import { escaparHtml } from './escaparHtml'
import { corredoresDoBloco, type Intervalo } from './corredores'

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

// Grupo 1 é o PREFIXO LITERAL inteiro (número + separador + espaço,
// exatamente como está no PDF) — formato mais comum é "1." / "1)", mas a
// proposta de referência numera os sistemas abrangidos como "1 - CG0101...",
// com espaço antes do traço. Manter o prefixo como um grupo só (em vez de
// número/separador separados) preserva esse espaçamento literal ao remontar
// o parágrafo em `formatarBlocoDeTexto`, sem inventar formatação que não
// estava no original.
const REGEX_LISTA_NUMERADA = /^(\d+\s*[.)-]\s+)(.*)$/
const REGEX_LISTA_MARCADOR = /^[•\-*]\s+(.*)$/

/** Trava de segurança pra `absorverBloco`: sem ela um bloco cresce enquanto a
 *  última linha absorvida não terminar em pontuação final — e texto tabular
 *  (preço, quantidade, código de item) raramente termina em ponto/vírgula
 *  final. Quando a tabela correspondente NÃO é reconhecida (nem por borda, nem
 *  por corredor — ver `iniciaTabela`), dezenas de linhas da tabela viram UM
 *  parágrafo só, sem quebra nenhuma: é exatamente a "parede de texto" que sai
 *  ilegível ao colar no SEI.
 *
 *  Diferente das constantes acima, este valor NÃO foi medido num corpus de
 *  documentos — é uma válvula de segurança deliberadamente conservadora: força
 *  uma quebra de parágrafo aqui (o restante ainda sai, sem coluna, mas pelo
 *  menos separado linha a linha do PDF, em vez de uma única `<li>`/`<p>`
 *  gigante) em vez de deixar o bloco crescer sem limite. Um parágrafo legítimo
 *  raríssimo que precise de mais linhas do que isto pra fechar em pontuação
 *  só perde a quebra "ideal" e vira dois parágrafos consecutivos — resultado
 *  pior que o normal, mas muito melhor que uma tabela inteira grudada. Se for
 *  afinar este número, use `scripts/diagnostico-conversao.mts` (métrica
 *  "blocos-gigantes") no seu conjunto de documentos em vez de ajustar pelo
 *  caso da vez. */
const LIMITE_LINHAS_SEM_PONTUACAO = 12

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

/** `StructuredTextItem` do `unpdf` + negrito/itálico já resolvidos pelo nome
 *  real da fonte (`pdfFontes.ts`) — anexado ANTES de agrupar em linhas, pra
 *  sobreviver às reordenações (`ordenarPorX`, `separarPorFaixaDeY`) sem
 *  depender de índice de array. */
type ItemComEstilo = StructuredTextItem & EstiloDeFonte

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

/** Imagem já gravada no storage, pronta pra entrar no HTML: guarda o HTML
 *  final (`<img alt="..." src="...">`) e a posição na página que decide em
 *  que ponto do texto ela entra. */
interface ImagemPosicionada {
  pagina: number
  topo: number
  html: string
}

export interface OpcoesConversaoPdf {
  /** Grava a imagem em algum lugar (storage, disco, banco) e devolve a URL que
   *  vai no `src` do `<img>`. É a única forma de as imagens do PDF
   *  aparecerem no resultado: sem esta função, elas são ignoradas — o
   *  conversor não decide sozinho onde gravar arquivo nenhum.
   *
   *  Devolver `null` descarta aquela imagem sem interromper a conversão. */
  salvarImagem?: (imagem: ImagemDeConteudo) => Promise<string | null>
}

/**
 * Converte o conteúdo de um PDF em HTML, preservando negrito, itálico,
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
 * sem nenhum aviso — o HTML sai "completo" e faltando uma página inteira de
 * conteúdo. Passando `opcoes.salvarImagem`, cada imagem de conteúdo (ver
 * `pdfImagens.ts`, que separa figura de logo/rodapé/capa) é gravada e entra no
 * HTML como `<img>`, no meio do texto, na posição em que aparece na página.
 */
export interface PaginaConvertida {
  /** 1-indexada, como `paginasImagem`. */
  pagina: number
  textoOriginal: string
  html: string
}

export interface ResultadoConversaoPdf {
  html: string
  /** Páginas (1-indexadas) sem camada de texto reconhecível — candidatas a
   *  OCR. Vazio pra qualquer PDF com texto normal. */
  paginasImagem: number[]
  /** Uma entrada por página com texto nativo (exclui as de `paginasImagem`) —
   *  usada só pela checagem por IA, pra comparar texto original x HTML
   *  gerado sem precisar reler o PDF de novo em outro lugar. */
  paginasConvertidas: PaginaConvertida[]
  /** Páginas (1-indexadas) com pelo menos uma imagem de CONTEÚDO embutida
   *  (![Imagem da página N]) — pode ser tabela, gráfico ou diagrama que o
   *  PDF trouxe como figura em vez de texto. Exclui página que já está em
   *  `paginasImagem` (essa já tem fluxo próprio de OCR). */
  paginasComImagem: number[]
}

export async function converterPdfParaHtml(
  buffer: Buffer,
  opcoes: OpcoesConversaoPdf = {}
): Promise<ResultadoConversaoPdf> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { items, totalPages } = await extractTextItems(pdf)
  const segmentosPorPagina = await extrairSegmentosRetosPorPagina(pdf, totalPages)
  const estilosPorPagina = await obterEstilosDeFontePorPagina(pdf, totalPages)
  const imagens = await prepararImagens(pdf, totalPages, opcoes.salvarImagem)
  const itemsComEstilo: ItemComEstilo[][] = items.map((itensDaPagina, pagina) => {
    const estilosDaPagina = estilosPorPagina[pagina] ?? []
    return itensDaPagina.map((item, indice) => ({
      ...item,
      ...(estilosDaPagina[indice] ?? { negrito: false, italico: false }),
    }))
  })

  const paginasImagem0 = new Set<number>()
  for (let pagina = 0; pagina < totalPages; pagina++) {
    const caracteresDaPagina = (items[pagina] ?? []).reduce((soma, item) => soma + (item.str?.length ?? 0), 0)
    const cobertura = segmentosPorPagina[pagina]?.fracaoAreaComImagem ?? 0
    if (caracteresDaPagina < LIMIAR_CHARS_PAGINA_IMAGEM && cobertura > LIMIAR_COBERTURA_IMAGEM) {
      paginasImagem0.add(pagina)
    }
  }
  const paginasImagem = [...paginasImagem0].sort((a, b) => a - b).map((p) => p + 1)
  // A página escaneada não deve virar figura crua (<img>) — ela some
  // como imagem e reaparece como marcador de OCR, na mesma posição.
  const imagensFiltradas = imagens.filter((imagem) => !paginasImagem0.has(imagem.pagina))
  // Página com imagem de conteúdo (tabela/gráfico que virou figura), fora das
  // que já são página inteira de OCR — a checagem por IA usa isso pra avisar
  // "confira essa página na mão", já que ela não vê o pixel da imagem (mesmo
  // a imagem aparecendo no HTML pra pessoa, a IA da checagem só recebe texto).
  const paginasComImagemSet = new Set(imagensFiltradas.map((imagem) => imagem.pagina + 1))
  const paginasComImagem = [...paginasComImagemSet].sort((a, b) => a - b)
  // Imagem de conteúdo numa página de texto normal entra como <img> mesmo,
  // na posição em que apareceu no PDF (contrato documentado em
  // `OpcoesConversaoPdf.salvarImagem` acima) — cópia fiel do original em vez
  // de aproximação por OCR. Chegou a existir uma versão que convertia essa
  // imagem num marcador de OCR de página inteira; revertido porque a pessoa
  // via só o texto reconhecido, nunca a imagem de verdade (ver
  // `paginasComImagemSet` acima pro aviso de "confira no original" que
  // continua valendo, já que a checagem por IA não enxerga pixel).
  const imagensParaOcr: ImagemPosicionada[] = imagensFiltradas

  // A grade de bordas vem antes das linhas porque o detector de sublinhado
  // precisa saber quais traços são borda de tabela pra não confundir os dois.
  // Cada página pode ter mais de uma tabela desenhada (ex.: tabela de preço
  // seguida do cronograma, com parágrafo entre as duas) — por isso uma LISTA
  // de grades por página, uma por tabela, nunca uma grade só unindo bordas de
  // tabelas diferentes (ver `construirGradesDaPagina`).
  const gradesPorPagina = new Map<number, GradeDeTabela[]>()
  segmentosPorPagina.forEach(({ segmentos }, pagina) => {
    const grades = construirGradesDaPagina(segmentos)
    if (grades.length > 0) gradesPorPagina.set(pagina, grades)
  })

  const todasAsLinhas: Linha[] = []
  itemsComEstilo.forEach((itensDaPagina, pagina) => {
    const segmentos = segmentosPorPagina[pagina]?.segmentos ?? []
    const paraSublinhado = segmentosSemBordaDeTabela(segmentos, gradesPorPagina.get(pagina))
    todasAsLinhas.push(...agruparEmLinhas(itensDaPagina, pagina, paraSublinhado))
  })

  const paginasOcrOrdenadas = [...paginasImagem0].sort((a, b) => a - b)

  // Nenhuma linha é descartada — a Proposta Comercial exige que o texto final
  // seja idêntico ao original, então nem rodapé de paginação ("Page N of M",
  // "Página N de N") é removido: se estava no PDF, entra no HTML.
  if (todasAsLinhas.length === 0) {
    // PDF só de imagem (página escaneada) não tem linha nenhuma, mas ainda tem
    // conteúdo — devolver vazio aqui apagaria o documento inteiro. Sem texto
    // NENHUM no documento inteiro não existe "página de texto normal com
    // figura" — toda página com imagem também vira marcador de OCR, mesmo
    // que a cobertura de imagem não tenha passado do limiar de paginasImagem0.
    const paginasComImagemSemTexto = new Set(imagensFiltradas.map((imagem) => imagem.pagina))
    const paginasParaOcr = [...new Set([...paginasImagem0, ...paginasComImagemSemTexto])].sort((a, b) => a - b)
    const blocosOcr = paginasParaOcr.map((p) => formatarBlocoOcrPendente(p + 1))
    return { html: blocosOcr.join('\n\n'), paginasImagem, paginasConvertidas: [], paginasComImagem }
  }

  const tamanhoCorpo = calcularTamanhoCorpo(todasAsLinhas)
  const margens = calcularMargens(todasAsLinhas)

  const { html, blocosPorPagina } = montarHtml(
    todasAsLinhas,
    tamanhoCorpo,
    margens,
    gradesPorPagina,
    imagensParaOcr,
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
      html: agruparListasEmHtml(blocosPorPagina.get(pagina) ?? []).join('\n\n'),
    }))
    .sort((a, b) => a.pagina - b.pagina)

  return { html, paginasImagem, paginasConvertidas, paginasComImagem }
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
      html: `<img alt="Imagem da página ${imagem.pagina + 1}" src="${escaparHtml(url)}">`,
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
function agruparEmLinhas(itens: ItemComEstilo[], pagina: number, segmentosDaPagina: SegmentoReto[]): Linha[] {
  const trechos: ItemComEstilo[][] = []
  let atual: ItemComEstilo[] = []

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
function separarPorFaixaDeY(trecho: ItemComEstilo[]): ItemComEstilo[][] {
  const comTexto = trecho.filter((item) => item.str.trim().length > 0)
  if (comTexto.length <= 1) return comTexto.length === 1 ? [trecho] : []

  const faixas: ItemComEstilo[][] = []
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
function ordenarPorX(itens: ItemComEstilo[]): ItemComEstilo[] {
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

function construirLinha(itensBrutos: ItemComEstilo[], pagina: number, segmentosDaPagina: SegmentoReto[]): Linha {
  const itensComTexto = itensBrutos.filter((item) => item.str.trim().length > 0)
  const y = itensComTexto[0]?.y ?? 0

  const itens: ItemLinha[] = itensComTexto.map((item) => ({
    texto: item.str,
    x: item.x,
    width: item.width,
    negrito: item.negrito,
    italico: item.italico,
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
function segmentosSemBordaDeTabela(segmentos: SegmentoReto[], grades?: GradeDeTabela[]): SegmentoReto[] {
  if (!grades || grades.length === 0) return segmentos
  return segmentos.filter((segmento) => {
    if (segmento.y1 !== segmento.y2) return true // vertical nunca vira sublinhado
    return !grades.some((grade) =>
      grade.y.some((yDaGrade) => Math.abs(yDaGrade - segmento.y1) <= TOLERANCIA_BORDA_DE_TABELA)
    )
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

/** Aplica negrito/itálico/sublinhado a um trecho de texto — fonte única desse
 *  formato, reaproveitada tanto pra parágrafo comum quanto pra célula de
 *  tabela (posição ou borda). `item.texto` é escapado (`escaparHtml`) ANTES
 *  de entrar em qualquer tag — é o único ponto do conversor que toca texto
 *  bruto do PDF, então é aqui que a blindagem contra `&`/`<`/`>` tem que
 *  acontecer. */
export function formatarTexto(item: ItemLinha): string {
  let texto = escaparHtml(item.texto)
  if (item.negrito && item.italico) texto = `<strong><em>${texto}</em></strong>`
  else if (item.negrito) texto = `<strong>${texto}</strong>`
  else if (item.italico) texto = `<em>${texto}</em>`
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

/** Célula já chega como HTML inline pronto (via `formatarTexto`) — nunca
 *  escapar de novo aqui, só encaixar na tag de linha/célula certa. */
export function montarTabelaHtml(linhas: string[][]): string {
  const [cabecalho, ...resto] = linhas
  const linhaCabecalho = `<tr>${cabecalho.map((c) => `<th>${c}</th>`).join('')}</tr>`
  const linhasCorpo = resto.map((linha) => `<tr>${linha.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
  return `<table><thead>${linhaCabecalho}</thead><tbody>${linhasCorpo}</tbody></table>`
}

function extrairTextoLinha(linha: Linha): string {
  return linha.itens.map((item) => formatarTexto(item)).join(' ').trim()
}

/** Texto puro da linha, SEM as tags de `formatarTexto` (`<strong>`/`<em>`/`<u>`).
 *  Existe separado de `extrairTextoLinha` porque análise estrutural (é
 *  título? termina em pontuação? começa com marcador de lista?) precisa olhar
 *  pro CONTEÚDO, não pra marcação — sobre texto já formatado, um título em
 *  negrito vira `<strong>Título</strong>`, e a primeira letra de verdade que
 *  `pareceTituloPelaCapitalizacao` encontra é o "s" minúsculo de "strong", não
 *  o "T" de "Título" (quebra a checagem de Title Case); pela mesma razão, uma
 *  frase em negrito terminando em ponto fecha a tag ANTES do ".", e
 *  `terminaComPontuacaoFinal` para de reconhecer o fim de frase. Esse bug
 *  ficava invisível enquanto negrito nunca era detectado de verdade (ver
 *  `pdfFontes.ts`) — reapareceu assim que passou a funcionar. */
function extrairTextoPlanoLinha(linha: Linha): string {
  return linha.itens.map((item) => item.texto).join(' ').trim()
}

function terminaComPontuacaoFinal(texto: string): boolean {
  return REGEX_PONTUACAO_FINAL.test(texto.trim())
}

function ehMarcadorDeLista(texto: string): boolean {
  return REGEX_LISTA_NUMERADA.test(texto) || REGEX_LISTA_MARCADOR.test(texto)
}

/** Acima desse número de repetições VERBATIM no documento inteiro, uma linha
 *  candidata a título (mesmo tamanho de fonte do corpo + Title Case/CAIXA
 *  ALTA) deixa de contar como título — é rótulo de campo repetido pelo
 *  template ("Disponibilidade", "Suporte ao Serviço", "Como solicitar"),
 *  não uma seção nova. Medido na proposta de referência: um título de
 *  verdade nesse tamanho de fonte (ex. "Do Reajuste de Preços") aparece
 *  UMA vez; os rótulos de template do descritivo de cada serviço repetem
 *  de 9 a 15+ vezes, sempre com o texto idêntico. 3 fica bem abaixo da
 *  menor repetição de rótulo observada e acima de qualquer coincidência
 *  plausível (ex. mesmo título em sumário + seção, no máximo 2). */
const LIMIAR_REPETICOES_ROTULO_TEMPLATE = 3

/** Conta quantas vezes cada texto de linha (sem formatação, só o texto puro
 *  do PDF) se repete no documento inteiro — usado só pra desambiguar título
 *  na faixa "mesmo tamanho do corpo" de `ehTitulo`. */
function contarRepeticoesDeTexto(linhas: Linha[]): Map<string, number> {
  const contagem = new Map<string, number>()
  for (const linha of linhas) {
    const texto = extrairTextoPlanoLinha(linha)
    if (!texto) continue
    contagem.set(texto, (contagem.get(texto) ?? 0) + 1)
  }
  return contagem
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
 *  título (Title Case ou TUDO EM MAIÚSCULAS) — ver `pareceTituloPelaCapitalizacao`
 *  — E não for um rótulo de template repetido — ver `LIMIAR_REPETICOES_ROTULO_TEMPLATE`. */
function ehTitulo(linha: Linha, tamanhoCorpo: number, repeticoes: Map<string, number>): boolean {
  const texto = extrairTextoPlanoLinha(linha)
  if (texto.length === 0 || texto.length > LIMIAR_TAMANHO_TITULO) return false
  if (ehMarcadorDeLista(texto)) return false
  if (terminaComPontuacaoFinal(texto)) return false

  if (linha.fontSizeMedio >= tamanhoCorpo * 1.3) return true
  if (linha.fontSizeMedio < tamanhoCorpo * 0.95) return false
  if (!pareceTituloPelaCapitalizacao(texto)) return false

  return (repeticoes.get(texto) ?? 0) < LIMIAR_REPETICOES_ROTULO_TEMPLATE
}

function formatarTitulo(linha: Linha, tamanhoCorpo: number, margens: Margens): string {
  const texto = extrairTextoLinha(linha)
  const nivel = linha.fontSizeMedio >= tamanhoCorpo * 1.5 ? 1 : 2
  const estilo = ehCentralizado(linha, margens) ? ' style="text-align:center"' : ''
  return `<h${nivel}${estilo}>${texto}</h${nivel}>`
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

const REGEX_LI_COM_NIVEL = /^<li data-nivel="(\d+)">([\s\S]*)<\/li>$/

/** Depois que `montarHtml` monta todos os blocos da página, uma rodada de
 *  `<li data-nivel="N">` consecutivos precisa virar UMA lista aninhada — sem
 *  essa segunda passada, cada item de lista fica solto (HTML inválido, sem
 *  marcador nenhum ao colar no SEI). Isso substitui o que o `marked` fazia de
 *  graça a partir de sintaxe Markdown: em HTML nativo não existe mais esse
 *  passo de renderização, o próprio conversor tem que produzir a lista já
 *  aninhada. Constrói a árvore com uma pilha de nível: abre `<ul>` novo
 *  quando o nível sobe, fecha quando desce, mantém aberto quando repete. */
export function agruparListasEmHtml(blocos: string[]): string[] {
  const resultado: string[] = []
  let partesLista: string[] = []
  const pilha: number[] = [] // níveis abertos, do mais externo pro mais interno

  // Fecha o <li> aberto (o do último item deste nível — pode ter um <ul>
  // aninhado dentro, já fechado antes de chegar aqui) e o <ul> do nível no
  // topo da pilha.
  function fecharNivel() {
    partesLista.push('</li></ul>')
    pilha.pop()
  }

  // Fecha a lista corrente (se houver) e empilha ela como UM bloco só no
  // resultado — assim, quando `montarHtml` junta todos os blocos da página
  // com o separador de sempre, a lista fica atômica, do mesmo jeito que um
  // `<table>` ou um `<p>` já são um bloco só.
  function encerrarListaSeHouver() {
    if (partesLista.length === 0) return
    while (pilha.length > 0) fecharNivel()
    resultado.push(partesLista.join(''))
    partesLista = []
  }

  for (const bloco of blocos) {
    const item = bloco.match(REGEX_LI_COM_NIVEL)
    if (!item) {
      encerrarListaSeHouver()
      resultado.push(bloco)
      continue
    }
    const nivel = Number(item[1])
    if (pilha.length === 0 || nivel > pilha[pilha.length - 1]) {
      // Nível mais fundo: aninha DENTRO do <li> anterior, que por isso NUNCA
      // fecha antes de abrir este <ul> — produz <li>Pai<ul>...</ul></li> em
      // vez de <ul> como irmão de <li> dentro do <ul> pai (HTML não aceita
      // <ul> direto ali, só dentro de um <li>).
      partesLista.push('<ul>')
      pilha.push(nivel)
    } else {
      // Mesmo nível ou nível mais raso: fecha o <li> aberto de cada nível
      // mais fundo que este (e o <ul> correspondente) antes de decidir o
      // que fazer com o nível atual.
      while (pilha.length > 0 && pilha[pilha.length - 1] > nivel) fecharNivel()
      if (pilha.length > 0 && pilha[pilha.length - 1] === nivel) {
        // Item irmão do anterior neste mesmo nível — fecha o <li> anterior.
        partesLista.push('</li>')
      } else {
        // Nível novo na raiz (não deveria acontecer com `nivelDoMarcador`,
        // que nunca pula nível — mantido como fallback defensivo).
        partesLista.push('<ul>')
        pilha.push(nivel)
      }
    }
    // <li> fica ABERTO de propósito (sem `</li>` aqui) — só fecha quando o
    // próximo item (irmão, nível mais raso, ou fim da lista) decidir que
    // não há mais nada pra aninhar dentro dele.
    partesLista.push(`<li>${item[2]}`)
  }
  encerrarListaSeHouver()
  return resultado
}

/** `textos`/`textoCompleto` já chegam como HTML inline pronto (negrito/
 *  itálico/sublinhado via `formatarTexto`) — nunca escapar de novo aqui, só
 *  envolver na tag de bloco certa. */
function formatarBlocoDeTexto(
  textos: string[],
  linhasDoBloco: Linha[],
  margens: Margens,
  ancorasDeMarcador: number[]
): string {
  const textoCompleto = textos.join(' ')

  // Cláusula numerada (1., 2., 4., 5. — número real do PDF, não sequencial)
  // vira parágrafo com o número LITERAL: um <ol> de verdade é renumerado
  // pelo navegador a partir de 1, o que apagaria o número original da
  // cláusula. Diferente do Markdown, HTML não precisa escapar "1." — texto
  // literal nunca é reinterpretado como marcação de lista.
  const numerada = textoCompleto.match(REGEX_LISTA_NUMERADA)
  if (numerada) return `<p>${numerada[1]}${numerada[2]}</p>`

  const marcada = textoCompleto.match(REGEX_LISTA_MARCADOR)
  if (marcada) {
    const x = linhasDoBloco[0]?.itens[0]?.x ?? 0
    const nivel = nivelDoMarcador(x, ancorasDeMarcador)
    // Marcador temporário de nível — `agruparListasEmHtml`, rodada final
    // sobre os blocos da página, junta rodadas consecutivas destes <li> em
    // <ul> aninhado por nível e remove o atributo.
    return `<li data-nivel="${nivel}">${marcada[1]}</li>`
  }

  if (linhasDoBloco.length === 1 && ehCentralizado(linhasDoBloco[0], margens)) {
    return `<p style="text-align:center">${textoCompleto}</p>`
  }
  if (linhasDoBloco.length >= 2 && ehJustificado(linhasDoBloco, margens)) {
    return `<p style="text-align:justify">${textoCompleto}</p>`
  }

  return `<p>${textoCompleto}</p>`
}

/** Reúne, a partir de `indiceInicial`, todas as linhas que ainda fazem parte do
 *  mesmo parágrafo/item de lista: continua absorvendo linhas seguintes enquanto
 *  o texto já absorvido não terminar em pontuação final e a próxima linha não for,
 *  ela mesma, o início de um marcador de lista, um título ou uma linha de tabela. */
function absorverBloco(
  linhas: Linha[],
  indiceInicial: number,
  tamanhoCorpo: number,
  gradesPorPagina: Map<number, GradeDeTabela[]>,
  repeticoes: Map<string, number>
): { textos: string[]; linhasConsumidas: Linha[]; proximoIndice: number } {
  const linhasConsumidas = [linhas[indiceInicial]]
  const textos = [extrairTextoLinha(linhas[indiceInicial])]
  // Paralelo SEM tag de formatação — as checagens abaixo (fim de frase,
  // marcador de lista) olham pro conteúdo, não pra marcação; ver
  // `extrairTextoPlanoLinha`.
  const textosPlanos = [extrairTextoPlanoLinha(linhas[indiceInicial])]
  let j = indiceInicial + 1

  while (j < linhas.length) {
    if (terminaComPontuacaoFinal(textosPlanos[textosPlanos.length - 1])) break
    if (linhasConsumidas.length >= LIMITE_LINHAS_SEM_PONTUACAO) break

    const candidata = linhas[j]
    const textoCandidataPlano = extrairTextoPlanoLinha(candidata)
    if (ehMarcadorDeLista(textoCandidataPlano)) break
    if (ehTitulo(candidata, tamanhoCorpo, repeticoes)) break
    if (iniciaTabela(linhas, j, gradesPorPagina)) break

    textos.push(extrairTextoLinha(candidata))
    textosPlanos.push(textoCandidataPlano)
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
): { html: string; proximoIndice: number } | null {
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
  return { html: montarTabelaHtml(linhasFormatadas), proximoIndice: j }
}

/** Tenta cada grade de borda da página (pode haver mais de uma tabela nela)
 *  a partir de `indice`, na ordem em que foram construídas — como as tabelas
 *  de uma mesma página nunca se sobrepõem em Y, no máximo uma delas aceita a
 *  linha inicial; as outras devolvem `null` de cara (checagem de área
 *  vertical em `detectarTabelaPorBordas`). */
function detectarTabelaEmQualquerGrade(
  linhas: Linha[],
  indice: number,
  grades: GradeDeTabela[]
): { html: string; proximoIndice: number } | null {
  for (const grade of grades) {
    const tabela = detectarTabelaPorBordas(linhas, indice, grade)
    if (tabela) return tabela
  }
  return null
}

/** Uma tabela (por bordas ou por posição) começa exatamente nesta linha? É o
 *  que interrompe a absorção de um parágrafo — antes bastava a linha TER vão
 *  largo, e com isso todo parágrafo justificado se partia no meio sem que
 *  tabela nenhuma chegasse a ser gerada. */
function iniciaTabela(
  linhas: Linha[],
  indice: number,
  gradesPorPagina: Map<number, GradeDeTabela[]>
): boolean {
  const grades = gradesPorPagina.get(linhas[indice].pagina)
  if (grades && detectarTabelaEmQualquerGrade(linhas, indice, grades)) return true
  return absorverTabelaPorPosicao(linhas, indice) !== null
}

/** Uma imagem entra no HTML ANTES de uma linha quando está numa página
 *  anterior, ou quando o TOPO dela fica acima da linha de base do texto na mesma
 *  página — ou seja, quando na página impressa ela vem antes daquela linha. */
function imagemVemAntesDaLinha(imagem: ImagemPosicionada, linha: Linha): boolean {
  if (imagem.pagina !== linha.pagina) return imagem.pagina < linha.pagina
  return imagem.topo >= linha.y
}

function montarHtml(
  linhas: Linha[],
  tamanhoCorpo: number,
  margens: Margens,
  gradesPorPagina: Map<number, GradeDeTabela[]>,
  imagens: ImagemPosicionada[] = [],
  paginasOcr: number[] = []
): { html: string; blocosPorPagina: Map<number, string[]> } {
  const blocos: string[] = []
  const blocosPorPagina = new Map<number, string[]>()
  // Registra o bloco na posição da página, além de empilhá-lo — é o que
  // permite montar `paginasConvertidas` (texto original x HTML por
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
  const repeticoes = contarRepeticoesDeTexto(linhas)
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
      registrar(imagem.pagina, imagem.html)
    }
  }

  while (i < linhas.length) {
    despejarOcrAntesDe(linhas[i].pagina)
    despejarImagensAntesDe(linhas[i])

    const grades = gradesPorPagina.get(linhas[i].pagina)
    const tabelaPorBordas = grades ? detectarTabelaEmQualquerGrade(linhas, i, grades) : null
    if (tabelaPorBordas) {
      registrar(linhas[i].pagina, tabelaPorBordas.html)
      i = tabelaPorBordas.proximoIndice
      continue
    }

    const tabelaPorPosicao = absorverTabelaPorPosicao(linhas, i)
    if (tabelaPorPosicao) {
      registrar(linhas[i].pagina, tabelaPorPosicao.html)
      i = tabelaPorPosicao.proximoIndice
      continue
    }

    if (ehTitulo(linhas[i], tamanhoCorpo, repeticoes)) {
      registrar(linhas[i].pagina, formatarTitulo(linhas[i], tamanhoCorpo, margens))
      i++
      continue
    }

    const { textos, linhasConsumidas, proximoIndice } = absorverBloco(linhas, i, tamanhoCorpo, gradesPorPagina, repeticoes)
    registrar(linhas[i].pagina, formatarBlocoDeTexto(textos, linhasConsumidas, margens, ancorasDeMarcador))
    i = proximoIndice
  }

  // Página de OCR ou imagem depois da última linha de texto do documento
  // (figura/anexo de fechamento) não pode ficar de fora.
  for (const pagina of paginasOcrPendentes) blocos.push(formatarBlocoOcrPendente(pagina + 1))
  for (const imagem of imagensPendentes) registrar(imagem.pagina, imagem.html)

  const blocosFiltrados = blocos.filter((bloco) => bloco.length > 0)
  return { html: agruparListasEmHtml(blocosFiltrados).join('\n\n'), blocosPorPagina }
}
