/**
 * Reparo determinístico da CAMADA DE TEXTO de PDFs que vieram com o mapa de
 * glifos errado do gerador. Sem IA, sem dicionário externo, sem rede.
 *
 * ## O defeito
 *
 * Num PDF, o desenho da letra e a informação "esse desenho é a letra tal" são
 * duas coisas separadas: a segunda vive na tabela `ToUnicode` da fonte
 * embutida. Alguns geradores montam essa tabela errado — a página IMPRIME
 * certo (o desenho está lá), mas quem lê o texto recebe outra letra.
 *
 * Caso que motivou este módulo (PC-SPTURIS-260831-939, `Producer:
 * "Microsoft: Print To PDF"`, fonte `/CIDFont+F1` com `Identity-H`):
 *
 *     glifo 0x00FA -> U+015F (ş)   devia ser ç
 *     glifo 0x0103 -> U+0103 (ă)   devia ser ã
 *     glifo 0x006C -> U+00E4 (ä)   devia ser ã
 *     glifo 0x0075 -> U+00EC (ì)   devia ser i
 *
 * Resultado no documento: `licenşas`, `medişões`, `atualizaşões`,
 * `atribuiçäo`, `configuraçăo`, `confìrmação`, `execuçáo`, `MiddIeware` —
 * 14 ocorrências em 6 páginas. NÃO é bug da nossa extração: o `pdfminer`
 * (biblioteca completamente diferente do `unpdf`/pdf.js) devolve exatamente
 * os mesmos erros, e quem copia do Acrobat com Ctrl+C recebe a mesma coisa.
 *
 * O defeito é ESPORÁDICO dentro do mesmo documento — a mesma palavra sai
 * certa num parágrafo e errada no outro, porque o Word usou glifos diferentes
 * pra mesma letra em operações de desenho diferentes. É justamente isso que
 * torna o conserto possível sem inventar nada: **o documento é o próprio
 * dicionário dele**. Quando `atribuiçäo` aparece quebrada uma vez e
 * `atribuição` aparece inteira em outro ponto, a forma certa não é um palpite
 * — é evidência tirada do próprio original.
 *
 * ## As três regras, em ordem de confiança
 *
 * 1. `glifo-impossivel` — o caractere não existe no alfabeto do português
 *    (ş, ă, ä, ì...). Manter isso nunca é a leitura certa. A troca é decidida
 *    pela família do acento (cedilha só pode virar ç; a-com-diacrítico-estranho
 *    vira ã/á/â/à/a) e, entre os candidatos, ganha o que já aparece escrito
 *    em outro ponto do documento.
 * 2. `padrao-impossivel` — o caractere é válido em português, mas não NAQUELA
 *    posição: depois de `ç`, a língua só tem `ão`/`ões` (`execuçáo` nunca
 *    existiu). Regra de ortografia, não de dicionário.
 * 3. `auto-consistencia` — caractere válido, posição válida, mas o token
 *    aparece UMA vez e vira uma palavra que aparece VÁRIAS vezes no mesmo
 *    documento trocando só um confundível `I`/`l` (em Arial os dois têm
 *    exatamente o mesmo desenho — `MiddIeware` é invisível a olho nu, no PDF
 *    e no OCR). É a única regra com juízo envolvido, e por isso a mais
 *    apertada: exige o certo aparecendo pelo menos 2x e mais vezes que o
 *    suspeito.
 *
 * ## O que este módulo NUNCA faz
 *
 * - Mexer em token que contém dígito. Isto aqui é proposta comercial: um `1`
 *   virando `l` dentro de `R$ 17.263,43` é pior que qualquer erro de acento.
 *   Token com número passa intacto SEMPRE, e se tinha glifo impossível dentro
 *   vira alerta pra conferência humana em vez de correção silenciosa.
 * - Trocar caractere que ele não conhece. Glifo fora do alfabeto do português
 *   e fora de `CANDIDATOS_POR_GLIFO` é reportado, nunca adivinhado.
 * - Alterar um PDF são. Em documento com `ToUnicode` correto nenhuma das três
 *   regras dispara — o resultado é byte a byte igual à entrada.
 *
 * Toda troca volta registrada em `correcoes` (página, antes, depois, regra e
 * contexto), pra tela poder mostrar e a pessoa poder auditar. Nada muda em
 * silêncio.
 */

