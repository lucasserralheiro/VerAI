import { getDocumentProxy } from 'unpdf'

// Texto do PDF oficial da tabela e do informativo (spec 2026-09-29-tabela-de-precos §4.4). O PDF é a
// referência publicada no DOC; a planilha é a fonte estruturada que ele confere.

/** Todas as páginas, espaços normalizados. */
export async function textoCorrido(conteudo: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(conteudo))
  const partes: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const c = await (await pdf.getPage(p)).getTextContent()
    partes.push(c.items.map((i) => ('str' in i ? i.str : '')).join(' '))
  }
  await pdf.cleanup?.()
  return partes.join(' ').replace(/\s+/g, ' ').trim()
}

const CODIGO_SERVICO = /(?<!\d)\d{2}\.\d{3}\.\d{5}\.\d{2}(?!\d)/g
const PRECO = /(?<![\d.,])(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/
const decimal = (brasileiro: string) => brasileiro.replace(/\./g, '').replace(',', '.')

export interface PrecoNoPdf {
  preco: string | null
  sobDemanda: boolean
}

/** Código → preço: o trecho vai do código até o próximo código; vale o PRIMEIRO valor em R$ (ou "SOB
 *  DEMANDA", o que vier antes). Número de descrição ("10.000 AP") não tem centavos e não casa; o que vem
 *  depois (observações da seção) fica depois do primeiro preço. Primeiro código repetido vence. */
export function precosNoPdf(texto: string): Map<string, PrecoNoPdf> {
  const t = texto.replace(/\s+/g, ' ')
  const achados = [...t.matchAll(CODIGO_SERVICO)]
  const mapa = new Map<string, PrecoNoPdf>()
  achados.forEach((m, i) => {
    if (mapa.has(m[0])) return
    const inicio = m.index! + m[0].length
    const trecho = t.slice(inicio, i + 1 < achados.length ? achados[i + 1].index : t.length)
    const preco = PRECO.exec(trecho)
    const sob = /SOB\s+DEMANDA/i.exec(trecho)
    const sobDemanda = !!sob && (!preco || sob.index < preco.index)
    mapa.set(m[0], { preco: sobDemanda || !preco ? null : decimal(preco[1]), sobDemanda })
  })
  return mapa
}

export interface Informativo {
  versao: string | null
  publicadaEm: Date | null
  alteracoes: { tipo: 'preco' | 'novo' | 'retorno'; nome: string }[]
  codigos: string[]
}

const TIPO_ALTERACAO: Record<string, 'preco' | 'novo' | 'retorno'> = { ALTERACAO: 'preco', NOVO: 'novo', RETORNO: 'retorno' }

export function lerInformativo(texto: string): Informativo {
  const t = texto.replace(/\s+/g, ' ')
  const versao = /[ÚU]ltima Vers[ãa]o publicada:\s*(\d{4})\s*v(\d+(?:\.\d+)?)/i.exec(t)
  const data = /Publica[çc][ãa]o no Di[áa]rio Oficial:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(t)
  const alteracoes = [...t.matchAll(/(ALTERA[ÇC][ÃA]O DE PRE[ÇC]OS|NOVO PRODUTO|RETORNO DE ITEM)\s*[—–-]\s*(\S+)/gi)].map((m) => ({
    tipo: TIPO_ALTERACAO[m[1].normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(' ')[0]],
    nome: m[2],
  }))
  return {
    versao: versao ? `${versao[1]} v${versao[2]}` : null,
    publicadaEm: data ? new Date(Date.UTC(Number(data[3]), Number(data[2]) - 1, Number(data[1]))) : null,
    alteracoes,
    codigos: [...new Set([...t.matchAll(CODIGO_SERVICO)].map((m) => m[0]))],
  }
}
