/**
 * Conferência determinística (sem IA) de TODO valor monetário de cada fonte
 * (página de PDF, ou arquivo Word inteiro — sem conceito de página) contra
 * o documento HTML final — atalho a mais além da checagem por IA
 * (`checarConversao.ts`), pra bater o olho rápido sem esperar chamada de
 * modelo nenhuma. Ver
 * docs/superpowers/specs/2026-09-16-conferencia-totais-design.md.
 *
 * Não exige rótulo de total ("total", "subtotal"...) perto do valor — só
 * exige que PAREÇA um valor monetário BR (milhar com ponto, decimal com
 * vírgula de 2 dígitos).
 *
 * DUAS formas de conferir, escolhidas por PÁGINA/fonte, nunca as duas
 * juntas pra não mostrar o mesmo valor duas vezes:
 *
 * 1. `html` da própria página/fonte (quando tem `<table>`) — `<td>` tem
 *    limite de verdade (a mesma detecção de tabela, já calibrada contra
 *    documento real, que constrói o HTML final — ver `montarTabelaHtml` em
 *    `pdfHtml.ts`), então não tem ambiguidade de onde um campo acaba e o
 *    próximo começa. `extrairTabelasConferidas` reconstrói a tabela INTEIRA
 *    (pra pessoa ver a mesma forma visual do original e bater célula por
 *    célula) — é a forma preferida sempre que existe.
 * 2. `textoOriginal`, linha por linha (`conferirTotais`/
 *    `extrairTodosRotuloEValor`) — só quando a fonte NÃO tem tabela
 *    detectada. Bom pra frase solta ("Valor Total: R$ 279.663,46" no meio
 *    de um parágrafo), mas quando a origem é uma TABELA que a extração do
 *    PDF não conseguiu segmentar em linha/coluna, esse texto vira uma
 *    parede de números colados sem separador
 *    ("BRL 269,00001.824,0012BRL 490.656,00") — tentar adivinhar limite de
 *    campo nisso com regex é ambíguo por natureza e quebra de um jeito NOVO
 *    a cada documento diferente (caso real que motivou trocar de
 *    abordagem, não só ajustar o regex de novo).
 *
 * Cobre texto/HTML puro — planilha (`.xlsx`/`.csv`) usa uma extração e
 * comparação diferentes (célula numérica lida direto, não regex — ver
 * `conferirTotaisPlanilha`), porque o número lá não sai formatado como
 * "1.234,56" no HTML final: sai como `String(valor)` do JavaScript (ex.:
 * "1234.56"), sem separador de milhar, ponto no lugar da vírgula.
 *
 * Limitação conhecida e aceita (mesma escolha de design já feita pra texto
 * em `checarConversao.ts`): confirma que o valor existe em ALGUM lugar do
 * documento, não que está na seção certa.
 */

export interface TextoParaConferirTotal {
  /** Rótulo de exibição: "Página 3" (PDF) ou o nome do arquivo (Word, sem
   *  conceito de página). */
  origem: string
  /** Número real da página, só quando `origem` é uma página de PDF — usado
   *  pra abrir "Ver no PDF" na tela. `null` nos outros formatos. */
  pagina: number | null
  textoOriginal: string
  /** HTML já convertido dessa MESMA fonte (a própria página do PDF, com a
   *  mesma detecção de tabela usada no documento final) — quando presente e
   *  tiver `<table>`, tem prioridade sobre `textoOriginal` (ver o
   *  comentário no topo do arquivo). `undefined` pra fonte sem HTML próprio
   *  (Word: usa sempre o texto puro, nunca tem esse campo). */
  html?: string
}

export interface TotalConferido {
  origem: string
  pagina: number | null
  rotulo: string
  valorNoOriginal: string
  encontradoNoDocumento: boolean
  ocorrenciasNoDocumento: number
  /** Trecho do documento final ao redor da PRIMEIRA ocorrência do valor —
   *  pra pessoa comparar visualmente, lado a lado, sem precisar confiar só
   *  no rótulo "Achado"/"Não achado". `undefined` quando não achou nenhuma. */
  contextoNoDocumento?: string
}

