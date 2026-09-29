import type { Diferencas, ItemSerializado, PrecoMudou } from './tipos'

// "O que mudou" entre duas versões da tabela (spec 2026-09-29-tabela-de-precos §6), por código.

const centavos = (valor: string | null) => (valor === null ? null : Math.round(Number(valor) * 100))

export function diferencasEntreVersoes(antes: ItemSerializado[], depois: ItemSerializado[]): Diferencas {
  const porCodigo = new Map(antes.map((i) => [i.codigo, i]))
  const codigosDepois = new Set(depois.map((i) => i.codigo))
  const precoMudou: PrecoMudou[] = []
  const novos: ItemSerializado[] = []
  for (const d of depois) {
    const a = porCodigo.get(d.codigo)
    if (!a) {
      novos.push(d)
      continue
    }
    const ca = a.sobDemanda ? null : centavos(a.preco)
    const cd = d.sobDemanda ? null : centavos(d.preco)
    if (ca === cd && a.sobDemanda === d.sobDemanda) continue
    precoMudou.push({
      codigo: d.codigo,
      descricao: d.descricao,
      antes: a.sobDemanda ? null : a.preco,
      depois: d.sobDemanda ? null : d.preco,
      percentual: ca && cd ? Math.round((cd / ca - 1) * 1000) / 10 : null,
    })
  }
  return { novos, retirados: antes.filter((a) => !codigosDepois.has(a.codigo)), precoMudou }
}
