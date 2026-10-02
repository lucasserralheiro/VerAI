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
  const t = texto.trim()
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return t.replace(/\./g, '')
  return valor(t)
}

type Colunas = { codigo: number; descricao: number; quantidade: number; unitario: number; total: number }

function colunasDoCabecalho(cab: string[]): Colunas {
  const achar = (re: RegExp) => cab.findIndex((c) => re.test(semAcento(c)))
  const unitario = achar(/unit|preco|valor unit/)
  const total = achar(/total/)
  return {
    codigo: achar(/codigo|cod\b|servico/),
    descricao: achar(/descri|servico|item de servico/),
    quantidade: achar(/qtde|quant|qtd/),
    unitario: unitario >= 0 ? unitario : achar(/^valor|preco/),
    total,
  }
}

export function itensDasTabelas(html: string): ItemDocumento[] {
  const itens: ItemDocumento[] = []
  for (const tabela of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const linhas = (tabela.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map(celulas).filter((l) => l.length > 0)
    if (linhas.length < 2) continue
    const iCab = linhas.findIndex((l) => !l.some((c) => CODIGO_SERVICO.test(c)))
    const col = colunasDoCabecalho(iCab >= 0 ? linhas[iCab] : [])
    let n = 0
    for (const l of linhas.slice(iCab + 1)) {
      const iCod = l.findIndex((c) => CODIGO_SERVICO.test(c))
      if (iCod < 0) continue
      n++
      const codigo = CODIGO_SERVICO.exec(l[iCod])![0]
      const descNaCelula = l[iCod].replace(codigo, '').replace(/^[\s\-–:]+/, '').trim()
      const descricao = col.descricao >= 0 && col.descricao !== iCod ? l[col.descricao] : descNaCelula
      itens.push({
        codigo,
        descricao: descricao ?? '',
        quantidade: col.quantidade >= 0 ? quantidade(l[col.quantidade]) : null,
        unitario: col.unitario >= 0 && col.unitario !== col.total ? valor(l[col.unitario]) : null,
        total: col.total >= 0 ? valor(l[col.total]) : null,
        linha: n,
      })
    }
  }
  return itens
}
