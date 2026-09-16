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
 * DUAS fontes de candidato, escolhidas por PÁGINA, nunca as duas juntas:
 *
 * 1. `html` da própria página/fonte (quando tem `<table>`) — extrai
 *    direto das células (`extrairTodosRotuloEValorDeTabelas`). Preferida
 *    sempre que existe: célula de `<td>` tem limite de verdade (a mesma
 *    detecção de tabela, já calibrada contra documento real, que constrói
 *    o HTML final — ver `montarTabelaHtml` em `pdfHtml.ts`), então não tem
 *    ambiguidade de onde um campo acaba e o próximo começa.
 * 2. `textoOriginal`, linha por linha (`extrairTodosRotuloEValor`) — só
 *    quando a página NÃO tem tabela detectada. Bom pra frase solta
 *    ("Valor Total: R$ 279.663,46" no meio de um parágrafo), mas quando a
 *    origem é uma TABELA que a extração do PDF não conseguiu segmentar em
 *    linha/coluna, esse texto vira uma parede de números colados sem
 *    separador ("BRL 269,00001.824,0012BRL 490.656,00") — tentar adivinhar
 *    limite de campo nisso com regex é ambíguo por natureza e quebra de um
 *    jeito NOVO a cada documento diferente (caso real que motivou trocar de
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

/** Quantas vezes cada valor normalizado aparece no documento inteiro —
 *  calculado uma vez só (não por total encontrado), pra não repetir a
 *  varredura do documento inteiro pra cada total (documento grande x
 *  poucas dezenas de totais: O(documento), não O(totais × documento)). */
function indexarValoresDoDocumento(documentoAtual: string): Map<string, number> {
  const indice = new Map<string, number>()
  for (const match of documentoAtual.matchAll(REGEX_QUALQUER_VALOR)) {
    const chave = normalizarValor(match[0])
    indice.set(chave, (indice.get(chave) ?? 0) + 1)
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
 *  separador entre campo — ver `extrairTodosRotuloEValorDeTabelas` pra
 *  isso). */
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

/** Linhas (`<tr>`) de cada `<table>` do HTML, uma célula de TEXTO PURO
 *  (`<td>`/`<th>`, sem marcação) por posição — pode ter mais de uma tabela
 *  no mesmo HTML (uma página de PDF com duas tabelas, por exemplo). */
function extrairLinhasDeTabelas(html: string): string[][] {
  const linhas: string[][] = []
  for (const matchTabela of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    for (const matchLinha of matchTabela[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const celulas = [...matchLinha[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
        semMarcacaoHtml(m[1]).trim()
      )
      if (celulas.length > 0) linhas.push(celulas)
    }
  }
  return linhas
}

/** Rótulo tem que ter pelo menos uma letra — só assim "10.050.00065.00"
 *  (código de produto: dígito e ponto, sem letra nenhuma) nunca vira rótulo
 *  no lugar da célula de descrição de verdade da mesma linha. */
const REGEX_TEM_LETRA = /[a-zà-öø-ÿ]/i

/** Mesma ideia de `extrairTodosRotuloEValor`, mas pra linha de TABELA
 *  (célula por célula, sem a ambiguidade de campo colado sem separador —
 *  ver o comentário no topo do arquivo). Rótulo da linha inteira é a
 *  primeira célula com letra que não é, ela mesma, um valor monetário
 *  (tipicamente a coluna de descrição do item) — toda célula que BATE o
 *  padrão de valor monetário vira um candidato separado, com esse mesmo
 *  rótulo. */
function extrairTodosRotuloEValorDeTabelas(html: string): RotuloEValor[] {
  const resultados: RotuloEValor[] = []

  for (const celulas of extrairLinhasDeTabelas(html)) {
    const rotulo = celulas.find((c) => REGEX_TEM_LETRA.test(c) && !REGEX_VALOR.test(c)) ?? '(sem rótulo)'

    for (const celula of celulas) {
      for (const match of celula.matchAll(REGEX_VALOR_GLOBAL)) {
        const valorTexto = match[1] ? `${match[1]} ${match[2]}` : match[2]
        resultados.push({ rotulo, valorTexto, valorNormalizado: normalizarValor(match[2]) })
      }
    }
  }

  return resultados
}

/**
 * Pra cada fonte, acha TODO valor monetário — de dentro de `<table>` do
 * HTML próprio da fonte quando ele existe (célula por célula, sem
 * ambiguidade), senão linha por linha do texto puro — e confere se o MESMO
 * valor (correspondência EXATA do número normalizado, nunca substring —
 * "663,46" não pode casar dentro de "279.663,46") aparece em algum lugar do
 * documento inteiro.
 */
export function conferirTotais(fontes: TextoParaConferirTotal[], documentoAtual: string): TotalConferido[] {
  const indiceDocumento = indexarValoresDoDocumento(documentoAtual)
  const vistos = new Set<string>()
  const totais: TotalConferido[] = []

  for (const fonte of fontes) {
    const temTabela = fonte.html?.includes('<table') ?? false
    const achados = temTabela
      ? extrairTodosRotuloEValorDeTabelas(fonte.html as string)
      : fonte.textoOriginal.split('\n').flatMap((linha) => extrairTodosRotuloEValor(semMarcacaoHtml(linha)))

    for (const achado of achados) {
      const chave = chaveDoTotal(achado.rotulo, achado.valorNormalizado)
      if (vistos.has(chave)) continue
      vistos.add(chave)

      const ocorrenciasNoDocumento = indiceDocumento.get(achado.valorNormalizado) ?? 0
      totais.push({
        origem: fonte.origem,
        pagina: fonte.pagina,
        rotulo: achado.rotulo,
        valorNoOriginal: achado.valorTexto,
        encontradoNoDocumento: ocorrenciasNoDocumento > 0,
        ocorrenciasNoDocumento,
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
function ocorrenciasDoNumeroLiteral(documentoAtual: string, valor: number): number {
  const literal = String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(?<![\\d.])${literal}(?![\\d.])`, 'g')
  return [...documentoAtual.matchAll(regex)].length
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

    const ocorrenciasNoDocumento = ocorrenciasDoNumeroLiteral(documentoAtual, candidato.valor)
    totais.push({
      origem,
      pagina: null,
      rotulo: candidato.rotulo,
      valorNoOriginal: formatarValorBr(candidato.valor),
      encontradoNoDocumento: ocorrenciasNoDocumento > 0,
      ocorrenciasNoDocumento,
    })
  }

  return totais
}