export type RegraDeReparo = 'glifo-impossivel' | 'padrao-impossivel' | 'auto-consistencia'

export interface CorrecaoDeTexto {
  /** 1-indexada, como o resto do pipeline de conversão. */
  pagina: number
  antes: string
  depois: string
  regra: RegraDeReparo
  /** Pedaço do texto ao redor, pra pessoa localizar no PDF sem caçar. */
  contexto: string
}

export interface AlertaDeTexto {
  pagina: number
  token: string
  motivo: 'glifo-desconhecido' | 'glifo-em-numero'
  contexto: string
}

export interface ResultadoReparoPdf {
  textosPorPagina: string[][]
  correcoes: CorrecaoDeTexto[]
  alertas: AlertaDeTexto[]
}

/** Alfabeto do português do Brasil + os dois indicadores ordinais (`º`/`ª`,
 *  que o Unicode classifica como LETRA e por isso caem no tokenizador) + `ñ`,
 *  que não é português mas aparece em nome próprio de fornecedor e é melhor
 *  deixar passar do que trocar por engano. */
const LETRAS_VALIDAS = new Set('abcdefghijklmnopqrstuvwxyzáàâãéêíóôõúüçñºªABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÉÊÍÓÔÕÚÜÇÑ')

/**
 * Pra cada glifo impossível em português, os substitutos possíveis em ordem
 * de probabilidade. A ordem é por FAMÍLIA DE ACENTO, não por chute: cedilha
 * só tem um destino possível em português (ç); `a` com diacrítico estranho
 * (breve, trema, anel) é quase sempre til, porque o til é o diacrítico que o
 * gerador mais erra; `i`/`u`/`e` com crase invertida quase nunca são
 * acentuados de verdade.
 *
 * Entre os candidatos quem decide é o próprio documento (ver
 * `escolherCandidato`) — esta lista só limita o espaço de busca.
 */
const CANDIDATOS_POR_GLIFO: Record<string, string[]> = {
  ş: ['ç'],
  ș: ['ç'],
  ć: ['ç', 'c'],
  č: ['c'],
  ă: ['ã', 'á', 'â', 'à', 'a'],
  ä: ['ã', 'á', 'â', 'à', 'a'],
  å: ['ã', 'á', 'â', 'à', 'a'],
  ā: ['ã', 'á', 'â', 'à', 'a'],
  ą: ['ã', 'á', 'â', 'à', 'a'],
  ì: ['i', 'í'],
  ï: ['i', 'í'],
  î: ['i', 'í'],
  ĭ: ['i', 'í'],
  ī: ['i', 'í'],
  ı: ['i', 'í'],
  è: ['é', 'ê', 'e'],
  ë: ['é', 'ê', 'e'],
  ĕ: ['é', 'ê', 'e'],
  ē: ['é', 'ê', 'e'],
  ò: ['õ', 'ó', 'ô', 'o'],
  ö: ['õ', 'ó', 'ô', 'o'],
  ŏ: ['õ', 'ó', 'ô', 'o'],
  ō: ['õ', 'ó', 'ô', 'o'],
  ù: ['ú', 'u'],
  ŭ: ['ú', 'u'],
  ū: ['ú', 'u'],
  ł: ['l'],
  ĺ: ['l'],
  ś: ['s'],
  š: ['s'],
  ż: ['z'],
  ź: ['z'],
  ž: ['z'],
  ř: ['r'],
  ŕ: ['r'],
  ň: ['n'],
  ğ: ['g'],
  ĝ: ['g'],
  ď: ['d'],
  ť: ['t'],
  ţ: ['t'],
  ț: ['t'],
  ý: ['y'],
  ÿ: ['y'],
}

/** Versão com maiúsculas incluída — derivada, não digitada à mão, pra as duas
 *  caixas nunca saírem de sincronia. */
