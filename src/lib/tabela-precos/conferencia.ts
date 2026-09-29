import type { Conferencia } from './tipos'
import type { ItemLido } from './planilha'
import type { Informativo, PrecoNoPdf } from './pdf'

// Cada item da planilha contra o PDF publicado (spec 2026-09-29-tabela-de-precos §4.4). Nunca escolhe um
// preço em silêncio: o que não bate fica marcado e a tela mostra os dois.

export type ItemConferido = ItemLido & { conferencia: Conferencia; precoNoPdf: string | null }

const centavos = (valor: string) => Math.round(Number(valor) * 100)
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function citadoNoInformativo(item: ItemLido, informativo: Informativo | null): boolean {
  if (!informativo) return false
  if (informativo.codigos.includes(item.codigo)) return true
  const descricao = normal(item.descricao)
  return informativo.alteracoes.some(({ nome }) => new RegExp(`(^|[^A-Z0-9])${escapar(normal(nome))}([^A-Z0-9]|$)`).test(descricao))
}

export function conferirItens(itens: ItemLido[], precos: Map<string, PrecoNoPdf> | null, informativo: Informativo | null): ItemConferido[] {
  return itens.map((item) => {
    if (!precos) return { ...item, conferencia: 'sem-pdf', precoNoPdf: null }
    const noPdf = precos.get(item.codigo)
    const citado = citadoNoInformativo(item, informativo)
    if (!noPdf) return { ...item, conferencia: citado ? 'alterado-pelo-informativo' : 'fora-do-pdf', precoNoPdf: null }
    const iguais = item.sobDemanda
      ? noPdf.sobDemanda
      : !noPdf.sobDemanda && item.preco !== null && noPdf.preco !== null && centavos(item.preco) === centavos(noPdf.preco)
    return {
      ...item,
      conferencia: iguais ? 'confere' : citado ? 'alterado-pelo-informativo' : 'diverge',
      precoNoPdf: noPdf.preco,
    }
  })
}

export function resumoDaConferencia(itens: ItemConferido[]): Record<Conferencia, number> {
  const resumo: Record<Conferencia, number> = { confere: 0, diverge: 0, 'fora-do-pdf': 0, 'alterado-pelo-informativo': 0, 'sem-pdf': 0 }
  for (const i of itens) resumo[i.conferencia]++
  return resumo
}
