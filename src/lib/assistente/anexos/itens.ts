import { normalizarDecimal } from '@/lib/relatorios-clientes/numero'
import { htmlParaTexto } from '../indexacao/trechos'
import type { ItemDocumento } from './tipos'

// Itens com código de serviço PRODAM tirados das tabelas do documento (spec 2026-10-02-assistente-anexos §6).
// Coluna pelo cabeçalho; sem tabela reconhecível → [] (nunca chuta).

export const CODIGO_SERVICO = /\b\d{2}\.\d{3}\.\d{5}\.\d{2}\b/

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const celulas = (linha: string) => [...linha.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => htmlParaTexto(m[1]).replace(/\s+/g, ' ').trim())

function valor(texto: string | undefined): string | null {
  if (!texto) return null
  const limpo = texto.replace(/R\$\s*/i, '').trim()
  if (!limpo) return null
  const r = normalizarDecimal(limpo)
  return 'valor' in r ? r.valor : null
}

function quantidade(texto: string | undefined): string | null {
  if (!texto) return null
  // Número inicial: "120 h", "12 meses", "1.000 un" -> só o número.
  const m = texto.trim().match(/^(\d[\d.,]*\d|\d)(?=\s|$|\D)/)
  if (!m) return null
  const t = m[1]
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return t.replace(/\./g, '')
  return valor(t)
}

type Colunas = { codigo: number; descricao: number; quantidade: number; unitario: number; total: number }

const NOMES_DE_COLUNA = /codigo|descri|servico|qtde|quant|qtd|unit|total|valor|preco/
const ANUAL = /anual|12 meses|global/

function colunasDoCabecalho(cab: string[]): Colunas {
  const nomes = cab.map(semAcento)
  const indices = (re: RegExp) => nomes.map((c, i) => (re.test(c) ? i : -1)).filter((i) => i >= 0)
  const quantidade = indices(/qtde|quant|qtd/)
  const escolher = (cands: number[]) => {
    const c = cands.filter((i) => !quantidade.includes(i))
    const mensal = c.find((i) => /mensal/.test(nomes[i]))
    if (mensal !== undefined) return mensal
    // Só anual/12 meses/global: não serve para comparar com unitário mensal.
    return c.find((i) => !ANUAL.test(nomes[i])) ?? -1
  }
  const totais = indices(/total/)
  const total = escolher(totais)
  const unit = indices(/unit/).filter((i) => !totais.includes(i))
  const unitario = unit.length ? escolher(unit) : escolher(indices(/^valor|preco/).filter((i) => !totais.includes(i)))
  const codigo = indices(/codigo|cod\b/)[0] ?? indices(/servico/)[0] ?? -1
  const descricao = indices(/descri/)[0] ?? indices(/servico/).find((i) => i !== codigo) ?? -1
  return { codigo, descricao, quantidade: quantidade[0] ?? -1, unitario, total }
}

const pontos = (l: string[]) => l.filter((c) => NOMES_DE_COLUNA.test(semAcento(c))).length

// Cabeçalho = linha (antes da 1ª com código) que mais casa com nomes de coluna; em 2 linhas, junta.
function cabecalhoDe(antes: string[][]): string[] {
  let melhor = -1
  let max = 0
  antes.forEach((l, i) => {
    if (pontos(l) > max) {
      max = pontos(l)
      melhor = i
    }
  })
  if (melhor < 0) return []
  const cab = antes[melhor]
  const ant = antes[melhor - 1]
  const prox = antes[melhor + 1]
  if (ant && ant.length === cab.length && pontos(ant) > 0) return ant.map((c, i) => `${c} ${cab[i]}`)
  if (prox && prox.length === cab.length && pontos(prox) > 0) return cab.map((c, i) => `${c} ${prox[i]}`)
  return cab
}

export function itensDasTabelas(html: string): ItemDocumento[] {
  const itens: ItemDocumento[] = []
  for (const tabela of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const linhas = (tabela.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map(celulas).filter((l) => l.length > 0)
    if (linhas.length < 2) continue
    const primeira = linhas.findIndex((l) => l.some((c) => CODIGO_SERVICO.test(c)))
    if (primeira < 0) continue
    const col = colunasDoCabecalho(cabecalhoDe(linhas.slice(0, primeira)))
    let n = 0
    for (const l of linhas.slice(primeira)) {
      const iCod = l.findIndex((c) => CODIGO_SERVICO.test(c))
      if (iCod < 0) continue
      const codigo = CODIGO_SERVICO.exec(l[iCod])![0]
      const descNaCelula = l[iCod].replace(codigo, '').replace(/^[\s\-–:]+/, '').trim()
      const descricao = (col.descricao >= 0 && col.descricao !== iCod ? l[col.descricao] : descNaCelula) ?? ''
      const qtd = col.quantidade >= 0 ? quantidade(l[col.quantidade]) : null
      const unit = col.unitario >= 0 ? valor(l[col.unitario]) : null
      const total = col.total >= 0 ? valor(l[col.total]) : null
      // Linha de subtotal/total que carrega código: descartada.
      if (/total/.test(semAcento(descricao)) && qtd === null && unit === null) continue
      n++
      itens.push({ codigo, descricao, quantidade: qtd, unitario: unit, total, linha: n })
    }
  }
  return itens
}