const CANDIDATOS: Record<string, string[]> = (() => {
  const mapa: Record<string, string[]> = { ...CANDIDATOS_POR_GLIFO }
  for (const [glifo, opcoes] of Object.entries(CANDIDATOS_POR_GLIFO)) {
    const maiusculo = glifo.toUpperCase()
    if (maiusculo !== glifo && !(maiusculo in mapa)) {
      mapa[maiusculo] = opcoes.map((o) => o.toUpperCase())
    }
  }
  return mapa
})()

/**
 * Sequências que o português não tem, com a única leitura possível delas.
 * Depois de `ç` a língua só admite `ão`/`ões` — `çáo`, `çâo`, `çào` não
 * existem em palavra nenhuma, então a troca é segura sem consultar
 * dicionário. Pega o caso em que o glifo trocado é uma letra VÁLIDA (o `á` de
 * `execuçáo`), que a regra 1 não tem como enxergar.
 */
const PADROES_IMPOSSIVEIS: Array<[RegExp, string]> = [
  [/ç[áàâäåăā]o/g, 'ção'],
  [/Ç[ÁÀÂÄÅĂĀ]O/g, 'ÇÃO'],
  [/ç[óòôöŏō]es/g, 'ções'],
  [/Ç[ÓÒÔÖŎŌ]ES/g, 'ÇÕES'],
]

/** Quantas vezes a forma candidata precisa aparecer no documento pra a regra
 *  de auto-consistência aceitar a troca. Duas é o mínimo que já exclui o
 *  acaso: uma ocorrência isolada não é padrão, é outra palavra. */
const MINIMO_OCORRENCIAS_AUTO_CONSISTENCIA = 2

/** Teto de glifos impossíveis num token pra valer a busca combinatória de
 *  candidatos. Acima disso não é mais "letra trocada", é texto de outro
 *  alfabeto — o token passa intacto e vira alerta. */
const MAXIMO_GLIFOS_POR_TOKEN = 3

/** Letras, marcas de acento combinantes e dígitos — um "token" é uma corrida
 *  desses. Pontuação, espaço, `R$` e `%` ficam de fora de propósito: são
 *  fronteira, nunca conteúdo a corrigir. */
const REGEX_TOKEN = /[\p{L}\p{M}\p{N}]+/gu

const TAMANHO_CONTEXTO = 40

function ehGlifoImpossivel(caractere: string): boolean {
  return /\p{L}/u.test(caractere) && !LETRAS_VALIDAS.has(caractere)
}

function temDigito(token: string): boolean {
  return /\p{N}/u.test(token)
}

function contexto(texto: string, posicao: number, tamanho: number): string {
  const inicio = Math.max(0, posicao - TAMANHO_CONTEXTO)
  const fim = Math.min(texto.length, posicao + tamanho + TAMANHO_CONTEXTO)
  return `${inicio > 0 ? '…' : ''}${texto.slice(inicio, fim).trim()}${fim < texto.length ? '…' : ''}`
}

/** Vocabulário do documento: quantas vezes cada palavra aparece escrita de
 *  forma CONFIÁVEL (sem nenhum glifo impossível dentro). É contra isto que as
 *  três regras conferem o palpite delas — por isso palavra quebrada não entra
 *  aqui, senão o erro viraria evidência a favor de si mesmo. */
function montarVocabulario(textosPorPagina: string[][]): Map<string, number> {
  const vocabulario = new Map<string, number>()
  for (const pagina of textosPorPagina) {
    for (const texto of pagina) {
      for (const [token] of texto.matchAll(REGEX_TOKEN)) {
        if (temDigito(token)) continue
        if ([...token].some(ehGlifoImpossivel)) continue
        const chave = token.toLowerCase()
        vocabulario.set(chave, (vocabulario.get(chave) ?? 0) + 1)
      }
    }
  }
  return vocabulario
}

/** Produto cartesiano das opções de cada posição defeituosa, em ordem de
 *  probabilidade (a primeira combinação é sempre "todo mundo na opção mais
 *  provável"). Limitado por `MAXIMO_GLIFOS_POR_TOKEN`, então nunca explode. */
function combinacoes(opcoesPorPosicao: string[][]): string[][] {
  return opcoesPorPosicao.reduce<string[][]>(
    (acumulado, opcoes) => acumulado.flatMap((prefixo) => opcoes.map((opcao) => [...prefixo, opcao])),
    [[]]
  )
}

