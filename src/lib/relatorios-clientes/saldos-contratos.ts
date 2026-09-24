import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calcularSaldo, type Saldo } from './saldo'

/**
 * Saldo de cada contrato, agregado no banco sob demanda (sem campo cacheado — plano, "Saldo"):
 * soma de `ItemContrato.valorTotal` dos itens vinculados − soma do faturado dos
 * faturamentos do contrato (valor lançado ou, sem ele, as notas fiscais), fora os cancelados
 * (`situacao-faturamento.ts`). Duas consultas pra qualquer quantidade de contratos.
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
    // Faturado = por faturamento, o `valor` lançado ou, na falta dele, a soma das notas fiscais —
    // a mesma regra do "valor exibido" da aba Faturamento (senão o lançamento digitado à mão
    // aparece na lista e não abate o saldo). NotaFiscal só chega ao contrato via Faturamento, e o
    // groupBy do Prisma não agrupa por campo de relação, então a soma vai em SQL.
    prisma.$queryRaw<Array<{ contratoId: string; faturado: Prisma.Decimal | null }>>`
      SELECT f."contratoId" AS "contratoId", SUM(COALESCE(f."valor", n."soma")) AS "faturado"
      FROM "Faturamento" f
      LEFT JOIN (
        SELECT "faturamentoId", SUM("valor") AS "soma" FROM "NotaFiscal" GROUP BY "faturamentoId"
      ) n ON n."faturamentoId" = f."id"
      WHERE f."contratoId" IN (${Prisma.join(contratoIds)})
        AND (f."situacao" IS NULL OR f."situacao" !~* 'cancel')
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
