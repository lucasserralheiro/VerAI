import { NextRequest, NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Histórico do ConfereAI — a listagem de `/confere/historico`.
 *
 * Todo mundo vê tudo, como no histórico da Proposta Comercial: o registro é
 * do que passou pela ferramenta, não de quem passou.
 */
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  // `$queryRaw` por um motivo específico: a lista precisa saber **se** existe
  // detalhamento guardado, sem trazer o JSON inteiro de cada execução — são
  // centenas de KB por linha, e o histórico cresce. `IS NOT NULL` resolve isso
  // no banco; um `select: { resultado: true }` traria tudo só para depois
  // reduzir a um booleano.
  //
  // O contrato vem por `LEFT JOIN`: execução sem contrato (antiga, ou com o
  // contrato excluído depois — o vínculo é `SetNull`) continua na lista.
  const execucoes = await prisma.$queryRaw<
    Array<{
      id: string
      nomeContrato: string
      nomeLevantamento: string
      nomesAditivos: unknown
      temResultado: boolean
      createdAt: Date
      contratoId: string | null
      clienteId: string | null
      numeroTermo: string | null
      competenciaAno: number | null
      competenciaMes: number | null
    }>
  >`
    SELECT
      e."id",
      e."nomeContrato",
      e."nomeLevantamento",
      e."nomesAditivos",
      e."resultado" IS NOT NULL AS "temResultado",
      e."createdAt",
      e."contratoId",
      e."competenciaAno",
      e."competenciaMes",
      c."clienteId",
      c."numeroTermo"
    FROM "ConfereExecucao" e
    LEFT JOIN "Contrato" c ON c."id" = e."contratoId"
    ORDER BY e."createdAt" DESC
  `

  return NextResponse.json(execucoes)
}