export interface CelulaConferida {
  texto: string
  /** `true` quando a célula bate o padrão de valor monetário — só essas têm
   *  `encontradoNoDocumento`/contexto preenchido; célula de texto (descrição,
   *  código, unidade) é só exibida, sem comparação nenhuma. */
  ehValor: boolean
  encontradoNoDocumento?: boolean
  /** `true` quando o valor aparece no documento final com o MESMO número mas
   *  com o SINAL trocado — a conversão perdeu (ou inventou) o menos. Só é
   *  calculado quando a célula é composta APENAS pelo valor e o documento
   *  final também tem esse número em célula isolada; fora disso fica
   *  `undefined`, porque um "-" no meio de texto é traço separador, não sinal.
   *
   *  Existe por causa da Proposta de Aditivo, que é feita de Inclusão e
   *  Redução do mesmo serviço: ali o sinal É o conteúdo, e antes disto a
   *  conferência casava `BRL - 7.948,25` com `BRL 7.948,25` sem reclamar,
   *  porque `normalizarValor` trabalha só sobre os dígitos. */
  sinalDivergente?: boolean
  /** Linha INTEIRA de origem (todas as células dessa linha, na ordem, "no
   *  PDF") — o lado "no original" da comparação lado a lado, só nas células
   *  de valor. */
  contextoOriginal?: string
  /** Trecho do documento final ao redor da PRIMEIRA ocorrência do valor —
   *  o lado "no documento" da comparação. `undefined` quando não achou. */
  contextoNoDocumento?: string
}

/** Uma tabela inteira do documento original, reconstruída linha por linha —
 *  exatamente como ela está lá (mesmas células, mesma ordem), com cada
 *  célula de valor marcada achada/não achada no documento final. Pedido
 *  explícito: a pessoa quer ver a tabela MONTADA, não uma lista achatada de
 *  valores soltos — assim dá pra bater o olho na mesma forma visual da
 *  tabela do PDF/planilha original e comparar número por número, célula por
 *  célula, na posição em que cada um realmente está. */
export interface TabelaConferida {
  origem: string
  pagina: number | null
  linhas: CelulaConferida[][]
}

/** Valor monetário BR (milhar com ponto, decimal com vírgula de 2 dígitos),
 *  com "R$"/"BRL" opcional na frente — o ÚNICO filtro que decide se um
 *  número vira candidato. Sozinho já descarta contagem solta ("Total de 45
 *  páginas", "12 itens"), que não tem vírgula decimal de 2 dígitos, sem
 *  precisar de lista de palavra-chave. Variante sem `g` pra teste avulso
 *  (`.test`/`.match` sem mexer em `lastIndex` global); `REGEX_VALOR_GLOBAL`
 *  pra varrer todas as ocorrências de uma vez (`matchAll`). */
const REGEX_VALOR = /(R\$|BRL)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/
const REGEX_VALOR_GLOBAL = /(R\$|BRL)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g

/** Quantos caracteres de texto ANTES de um valor viram o rótulo exibido —
 *  não é preciso a linha inteira quando o primeiro valor vem bem depois de
 *  um parágrafo de descrição; os últimos caracteres já dão contexto
 *  suficiente pra pessoa reconhecer do que se trata. */
const LIMITE_ROTULO = 80

/** Todo número em formato monetário BR (milhar com ponto, decimal com
 *  vírgula de 2 dígitos) solto no texto — usado pra indexar o documento
 *  inteiro numa única passada (ver `indexarValoresDoDocumento`). */
const REGEX_QUALQUER_VALOR = /\d{1,3}(?:\.\d{3})*,\d{2}/g

