import { generateObject } from 'ai'
import { diffWordsWithSpace } from 'diff'
import { z } from 'zod'
import { getModel } from './modelo'

/**
 * Checagem por IA da conversão de PDF — pra CADA página do PDF, confere se o
 * texto ORIGINAL dela (extraído pelo `pdf.js`) está correto e completo em
 * ALGUM lugar do Markdown do DOCUMENTO INTEIRO da proposta, e sinaliza erro
 * de ortografia/acentuação do Markdown gerado. Nunca vê a imagem da página —
 * só texto. Score e trechos suspeitos nunca bloqueiam nada (ver
 * docs/superpowers/specs/2026-09-11-checagem-ia-conversao-design.md).
 *
 * Sempre compara contra o DOCUMENTO INTEIRO, nunca contra a fatia de
 * Markdown de uma página só — mesmo na primeira checagem, antes de qualquer
 * edição. Não é só sobre reorganização pós-edição: o próprio conversor
 * determinístico (`pdfMarkdown.ts`) já pode atribuir um parágrafo que
 * atravessa a quebra de página inteiro à página ANTERIOR (ver
 * `absorverBloco`), então mesmo sem nenhuma edição humana a fatia de uma
 * página isolada pode legitimamente não conter tudo que veio dela. Comparar
 * sempre contra o documento inteiro evita esse falso positivo desde a
 * primeira checagem, em vez de só descobrir depois (na auditoria "depois
 * das mudanças") que aquilo nunca tinha sido um problema de verdade.
 *
 * Isso deixa a comparação mais cara e mais sujeita a ruído (documento
 * inteiro é um palheiro bem maior que uma página só) — por isso toda página
 * passa primeiro por `calcularCoberturaPagina`, uma conferência
 * determinística e de graça: só quando ela NÃO consegue confirmar sozinha
 * que a página já está lá é que a IA entra (ver
 * `COBERTURA_MINIMA_PULA_AUDITORIA_IA`). E o mesmo trecho relatado por mais
 * de uma página (cláusula/cabeçalho repetido) conta uma vez só (ver
 * `dedupeTrechos`) — sem isso, uma auditoria depois de uma correção real
 * podia mostrar MAIS diferenças que antes, não menos (caso real que já
 * aconteceu: 52 → 71 depois de uma correção certa).
 *
 * Cada trecho suspeito pode vir com uma `correcaoSugerida` — mas a IA nunca
 * tem liberdade pra inventar o texto corrigido: ela só pode copiar do TEXTO
 * ORIGINAL que já recebeu, e `correcaoEhSegura` confere isso de novo no
 * código antes de expor o campo (nunca confia só na obediência do modelo).
 * Sem essa ancoragem, `correcaoSugerida` vira `null` e o item continua só
 * informativo, do jeito que já funcionava.
 */

const schemaPagina = z.object({
  scoreConfianca: z.number().min(0).max(1),
  trechosSuspeitos: z.array(
    z.object({
      trecho: z.string(),
      motivo: z.string(),
      trechoOriginal: z.string().nullable(),
      correcaoSugerida: z.string().nullable(),
    })
  ),
})

export interface TrechoSuspeito {
  pagina: number
  trecho: string
  motivo: string
  /** O que o PDF diz nesse ponto. Quando a IA recorta certinho o trecho e
   *  ele bate com o original, é só esse pedaço; senão cai pro texto da
   *  página inteira — nunca fica vazio, a pessoa sempre tem o texto de
   *  verdade na mão pra comparar e copiar, sem precisar abrir o PDF e
   *  selecionar à mão (aquilo continua existindo, só que como opção, não
   *  como único jeito). */
  trechoOriginal?: string
  /** `true` quando `trechoOriginal` é o recorte específico do trecho
   *  (seguro pra usar como substituição direta); `false`/ausente quando é
   *  o fallback de página inteira — bom pra pessoa ler e copiar a parte
   *  certa, mas grande demais pra trocar sozinho no lugar de um trecho
   *  pequeno (a tela usa isso pra desabilitar o modo "PDF" nesse caso). */
  trechoOriginalEspecifico?: boolean
  /** Substituição sugerida pra `trecho`, pronta pra aplicar por substituição
   *  literal. `null` quando a IA não achou (ou a checagem descartou) uma
   *  correção ancorada no texto original — o item segue só informativo. */
  correcaoSugerida: string | null
  /** A IA sugeriu uma correção, mas ela não bate com o texto do PDF e foi
   *  descartada pela trava. Serve pra tela explicar POR QUE o trecho ficou
   *  sem correção automática (≠ a IA não ter sugerido nada). */
  correcaoDescartada?: boolean
}

