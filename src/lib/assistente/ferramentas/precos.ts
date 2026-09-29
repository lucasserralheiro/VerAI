import { z } from 'zod'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { carregarTabela } from '@/lib/tabela-precos/consultas'
import { filtrarItens } from '@/lib/tabela-precos/busca'
import type { ItemSerializado } from '@/lib/tabela-precos/tipos'
import { definirFerramenta, esquemaLimite, moeda } from './comum'

// Tabela de preços oficial (spec docs/superpowers/specs/2026-09-29-tabela-de-precos-design.md §8). Pública
// (publicada no DOC): não filtra por cliente.

function aviso(i: ItemSerializado): string | undefined {
  if (i.conferencia === 'alterado-pelo-informativo') {
    return `preço alterado pelo informativo depois da publicação${i.precoNoPdf ? ` (PDF publicado: ${moeda(i.precoNoPdf)})` : ''}`
  }
  if (i.conferencia === 'diverge') return `a planilha difere do PDF publicado (PDF: ${moeda(i.precoNoPdf)})`
  return undefined
}

export const consultarTabelaDePrecos = definirFerramenta({
  descricao:
    'Tabela de preços oficial dos serviços da PRODAM (versão vigente, publicada no Diário Oficial): busca por código do serviço (NN.NNN.NNNNN.NN) ou por palavras da descrição; devolve código, descrição, unidade, preço unitário e aviso quando o preço mudou depois da publicação.',
  entrada: z.object({
    busca: z.string().min(2).describe('código do serviço ou palavras da descrição (ex.: "analista complexidade 3", "10.050.00067.00")'),
    limite: esquemaLimite,
  }),
  async executar({ busca, limite }) {
    const carregada = await carregarTabela()
    if (!carregada) return { erro: 'a tabela de preços ainda não foi lida da pasta do SharePoint' }
    const achados = filtrarItens(carregada.itens, busca).slice(0, limite)
    return {
      versao: carregada.tabela.versao,
      publicadaEm: carregada.tabela.publicadaEm ? formatarData(carregada.tabela.publicadaEm) : null,
      total: achados.length,
      itens: achados.map((i) => {
        const obs = aviso(i)
        return {
          codigo: i.codigo,
          descricao: i.descricao,
          unidade: i.unidade,
          preco: i.sobDemanda ? 'sob demanda' : i.preco !== null ? moeda(i.preco) : (i.precoTexto ?? '—'),
          ...(obs ? { aviso: obs } : {}),
        }
      }),
    }
  },
})
