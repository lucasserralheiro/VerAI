/**
 * Conferência determinística (sem IA) dos valores de TOTAL/resultado geral
 * de cada fonte de texto (página de PDF, ou arquivo Word inteiro — sem
 * conceito de página) contra o documento HTML final — atalho a mais além da
 * checagem por IA (`checarConversao.ts`), focado só nos números de maior
 * risco financeiro numa proposta comercial (total, subtotal), pra bater o
 * olho rápido sem esperar chamada de modelo nenhuma. Ver
 * docs/superpowers/specs/2026-09-16-conferencia-totais-design.md.
 *
 * Cobre texto puro (PDF via `pdfHtml.ts`, Word via `mammoth.extractRawText`)
 * — planilha (`.xlsx`/`.csv`) usa uma extração e comparação diferentes
 * (célula numérica, não regex — ver `conferirTotaisPlanilha`), porque o
 * número lá não sai formatado como "1.234,56" no HTML final: sai como
 * `String(valor)` do JavaScript (ex.: "1234.56"), sem separador de milhar,
 * ponto no lugar da vírgula.
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
}

export interface TotalConferido {
  origem: string
  pagina: number | null
  rotulo: string
  valorNoOriginal: string
  encontradoNoDocumento: boolean
  ocorrenciasNoDocumento: number
}

/** Palavra-chave de total, do mais específico pro mais genérico — na mesma
 *  posição de início, a alternativa mais específica tenta primeiro (ordem da
 *  alternação em regex JS não é "mais longa vence", é "primeira que bate"),
 *  então "Total Geral" nunca vira só "Total". */
const REGEX_ROTULO = /total\s+geral|valor\s+total|subtotal|resultado\s+geral|total/i

/** Valor monetário BR (milhar com ponto, decimal com vírgula de 2 dígitos),
 *  com "R$" opcional na frente. Buscado DEPOIS da palavra-chave (não logo em
 *  seguida) — rótulo de total costuma vir com texto descritivo no meio
 *  ("Subtotal do Lote 1:", "Total dos Serviços de Manutenção:"), então
 *  exigir o valor colado teria como custo perder exatamente os totais de um
 *  documento com múltiplos lotes/itens, que são os que mais precisam de
 *  conferência (vários totais, não um só). */
const REGEX_VALOR = /(R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/

/** Até onde, depois da palavra-chave, ainda vale procurar o valor — trecho
 *  descritivo de rótulo real cabe fácil aqui; documento com "total" solto no
 *  meio de uma frase comprida não acha nenhum número perto o bastante pra
 *  contar como falso positivo. */
const JANELA_BUSCA_VALOR = 80

/** Todo número em formato monetário BR (milhar com ponto, decimal com
 *  vírgula de 2 dígitos) solto no texto — usado pra indexar o documento
 *  inteiro numa única passada (ver `indexarValoresDoDocumento`). */
const REGEX_QUALQUER_VALOR = /\d{1,3}(?:\.\d{3})*,\d{2}/g

/** Remove separador de milhar, mantém a vírgula decimal — só assim dois
 *  números "iguais" escritos de formas diferentes comparam igual. */
function normalizarValor(valor: string): string {
  return valor.replace(/\./g, '')
}

/** `textoOriginal` NÃO é texto puro do PDF — `extrairTextoLinha`/
 *  `formatarTexto` (`pdfHtml.ts`) embutem `<strong>`/`<em>`/`<u>` em volta de
 *  trecho em negrito/itálico/sublinhado, e rótulo de total numa proposta
 *  comercial quase sempre vem em negrito no PDF original. Sem tirar a
 *  marcação antes de casar o regex, "Total Geral" some dentro de
 *  "<strong>Total Geral</strong>", e o separador entre rótulo e valor
 *  esbarra em "</strong>" (fora da classe de caracteres tolerada) — o
 *  total nunca é achado. Troca por espaço, não string vazia, pra não colar
 *  duas palavras que só tinham a tag entre elas (mesmo padrão de
 *  `semMarcacaoHtml` em `checarConversao.ts`). Inofensivo pro texto do Word
 *  (`mammoth.extractRawText` nunca tem tag). */
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

/** Acha a palavra-chave de total na linha e, DEPOIS dela (dentro de
 *  `JANELA_BUSCA_VALOR`), o primeiro valor monetário — `rotulo` é tudo
 *  entre o início da palavra-chave e o início do valor (ex.: "Subtotal do
 *  Lote 1", não só "Subtotal"), sem pontuação/espaço sobrando na ponta.
 *  `null` quando a linha não tem palavra-chave, ou tem mas nenhum valor
 *  perto o bastante dela. */
function extrairRotuloEValor(linha: string): RotuloEValor | null {
  const matchRotulo = linha.match(REGEX_ROTULO)
  if (!matchRotulo || matchRotulo.index === undefined) return null

  const inicioResto = matchRotulo.index + matchRotulo[0].length
  const resto = linha.slice(inicioResto, inicioResto + JANELA_BUSCA_VALOR)
  const matchValor = resto.match(REGEX_VALOR)
  if (!matchValor || matchValor.index === undefined) return null

  const rotulo = linha
    .slice(matchRotulo.index, inicioResto + matchValor.index)
    .replace(/[\s.\-:]+$/, '')
    .trim()
  const valorTexto = matchValor[1] ? `${matchValor[1]} ${matchValor[2]}` : matchValor[2]
  return { rotulo, valorTexto, valorNormalizado: normalizarValor(matchValor[2]) }
}

/**
 * Pra cada fonte (página de PDF ou arquivo Word inteiro), acha a primeira
 * linha com rótulo de total perto de um valor monetário, e confere se o
 * MESMO valor (correspondência EXATA do número normalizado, nunca substring
 * — "663,46" não pode casar dentro de "279.663,46") aparece em algum lugar
 * do documento inteiro.
 */
export function conferirTotais(fontes: TextoParaConferirTotal[], documentoAtual: string): TotalConferido[] {
  const indiceDocumento = indexarValoresDoDocumento(documentoAtual)
  const vistos = new Set<string>()
  const totais: TotalConferido[] = []

  for (const fonte of fontes) {
    for (const linha of fonte.textoOriginal.split('\n')) {
      const achado = extrairRotuloEValor(semMarcacaoHtml(linha))
      if (!achado) continue

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
