import Decimal from 'decimal.js'
import { camposPorRegra } from '../fichas/regras'
import type { PaginaDeTexto } from '../indexacao/trechos'
import { textoSeguroDeLinha as seguro } from './seguro'
import type { FichaAnexo, FormatoAnexo, ItemDocumento, TipoDocumento } from './tipos'

// Ficha do anexo, montada por regra e sem IA (spec 2026-10-02-assistente-anexos §5).

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const SIGLA = (n: string, ...siglas: string[]) => new RegExp(`(?<![a-z])(${siglas.join('|')})(?![a-z])`).test(n)

function tipoPeloNome(n: string): TipoDocumento | null {
  // Termo de Referência (TR) não é termo de contrato: não roda a leitura de contrato/aditivo.
  if (SIGLA(n, 'tr') || /termo de referencia/.test(n)) return 'outro'
  if (SIGLA(n, 'pc', 'pa') || /proposta/.test(n)) return 'proposta'
  if (SIGLA(n, 'tc', 'ta', 'tap') || /termo|aditivo|prorroga|apostil|rescis/.test(n)) return 'termo'
  if (/controle/.test(n)) return 'controle'
  if (/of[ií]cio|memorando|despacho/.test(n)) return 'oficio'
  return null
}

/** O nome do arquivo decide primeiro; o texto só quando o nome não tem pista. */
export function tipoDoDocumento(nome: string, texto: string, formato: FormatoAnexo): TipoDocumento {
  const n = semAcento(nome)
  const t = semAcento(texto.slice(0, 4000))
  const pelaNome = tipoPeloNome(n)
  if (pelaNome) return pelaNome
  if (/^\s*termo de referencia/m.test(t)) return 'outro'
  if (/proposta comercial/.test(t)) return 'proposta'
  if (/termo (aditivo|de contrato)|apostilamento/.test(t)) return 'termo'
  if (/controle de contratos/.test(t)) return 'controle'
  if (/^\s*(oficio|memorando|despacho)\b/m.test(t)) return 'oficio'
  if (formato === 'xlsx' || formato === 'csv') return 'planilha'
  return 'outro'
}

const ORDINAIS = ['primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'setimo', 'oitavo', 'nono', 'decimo']

/**
 * Identidade do termo no formato de `termoDoTexto` (valores-contratos): "TA3", "TAP2" (apostilamento), "TC0"
 * (contrato). Pelo nome ("TA 03.pdf", "T.A. 04") ou pelo começo do texto ("TERMO ADITIVO Nº 05", "2º TERMO
 * ADITIVO", "TERCEIRO TERMO ADITIVO"). Sem número → null.
 */
export function termoDoAnexo(nome: string, texto: string): string | null {
  const n = semAcento(nome).replace(/_/g, ' ')
  const doNome = /(?<![a-z])(tap|tc|t\.a\.?|ta)\s*[-.nº°o]*\s*(\d{1,3})(?!\d)/.exec(n)
  if (doNome) return doNome[1] === 'tc' ? 'TC0' : `${doNome[1] === 'tap' ? 'TAP' : 'TA'}${Number(doNome[2])}`
  const t = semAcento(texto.slice(0, 1500))
  const especie = (e: string) => (/apostil/.test(e) ? 'TAP' : 'TA')
  const porNumero = /termo\s+(aditivo|de\s+apostilamento)\s*(?:n[º°o.]*\s*)?(\d{1,3})(?!\d)/.exec(t)
  if (porNumero) return `${especie(porNumero[1])}${Number(porNumero[2])}`
  const porOrdinal = /(?<!\d)(\d{1,2})\s*[º°o]\s*termo\s+(aditivo|de\s+apostilamento)/.exec(t)
  if (porOrdinal) return `${especie(porOrdinal[2])}${Number(porOrdinal[1])}`
  const porExtenso = new RegExp(`(${ORDINAIS.join('|')})\\s+termo\\s+(aditivo|de\\s+apostilamento)`).exec(t)
  if (porExtenso) return `${especie(porExtenso[2])}${ORDINAIS.indexOf(porExtenso[1]) + 1}`
  return null
}

/** Tipo de linha do histórico, que escolhe os padrões de leitura (`extrairCampos`). Apostilamento não tem regra própria. */
export function tipoDaLinha(nome: string, texto: string): 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO' {
  const n = semAcento(nome)
  const t = semAcento(texto.slice(0, 1500))
  const de = (x: string) => {
    if (/rescis/.test(x)) return 'RESCISAO' as const
    if (/prorroga/.test(x) || SIGLA(x, 'tap')) return 'PRORROGACAO' as const
    if (/aditivo|apostil/.test(x) || SIGLA(x, 'ta')) return 'ADITIVO' as const
    if (SIGLA(x, 'tc') || /termo de contrato/.test(x)) return 'CONTRATO' as const
    return null
  }
  return de(n) ?? de(t) ?? 'CONTRATO'
}

