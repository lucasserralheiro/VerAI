import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { alertasDosContratos } from '@/lib/relatorios-clientes/alertas-banco'
import type { Alerta } from '@/lib/relatorios-clientes/alertas'
import { clienteIdsPermitidos, podeVerCliente } from '@/lib/visibilidade'
import { proximosDoFaturamento } from '@/lib/calendario/consultas'
import { quandoTexto, ROTULO_TIPO } from '@/lib/calendario/tipos'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { SELECT_CONTRATO } from '@/app/api/contratos/esquema'
import { apelidosDoCliente } from './apelidos'
import { moeda, resumirContrato, type ContextoFerramenta, type ContratoResumido } from './ferramentas/comum'

// Resposta do cliente montada pelo código, sem IA (spec 2026-09-30-assistente-consultor §3).

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const tokens = (t: string) => semAcento(t).replace(/[^a-z0-9-]+/g, ' ').trim().split(' ').filter(Boolean)

/** Só palavras que não mudam o pedido. Mais estreito que `PALAVRAS_DE_LIGACAO` (apelidos.ts) de propósito:
 *  "quanto falta faturar da saúde?" e "contratos da SMS" são perguntas e vão à IA. */
const SO_CLIENTE = new Set([
  'o', 'a', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'me', 'fale', 'fala', 'sobre', 'tudo', 'cliente',
  'resumo', 'mostra', 'mostre', 'ver', 'quero', 'como', 'esta', 'ta', 'situacao', 'geral', 'por', 'favor',
])

/** A mensagem, tirando palavras de ligação, é só a referência ao cliente? */
export function mensagemSoCliente(pergunta: string, cliente: { nome: string; siglaLegado: string | null }): boolean {
  const resto = tokens(pergunta).filter((t) => !SO_CLIENTE.has(t))
  if (resto.length === 0) return false
  const referencias = [cliente.siglaLegado, cliente.nome, ...apelidosDoCliente(cliente)].filter((r): r is string => !!r).map((r) => tokens(r).join(' '))
  return referencias.includes(resto.join(' '))
}

export type ContratoDaResposta = ContratoResumido & { valores: { valor: string | null; faturado: string; saldo: string | null } }

export interface DadosCliente {
  id: string
  nome: string
  sigla: string | null
  contratos: ContratoDaResposta[]
  alertas: Pick<Alerta, 'nivel' | 'titulo' | 'contrato' | 'contratoId'>[]
  proximoPrazo: { tipo: string; data: string; quando: string } | null
}

const ICONE: Record<string, string> = { critico: '🔴', atencao: '🟠', info: '🔵' }
const MAX_ALERTAS = 5

export function respostaDoCliente(d: DadosCliente): string {
  const ativos = d.contratos.filter((c) => c.ativo)
  const comValor = ativos.filter((c) => c.valores.valor !== null)
  const soma = (f: (c: ContratoDaResposta) => string | null) => comValor.reduce((s, c) => s.plus(f(c) ?? 0), new Decimal(0)).toFixed(2)
  const semValor = ativos.length - comValor.length
  const titulo = `**${d.sigla ? `${d.sigla} – ` : ''}${d.nome}**`
  const linhas = [
    `${titulo}: ${ativos.length} contrato${ativos.length === 1 ? '' : 's'} ativo${ativos.length === 1 ? '' : 's'} · valor ${moeda(soma((c) => c.valores.valor))} · faturado ${moeda(soma((c) => c.valores.faturado))} · saldo ${moeda(soma((c) => c.valores.saldo))}${semValor ? ` (${semValor} sem valor cadastrado, fora das somas)` : ''}`,
    '',
  ]
  const proximo = ativos.filter((c) => c.diasParaVencer !== null && c.diasParaVencer >= 0).sort((a, b) => a.diasParaVencer! - b.diasParaVencer!)[0]
  if (proximo) linhas.push(`- Próximo vencimento: [${proximo.numero}](contrato:${proximo.id}) em ${proximo.fimVigencia} (${proximo.diasParaVencer} dias)`)
  if (d.proximoPrazo) linhas.push(`- Próximo prazo do faturamento: ${d.proximoPrazo.tipo} em ${d.proximoPrazo.data} (${d.proximoPrazo.quando})`)
  if (d.alertas.length) {
    linhas.push('', '**Atenção**')
    for (const a of d.alertas.slice(0, MAX_ALERTAS)) linhas.push(`- ${ICONE[a.nivel] ?? '•'} ${a.titulo}${a.contratoId ? ` — [${a.contrato}](contrato:${a.contratoId})` : ''}`)
  }
  linhas.push('', `[Abrir o cliente](cliente:${d.id}) · Pergunte, por exemplo: "quanto falta faturar?" ou "o que vence este ano?"`)
  return linhas.join('\n')
}

export function respostaDeAmbiguidade(candidatos: { nome: string; sigla: string | null }[]): string {
  return ['Encontrei mais de um cliente. Qual deles?', ...candidatos.map((c) => `- ${c.sigla ? `${c.sigla} – ` : ''}${c.nome}`)].join('\n')
}

export async function dadosDoCliente(clienteId: string, { usuario, hoje }: ContextoFerramenta): Promise<DadosCliente | null> {
  if (!(await podeVerCliente(usuario, clienteId))) return null
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true, siglaLegado: true, contratos: { select: SELECT_CONTRATO } } })
  if (!cliente) return null
  const [consolidados, alertas, prazos] = await Promise.all([
    consolidarContratos(cliente.contratos, hoje),
    alertasDosContratos({ clienteIds: await clienteIdsPermitidos(usuario), clienteId }, hoje),
    proximosDoFaturamento(1, hoje),
  ])
  const contratos = cliente.contratos
    .map((c) => ({ c, k: consolidados.get(c.id)! }))
    .filter(({ k }) => !k.vazio)
    .map(({ c, k }) => ({
      ...resumirContrato(c, k),
      valores: { valor: k.valorBase === null ? null : k.valorBase.toString(), faturado: k.saldo.faturado.toString(), saldo: k.saldo.saldo === null ? null : k.saldo.saldo.toString() },
    }))
  const [p] = prazos
  return {
    id: cliente.id,
    nome: cliente.nome,
    sigla: cliente.siglaLegado,
    contratos,
    alertas,
    proximoPrazo: p ? { tipo: ROTULO_TIPO[p.tipo], data: formatarData(p.inicio), quando: quandoTexto(p) } : null,
  }
}
