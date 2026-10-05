// Fórmulas da planilha no reajuste. A regra do IPC-Fipe é corrigir o PREÇO e deixar o resto sair da
// conta da própria planilha: total = ROUND(preço corrigido × qtde × meses), subtotal = soma dos totais
// corrigidos. Multiplicar o total já pronto pelo fator dá centavos de diferença e deixa subtotal que
// não bate com a soma — por isso a coluna corrigida de uma coluna de fórmulas recebe a MESMA fórmula,
// com as referências às colunas marcadas trocadas pelas colunas corrigidas correspondentes.

/** aba → (coluna original → coluna corrigida), colunas 1-based. */
export type MapaDeColunas = Map<string, Map<number, number>>

export function letraParaColuna(letras: string): number {
  return letras
    .toUpperCase()
    .split('')
    .reduce((n, l) => n * 26 + (l.charCodeAt(0) - 64), 0)
}

export function colunaParaLetra(coluna: number): string {
  let s = ''
  for (let n = coluna; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

// Referência a célula, intervalo de células ou intervalo de colunas, com aba opcional
// ('Aba com espaço'!A1, Aba!A1). Os grupos: 1 aba entre aspas, 2 aba sem aspas, 3–6 célula inicial,
// 7–10 célula final, 11–14 intervalo de colunas (H:H).
const REFERENCIA = new RegExp(
  String.raw`(?:'((?:[^']|'')+)'!|([\p{L}_][\p{L}\p{N}_.]*)!)?` +
    String.raw`(?:(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?::(\$?)([A-Za-z]{1,3})(\$?)(\d+))?|(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3}))`,
  'gu'
)
const ANTES_PROIBIDO = /[\p{L}\p{N}_.$']/u
const DEPOIS_PROIBIDO = /[\p{L}\p{N}_(!]/u

export type Traducao =
  | { tipo: 'traduzida'; formula: string } // refaz a conta com as colunas corrigidas
  | { tipo: 'sem-coluna-marcada' } // não depende do que foi corrigido
  | { tipo: 'intraduzivel' } // intervalo que mistura coluna marcada e não marcada

/**
 * Troca, na fórmula de `abaAtual`, cada referência a coluna marcada pela coluna corrigida. Texto entre
 * aspas duplas fica intacto. Intervalo de várias colunas só é traduzido se todas estiverem marcadas e as
 * corrigidas ficarem lado a lado na mesma ordem; senão é `intraduzivel` (quem chama corrige o resultado).
 */
export function traduzirFormula(formula: string, abaAtual: string, mapa: MapaDeColunas): Traducao {
  let tocou = false
  let quebrou = false
  // Partes fora de string: índices pares depois do split por literal "...".
  const partes = formula.split(/("(?:[^"]|"")*")/)
  const traduzidas = partes.map((parte, i) => {
    if (i % 2 === 1) return parte
    return parte.replace(REFERENCIA, (achado: string, ...g: unknown[]) => {
      const pos = g[14] as number
      const antes = pos > 0 ? parte[pos - 1] : ''
      const depois = parte[pos + achado.length] ?? ''
      if ((antes && ANTES_PROIBIDO.test(antes)) || (depois && DEPOIS_PROIBIDO.test(depois))) return achado
      const [abaAspas, abaSimples, d1, c1, r1d, l1, d2, c2, r2d, l2, cd1, cc1, cd2, cc2] = g as Array<string | undefined>
      const aba = abaAspas !== undefined ? abaAspas.replace(/''/g, "'") : (abaSimples ?? abaAtual)
      const prefixo = achado.slice(0, abaAspas !== undefined ? abaAspas.length + 3 : abaSimples !== undefined ? abaSimples.length + 1 : 0)
      const destinos = mapa.get(aba)
      const ini = c1 ?? cc1!
      const fim = c2 ?? cc2
      if (!destinos) return achado
      const a = letraParaColuna(ini)
      const b = fim ? letraParaColuna(fim) : a
      const [menor, maior] = a <= b ? [a, b] : [b, a]
      const marcadas = []
      for (let c = menor; c <= maior; c++) if (destinos.has(c)) marcadas.push(c)
      if (marcadas.length === 0) return achado
      const contiguas = marcadas.length === maior - menor + 1 && marcadas.every((c) => destinos.get(c) === destinos.get(menor)! + (c - menor))
      if (!contiguas) {
        quebrou = true
        return achado
      }
      tocou = true
      const novaA = colunaParaLetra(destinos.get(a)!)
      const novaB = colunaParaLetra(destinos.get(b)!)
      if (c1 !== undefined) {
        const inicio = `${d1}${novaA}${r1d}${l1}`
        return fim !== undefined ? `${prefixo}${inicio}:${d2}${novaB}${r2d}${l2}` : `${prefixo}${inicio}`
      }
      return `${prefixo}${cd1}${novaA}:${cd2}${novaB}`
    })
  })
  if (quebrou) return { tipo: 'intraduzivel' }
  if (!tocou) return { tipo: 'sem-coluna-marcada' }
  return { tipo: 'traduzida', formula: traduzidas.join('') }
}

/** Referências da fórmula, cada uma com as colunas que cobre (SUM(C3:H3) → C..H juntas) — pra sugerir
 *  as colunas que saem da conta das marcadas. */
export function colunasCitadas(formula: string, abaAtual: string): Array<{ aba: string; colunas: number[] }> {
  const citadas: Array<{ aba: string; colunas: number[] }> = []
  const partes = formula.split(/("(?:[^"]|"")*")/)
  partes.forEach((parte, i) => {
    if (i % 2 === 1) return
    for (const m of parte.matchAll(REFERENCIA)) {
      const pos = m.index ?? 0
      const antes = pos > 0 ? parte[pos - 1] : ''
      const depois = parte[pos + m[0].length] ?? ''
      if ((antes && ANTES_PROIBIDO.test(antes)) || (depois && DEPOIS_PROIBIDO.test(depois))) continue
      const aba = m[1] !== undefined ? m[1].replace(/''/g, "'") : (m[2] ?? abaAtual)
      const a = letraParaColuna(m[4] ?? m[12])
      const fim = m[8] ?? m[14]
      const b = fim ? letraParaColuna(fim) : a
      const colunas: number[] = []
      for (let c = Math.min(a, b); c <= Math.max(a, b); c++) colunas.push(c)
      citadas.push({ aba, colunas })
    }
  })
  return citadas
}
