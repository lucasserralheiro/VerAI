import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { identidadeDoContrato } from '@/lib/confere/identidade'
import { localizarContrato, type ContratoParaBusca } from '@/lib/confere/localizar-contrato'
import { alertasDosContratos } from '@/lib/relatorios-clientes/alertas-banco'
import { consolidarContratos, type ContratoConsolidado } from '@/lib/relatorios-clientes/contratos-consolidados'
import { carregarPainelCarteiras, SEM_CARTEIRA, totalizar } from '@/lib/relatorios-clientes/painel-carteiras'

import { chaveDaGerencia, mesmaSigla, siglaComparavel } from './chaves'
import type {
  AvisoContrato,
  CarteiraIntegracao,
  ClienteDetalheIntegracao,
  ClienteIntegracao,
  ContratoIntegracao,
  LocalizacaoIntegracao,
  PedidoLocalizacao,
} from './tipos'

// Consultas da API de plataforma (/api/v1) — contrato consolidado, clientes, localização de contrato. Só leitura, e TODO número de contrato sai de
// `consolidarContratos()` (regra única de contrato — CLAUDE.md): a API nunca recalcula ativo,
// vigência, valor ou saldo. Spec docs/superpowers/specs/2026-10-08-api-plataforma-design.md.

/** Quem consulta pela API. Desde 02/10/2026 todo usuário vê todos os clientes (`clienteIdsPermitidos`
 *  devolve `null`); o que cada aplicativo vê é decidido pelos escopos dele. Se a visibilidade voltar a ser
 *  por cliente, esta conta precisa de decisão própria. */
export const USUARIO_INTEGRACAO: AuthUser = {
  id: 'api-plataforma',
  nome: 'API de plataforma',
  email: 'integracao@verai.local',
  role: 'responsavel',
}

const MAXIMO_DE_ALERTAS = 20
export const MAXIMO_DE_LOCALIZACOES = 500

