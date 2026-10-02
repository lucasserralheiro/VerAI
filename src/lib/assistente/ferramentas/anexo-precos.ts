import Decimal from 'decimal.js'
import { z } from 'zod'
import { normalizarDecimal } from '@/lib/relatorios-clientes/numero'
import { carregarTabela } from '@/lib/tabela-precos/consultas'
import { anexoDoUsuario } from '@/lib/assistente/anexos/acesso'
import { htmlDoAnexo } from '@/lib/assistente/anexos/extrair'
import { itensDasTabelas } from '@/lib/assistente/anexos/itens'
import type { FormatoAnexo } from '@/lib/assistente/anexos/tipos'
import { getR2 } from '@/lib/r2'
import { tabela } from './compacto'
import { definirFerramenta, moeda, NAO_ENCONTRADO } from './comum'

// Confere os preços do anexo: item × tabela oficial, quantidade × unitário e soma × total declarado.
// Tudo em decimal.js; somente leitura.

type Preco = 'igual' | 'diferente' | 'código não existe' | 'sob demanda' | 'sem unitário'
type Conta = 'confere' | 'não confere' | 'sem dados'
interface ItemConferido {
  linha: number
  codigo: string
  descricao: string
  unitario: string | null
  tabelaOficial: string | null
  preco: Preco
  conta: Conta
  detalhe?: string
}
interface SaidaPrecos {
  anexo: string
  tabela: string
  avisos: string[]
  resumo: { igual: number; diferente: number; inexistente: number; contaErrada: number }
  somaDasLinhas: string | null
  totalDeclarado: string | null
  soma: 'confere' | 'não confere' | 'sem total declarado' | 'não conferida'
  itens: ItemConferido[]
}

const MAX_AVISOS_MODELO = 5
const MAX_PROBLEMAS_MODELO = 60
const ORDEM: (Preco | 'conta')[] = ['diferente', 'código não existe', 'conta', 'sob demanda', 'sem unitário']

function decimalDe(texto: string | null | undefined): Decimal | null {
  if (!texto) return null
  const r = normalizarDecimal(texto)
  return 'valor' in r ? new Decimal(r.valor) : null
}
const dinheiro = (d: Decimal) => moeda(d.toFixed(2))
const arredondar = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

const categoria = (i: ItemConferido): Preco | 'conta' | null =>
  i.preco === 'diferente' || i.preco === 'código não existe' ? i.preco : i.conta === 'não confere' ? 'conta' : i.preco === 'igual' ? null : i.preco

/** Texto ao modelo: avisos, resumo, soma e problemas primeiro; itens iguais só contados. */
function compactarPrecos(saida: unknown): string {
  const s = saida as SaidaPrecos
  const partes = [`anexo: ${s.anexo}`, `tabela: ${s.tabela}`]
  if (s.avisos.length > 0) {
    const mostrados = s.avisos.slice(0, MAX_AVISOS_MODELO)
    const resto = s.avisos.length - mostrados.length
    partes.push(`avisos: ${mostrados.join('; ')}${resto > 0 ? `; … e mais ${resto}` : ''}`)
  }
  const r = s.resumo
  partes.push(`resumo: ${r.igual} igual, ${r.diferente} diferente, ${r.inexistente} código não existe, ${r.contaErrada} conta não confere`)
  partes.push(`soma: ${s.soma}; linhas ${s.somaDasLinhas ?? '-'}; declarado ${s.totalDeclarado ?? '-'}`)
  const problemas = ORDEM.flatMap((c) => s.itens.filter((i) => categoria(i) === c))
  const mostrados = problemas.slice(0, MAX_PROBLEMAS_MODELO)
  partes.push(
    tabela(
      'itensComProblema',
      mostrados.map(({ linha, codigo, unitario, tabelaOficial, preco, conta, detalhe }) => ({ linha, codigo, unitario, tabelaOficial, preco, conta, detalhe })) as unknown as Record<string, unknown>[],
    ),
  )
  if (problemas.length > mostrados.length) partes.push(`… e mais ${problemas.length - mostrados.length} itens com problema`)
  partes.push(`itensOk: ${s.itens.length - problemas.length}`)
  return partes.join('\n')
}