/**
 * Escolhe entre os candidatos de um token quebrado: ganha o primeiro que já
 * aparece escrito em outro ponto do DOCUMENTO. Nenhum aparecendo, cai na
 * combinação mais provável (a primeira opção de cada família de acento) — que
 * ainda passa pela regra de padrão impossível depois, então `medişões` vira
 * `medições` mesmo sem a palavra existir inteira em lugar nenhum do arquivo.
 */
function escolherCandidato(token: string, vocabulario: Map<string, number>): string | null {
  const posicoes: number[] = []
  const opcoes: string[][] = []
  for (let i = 0; i < token.length; i++) {
    if (!ehGlifoImpossivel(token[i])) continue
    const candidatos = CANDIDATOS[token[i]]
    if (!candidatos) return null // glifo que não sabemos ler — reportar, nunca adivinhar
    posicoes.push(i)
    opcoes.push(candidatos)
  }
  if (posicoes.length === 0 || posicoes.length > MAXIMO_GLIFOS_POR_TOKEN) return null

  const montar = (escolha: string[]): string => {
    const letras = [...token]
    posicoes.forEach((posicao, indice) => {
      letras[posicao] = escolha[indice]
    })
    return letras.join('')
  }

  const todas = combinacoes(opcoes).map(montar)
  return todas.find((palavra) => (vocabulario.get(palavra.toLowerCase()) ?? 0) > 0) ?? todas[0] ?? null
}

/** Regra 2 aplicada a um token já livre de glifo impossível. */
function corrigirPadraoImpossivel(token: string): string {
  return PADROES_IMPOSSIVEIS.reduce((texto, [padrao, troca]) => texto.replace(padrao, troca), token)
}

/**
 * Regra 3, deliberadamente estreita: só olha `I` maiúsculo logo depois de
 * letra minúscula e `l` minúsculo logo depois de MAIÚSCULA — as duas únicas
 * posições em que a confusão `I`/`l` é invisível na página (mesmo desenho em
 * Arial/Helvetica). Fora disso não mexe.
 */
function corrigirPorAutoConsistencia(token: string, vocabulario: Map<string, number>): string {
  const frequenciaAtual = vocabulario.get(token.toLowerCase()) ?? 0
  for (let i = 1; i < token.length; i++) {
    const anterior = token[i - 1]
    const atual = token[i]
    const trocaPorMinuscula = atual === 'I' && anterior >= 'a' && anterior <= 'z'
    const trocaPorMaiuscula = atual === 'l' && anterior >= 'A' && anterior <= 'Z'
    if (!trocaPorMinuscula && !trocaPorMaiuscula) continue
    const candidato = `${token.slice(0, i)}${trocaPorMinuscula ? 'l' : 'I'}${token.slice(i + 1)}`
    const frequencia = vocabulario.get(candidato.toLowerCase()) ?? 0
    if (frequencia >= MINIMO_OCORRENCIAS_AUTO_CONSISTENCIA && frequencia > frequenciaAtual) return candidato
  }
  return token
}

interface ReparoDeToken {
  texto: string
  regra: RegraDeReparo
}

/** As três regras aplicadas a um token, na ordem de confiança. `null` quando
 *  nada mudou. A trava de número é a PRIMEIRA linha de defesa, antes de
 *  qualquer regra — ver o cabeçalho do arquivo. */
function repararToken(token: string, vocabulario: Map<string, number>): ReparoDeToken | null {
  if (temDigito(token)) return null

  const temGlifoImpossivel = [...token].some(ehGlifoImpossivel)
  if (temGlifoImpossivel) {
    const escolhido = escolherCandidato(token, vocabulario)
    if (escolhido === null) return null
    const comPadrao = corrigirPadraoImpossivel(escolhido)
    return comPadrao === token ? null : { texto: comPadrao, regra: 'glifo-impossivel' }
  }

  const comPadrao = corrigirPadraoImpossivel(token)
  if (comPadrao !== token) return { texto: comPadrao, regra: 'padrao-impossivel' }

  const porConsistencia = corrigirPorAutoConsistencia(token, vocabulario)
  if (porConsistencia !== token) return { texto: porConsistencia, regra: 'auto-consistencia' }

  return null
}