function urlBase(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/** Data só-dia do banco → "AAAA-MM-DD" (meio-dia UTC acerta 00:00Z e 03:00Z, ver `vencimento.ts`). */
export function diaIso(data: Date | null): string | null {
  return data ? new Date(data.getTime() + 12 * 60 * 60 * 1000).toISOString().slice(0, 10) : null
}

interface ContratoDoBanco {
  id: string
  clienteId: string
  numeroTermo: string | null
  descricao: string | null
  situacao: string | null
  seiProdam: string | null
  seiCliente: string | null
}

export function contratoParaIntegracao(contrato: ContratoDoBanco, k: ContratoConsolidado): ContratoIntegracao {
  const avisos: AvisoContrato[] = []
  if (k.situacaoDesatualizada) avisos.push('situacaoDesatualizada')
  if (k.prorrogacaoEmAndamento) avisos.push('prorrogacaoEmAndamento')
  if (k.valorBase === null) avisos.push('semValor')
  return {
    id: contrato.id,
    numero: contrato.numeroTermo,
    descricao: contrato.descricao,
    situacao: contrato.situacao,
    seiProdam: contrato.seiProdam,
    seiCliente: contrato.seiCliente,
    ativo: k.ativo,
    rescindido: k.rescindido,
    vigenciaFim: diaIso(k.vigenciaFim),
    vencimento: k.vencimento,
    valorContratado: k.valorBase,
    faturado: k.saldo.faturado,
    saldo: k.saldo.saldo,
    percentualFaturado: k.saldo.percentualFaturado,
    avisos,
    url: `${urlBase()}/clientes/${contrato.clienteId}/contratos/${contrato.id}`,
  }
}

/** Ativos primeiro, depois o que vence antes; sem data no fim. */
function ordemDosContratos(a: ContratoIntegracao, b: ContratoIntegracao): number {
  if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
  return (a.vigenciaFim ?? '9999').localeCompare(b.vigenciaFim ?? '9999')
}

const SELECAO_CLIENTE = {
  id: true,
  nome: true,
  siglaLegado: true,
  carteira: { select: { gerencia: { select: { nome: true, sigla: true } } } },
} satisfies Prisma.ClienteSelect

type ClienteDoBanco = {
  id: string
  nome: string
  siglaLegado: string | null
  carteira: { gerencia: { nome: string; sigla: string | null } } | null
}

function carteiraDoCliente(cliente: ClienteDoBanco): ClienteIntegracao['carteira'] {
  const g = cliente.carteira?.gerencia
  return g ? { nome: g.nome, sigla: g.sigla, chave: chaveDaGerencia(g.sigla) ?? chaveDaGerencia(g.nome) } : null
}

export async function listarCarteiras(hoje: Date = new Date()): Promise<CarteiraIntegracao[]> {
  const painel = await carregarPainelCarteiras(USUARIO_INTEGRACAO, hoje)
  return painel.carteiras.map((c) => ({
    id: c.id,
    nome: c.nome,
    sigla: c.sigla,
    chave: c.id === SEM_CARTEIRA ? null : chaveDaGerencia(c.sigla) ?? chaveDaGerencia(c.nome),
    gerentes: c.gerentes,
    totais: c.totais,
  }))
}

/** Clientes com os totais do painel (mesma conta da lista de clientes). `carteira`: chave ("GRC4",
 *  "grc-4") ou "sem"; ausente = todos. */
export async function listarClientes(filtro: { carteira?: string | null }, hoje: Date = new Date()): Promise<ClienteIntegracao[]> {
  const [painel, clientes] = await Promise.all([
    carregarPainelCarteiras(USUARIO_INTEGRACAO, hoje),
    prisma.cliente.findMany({ orderBy: { nome: 'asc' }, select: SELECAO_CLIENTE }),
  ])
  const pedida = filtro.carteira?.trim() || null
  const chavePedida = pedida && pedida !== SEM_CARTEIRA ? chaveDaGerencia(pedida) ?? siglaComparavel(pedida) : null
  return clientes
    .map((cliente) => ({
      id: cliente.id,
      nome: cliente.nome,
      sigla: cliente.siglaLegado,
      carteira: carteiraDoCliente(cliente),
      totais: painel.clientes[cliente.id] ?? totalizar([[]]),
      url: `${urlBase()}/clientes/${cliente.id}`,
    }))
    .filter((c) => {
      if (!pedida) return true
      if (pedida === SEM_CARTEIRA) return c.carteira === null
      return !!c.carteira && (c.carteira.chave ?? siglaComparavel(c.carteira.sigla ?? c.carteira.nome)) === chavePedida
    })
}

export type BuscaDeCliente =
  | { tipo: 'encontrado'; cliente: ClienteDetalheIntegracao }
  | { tipo: 'ambiguo'; candidatos: { id: string; nome: string; sigla: string | null }[] }
  | { tipo: 'nenhum' }

/** Cliente pela sigla do AIBertinho ("SGM", "SP REGULA"); sem sigla igual, pelo nome inteiro. Só
 *  escolhe sozinho quando é único (regra de ouro do projeto). */
export async function buscarClientePorSigla(sigla: string, hoje: Date = new Date()): Promise<BuscaDeCliente> {
  const todos = await prisma.cliente.findMany({ select: { id: true, nome: true, siglaLegado: true } })
  let achados = todos.filter((c) => mesmaSigla(c.siglaLegado, sigla))
  if (achados.length === 0) achados = todos.filter((c) => mesmaSigla(c.nome, sigla))
  if (achados.length === 0) return { tipo: 'nenhum' }
  if (achados.length > 1) {
    return { tipo: 'ambiguo', candidatos: achados.map((c) => ({ id: c.id, nome: c.nome, sigla: c.siglaLegado })) }
  }

  const cliente = await prisma.cliente.findUniqueOrThrow({
    where: { id: achados[0].id },
    select: {
      ...SELECAO_CLIENTE,
      contratos: {
        select: { id: true, clienteId: true, numeroTermo: true, descricao: true, situacao: true, seiProdam: true, seiCliente: true, dataVencimento: true },
      },
    },
  })
  const [consolidados, alertas] = await Promise.all([
    consolidarContratos(cliente.contratos, hoje),
    alertasDosContratos({ clienteIds: null, clienteId: cliente.id }, hoje),
  ])
  const pares = cliente.contratos
    .map((c) => ({ c, k: consolidados.get(c.id) }))
    .filter((p): p is { c: (typeof cliente.contratos)[number]; k: ContratoConsolidado } => !!p.k && !p.k.vazio)

  return {
    tipo: 'encontrado',
    cliente: {
      id: cliente.id,
      nome: cliente.nome,
      sigla: cliente.siglaLegado,
      carteira: carteiraDoCliente(cliente),
      totais: totalizar([pares.map((p) => p.k)]),
      url: `${urlBase()}/clientes/${cliente.id}`,
      contratos: pares.map((p) => contratoParaIntegracao(p.c, p.k)).sort(ordemDosContratos),
      alertas: alertas.slice(0, MAXIMO_DE_ALERTAS).map(({ codigo, nivel, contrato, titulo, detalhe, acao, dias }) => ({
        codigo,
        nivel,
        contrato,
        titulo,
        detalhe,
        acao,
        dias,
      })),
    },
  }
}

/** Resolve os números de contrato do AIBertinho para os contratos do VerAI, pela mesma regra do
 *  Confere (`identidadeDoContrato` + `localizarContrato`). A sigla do cliente que o AIBertinho manda
 *  completa o órgão quando o número não o traz. Nunca escolhe entre dois candidatos. */
export async function localizarContratos(pedidos: PedidoLocalizacao[], hoje: Date = new Date()): Promise<LocalizacaoIntegracao[]> {
  if (pedidos.length === 0) return []
  const contratos = await prisma.contrato.findMany({
    select: {
      id: true,
      clienteId: true,
      numeroTermo: true,
      chaveSharepoint: true,
      descricao: true,
      situacao: true,
      seiProdam: true,
      seiCliente: true,
      dataVencimento: true,
      cliente: { select: { nome: true, siglaLegado: true } },
    },
  })
  const paraBusca: ContratoParaBusca[] = contratos.map((c) => ({
    id: c.id,
    clienteId: c.clienteId,
    clienteNome: c.cliente.nome,
    clienteSigla: c.cliente.siglaLegado,
    numeroTermo: c.numeroTermo,
    chaveSharepoint: c.chaveSharepoint,
  }))

  const resultados = pedidos.map((pedido) => {
    const identidade = identidadeDoContrato(pedido.numero)
    if (!identidade) return { pedido, tipo: 'ilegivel' as const }
    const orgao = identidade.orgao ?? (pedido.cliente ? siglaComparavel(pedido.cliente) || null : null)
    return { pedido, ...localizarContrato({ ...identidade, orgao }, paraBusca) }
  })

  const encontrados = new Set(resultados.flatMap((r) => (r.tipo === 'encontrado' ? [r.contrato.id] : [])))
  const consolidados = await consolidarContratos(
    contratos.filter((c) => encontrados.has(c.id)),
    hoje
  )
  const porId = new Map(contratos.map((c) => [c.id, c]))

  return resultados.map((r): LocalizacaoIntegracao => {
    const numero = r.pedido.numero
    if (r.tipo === 'ilegivel') return { numero, resultado: 'ilegivel' }
    if (r.tipo === 'ambiguo') {
      return {
        numero,
        resultado: 'ambiguo',
        candidatos: r.candidatos.map((c) => ({ id: c.id, numero: c.numeroTermo, cliente: c.clienteSigla ?? c.clienteNome })),
      }
    }
    if (r.tipo === 'nenhum') return { numero, resultado: 'nenhum' }
    const contrato = porId.get(r.contrato.id)!
    const k = consolidados.get(contrato.id)
    if (!k) return { numero, resultado: 'nenhum' }
    return {
      numero,
      resultado: 'encontrado',
      contrato: {
        ...contratoParaIntegracao(contrato, k),
        cliente: { id: contrato.clienteId, nome: contrato.cliente.nome, sigla: contrato.cliente.siglaLegado },
      },
    }
  })
}
