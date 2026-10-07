import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { consolidarContratos, type ContratoConsolidado } from './contratos-consolidados'
import { calcularSaldo } from './saldo'

/**
 * Painel da lista de clientes agrupada por carteira (gerência). Os números saem SEMPRE de
 * `consolidarContratos()` — a mesma regra da ficha, da aba Contratos e de /api/relatorios/valor-total —
 * e são somados aqui, no servidor, em decimal (nunca em `number` no navegador).
 *
 * Três níveis com a MESMA forma (`TotaisCarteira`): o cliente, a carteira (soma dos clientes dela) e o
 * geral (soma de todos os visíveis). Assim a tela mostra o total do nível em que está sem fazer conta.
 */

/** Id da pasta dos clientes que ainda não estão em carteira nenhuma. */
export const SEM_CARTEIRA = 'sem'

export interface TotaisCarteira {
  clientes: number
  /** Clientes com pelo menos um contrato ativo. */
  clientesComContratoAtivo: number
  contratosAtivos: number
  /** Ativos sem valor nenhum (histórico nem itens): ficam fora das somas, a tela avisa. */
  contratosSemValor: number
  valorContratado: string
  faturado: string
  saldo: string | null
  percentualFaturado: string | null
  /** Ativos com a vigência já vencida (situação "Ativo" desatualizada). */
  vencidos: number
  /** Ativos que vencem em até 30 dias. */
  vencem30: number
  /** Ativos que vencem em até 90 dias (inclui os de 30). */
  vencem90: number
}

export interface CarteiraDoPainel {
  /** Id da gerência, ou `SEM_CARTEIRA`. */
  id: string
  nome: string
  sigla: string | null
  /** Nome dos managers da gerência (vazio = sem gerente definido). */
  gerentes: string[]
  totais: TotaisCarteira
}

export interface PainelCarteiras {
  geral: TotaisCarteira
  carteiras: CarteiraDoPainel[]
  /** Totais de cada cliente visível, por id. */
  clientes: Record<string, TotaisCarteira>
}

type ContratoParaTotal = Pick<ContratoConsolidado, 'ativo' | 'valorBase' | 'vencimento'> & {
  saldo: Pick<ContratoConsolidado['saldo'], 'faturado'>
}

/** Soma os contratos de uma lista de clientes (cada item = contratos de UM cliente). Função pura. */
export function totalizar(clientes: ContratoParaTotal[][]): TotaisCarteira {
  let valor = new Prisma.Decimal(0)
  let faturado = new Prisma.Decimal(0)
  let clientesComContratoAtivo = 0
  let contratosAtivos = 0
  let contratosSemValor = 0
  let vencidos = 0
  let vencem30 = 0
  let vencem90 = 0

  for (const contratos of clientes) {
    let temAtivo = false
    for (const contrato of contratos) {
      if (!contrato.ativo) continue
      temAtivo = true
      contratosAtivos++
      const nivel = contrato.vencimento.nivel
      if (nivel === 'vencido') vencidos++
      if (nivel === 'critico') vencem30++
      if (nivel === 'critico' || nivel === 'atencao') vencem90++
      // Valor e faturado dos MESMOS contratos (mesma regra de /api/relatorios/valor-total): contrato sem
      // valor fica fora das duas somas, senão o % faturado sai maior que o real.
      if (contrato.valorBase === null) {
        contratosSemValor++
        continue
      }
      valor = valor.plus(contrato.valorBase)
      faturado = faturado.plus(contrato.saldo.faturado)
    }
    if (temAtivo) clientesComContratoAtivo++
  }

  const saldo = calcularSaldo({ valorItens: valor, faturado })
  return {
    clientes: clientes.length,
    clientesComContratoAtivo,
    contratosAtivos,
    contratosSemValor,
    valorContratado: saldo.valorItens,
    faturado: saldo.faturado,
    saldo: saldo.saldo,
    percentualFaturado: saldo.percentualFaturado,
    vencidos,
    vencem30,
    vencem90,
  }
}

interface ClienteDoPainel {
  id: string
  gerenciaId: string | null
  contratos: ContratoParaTotal[]
}
interface GerenciaDoPainel {
  id: string
  nome: string
  sigla: string | null
  ativa: boolean
  gerentes: string[]
}

/** Monta o painel a partir do que já foi carregado (função pura). Gerência ativa aparece mesmo vazia;
 *  inativa só se ainda tiver cliente. "Sem carteira" só aparece quando há cliente sem gerência. */
export function montarPainel(clientes: ClienteDoPainel[], gerencias: GerenciaDoPainel[]): PainelCarteiras {
  const porGerencia = new Map<string, ClienteDoPainel[]>()
  const conhecidas = new Set(gerencias.map((g) => g.id))
  for (const cliente of clientes) {
    const chave = cliente.gerenciaId && conhecidas.has(cliente.gerenciaId) ? cliente.gerenciaId : SEM_CARTEIRA
    porGerencia.set(chave, [...(porGerencia.get(chave) ?? []), cliente])
  }

  const carteiras: CarteiraDoPainel[] = gerencias
    .filter((g) => g.ativa || porGerencia.has(g.id))
    .map((g) => ({
      id: g.id,
      nome: g.nome,
      sigla: g.sigla,
      gerentes: g.gerentes,
      totais: totalizar((porGerencia.get(g.id) ?? []).map((c) => c.contratos)),
    }))
  const semCarteira = porGerencia.get(SEM_CARTEIRA)
  if (semCarteira) {
    carteiras.push({
      id: SEM_CARTEIRA,
      nome: 'Sem carteira',
      sigla: null,
      gerentes: [],
      totais: totalizar(semCarteira.map((c) => c.contratos)),
    })
  }

  return {
    geral: totalizar(clientes.map((c) => c.contratos)),
    carteiras,
    clientes: Object.fromEntries(clientes.map((c) => [c.id, totalizar([c.contratos])])),
  }
}

/** Painel dos clientes visíveis ao usuário: 3 consultas + as 3 do `consolidarContratos`, sem N+1. */
export async function carregarPainelCarteiras(usuario: AuthUser, hoje: Date = new Date()): Promise<PainelCarteiras> {
  const [clientes, gerencias] = await Promise.all([
    prisma.cliente.findMany({
      where: await clientesVisiveisWhere(usuario),
      select: {
        id: true,
        carteira: { select: { gerenciaId: true } },
        contratos: { select: { id: true, situacao: true, dataVencimento: true } },
      },
    }),
    prisma.gerencia.findMany({
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        sigla: true,
        ativa: true,
        membros: {
          where: { papel: 'manager' },
          orderBy: { usuario: { nome: 'asc' } },
          select: { usuario: { select: { nome: true } } },
        },
      },
    }),
  ])

  const consolidados = await consolidarContratos(
    clientes.flatMap((c) => c.contratos),
    hoje
  )

  return montarPainel(
    clientes.map((c) => ({
      id: c.id,
      gerenciaId: c.carteira?.gerenciaId ?? null,
      contratos: c.contratos
        .map((contrato) => consolidados.get(contrato.id))
        .filter((k): k is ContratoConsolidado => !!k && !k.vazio),
    })),
    gerencias.map(({ membros, ...g }) => ({ ...g, gerentes: membros.map((m) => m.usuario.nome) }))
  )
}
