import Decimal from 'decimal.js'
import { camposPorRegra } from '../fichas/regras'
import type { PaginaDeTexto } from '../indexacao/trechos'
import { lerConversa } from './conversa'
import type { FichaAnexo, FormatoAnexo, ItemDocumento, TipoDocumento } from './tipos'

// Ficha do anexo, montada por regra e sem IA (spec 2026-10-02-assistente-anexos §5).

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function tipoDoDocumento(nome: string, texto: string, formato: FormatoAnexo): TipoDocumento {
  if (formato === 'eml') return 'email'
  const n = semAcento(nome)
  const t = semAcento(texto.slice(0, 4000))
  if (formato === 'txt') {
    const f = lerConversa(texto).formato
    if (f) return f === 'email' ? 'email' : 'conversa'
  }
  if (/\b(pc|pa)\b|proposta/.test(n) || /proposta comercial/.test(t)) return 'proposta'
  if (/\b(tc|ta|tap)\b|termo|aditivo|prorroga|apostil/.test(n) || /termo (aditivo|de contrato)|apostilamento/.test(t)) return 'termo'
  if (/controle/.test(n) || /controle de contratos/.test(t)) return 'controle'
  if (/of[ií]cio|memorando|despacho/.test(n) || /^\s*(oficio|memorando|despacho)\b/m.test(t)) return 'oficio'
  if (formato === 'xlsx' || formato === 'csv') return 'planilha'
  return 'outro'
}

const ROTULO: Record<TipoDocumento, string> = {
  proposta: 'proposta comercial', termo: 'termo (contrato/aditivo)', controle: 'controle do faturamento', planilha: 'planilha',
  oficio: 'ofício/memorando', email: 'e-mail', conversa: 'conversa', outro: 'documento',
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
    case 'conversa':
    case 'email': return ['O que foi combinado e quem ficou de fazer o quê?', 'Algo aqui contradiz o contrato?', 'Qual o próximo passo?']
    default: return ['Resuma este documento.', 'Quais prazos e valores aparecem?', 'O que precisa de ação?']
  }
}

export function fichaDoAnexo(e: {
  nome: string
  formato: FormatoAnexo
  paginas: PaginaDeTexto[]
  itens: ItemDocumento[]
  entidades: { clienteId: string | null; cliente: string | null; contratoId: string | null; contrato: string | null }
  anexosDoEmail?: string[]
  paginasIlegiveis?: number[]
}): FichaAnexo {
  const texto = e.paginas.map((p) => p.texto).join('\n')
  const tipo = tipoDoDocumento(e.nome, texto, e.formato)
  const camposLidos = tipo === 'proposta' || tipo === 'termo' ? camposPorRegra(e.paginas, 'CONTRATO') : {}
  const campos = Object.fromEntries(Object.entries(camposLidos).map(([k, c]) => [k, { valor: c!.valor, pagina: c!.pagina }]))
  const totais = e.itens.map((i) => i.total).filter((t): t is string => t !== null)
  const conv = lerConversa(texto)
  const conversa = conv.formato
    ? {
        participantes: [...new Set(conv.mensagens.map((m) => m.autor))].filter((a) => a !== '(texto colado)'),
        inicio: conv.mensagens.find((m) => m.quando)?.quando ?? null,
        fim: [...conv.mensagens].reverse().find((m) => m.quando)?.quando ?? null,
        mensagens: conv.mensagens.length,
      }
    : null
  const avisos = [
    ...(e.paginasIlegiveis ?? []).map((p) => `página ${p} ilegível`),
    ...(e.paginas.length === 0 ? ['não foi possível ler o texto deste arquivo'] : []),
  ]
  return {
    tipo,
    ...e.entidades,
    campos,
    itens: e.itens.length,
    somaItens: totais.length ? totais.reduce((s, t) => s.plus(t), new Decimal(0)).toFixed(2) : null,
    conversa,
    anexosDoEmail: e.anexosDoEmail ?? [],
    sugestoes: sugestoes(tipo, e.entidades.contrato),
    avisos,
  }
}

const moeda = (v: string) => `R$ ${new Decimal(v).toNumber().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function textoDaFicha(nome: string, f: FichaAnexo): string {
  const cabeca = [`**${nome}** — ${ROTULO[f.tipo]}`, f.cliente, f.contrato].filter(Boolean).join(' · ')
  const linhas = [cabeca, '']
  for (const [k, c] of Object.entries(f.campos)) linhas.push(`- ${ROTULO_CAMPO[k] ?? k}: ${c.valor}${c.pagina ? ` (p. ${c.pagina})` : ''}`)
  if (f.itens) linhas.push(`- ${f.itens} itens com código de serviço${f.somaItens ? ` · soma das linhas ${moeda(f.somaItens)}` : ''}`)
  if (f.conversa) linhas.push(`- ${f.conversa.mensagens} mensagens de ${f.conversa.participantes.join(', ')}${f.conversa.inicio ? ` · ${f.conversa.inicio} a ${f.conversa.fim}` : ''}`)
  if (f.anexosDoEmail.length) linhas.push(`- anexos do e-mail (não lidos): ${f.anexosDoEmail.join(', ')}`)
  for (const a of f.avisos) linhas.push(`- ⚠ ${a}`)
  linhas.push('', `Pergunte, por exemplo: ${f.sugestoes.map((s) => `"${s}"`).join(' · ')}`)
  return linhas.join('\n')
}