export interface ResultadoChecagem {
  /** 0-99, nunca 100 — teto aplicado no código, não no prompt. `null` quando
   *  não havia nenhuma página checável (documento só de páginas de OCR). */
  scoreExibido: number | null
  trechosSuspeitos: TrechoSuspeito[]
}

export interface PaginaParaChecar {
  pagina: number
  textoOriginal: string
  markdown: string
}

const PROMPT_CHECAGEM = [
  'Você audita se o TEXTO ORIGINAL de uma página de um PDF está correto e',
  'INTEGRALMENTE presente no MARKDOWN do documento abaixo — o conteúdo pode',
  'estar em qualquer posição do documento (reorganização, mescla com outro',
  'arquivo, parágrafo que atravessou a quebra de página). Isso não é',
  'problema; o que importa é o CONTEÚDO estar certo e completo em ALGUM',
  'lugar do documento.',
  '',
  'Seja EXAUSTIVO: confira letra por letra, número por número, vírgula por',
  'vírgula. Não deixe passar nada por parecer pequeno — um dígito trocado,',
  'uma vírgula decimal errada, uma palavra faltando também é divergência,',
  'mesmo que não mude o sentido geral do texto.',
  '',
  'Aponte SÓ divergência real de conteúdo — texto que sumiu, número ou data',
  'trocado, célula de tabela faltando. NUNCA aponte estilo, escolha de',
  'formatação Markdown (títulos, negrito, listas), reordenação cosmética',
  'do texto, OU numeração de página / cabeçalho / rodapé repetido (ex.:',
  '"Page 2 of 45", "Página 2 de 45") — isso é ruído de paginação do PDF,',
  'nunca conteúdo relevante do contrato, mesmo que a posição dele no',
  'Markdown pareça estranha (ex.: colado no fim de um item de lista).',
  'Nada disso é erro de conversão.',
  '',
  'Além de divergência de conteúdo, aponte também erro de ORTOGRAFIA e',
  'ACENTUAÇÃO do português do Brasil no MARKDOWN (acento que sumiu ou está',
  'errado, letra trocada, palavra grudada ou separada errado) — mesmo',
  'quando isso não muda o sentido do texto. A "correcaoSugerida" desses',
  'itens segue a MESMA regra de baixo: só é aceita se a forma certa da',
  'palavra aparecer no TEXTO ORIGINAL. NÃO aponte erro de concordância,',
  'estilo, clareza ou reescrita — só ortografia e acentuação pontual,',
  'palavra por palavra.',
  '',
  '"scoreConfianca": de 0 a 1, quão completo e correto está o CONTEÚDO',
  'desta página no documento (1 = tudo presente e certo — erro de',
  'ortografia sozinho não derruba essa nota).',
  '"trechosSuspeitos": um item por divergência encontrada, com:',
  '- "trecho": cópia exata do pedaço do MARKDOWN onde está o problema. Se',
  '  o conteúdo da página sumiu inteiro do documento, copie o trecho ao',
  '  redor de onde ele deveria estar.',
  '- "motivo": curto, em português, explicando a suspeita.',
  '- "trechoOriginal": o pedaço do TEXTO ORIGINAL que corresponde ao',
  '  trecho, copiado LITERALMENTE (é o que o PDF diz ali). null se não',
  '  houver correspondente no original.',
  '- "correcaoSugerida": como o trecho deve ficar no Markdown. Palavras,',
  '  números e pontuação têm que ser copiados LITERALMENTE do TEXTO',
  '  ORIGINAL — nunca invente, reescreva ou traduza. Quando o problema for',
  '  de estrutura (item de lista no nível errado, título, linha de tabela),',
  '  ajuste só a marcação Markdown (-, #, |) mantendo o texto do original.',
  '  Se não for possível corrigir assim (ex.: o conteúdo sumiu e não',
  '  sobrou rastro de onde entra, ou o problema é ambíguo), devolva null',
  '  nesse campo — não force uma correção.',
  'Lista vazia se não achar nada.',
  '',
  'Responda SÓ com o JSON do schema pedido.',
].join('\n')