/**
 * Repara o texto de UM trecho (um item de texto do PDF, uma linha, uma célula)
 * contra o vocabulário já montado do documento inteiro. Exportada porque o
 * conversor repara item a item, mas o vocabulário precisa vir do documento
 * todo — a ordem certa é `montarVocabulario` uma vez, `repararTexto` N vezes.
 */
export function repararTexto(
  texto: string,
  vocabulario: Map<string, number>,
  pagina: number
): { texto: string; correcoes: CorrecaoDeTexto[]; alertas: AlertaDeTexto[] } {
  const correcoes: CorrecaoDeTexto[] = []
  const alertas: AlertaDeTexto[] = []
  let deslocamento = 0
  let resultado = texto

  for (const encontro of texto.matchAll(REGEX_TOKEN)) {
    const token = encontro[0]
    const posicao = encontro.index ?? 0

    if (temDigito(token)) {
      // Número com glifo impossível dentro não é corrigido nem na marra: sobe
      // pra conferência humana. Ver o cabeçalho do arquivo.
      if ([...token].some(ehGlifoImpossivel)) {
        alertas.push({ pagina, token, motivo: 'glifo-em-numero', contexto: contexto(texto, posicao, token.length) })
      }
      continue
    }

    if ([...token].some(ehGlifoImpossivel) && escolherCandidato(token, vocabulario) === null) {
      alertas.push({ pagina, token, motivo: 'glifo-desconhecido', contexto: contexto(texto, posicao, token.length) })
      continue
    }

    const reparo = repararToken(token, vocabulario)
    if (!reparo) continue

    const inicio = posicao + deslocamento
    resultado = resultado.slice(0, inicio) + reparo.texto + resultado.slice(inicio + token.length)
    deslocamento += reparo.texto.length - token.length
    correcoes.push({
      pagina,
      antes: token,
      depois: reparo.texto,
      regra: reparo.regra,
      contexto: contexto(texto, posicao, token.length),
    })
  }

  return { texto: resultado, correcoes, alertas }
}

/**
 * Passada completa sobre os textos de um PDF — uma lista de trechos por
 * página, na ordem em que saíram da extração. Devolve os mesmos trechos
 * reparados (mesmo formato, mesmo comprimento de array: o conversor continua
 * casando item com estilo/posição por índice) mais o registro do que mudou.
 *
 * PDF são entra e sai idêntico: as três regras só disparam em caractere ou
 * sequência que não existe em português, ou em confusão `I`/`l` que o próprio
 * documento desmente.
 */
export function repararTextosDoPdf(textosPorPagina: string[][]): ResultadoReparoPdf {
  const vocabulario = montarVocabulario(textosPorPagina)
  const correcoes: CorrecaoDeTexto[] = []
  const alertas: AlertaDeTexto[] = []

  const textos = textosPorPagina.map((pagina, indice) =>
    pagina.map((texto) => {
      const reparo = repararTexto(texto, vocabulario, indice + 1)
      correcoes.push(...reparo.correcoes)
      alertas.push(...reparo.alertas)
      return reparo.texto
    })
  )

  return { textosPorPagina: textos, correcoes, alertas }
}

/**
 * Geradores de PDF conhecidos por montar `ToUnicode` errado. Não é a decisão
 * de corrigir — as regras acima já são inofensivas em PDF são — mas serve pra
 * TELA avisar a pessoa antes mesmo de ela abrir o documento, e pra explicar à
 * origem (GRC) que exportar pelo Word em "Salvar como PDF" resolve o problema
 * na fonte, em vez de imprimir via "Microsoft Print to PDF".
 */
const GERADORES_SUSPEITOS = [/microsoft:\s*print\s*to\s*pdf/i, /microsoft\s+print\s+to\s+pdf/i]

export function geradorConhecidoPorQuebrarTexto(producer?: string | null, creator?: string | null): boolean {
  return [producer, creator].some((valor) => !!valor && GERADORES_SUSPEITOS.some((padrao) => padrao.test(valor)))
}
