import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calcularSaldo, type Saldo } from './saldo'

/**
 * Saldo de cada contrato, agregado no banco sob demanda (sem campo cacheado — plano, "Saldo"):
 * soma de `ItemContrato.valorTotal` dos itens vinculados − soma de `NotaFiscal.valor` dos
 * faturamentos do contrato. Duas consultas pra qualquer quantidade de contratos.
 */
export async function saldosDosContratos(contratoIds: string[]): Promise<Map<string, Saldo>> {
  const saldos = new Map<string, Saldo>()
  if (contratoIds.length === 0) return saldos

  const [itens, notas] = await Promise.all([
    prisma.itemContrato.groupBy({
      by: ['contratoId'],
      where: { contratoId: { in: contratoIds } },
      _sum: { valorTotal: true },
    }),
    // NotaFiscal só chega ao contrato via Faturamento — o groupBy do Prisma não agrupa por campo
    // de relação, então a soma vai em SQL.
    prisma.$queryRaw<Array<{ contratoId: string; faturado: Prisma.Decimal | null }>>`
      SELECT f."contratoId" AS "contratoId", SUM(n."valor") AS "faturado"
      FROM "NotaFiscal" n
      JOIN "Faturamento" f ON f."id" = n."faturamentoId"
      WHERE f."contratoId" IN (${Prisma.join(contratoIds)})
      GROUP BY f."contratoId"
    `,
  ])

  const valorItens = new Map(itens.map((linha) => [linha.contratoId, linha._sum.valorTotal]))
  const faturado = new Map(notas.map((linha) => [linha.contratoId, linha.faturado]))
  for (const id of contratoIds) {
    saldos.set(id, calcularSaldo({ valorItens: valorItens.get(id) ?? null, faturado: faturado.get(id) ?? null }))
  }
  return saldos
}