/** Remove separador de milhar, mantém a vírgula decimal — só assim dois
 *  números "iguais" escritos de formas diferentes comparam igual. */
function normalizarValor(valor: string): string {
  // Zero à esquerda sobrando (comum quando o valor real vem colado a outro
  // número sem separador, ex.: "...0015,00..." vira "015,00" depois do
  // valor anterior consumir o resto) não muda o número — "015,00" e
  // "15,00" são o mesmo valor, mas comparariam diferente como STRING sem
  // isso. Mantém pelo menos um dígito (não zera "0,00" pra vazio).
  return valor.replace(/\./g, '').replace(/^0+(?=\d)/, '')
}

/** `textoOriginal` NÃO é texto puro do PDF — `extrairTextoLinha`/
 *  `formatarTexto` (`pdfHtml.ts`) embutem `<strong>`/`<em>`/`<u>` em volta de
 *  trecho em negrito/itálico/sublinhado, e rótulo de total numa proposta
 *  comercial quase sempre vem em negrito no PDF original. Sem tirar a
 *  marcação antes de casar o regex, "Total Geral" some dentro de
 *  "<strong>Total Geral</strong>", e o separador entre rótulo e valor
 *  esbarra em "</strong>" (fora da classe de caracteres tolerada) — o
 *  total nunca é achado. Troca por espaço, não string vazia, pra não colar
 *  duas palavras que só tinham a tag entre elas. Inofensivo pro texto do
 *  Word (`mammoth.extractRawText` nunca tem tag) e pro texto de célula de
 *  tabela (mesma razão). */
function semMarcacaoHtml(texto: string): string {
  return texto.replace(/<[^>]+>/g, ' ')
}

/**
 * O valor de uma célula que contém SÓ um valor monetário (moeda e sinal
 * opcionais), com o sinal resolvido. `null` quando a célula tem qualquer
 * outra coisa junto.
 *
 * A exigência de a célula ser só o valor não é preciosismo: é o que separa
 * SINAL de TRAÇO. Em "SERVIÇO - 1.200,00" o hífen é separador de rótulo; em
 * "BRL - 7.948,25", sozinho numa célula de tabela, é menos. Sem essa
 * fronteira, qualquer rótulo terminado em hífen viraria valor negativo.
 *
 * Cobre as três formas que aparecem nas propostas: menos antes da moeda
 * ("- R$ 1.200,00"), menos depois dela ("BRL - 7.948,25") e a notação
 * contábil entre parênteses ("(1.200,00)").
 */
function valorIsoladoDaCelula(texto: string): { valorNormalizado: string; negativo: boolean } | null {
  const limpo = texto.trim()
  const contabil = /^\((.*)\)$/.exec(limpo)
  const nucleo = (contabil ? contabil[1] : limpo).trim()
  const achado = /^(-?)\s*(?:(?:R\$|BRL)\s*)?(-?)\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/.exec(nucleo)
  if (!achado) return null
  return {
    valorNormalizado: normalizarValor(achado[3]),
    negativo: Boolean(contabil) || achado[1] === '-' || achado[2] === '-',
  }
}

/** Quantos caracteres pra cada lado do valor achado entram no "contexto" —
 *  dá pra pessoa reconhecer o trecho (rótulo/linha ao redor) sem precisar
 *  abrir o documento inteiro procurando. */
const JANELA_CONTEXTO = 100

/** Trecho de texto puro (sem tag, espaço normalizado) ao redor de uma
 *  posição do documento — o "no documento" da comparação lado a lado. */
function extrairContexto(documentoAtual: string, indice: number, tamanho: number): string {
  const inicio = Math.max(0, indice - JANELA_CONTEXTO)
  const fim = Math.min(documentoAtual.length, indice + tamanho + JANELA_CONTEXTO)
  return semMarcacaoHtml(documentoAtual.slice(inicio, fim)).replace(/\s+/g, ' ').trim()
}

