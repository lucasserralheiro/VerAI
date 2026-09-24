export interface Precos {
  entrada: number
  entradaCache: number
  saida: number
}

/** USD por milhão de tokens, do ambiente — o DeepSeek muda preço, então não fica fixo no código. */
export function precosDoAmbiente(): Precos | null {
  const ler = (nome: string) => {
    const valor = Number(process.env[nome])
    return process.env[nome]?.trim() && Number.isFinite(valor) ? valor : null
  }
  const entrada = ler('ASSISTENTE_PRECO_ENTRADA')
  const entradaCache = ler('ASSISTENTE_PRECO_ENTRADA_CACHE')
  const saida = ler('ASSISTENTE_PRECO_SAIDA')
  if (entrada === null || entradaCache === null || saida === null) return null
  return { entrada, entradaCache, saida }
}

export function custoEstimadoUsd(uso: { entrada: number; cache: number; saida: number }, precos: Precos): number {
  const semCache = Math.max(uso.entrada - uso.cache, 0)
  return (semCache * precos.entrada + uso.cache * precos.entradaCache + uso.saida * precos.saida) / 1_000_000
}
