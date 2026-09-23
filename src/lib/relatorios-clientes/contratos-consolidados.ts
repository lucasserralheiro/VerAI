import { prisma } from '@/lib/prisma'
import { contratoAtivo, contratoVazio, vigenciaEfetiva } from './regras'
import { calcularSaldo, type Saldo } from './saldo'
import { saldosDosContratos } from './saldos-contratos'
import { baseDoContrato } from './valor-contratado'
import { resumirHistorico, type LinhaResumoHistorico, type ResumoHistorico } from './resumo-historico'
import { situacaoVencimento, type SituacaoVencimento } from './vencimento'

/**
 * FONTE ÚNICA de "o que é um contrato" para qualquer tela ou relatório: ficha do cliente (cartões),
 * aba Contratos, detalhe do contrato, vencimentos, valor total e status de faturamento passam todos
 * por aqui. Antes cada rota recalculava por conta própria (ativo pela data do cabeçalho, valor pelos
 * itens numa tela e pelo histórico em outra) e os números divergiam entre telas.
 *
 * Regras (as mesmas em todo lugar):
 *  - Vigência efetiva = a MAIOR data de vencimento entre o cabeçalho do contrato e as linhas do
 *    histórico (aditivo/prorrogação estendem o prazo; o cabeçalho do legado quase nunca é
 *    atualizado). Prospecção (proposta não assinada) e rescisão não estendem nada.
 *  - Ativo = não é linha vazia, não foi rescindido (linha RESCISAO no histórico) e passa em
 *    `contratoAtivo`: situação "Ativo" vale mesmo com data vencida (a data vira alerta); sem
 *    situação, a vigência efetiva decide.
 *  - Valor contratado = valor atual do histórico; sem ele, a soma dos itens vinculados; sem
 *    nenhum dos dois, `null` (o contrato fica fora das somas e as telas avisam).
 *  - Saldo/% faturado usam SEMPRE essa mesma base, nunca só os itens.
 */

export type LinhaHistoricoConsolidacao = LinhaResumoHistorico & { dataVencimento: Date | null }

export interface ContratoConsolidado {
  /** Fim de vigência efetivo (ver regras acima); `null` quando nem o cabeçalho nem o histórico têm data. */
  vigenciaFim: Date | null
  vencimento: SituacaoVencimento
  rescindido: boolean
  /** Linha vazia do legado (ver `contratoVazio`): não conta como contrato. */
  vazio: boolean
  ativo: boolean
  resumoHistorico: ResumoHistorico
  /** Base do valor contratado (string decimal) ou `null` quando o contrato não tem valor nenhum. */
  valorBase: string | null
  /** Saldo calculado sobre `valorBase`; `saldo`/`percentualFaturado` ficam `null` sem base. */
  saldo: Saldo
}

export interface EntradaContrato {
  id: string
  situacao: string | null
  dataVencimento: Date | null
}

/** Consolida UM contrato a partir do que já foi carregado (função pura — testável sem banco). */
export function consolidarContrato(
  contrato: EntradaContrato,
  linhas: LinhaHistoricoConsolidacao[],
  saldoDosItens: Saldo,
  hoje: Date,
  vazio = false
): ContratoConsolidado {
  const vigenciaFim = vigenciaEfetiva(contrato.dataVencimento, linhas)
  const rescindido = linhas.some((linha) => linha.tipo === 'RESCISAO')
  const resumoHistorico = resumirHistorico(linhas)
  const valorBase = baseDoContrato(resumoHistorico.valorAtual?.valor ?? null, saldoDosItens.valorItens)
  return {
    vigenciaFim,
    vencimento: situacaoVencimento(vigenciaFim, hoje),
    rescindido,
    vazio,
    ativo: !vazio && !rescindido && contratoAtivo({ situacao: contrato.situacao, dataVencimento: vigenciaFim }, hoje),
    resumoHistorico,
    valorBase,
    saldo: calcularSaldo({ valorItens: valorBase, faturado: saldoDosItens.faturado }),
  }
}

/** Carrega histórico + saldos de uma lista de contratos (3 consultas, sem N+1) e consolida cada um. */
export async function consolidarContratos(
  contratos: EntradaContrato[],
  hoje: Date = new Date()
): Promise<Map<string, ContratoConsolidado>> {
  const consolidados = new Map<string, ContratoConsolidado>()
  if (contratos.length === 0) return consolidados

  const ids = contratos.map((contrato) => contrato.id)
  const [linhasHistorico, saldos, identidades] = await Promise.all([
    prisma.historicoContrato.findMany({
      where: { contratoId: { in: ids } },
      select: {
        contratoId: true,
        tipo: true,
        data: true,
        createdAt: true,
        numero: true,
        proposta: true,
        valor: true,
        dataVencimento: true,
        propostaPdfUrl: true,
        propostaPdfNome: true,
        termoPdfUrl: true,
        termoPdfNome: true,
      },
    }),
    saldosDosContratos(ids),
    prisma.contrato.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        numeroTermo: true,
        descricao: true,
        seiCliente: true,
        seiProdam: true,
        dataInicio: true,
        dataVencimento: true,
        _count: { select: { historico: true, itens: true, faturamentos: true } },
      },
    }),
  ])
  const vazios = new Set(
    identidades
      .filter((c) =>
        contratoVazio({ ...c, historico: c._count.historico, itens: c._count.itens, faturamentos: c._count.faturamentos })
      )
      .map((c) => c.id)
  )

  const porContrato = new Map<string, LinhaHistoricoConsolidacao[]>()
  for (const { contratoId, ...linha } of linhasHistorico) {
    porContrato.set(contratoId, [...(porContrato.get(contratoId) ?? []), linha])
  }
  for (const contrato of contratos) {
    consolidados.set(
      contrato.id,
      consolidarContrato(contrato, porContrato.get(contrato.id) ?? [], saldos.get(contrato.id)!, hoje, vazios.has(contrato.id))
    )
  }
  return consolidados
}