interface EntradaIndiceDocumento {
  ocorrencias: number
  /** Sinais com que ESTE número aparece no documento final, considerando só
   *  célula de tabela composta apenas pelo valor (ver `valorIsoladoDaCelula`).
   *  Vazio quando o número só aparece em prosa — e aí a checagem de sinal não
   *  opina, pra não inventar divergência onde não dá pra saber. */
  sinais: Set<'+' | '-'>
  /** Contexto da PRIMEIRA ocorrência achada — não recalcula pra cada
   *  ocorrência repetida, só a primeira já serve pra pessoa reconhecer o
   *  trecho. */
  contexto: string
}

/** Quantas vezes cada valor normalizado aparece no documento inteiro, e o
 *  contexto da primeira ocorrência — calculado uma vez só (não por total
 *  encontrado), pra não repetir a varredura do documento inteiro pra cada
 *  total (documento grande x poucas dezenas de totais: O(documento), não
 *  O(totais × documento)). */
function indexarValoresDoDocumento(documentoAtual: string): Map<string, EntradaIndiceDocumento> {
  const indice = new Map<string, EntradaIndiceDocumento>()
  for (const match of documentoAtual.matchAll(REGEX_QUALQUER_VALOR)) {
    const chave = normalizarValor(match[0])
    const atual = indice.get(chave)
    if (atual) {
      atual.ocorrencias += 1
    } else {
      indice.set(chave, {
        ocorrencias: 1,
        sinais: new Set(),
        contexto: extrairContexto(documentoAtual, match.index ?? 0, match[0].length),
      })
    }
  }

  // Segunda passada, só pelas células de tabela do documento final: registra
  // com que SINAL cada número aparece. Passada separada de propósito — a
  // contagem de ocorrências acima continua exatamente como era (por número,
  // sem sinal), então nenhum valor que era achado antes deixa de ser achado.
  // O sinal só ACRESCENTA uma detecção nova (`sinalDivergente`).
  for (const celula of documentoAtual.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
    const valor = valorIsoladoDaCelula(semMarcacaoHtml(celula[1]))
    if (!valor) continue
    indice.get(valor.valorNormalizado)?.sinais.add(valor.negativo ? '-' : '+')
  }

  return indice
}

/** Chave de dedupe: mesmo rótulo (sem diferenciar caixa) + mesmo valor
 *  normalizado conta uma vez só, mesmo vindo de fontes diferentes
 *  (resumo/cabeçalho repetido, ou o mesmo total citado em página e anexo). */
function chaveDoTotal(rotulo: string, valorNormalizado: string): string {
  return `${rotulo.trim().toLowerCase()} ${valorNormalizado}`
}

interface RotuloEValor {
  rotulo: string
  valorTexto: string
  valorNormalizado: string
}

/** Acha TODO valor monetário da linha (não só perto de palavra-chave de
 *  total, não só o primeiro) — `rotulo` é o texto que veio ANTES dele desde
 *  o valor anterior (ou desde o início da linha, no primeiro), limitado aos
 *  últimos `LIMITE_ROTULO` caracteres e sem pontuação/espaço sobrando na
 *  ponta. `'(sem rótulo)'` quando não sobra texto nenhum antes (valor logo
 *  no início da linha).
 *
 *  Só serve pra texto de PROSE (linha de parágrafo, não linha de tabela sem
 *  separador entre campo — ver `extrairTabelasConferidas` pra isso). */
function extrairTodosRotuloEValor(linha: string): RotuloEValor[] {
  const resultados: RotuloEValor[] = []
  let cursor = 0

  for (const match of linha.matchAll(REGEX_VALOR_GLOBAL)) {
    if (match.index === undefined) continue

    const textoAntes = linha
      .slice(cursor, match.index)
      .replace(/[\s.\-:]+$/, '')
      .trim()
    const rotulo = textoAntes.length > 0 ? textoAntes.slice(-LIMITE_ROTULO).trim() : '(sem rótulo)'
    const valorTexto = match[1] ? `${match[1]} ${match[2]}` : match[2]
    resultados.push({ rotulo, valorTexto, valorNormalizado: normalizarValor(match[2]) })

    cursor = match.index + match[0].length
  }

  return resultados
}

