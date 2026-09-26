import type { PaginaDeTexto } from '@/lib/assistente/indexacao/trechos'
import { extrairCampos } from '@/lib/importacao-sharepoint/texto'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { TAMANHO_TRECHO_FICHA, type CampoFicha, type CamposFicha } from './campos'

/**
 * Campos da ficha lidos por regra, sem IA (spec fase 2 §5.2, etapa 1): o que `extrairCampos` já lê na
 * sincronização (objeto, valor, vigência) mais palavras-chave de reajuste, garantia e pagamento. Cada
 * campo sai com a página e uma janela do texto em volta como trecho.
 */

interface Achado {
  pagina: number | null
  indice: number
  texto: string
  comprimento: number
}

function acharNasPaginas(paginas: PaginaDeTexto[], padrao: RegExp): (Achado & { casamento: RegExpExecArray }) | null {
  for (const p of paginas) {
    padrao.lastIndex = 0
    const m = padrao.exec(p.texto)
    if (m) return { pagina: p.pagina, indice: m.index, texto: p.texto, comprimento: m[0].length, casamento: m }
  }
  return null
}

function janela(a: Achado): string {
  const folga = Math.max(0, Math.floor((TAMANHO_TRECHO_FICHA - a.comprimento) / 2))
  return a.texto.slice(Math.max(0, a.indice - folga), a.indice + a.comprimento + folga).slice(0, TAMANHO_TRECHO_FICHA).trim()
}

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function campoDoTexto(paginas: PaginaDeTexto[], valor: string, procurar: string | RegExp): CampoFicha {
  const achado = acharNasPaginas(paginas, typeof procurar === 'string' ? new RegExp(escapar(procurar)) : procurar)
  return { valor, pagina: achado?.pagina ?? null, trecho: achado ? janela(achado) : null, fonte: 'regra' }
}

/** Ordem importa: o mais específico antes (IPCA-E antes de IPCA, IPC-FIPE antes de IPC). */
const INDICES: [string, RegExp][] = [
  ['IPCA-E', /\bIPCA[\s-]*E\b/i],
  // "IPC/FIPE", "IPC-FIPE" ou o nome por extenso no meio ("IPC – Índice de Preços ao Consumidor, apurado pela FIPE").
  ['IPC-FIPE', /\bIPC\b[^.\n]{0,80}?\bFIPE\b/i],
  ['IPCA', /\bIPCA\b/i],
  ['INPC', /\bINPC\b/i],
  ['IGP-M', /\bIGP[\s-]*M\b/i],
  ['IGP-DI', /\bIGP[\s-]*DI\b/i],
  ['ICTI', /\bICTI\b/],
  ['IST', /\bIST\b/],
]

const GARANTIA = /(cau[cç][aã]o|seguro[\s-]*garantia|fian[cç]a\s+banc[aá]ria)/i
const NOME_GARANTIA = (bruto: string) =>
  /cau/i.test(bruto) ? 'caução' : /seguro/i.test(bruto) ? 'seguro-garantia' : 'fiança bancária'
const PERCENTUAL = /(\d{1,2}(?:,\d+)?)\s*%/
const PAGAMENTO =
  /(\d{1,3})\s*(?:\([^)]{0,30}\))?\s*dias[^.]{0,120}?pagamento|pagamento[^.]{0,120}?(\d{1,3})\s*(?:\([^)]{0,30}\))?\s*dias/i

type TipoTermo = 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO'
const tipoTermo = (tipoLinha: string): TipoTermo =>
  tipoLinha === 'ADITIVO' || tipoLinha === 'PRORROGACAO' || tipoLinha === 'RESCISAO' ? tipoLinha : 'CONTRATO'

export function camposPorRegra(paginas: PaginaDeTexto[], tipoLinha: string): CamposFicha {
  const campos: CamposFicha = {}
  const lidos = extrairCampos(paginas.map((p) => p.texto).join('\n'), tipoTermo(tipoLinha))

  if (lidos.objeto) campos.objeto = campoDoTexto(paginas, lidos.objeto.slice(0, TAMANHO_TRECHO_FICHA), lidos.objeto.slice(0, 60))
  if (lidos.valor) {
    const moeda = formatarMoeda(lidos.valor)
    campos.valorTotal = campoDoTexto(paginas, moeda, moeda.replace(/^R\$\s*/, ''))
  }
  if (lidos.inicio) campos.vigenciaInicio = campoDoTexto(paginas, formatarData(lidos.inicio.toISOString()), formatarData(lidos.inicio.toISOString()))
  if (lidos.fim) campos.vigenciaFim = campoDoTexto(paginas, formatarData(lidos.fim.toISOString()), formatarData(lidos.fim.toISOString()))
  if (lidos.meses) campos.vigenciaMeses = campoDoTexto(paginas, `${lidos.meses} meses`, new RegExp(`\\b${lidos.meses}\\s*(?:\\([^)]{0,20}\\))?\\s*meses`, 'i'))

  for (const [nome, padrao] of INDICES) {
    const achado = acharNasPaginas(paginas, padrao)
    if (achado) {
      campos.reajusteIndice = { valor: nome, pagina: achado.pagina, trecho: janela(achado), fonte: 'regra' }
      break
    }
  }

  const garantia = acharNasPaginas(paginas, GARANTIA)
  if (garantia) {
    const trecho = janela(garantia)
    const percentual = PERCENTUAL.exec(garantia.texto.slice(garantia.indice, garantia.indice + 150))
    campos.garantia = { valor: [NOME_GARANTIA(garantia.casamento[1]), percentual ? `${percentual[1]}%` : null].filter(Boolean).join(', '), pagina: garantia.pagina, trecho, fonte: 'regra' }
  }

  const pagamento = acharNasPaginas(paginas, PAGAMENTO)
  if (pagamento) {
    campos.prazoPagamento = { valor: `${pagamento.casamento[1] ?? pagamento.casamento[2]} dias`, pagina: pagamento.pagina, trecho: janela(pagamento), fonte: 'regra' }
  }
  return campos
}