/** Remove acento e normaliza espaço/caixa — pra comparar "a mesma coisa,
 *  escrita igual" sem exigir bytes idênticos (o texto original vem de uma
 *  extração diferente da do Markdown, então espaçamento pode variar um
 *  pouco mesmo sem erro nenhum). */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Marcador de lista do PDF (•, ▪, o bullet da fonte Symbol...) não é
    // conteúdo — no Markdown ele vira "-".
    .replace(/[\u2022\u2023\u2043\u25aa\u25ab\u25cf\u25cb\u25a0\u25a1\u25ba\u25b8\u25e6\uf0a7\uf0b7]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tira só a MARCAÇÃO Markdown (item de lista, título, citação, negrito,
 *  tabela) — o texto fica. Assim uma correção de estrutura ("item no nível
 *  errado") passa pela mesma ancoragem no original que uma de texto, sem
 *  abrir brecha pra palavra ou número inventado. Lista numerada não entra:
 *  o número do item é conteúdo e tem que estar no original. */
function semMarcacaoMarkdown(texto: string): string {
  return texto
    .replace(/^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/gm, ' ')
    .replace(/^\s*(?:#{1,6}|>|[-*+])\s+/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\|/g, ' ')
}

/** Só letras e números — ignora quebra de linha, hifenização, aspas,
 *  pontuação e espaçamento, que a extração do PDF bagunça à toa. */
function soLetrasENumeros(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9]/g, '')
}

/** O "no PDF" que a IA devolve é pra pessoa ver e usar (ela confere antes de
 *  aplicar), então a ancoragem aqui é por letras e números: toda palavra e
 *  todo dígito têm que estar no PDF, mas diferença de espaço, quebra de
 *  linha ou pontuação não descarta o texto. A correção AUTOMÁTICA continua
 *  com a checagem mais rígida (`correcaoEhSegura`). */
function textoDoPdfConfere(texto: string, textoOriginal: string): boolean {
  const alvo = soLetrasENumeros(texto)
  if (alvo.length < 4) return false
  return soLetrasENumeros(textoOriginal).includes(alvo)
}

/** `trecho` que a IA devolveu precisa ser uma cópia real de um pedaço do
 *  Markdown auditado — é o que o prompt pede ("cópia exata de um pedaço do
 *  MARKDOWN..."). Isso não é garantido pelo schema: `trecho` só precisa
 *  ser uma string, então nada barra o modelo de escrever ali outra coisa —
 *  já aconteceu de vir o próprio raciocínio dele em vez do trecho pedido
 *  (ex.: "Agora, vamos analisar as informações fornecidas: 1. O usuário
 *  forneceu um texto original de 69 linhas..."). Sem `trecho` existir de
 *  verdade no documento, o item nunca vai dar pra localizar — nem auto-
 *  aplicar, nem o botão "Aplicar no documento" na conferência manual — só
 *  aparece pra pessoa como um "No documento hoje" com lixo, sem eu saber
 *  onde agir. Mesma tolerância de `ancoradoNoOriginal` (acento/caixa/
 *  marcador de lista) — não é pra descartar um achado real só por
 *  diferença de formatação. */
function trechoExisteNoAlvo(trecho: string, markdownAlvo: string): boolean {
  const normalizado = normalizar(trecho)
  if (normalizado.length < 2) return false
  return normalizar(markdownAlvo).includes(normalizado)
}

/** Linha do texto original curta demais pra julgar sozinha na cobertura
 *  (número de página solto, marcador decorativo, "-") — mesmo tipo de
 *  ruído que o prompt já instrui a IA a ignorar (numeração de página,
 *  cabeçalho/rodapé repetido). Não entra nem no total nem no achado: não
 *  penaliza, também não infla. */
const TAMANHO_MIN_LINHA_COBERTURA = 4

/**
 * Auditoria determinística, byte a byte, de quanto do TEXTO ORIGINAL de
 * uma página sobrevive no Markdown auditado — usada como `scoreConfianca`
 * no lugar do número que a IA inventava (ver `object.scoreConfianca`
 * ignorado de propósito em `checarPaginaComPrompt`).
 *
 * Por quê trocar: o `scoreConfianca` antigo era a PRÓPRIA IA se
 * autoavaliando — um campo a mais no mesmo JSON gerado, não uma métrica
 * calculada. Isso faz duas rodadas da MESMA checagem darem números
 * diferentes mesmo quando o conteúdo não piorou. É o "resolvi várias
 * diferenças e o score caiu" que não devia acontecer.
 *
 * Como funciona: quebra o texto original em linhas, descarta as curtas
 * demais pra julgar sozinhas (`TAMANHO_MIN_LINHA_COBERTURA`), e cada linha
 * que sobra conta como "achada" se aparecer — tolerando acento, caixa e
 * marcador de lista, mesma régua de `ancoradoNoOriginal` — em QUALQUER
 * lugar do Markdown auditado. Não exige posição alinhada de propósito:
 * conteúdo reordenado ou mesclado com outro arquivo não derruba o score só
 * por ter mudado de lugar, igual a IA já é instruída a não penalizar
 * "reordenação cosmética do texto". O resultado é a fração de CARACTERES
 * (não de linhas — um parágrafo grande que sumiu pesa mais que um título
 * curto) do texto original confirmada presente. Determinístico: o mesmo
 * par (original, alvo) sempre devolve o mesmo número, e ele só sobe
 * quando o conteúdo realmente passa a bater mais — nunca por humor do
 * modelo numa rodada nova.
 */
function calcularCoberturaPagina(textoOriginal: string, markdownAlvo: string): number {
  const alvoNormalizado = normalizar(markdownAlvo)
  const linhas = textoOriginal
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => normalizar(linha).length >= TAMANHO_MIN_LINHA_COBERTURA)

  if (linhas.length === 0) return 1 // nada substancial pra conferir — não penaliza

  let totalChars = 0
  let charsAchados = 0
  for (const linha of linhas) {
    totalChars += linha.length
    if (alvoNormalizado.includes(normalizar(linha))) charsAchados += linha.length
  }

  return totalChars === 0 ? 1 : charsAchados / totalChars
}

/** `texto` aparece (a menos de acento/espaço/caixa/marcador de lista)
 *  dentro do texto original da página? */
function ancoradoNoOriginal(texto: string, textoOriginal: string): boolean {
  const normalizado = normalizar(texto)
  if (normalizado.length < 2) return false
  return normalizar(textoOriginal).includes(normalizado)
}

/** Um título Markdown "de verdade" — curto, é só o título mesmo. Acima
 *  desse tamanho a linha já não parece um título de seção; é sinal de que
 *  o `#`/`##` colou por engano na mesma linha de um parágrafo inteiro (bug
 *  da própria conversão) — nesse caso a linha inteira é o conteúdo com
 *  problema, não um título separado que precisa sobreviver à correção. */
const TAMANHO_MAX_TITULO = 100

/** Títulos Markdown (#, ##...) que aparecem como LINHA do trecho, curtos o
 *  bastante pra serem título de seção de verdade (ver `TAMANHO_MAX_TITULO`). */
function titulosDoTrecho(texto: string): string[] {
  return texto
    .split('\n')
    .map((linha) => linha.match(/^\s*#{1,6}\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null && m[1].length <= TAMANHO_MAX_TITULO)
    .map((m) => normalizar(m[1]))
}

/**
 * Segundo guarda-rail de `correcaoEhSegura`: título de seção que aparece no
 * TRECHO reportado nunca pode sumir da correção sugerida. O prompt já pede
 * pra IA nunca apontar formatação/título como problema — então um título
 * que desaparece na correção é sinal de que o "trecho" citado é mais largo
 * do que a divergência de verdade (ex.: o motivo é sobre uma linha de
 * código de serviço, mas o trecho copiado engloba também os dois títulos de
 * seção vizinhos). Sem essa checagem, "Corrigir automaticamente" apagaria a
 * seção inteira do documento — e a auditoria seguinte, achando a seção
 * "sumida", ofereceria uma NOVA correção pra reinserir: o botão nunca para
 * de voltar (caso real que motivou este guarda-rail).
 */
function preservaTitulos(trecho: string, correcaoSugerida: string): boolean {
  const titulos = titulosDoTrecho(trecho)
  if (titulos.length === 0) return true
  const alvo = normalizar(correcaoSugerida)
  return titulos.every((titulo) => alvo.includes(titulo))
}

/**
 * Guarda-rail contra alucinação: só aceita `correcaoSugerida` se ela
 * aparecer, literalmente (a menos de acento/espaço/caixa), dentro do texto
 * original da própria página. Isso não impede TODA alucinação possível,
 * mas impede a IA de simplesmente inventar um número/data/palavra que não
 * está em lugar nenhum do documento — o pior cenário pra um documento
 * contratual.
 *
 * Quando `trecho` é passado, soma a checagem de `preservaTitulos` — sem
 * ela, a ancoragem sozinha aceitaria uma correção que apaga título de seção
 * vizinho ao problema de verdade (ver `preservaTitulos` acima).
 */
export function correcaoEhSegura(correcaoSugerida: string | null, textoOriginal: string, trecho?: string): boolean {
  if (!correcaoSugerida) return false
  if (!ancoradoNoOriginal(semMarcacaoMarkdown(correcaoSugerida), textoOriginal)) return false
  return trecho === undefined || preservaTitulos(trecho, correcaoSugerida)
}

/** Um "rótulo" — texto curto e isolado que funciona como título de
 *  subseção mesmo sem marcação Markdown (comum nestes contratos: "Gestão
 *  de faturamento", "Não faz parte do escopo do Serviço" aparecem como
 *  linha solta, sem "#"). Só conta quando o trecho tem MAIS de uma linha —
 *  um trecho de uma linha só é sempre o próprio conteúdo sendo corrigido,
 *  nunca um "rótulo seguido de corpo" (isso evita marcar toda correção de
 *  linha única — o caso mais comum da tela — como candidata a este
 *  guarda-rail). */
function rotuloDoTrecho(trecho: string): string | null {
  const linhas = trecho.split('\n')
  if (linhas.length < 2) return null
  const primeira = linhas[0].trim()
  if (!primeira || primeira.length > TAMANHO_MAX_TITULO) return null
  if (/^\s*[-*+•]\s/.test(primeira) || /^\d+[.)]\s/.test(primeira)) return null
  if (linhas[1].trim() !== '') return null // só conta se for isolado (linha em branco depois)
  return normalizar(primeira.replace(/^\s*#{1,6}\s+/, ''))
}

/** `rotulo` aparece mais de uma vez no documento-alvo? Contrato com vários
 *  lotes/serviços repete a mesma subseção ("Gestão de faturamento", "Não
 *  faz parte do escopo") em cada um — a checagem compara UMA página contra
 *  o DOCUMENTO INTEIRO, sem fronteira de página, então não tem como
 *  garantir a qual ocorrência a divergência relatada se refere. */
function rotuloRepeteNoDocumento(rotulo: string, documentoAlvo: string): boolean {
  const documento = normalizar(documentoAlvo)
  let ocorrencias = 0
  let posicao = documento.indexOf(rotulo)
  while (posicao !== -1) {
    ocorrencias++
    if (ocorrencias > 1) return true
    posicao = documento.indexOf(rotulo, posicao + rotulo.length)
  }
  return false
}

/** Quanto do TEXTO de `trecho` sobrevive, sem mudar, em `correcaoSugerida`
 *  — 1 quando nada foi removido, 0 quando tudo foi trocado. Usa diff por
 *  palavra (a mesma biblioteca de `mudancasTexto.ts`) pra não penalizar
 *  reformatação (troca de "•" por "-", espaçamento) como se fosse conteúdo
 *  perdido. */
function proporcaoPreservada(trecho: string, correcaoSugerida: string): number {
  let total = 0
  let mantido = 0
  for (const parte of diffWordsWithSpace(trecho, correcaoSugerida)) {
    if (parte.removed) {
      total += parte.value.length
    } else if (!parte.added) {
      total += parte.value.length
      mantido += parte.value.length
    }
  }
  return total === 0 ? 1 : mantido / total
}

/** Abaixo disso, a correção jogou fora "a maior parte" do trecho original —
 *  não é mais um ajuste pontual, é uma troca de conteúdo. Calibrado com um
 *  caso real de cada lado (ver testes): a troca de conteúdo entre seções
 *  preservava 30%; a reformatação legítima sob rótulo repetido preservava
 *  97%. */
const LIMIAR_PRESERVACAO = 0.5

/**
 * Quarto guarda-rail: quando o trecho tem um `rotuloDoTrecho` que se repete
 * no documento-alvo E a correção sugerida joga fora a maior parte
 * do conteúdo original (`proporcaoPreservada` abaixo de `LIMIAR_PRESERVACAO`),
 * a correção provavelmente pegou a ocorrência ERRADA do rótulo — sobrescreveu
 * conteúdo de uma seção que já estava certo com o texto de OUTRA seção
 * (caso real que motivou isto: "Gestão de faturamento" da seção de internet
 * virou o texto padrão de faturamento de outra seção do contrato, apagando
 * os itens de escopo de internet que estavam certos ali).
 *
 * Reformatação sozinha (bullet, espaçamento) tem preservação alta mesmo sob
 * rótulo repetido — não cai aqui (ver o caso "Análise de Negócio" no teste).
 */
export function trocaConteudoSobRotuloAmbiguo(trecho: string, correcaoSugerida: string, documentoAlvo: string): boolean {
  const rotulo = rotuloDoTrecho(trecho)
  if (!rotulo) return false
  if (!rotuloRepeteNoDocumento(rotulo, documentoAlvo)) return false
  return proporcaoPreservada(trecho, correcaoSugerida) < LIMIAR_PRESERVACAO
}

/** Quantas vezes tenta gerar o JSON de uma página antes de desistir dela.
 *  A falha mais comum aqui não é o modelo estar indisponível — é ele
 *  devolver um JSON que não bate com o schema pedido (ex.: escreveu
 *  "correcaoSugida" em vez de "correcaoSugerida") ou vir cortado no meio por
 *  estourar o teto de tokens. Isso é ruído não-determinístico da própria
 *  geração: tentar de novo, do zero, costuma sair certo na segunda vez, sem
 *  custar quase nada extra (só acontece quando a primeira já falhou). */
const TENTATIVAS_POR_PAGINA = 2

/** Uma página checada: seu texto ORIGINAL × o Markdown do documento
 *  INTEIRO (sempre — ver o comentário no topo do arquivo). */
async function checarPaginaComPrompt(
  pagina: { pagina: number; textoOriginal: string },
  markdownAlvo: string,
  prompt: string,
  maxOutputTokens: number
): Promise<{
  pagina: number
  scoreConfianca: number
  trechosSuspeitos: TrechoSuspeito[]
}> {
  let ultimoErro: unknown
  let object: z.infer<typeof schemaPagina> | undefined
  let usage: Awaited<ReturnType<typeof generateObject>>['usage'] | undefined
  for (let tentativa = 1; tentativa <= TENTATIVAS_POR_PAGINA; tentativa++) {
    try {
      ;({ object, usage } = await generateObject({
        model: getModel(process.env.AI_REVISAO_MODEL || undefined),
        schema: schemaPagina,
        // O documento (`markdownAlvo`) é IDÊNTICO em toda chamada desta MESMA
        // checagem (uma por página) — só o texto original da página muda.
        // Por isso ele vem logo depois das instruções, e o texto único da
        // página por ÚLTIMO, com um rótulo SEM o número da página (o modelo
        // não precisa saber qual página é — só compara os dois textos): o
        // prefixo do prompt fica byte a byte igual entre as chamadas, o que
        // deixa o cache de prompt do provedor (cobra bem menos por tokens
        // repetidos) funcionar. Antes o texto da página — e o próprio número
        // dela no rótulo — vinha no meio, quebrando esse prefixo em toda
        // chamada. Ver comentário no topo do arquivo sobre o custo de
        // comparar contra o documento inteiro.
        prompt: `${prompt}\n\n---MARKDOWN---\n${markdownAlvo}\n\n---TEXTO ORIGINAL DESTA PÁGINA---\n${pagina.textoOriginal}`,
        maxOutputTokens,
      }))
      break
    } catch (erro) {
      ultimoErro = erro
    }
  }
  if (!object) throw ultimoErro
  // Evidência real de que o reordenamento do prompt (instruções + documento
  // ANTES do trecho único da página — ver acima) está de fato economizando,
  // não só habilitando: sem isto não tem como confirmar se o provedor está
  // batendo cache, só supor. `cacheReadTokens` alto nas chamadas 2ª em
  // diante de uma MESMA checagem confirma o ganho; perto de zero em todas
  // significa que o provedor não está cacheando como esperado.
  console.log('checagem por IA: uso de tokens', {
    pagina: pagina.pagina,
    inputTokens: usage?.inputTokens,
    cacheReadTokens: usage?.inputTokenDetails?.cacheReadTokens,
    outputTokens: usage?.outputTokens,
  })
  return {
    pagina: pagina.pagina,
    // Byte a byte, calculado no código — não é `object.scoreConfianca`
    // (o número que a própria IA devolveu junto do resto do JSON; ver
    // `calcularCoberturaPagina` pra entender por que ele é ignorado aqui).
    // O campo continua no schema pedido à IA mesmo assim: pedir pra ela se
    // autoavaliar tende a deixar `trechosSuspeitos` mais cuidadoso — só
    // que o NÚMERO que aparece pra pessoa não confia mais nisso.
    scoreConfianca: calcularCoberturaPagina(pagina.textoOriginal, markdownAlvo),
    trechosSuspeitos: object.trechosSuspeitos
      // A IA às vezes "acha" uma diferença que não existe — devolve a
      // correção sugerida idêntica ao trecho apontado (o exemplo real que
      // motivou isso: motivo dizia "está incorreto... Sim, está correto.
      // Não há erro." com os dois campos iguais). Isso não é achado
      // nenhum: aplicar não muda uma letra do documento, então a auditoria
      // seguinte encontra "o mesmo problema" nesse ponto pra sempre — a
      // lista nunca converge. Descarta aqui, antes de virar item da tela.
      .filter((t) => t.correcaoSugerida === null || t.correcaoSugerida !== t.trecho)
      // `trecho` alucinado (não é um pedaço real do Markdown auditado) —
      // ver `trechoExisteNoAlvo`. Descarta ANTES de virar item da tela:
      // sem isso o item aparece pra pessoa sem nenhum jeito de agir.
      .filter((t) => trechoExisteNoAlvo(t.trecho, markdownAlvo))
      .map(({ trechoOriginal, ...t }) => ({
      ...t,
      pagina: pagina.pagina,
      // O "no PDF" mostrado pra pessoa nunca fica vazio: se o recorte que a
      // IA devolveu não bate com o original (mesmo guarda-rail da
      // correção), cai pro texto da página inteira — ela sempre tem o
      // texto de verdade na mão pra comparar e copiar, em vez de precisar
      // abrir o PDF e selecionar à mão pra todo trecho sem sorte. Mas só o
      // recorte específico é seguro pra virar substituição automática —
      // `trechoOriginalEspecifico` diz qual dos dois casos é este.
      ...(trechoOriginal && textoDoPdfConfere(trechoOriginal, pagina.textoOriginal)
        ? { trechoOriginal, trechoOriginalEspecifico: true }
        : { trechoOriginal: pagina.textoOriginal }),
      ...(correcaoEhSegura(t.correcaoSugerida, pagina.textoOriginal, t.trecho) &&
      // Contra a troca de conteúdo entre ocorrências do mesmo rótulo — checa
      // contra o Markdown-alvo inteiro (`markdownAlvo`, sempre o documento
      // completo — ver `trocaConteudoSobRotuloAmbiguo`).
      !(t.correcaoSugerida && trocaConteudoSobRotuloAmbiguo(t.trecho, t.correcaoSugerida, markdownAlvo))
        ? { correcaoSugerida: t.correcaoSugerida }
        : { correcaoSugerida: null, ...(t.correcaoSugerida ? { correcaoDescartada: true } : {}) }),
    })),
  }
}

/** Chave de deduplicação de um trecho suspeito: mesmo trecho relatado + mesma
 *  correção (ou ambos sem correção) conta como o MESMO achado, mesmo vindo de
 *  chamadas de IA (e por tanto páginas) diferentes. */
function chaveDoTrecho(t: TrechoSuspeito): string {
  return `${normalizar(t.trecho)}\u0000${normalizar(t.correcaoSugerida ?? '')}`
}

/** Um contrato repete a mesma cláusula/cabeçalho em VÁRIAS páginas (seção
 *  padrão, texto de rodapé) — se essa cláusula ainda diverge do PDF, TODA
 *  página cujo texto original a contém relata o MESMO problema, já que
 *  `checarConversao` roda uma checagem por página. Sem isto, uma única
 *  divergência de conteúdo conta uma vez PRA CADA página que cita
 *  aquele trecho — inflando o total sem representar problema a mais. É fácil
 *  confundir isso com "a correção piorou as coisas" quando na verdade é a
 *  mesma divergência contada mais de uma vez. Mantém a primeira ocorrência
 *  (primeira página em que apareceu). */
function dedupeTrechos(trechos: TrechoSuspeito[]): TrechoSuspeito[] {
  const vistos = new Set<string>()
  return trechos.filter((t) => {
    const chave = chaveDoTrecho(t)
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

/** Roda `checarPaginaComPrompt` em todas as páginas em paralelo, descarta
 *  quem falhou (uma página ruim não derruba a checagem inteira) e agrega
 *  score (média) e trechos suspeitos (concatenados, sem duplicata — ver
 *  `dedupeTrechos`). */
async function agregarChecagem(
  paginas: number[],
  promessas: Promise<{ pagina: number; scoreConfianca: number; trechosSuspeitos: TrechoSuspeito[] }>[],
  rotuloErro: string
): Promise<ResultadoChecagem> {
  const resultados = await Promise.allSettled(promessas)

  const ok: { pagina: number; scoreConfianca: number; trechosSuspeitos: TrechoSuspeito[] }[] = []
  resultados.forEach((resultado, indice) => {
    if (resultado.status === 'fulfilled') {
      ok.push(resultado.value)
    } else {
      console.error(`${rotuloErro}: página ${paginas[indice]} falhou, pulando —`, resultado.reason)
    }
  })

  if (ok.length === 0) {
    throw new Error(`não foi possível checar nenhuma página (${rotuloErro})`)
  }

  const media = ok.reduce((soma, r) => soma + r.scoreConfianca, 0) / ok.length
  const scoreExibido = Math.min(Math.round(media * 100), 99)
  const trechosSuspeitos = dedupeTrechos(ok.flatMap((r) => r.trechosSuspeitos))

  return { scoreExibido, trechosSuspeitos }
}

/** Cobertura (`calcularCoberturaPagina`) a partir da qual a página já está,
 *  praticamente byte a byte, inteira no documento — não compensa gastar uma
 *  chamada de IA procurando problema numa página que já bate quase 100%.
 *
 *  Sem isto, TODA página é mandada pra IA — inclusive as que a pessoa já
 *  conferiu à mão contra o PDF — e cada chamada pede pro modelo vasculhar o
 *  DOCUMENTO INTEIRO (um palheiro bem maior que uma página só). Quanto maior
 *  o palheiro, maior a chance de "achar" divergência que não existe. Caso
 *  real que motivou isto: uma correção aplicada e conferida à mão contra o
 *  PDF, e a auditoria seguinte reportando MAIS diferenças que antes (52 →
 *  71) — pior, não melhor, depois de uma correção de verdade. Não é medido
 *  — é uma barreira alta de propósito (praticamente cobertura total) pra
 *  nunca pular uma página que ainda tem algo genuíno pra conferir. */
const COBERTURA_MINIMA_PULA_AUDITORIA_IA = 0.999

/**
 * Audita a conversão: pra cada página do PDF, confere se o texto original
 * dela está correto e completo em algum lugar de `documentoAtual` — o
 * Markdown do documento INTEIRO da proposta, como está agora (recém-gerado,
 * sem nenhuma edição, ou já com edição/correção aplicada; a função não
 * distingue os dois casos, sempre faz a MESMA comparação — ver o comentário
 * no topo do arquivo pra entender por que comparar sempre contra o
 * documento inteiro, mesmo antes de qualquer edição).
 */
export async function checarConversao(paginas: PaginaParaChecar[], documentoAtual: string): Promise<ResultadoChecagem> {
  if (paginas.length === 0) return { scoreExibido: null, trechosSuspeitos: [] }

  const promessas = paginas.map((pagina) => {
    // Confere primeiro, de graça e sem IA, se a página já bate quase 100% —
    // só manda pra IA (mais cara e mais sujeita a falso positivo num
    // documento grande) o que essa checagem determinística não conseguiu
    // confirmar sozinha.
    const cobertura = calcularCoberturaPagina(pagina.textoOriginal, documentoAtual)
    if (cobertura >= COBERTURA_MINIMA_PULA_AUDITORIA_IA) {
      return Promise.resolve({ pagina: pagina.pagina, scoreConfianca: cobertura, trechosSuspeitos: [] })
    }
    return checarPaginaComPrompt(pagina, documentoAtual, PROMPT_CHECAGEM, 8000)
  })
  return agregarChecagem(
    paginas.map((p) => p.pagina),
    promessas,
    'checagem por IA'
  )
}