/** Cada `<table>` do HTML, como uma lista de linhas (`<tr>`) de célula de
 *  TEXTO PURO (`<td>`/`<th>`, sem marcação) — pode ter mais de uma tabela no
 *  mesmo HTML (uma página de PDF com duas tabelas, por exemplo); cada uma
 *  vira sua PRÓPRIA entrada, nunca mescladas. */
function extrairTabelas(html: string): string[][][] {
  const tabelas: string[][][] = []
  for (const matchTabela of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const linhas: string[][] = []
    for (const matchLinha of matchTabela[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const celulas = [...matchLinha[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
        semMarcacaoHtml(m[1]).trim()
      )
      if (celulas.length > 0) linhas.push(celulas)
    }
    if (linhas.length > 0) tabelas.push(linhas)
  }
  return tabelas
}

/** Reconstrói CADA tabela de CADA fonte (`html` com `<table>`) — uma
 *  `TabelaConferida` por `<table>`, célula a célula, na MESMA ordem/forma em
 *  que está no original (ver `TabelaConferida`). Fonte sem `html`/tabela não
 *  entra aqui — segue coberta pela lista achatada (`conferirTotais`). */
export function extrairTabelasConferidas(fontes: TextoParaConferirTotal[], documentoAtual: string): TabelaConferida[] {
  const indiceDocumento = indexarValoresDoDocumento(documentoAtual)
  const tabelas: TabelaConferida[] = []

  for (const fonte of fontes) {
    if (!fonte.html?.includes('<table')) continue

    for (const linhas of extrairTabelas(fonte.html)) {
      tabelas.push({
        origem: fonte.origem,
        pagina: fonte.pagina,
        linhas: linhas.map((celulas) => {
          const contextoOriginal = celulas.join(' | ')
          return celulas.map((texto) => {
            const match = texto.match(REGEX_VALOR)
            if (!match) return { texto, ehValor: false }
            const valorNormalizado = normalizarValor(match[2])
            const entrada = indiceDocumento.get(valorNormalizado)
            const isolado = valorIsoladoDaCelula(texto)
            // Só opina sobre sinal quando os DOIS lados são célula de valor
            // isolado: a daqui e pelo menos uma no documento final. Sem isso
            // não dá pra distinguir menos de traço, e um palpite errado aqui
            // vira alarme falso em cima de valor que está certo.
            const sinalDivergente =
              isolado && entrada && entrada.sinais.size > 0
                ? !entrada.sinais.has(isolado.negativo ? '-' : '+')
                : undefined
            return {
              texto,
              ehValor: true,
              encontradoNoDocumento: (entrada?.ocorrencias ?? 0) > 0,
              ...(sinalDivergente === undefined ? {} : { sinalDivergente }),
              contextoOriginal,
              contextoNoDocumento: entrada?.contexto,
            }
          })
        }),
      })
    }
  }

  return tabelas
}

/**
 * Pra cada fonte SEM tabela detectada, acha TODO valor monetário linha por
 * linha do texto puro, e confere se o MESMO valor (correspondência EXATA do
 * número normalizado, nunca substring — "663,46" não pode casar dentro de
 * "279.663,46") aparece em algum lugar do documento inteiro. Fonte COM
 * tabela é pulada aqui de propósito — ela já é coberta, célula a célula, por
 * `extrairTabelasConferidas` (essa lista achatada e a tabela reconstruída
 * nunca mostram o mesmo valor duas vezes).
 */
export function conferirTotais(fontes: TextoParaConferirTotal[], documentoAtual: string): TotalConferido[] {
  const indiceDocumento = indexarValoresDoDocumento(documentoAtual)
  const vistos = new Set<string>()
  const totais: TotalConferido[] = []

  for (const fonte of fontes) {
    if (fonte.html?.includes('<table')) continue

    const achados = fonte.textoOriginal.split('\n').flatMap((linha) => extrairTodosRotuloEValor(semMarcacaoHtml(linha)))

    for (const achado of achados) {
      const chave = chaveDoTotal(achado.rotulo, achado.valorNormalizado)
      if (vistos.has(chave)) continue
      vistos.add(chave)

      const entrada = indiceDocumento.get(achado.valorNormalizado)
      totais.push({
        origem: fonte.origem,
        pagina: fonte.pagina,
        rotulo: achado.rotulo,
        valorNoOriginal: achado.valorTexto,
        encontradoNoDocumento: (entrada?.ocorrencias ?? 0) > 0,
        ocorrenciasNoDocumento: entrada?.ocorrencias ?? 0,
        contextoNoDocumento: entrada?.contexto,
      })
    }
  }

  return totais
}

/** Número da planilha aparece no HTML final EXATAMENTE como `String(valor)`
 *  produz (célula renderizada por `celulaHtml` em `excel.ts`) — sem
 *  separador de milhar, ponto no lugar de vírgula (ex.: 1234.5 vira
 *  "1234.5"). Comparar contra `indexarValoresDoDocumento` (formato BR) não
 *  serviria de nada aqui — formato diferente. Confere por igualdade exata
 *  do literal, com fronteira de dígito/ponto pros dois lados — sem isso,
 *  "63.46" casaria como substring dentro de "279663.46". */
function encontrarNumeroLiteral(documentoAtual: string, valor: number): EntradaIndiceDocumento {
  const literal = String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(?<![\\d.])${literal}(?![\\d.])`, 'g')
  const ocorrencias = [...documentoAtual.matchAll(regex)]
  const primeira = ocorrencias[0]
  return {
    ocorrencias: ocorrencias.length,
    // Planilha não passa pela checagem de sinal: o número vem lido da célula
    // como `number`, já com sinal, e a comparação é por literal exato — o
    // sinal já faz parte do que casa ou não casa.
    sinais: new Set<'+' | '-'>(),
    contexto: primeira ? extrairContexto(documentoAtual, primeira.index ?? 0, primeira[0].length) : '',
  }
}

/** Formata pro "Valor no original" da tela — "1234.5" fica "1.234,50",
 *  mais fácil de bater o olho que o literal cru do JavaScript. */
function formatarValorBr(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Mesma ideia de `conferirTotais`, mas pra candidato de planilha
 * (`extrairTotaisDePlanilha`, `excel.ts`) — célula numérica lida direto,
 * não regex sobre texto, e comparação por igualdade exata do literal
 * JavaScript (ver `ocorrenciasDoNumeroLiteral`), não do número BR
 * normalizado que `conferirTotais` usa pra PDF/Word.
 */
export function conferirTotaisPlanilha(
  origem: string,
  candidatos: { rotulo: string; valor: number }[],
  documentoAtual: string
): TotalConferido[] {
  const vistos = new Set<string>()
  const totais: TotalConferido[] = []

  for (const candidato of candidatos) {
    const chave = chaveDoTotal(candidato.rotulo, String(candidato.valor))
    if (vistos.has(chave)) continue
    vistos.add(chave)

    const entrada = encontrarNumeroLiteral(documentoAtual, candidato.valor)
    totais.push({
      origem,
      pagina: null,
      rotulo: candidato.rotulo,
      valorNoOriginal: formatarValorBr(candidato.valor),
      encontradoNoDocumento: entrada.ocorrencias > 0,
      ocorrenciasNoDocumento: entrada.ocorrencias,
      contextoNoDocumento: entrada.ocorrencias > 0 ? entrada.contexto : undefined,
    })
  }

  return totais
}
