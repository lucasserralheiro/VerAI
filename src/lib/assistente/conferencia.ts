// Conferência dos números da resposta contra o que as ferramentas devolveram (spec 2026-09-30-assistente-consultor §7).
// Puro. Marca, não bloqueia (quem bloqueia o caso "sem consulta" é a rota).

export interface Conferencia {
  conferidos: number
  naoConfirmados: string[]
}

const PADROES = [
  /R\$\s?-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|R\$\s?-?\d+(?:,\d{2})?/g, // moeda
  /\b\d{4}\.\d{4}\/\d{7}-\d\b/g, // SEI
  /\b\d{1,3}(?:[.,]\d{1,2})?%/g, // percentual
  /\b\d{2}\/\d{2}\/\d{4}\b/g, // data
  /\b\d{1,4}\/[A-Za-zÀ-ú]+\/\d{4}\b/g, // contrato NN/SIGLA/AAAA
  /(?<![\d/])\b(?:0[1-9]|1[0-2])\/20\d{2}\b(?![\d/])/g, // competência mm/aaaa
]

export function extrairNumeros(texto: string): string[] {
  const achados: { i: number; v: string }[] = []
  const ocupado: [number, number][] = []
  for (const p of PADROES) {
    for (const m of texto.matchAll(p)) {
      const ini = m.index!
      const fim = ini + m[0].length
      if (ocupado.some(([a, b]) => ini < b && fim > a)) continue
      ocupado.push([ini, fim])
      achados.push({ i: ini, v: m[0].trim() })
    }
  }
  return achados.sort((a, b) => a.i - b.i).map((a) => a.v)
}

/** Forma canônica para comparar: moeda e percentual viram número com 2 casas; o resto, só dígitos e letras. */
function canonico(v: string): string {
  if (/^R\$/.test(v)) return `n:${Number(v.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')).toFixed(2)}`
  if (v.endsWith('%')) return `n:${Number(v.slice(0, -1).replace(',', '.')).toFixed(2)}`
  return `t:${v.toUpperCase().replace(/\s/g, '')}`
}

function canonicosDasFontes(fontes: string[]): Set<string> {
  const s = new Set<string>()
  const texto = fontes.join('\n')
  for (const v of extrairNumeros(texto)) s.add(canonico(v))
  // Decimal cru das ferramentas ("1000.00", "6.17") também vale como moeda/percentual. Só com ponto e 1–2
  // casas: inteiro solto ("30" de uma data) não pode confirmar "R$ 30,00".
  for (const m of texto.matchAll(/(?<![\d.,])-?\d+\.\d{1,2}(?![\d%])/g)) s.add(`n:${Number(m[0]).toFixed(2)}`)
  return s
}

export function conferirResposta({ textoVerai, fontes }: { textoVerai: string; fontes: string[] }): Conferencia {
  const numeros = extrairNumeros(textoVerai)
  if (numeros.length === 0) return { conferidos: 0, naoConfirmados: [] }
  const conhecidos = canonicosDasFontes(fontes)
  const naoConfirmados = numeros.filter((v) => !conhecidos.has(canonico(v)))
  return { conferidos: numeros.length - naoConfirmados.length, naoConfirmados: [...new Set(naoConfirmados)] }
}