const ROTULO: Record<TipoDocumento, string> = {
  proposta: 'proposta comercial', termo: 'termo (contrato/aditivo)', controle: 'controle do faturamento', planilha: 'planilha',
  oficio: 'ofício/memorando', outro: 'documento',
}

const ROTULO_CAMPO: Record<string, string> = {
  objeto: 'objeto',
  valorTotal: 'valor',
  vigenciaInicio: 'início',
  vigenciaFim: 'fim',
  vigenciaMeses: 'vigência',
  reajusteIndice: 'reajuste',
  reajustePeriodicidade: 'periodicidade do reajuste',
  garantia: 'garantia',
  multas: 'multas',
  prazoPagamento: 'prazo de pagamento',
  medicao: 'medição',
  alteracoes: 'alterações',
}

function sugestoes(tipo: TipoDocumento, contrato: string | null): string[] {
  const bate = contrato ? `Bate com o contrato ${contrato}?` : 'Bate com o contrato no VerAI?'
  switch (tipo) {
    case 'proposta': return ['Os preços estão certos?', bate, 'Resuma os riscos e prazos.']
    case 'termo': return [bate, 'O que este termo muda?', 'Resuma os riscos e prazos.']
    case 'planilha': return ['Os preços estão certos?', bate, 'Resuma esta planilha.']
    default: return ['Resuma este documento.', 'Quais prazos e valores aparecem?', 'O que precisa de ação?']
  }
}

export function fichaDoAnexo(e: {
  nome: string
  formato: FormatoAnexo
  paginas: PaginaDeTexto[]
  itens: ItemDocumento[]
  entidades: { clienteId: string | null; cliente: string | null; contratoId: string | null; contrato: string | null }
  paginasIlegiveis?: number[]
}): FichaAnexo {
  const texto = e.paginas.map((p) => p.texto).join('\n')
  const tipo = tipoDoDocumento(e.nome, texto, e.formato)
  const tipoLinha = tipo === 'proposta' || tipo === 'termo' ? tipoDaLinha(e.nome, texto) : null
  const camposLidos = tipoLinha ? camposPorRegra(e.paginas, tipoLinha) : {}
  const campos = Object.fromEntries(Object.entries(camposLidos).map(([k, c]) => [k, { valor: c!.valor, pagina: c!.pagina }]))
  const totais = e.itens.map((i) => i.total).filter((t): t is string => t !== null)
  const avisos = [
    ...(e.paginasIlegiveis ?? []).map((p) => `página ${p} ilegível`),
    ...(e.paginas.length === 0 ? ['não foi possível ler o texto deste arquivo'] : []),
  ]
  return {
    tipo,
    ...e.entidades,
    ...(tipo === 'termo' && tipoLinha ? { tipoLinha, termo: termoDoAnexo(e.nome, texto) } : {}),
    campos,
    itens: e.itens.length,
    somaItens: totais.length ? totais.reduce((s, t) => s.plus(t), new Decimal(0)).toFixed(2) : null,
    sugestoes: sugestoes(tipo, e.entidades.contrato),
    avisos,
  }
}

const moeda = (v: string) => `R$ ${new Decimal(v).toNumber().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function textoDaFicha(nome: string, f: FichaAnexo): string {
  const cabeca = [`**${seguro(nome, 120)}** — ${ROTULO[f.tipo]}`, f.cliente && seguro(f.cliente, 120), f.contrato && seguro(f.contrato, 120)].filter(Boolean).join(' · ')
  const linhas = [cabeca, '']
  for (const [k, c] of Object.entries(f.campos)) linhas.push(`- ${ROTULO_CAMPO[k] ?? k}: ${seguro(c.valor, 200)}${c.pagina ? ` (p. ${c.pagina})` : ''}`)
  if (f.itens) linhas.push(`- ${f.itens} itens com código de serviço${f.somaItens ? ` · soma das linhas ${moeda(f.somaItens)}` : ''}`)
  for (const a of f.avisos) linhas.push(`- ⚠ ${seguro(a, 300)}`)
  linhas.push('', `Pergunte, por exemplo: ${f.sugestoes.map((s) => `"${s}"`).join(' · ')}`)
  return linhas.join('\n')
}