export const conferirPrecosDoAnexo = definirFerramenta({
  descricao:
    'Confere os preços do documento anexado: cada item com código de serviço contra a tabela de preços oficial, quantidade × unitário e a soma das linhas contra o total declarado. Use para "os preços estão certos?", "a conta fecha?". Devolve os itens com problema e a contagem dos corretos.',
  entrada: z.object({ anexoId: z.string().min(1).describe('id do anexo (vem de anexosDaConversa)') }),
  compactar: compactarPrecos,
  async executar({ anexoId }, { usuario }) {
    const anexo = await anexoDoUsuario(anexoId, usuario)
    if (!anexo) return NAO_ENCONTRADO
    if (anexo.status !== 'ok') return { erro: 'não consegui ler este anexo' }

    let itensDoAnexo
    try {
      const resposta = await getR2(anexo.chaveR2)
      if (!resposta?.ok) throw new Error('arquivo fora do R2')
      const html = await htmlDoAnexo(Buffer.from(await resposta.arrayBuffer()), anexo.formato as FormatoAnexo)
      itensDoAnexo = itensDasTabelas(html)
    } catch (erro) {
      console.error('[assistente] falha ao reler o anexo para conferir preços', erro)
      return { erro: 'não consegui reler o anexo' }
    }
    if (itensDoAnexo.length === 0) return { erro: 'não achei tabela de itens com código de serviço neste anexo' }

    const oficial = await carregarTabela()
    if (!oficial) return { erro: 'a tabela de preços oficial ainda não foi lida' }
    const porCodigo = new Map(oficial.itens.map((i) => [i.codigo, i]))

    const avisos: string[] = []
    const resumo = { igual: 0, diferente: 0, inexistente: 0, contaErrada: 0 }
    const itens: ItemConferido[] = []
    let semTotal = 0
    let semValor = 0
    let soma = new Decimal(0)

    for (const a of itensDoAnexo) {
      const unit = decimalDe(a.unitario)
      const qtd = decimalDe(a.quantidade)
      const totalLinha = decimalDe(a.total)
      const ref = porCodigo.get(a.codigo)
      const refDec = ref ? decimalDe(ref.preco) : null
      const detalhes: string[] = []

      let preco: Preco
      if (!ref) preco = 'código não existe'
      else if (ref.sobDemanda || !refDec) preco = 'sob demanda'
      else if (!unit) preco = 'sem unitário'
      else if (arredondar(unit).equals(arredondar(refDec))) preco = 'igual'
      else {
        preco = 'diferente'
        detalhes.push(`tabela ${dinheiro(refDec)}${ref?.unidade ? ` por ${ref.unidade}` : ""}`)
      }
      if (preco === 'igual') resumo.igual++
      else if (preco === 'diferente') resumo.diferente++
      else if (preco === 'código não existe') resumo.inexistente++

      let conta: Conta = 'sem dados'
      if (qtd && unit && totalLinha) {
        const calculado = arredondar(qtd.times(unit))
        if (calculado.equals(arredondar(totalLinha))) conta = 'confere'
        else {
          conta = 'não confere'
          resumo.contaErrada++
          detalhes.push(`quantidade × unitário = ${dinheiro(calculado)}`)
        }
      } else if (qtd && unit && !totalLinha) semTotal++

      const valorLinha = totalLinha ?? (qtd && unit ? arredondar(qtd.times(unit)) : null)
      if (valorLinha) soma = soma.plus(valorLinha)
      else semValor++

      itens.push({
        linha: a.linha,
        codigo: a.codigo,
        descricao: a.descricao,
        unitario: unit ? dinheiro(unit) : null,
        tabelaOficial: refDec ? dinheiro(refDec) : null,
        preco,
        conta,
        ...(detalhes.length > 0 ? { detalhe: detalhes.join('; ') } : {}),
      })
    }
    if (semTotal > 0) avisos.push(`${semTotal} linha(s) sem total — conta por linha não conferida`)

    const declarado = decimalDe(anexo.ficha?.campos?.valorTotal?.valor)
    let situacaoSoma: SaidaPrecos['soma']
    let somaDasLinhas: string | null = null
    if (semValor > 0) {
      situacaoSoma = 'não conferida'
      avisos.push(`soma não conferida: ${semValor} item(ns) sem valor`)
    } else {
      somaDasLinhas = dinheiro(soma)
      avisos.push('a soma considera só os itens com código de serviço')
      if (!declarado) situacaoSoma = 'sem total declarado'
      else if (arredondar(soma).equals(arredondar(declarado))) situacaoSoma = 'confere'
      else if (arredondar(soma.times(12)).equals(arredondar(declarado))) {
        situacaoSoma = 'não conferida'
        avisos.push('o total declarado parece anual (12 × a soma mensal das linhas)')
      } else {
        situacaoSoma = 'não confere'
        avisos.push(`soma das linhas ${dinheiro(soma)} × total declarado ${dinheiro(declarado)}`)
      }
    }

    return {
      anexo: anexo.nome,
      tabela: oficial.tabela.versao,
      avisos,
      resumo,
      somaDasLinhas,
      totalDeclarado: declarado ? dinheiro(declarado) : null,
      soma: situacaoSoma,
      itens,
    } satisfies SaidaPrecos
  },
})
