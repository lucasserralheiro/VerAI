// Que número é este? (spec docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md §5.1). Regra
// pura sobre o trecho que a ficha do termo guardou: vale a palavra-chave MAIS PRÓXIMA antes do número. É o que
// separa "o valor do contrato passa para R$ Y" (novo total) de "valor da supressão R$ X" (diferença).

export type CategoriaValor = 'total' | 'novo-total' | 'periodo' | 'diferenca' | 'mensal' | 'inicial' | 'ambiguo'

const PADROES: [CategoriaValor, RegExp][] = [
  ['diferenca', /supress|acr[eé]scimo|complementar|apostil|reajuste|redu[cç][aã]o|aumento\s+de/gi],
  ['mensal', /mensal/gi],
  ['inicial', /inicial/gi],
  // "passa para", "passa a ser", "passando … para", "Passa de R$ X (…) para", "atualizado", "totalizando".
  ['novo-total', /passa(?:ndo|r[aá])?\s+(?:a\s+ser|para)|passa(?:ndo)?\b[\s\S]{0,60}?\bde\b[\s\S]*?\bpara\b|atualizado|totalizando/gi],
  ['periodo', /per[ií]odo|aditamento|aditivo|adi\s?vo|d[oe]\s+(?:presente\s+)?termo|deste\s+termo/gi],
  ['total', /valor\s+(?:total|global|estimado)|pre[cç]o\s+total|valor\s+d[oe]\s+(?:presente\s+)?contrato|valor\s+contratual|perfazendo/gi],
]

/** O número do valor da ficha como aparece no texto: "R$ 2.207.992,20 (dois…)" → "2.207.992,20". */
export function numeroDoValor(valor: string): string | null {
  return /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?![\d])/.exec(valor)?.[1] ?? null
}

export function categoriaDoValor(trecho: string, valor: string): CategoriaValor {
  const numero = numeroDoValor(valor)
  const posicao = numero ? trecho.indexOf(numero) : -1
  if (!numero || posicao < 0) return 'ambiguo'
  const janela = trecho.slice(Math.max(0, posicao - 250), posicao)
  let melhor: { categoria: CategoriaValor; fim: number } | null = null
  for (const [categoria, padrao] of PADROES) {
    for (const m of janela.matchAll(padrao)) {
      const fim = m.index! + m[0].length
      if (!melhor || fim > melhor.fim) melhor = { categoria, fim }
    }
  }
  return melhor?.categoria ?? 'ambiguo'
}

/** Cada linha do histórico guarda o valor TOTAL do contrato naquele momento (resumo-historico.ts):
 *  contrato → total; prorrogação → total do novo período; aditivo → só o novo total ("passa para"). */
export function aceitaCategoria(tipoLinha: string, categoria: CategoriaValor): boolean {
  if (tipoLinha === 'CONTRATO') return categoria === 'total'
  if (tipoLinha === 'PRORROGACAO') return categoria === 'total' || categoria === 'novo-total' || categoria === 'periodo'
  if (tipoLinha === 'ADITIVO') return categoria === 'novo-total'
  return false
}
