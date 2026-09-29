import { prisma } from '@/lib/prisma'
import { textoDaOrigem, type CampoOrigem } from './texto-origem'

export type OrigensDoHistorico = Record<string, Partial<Record<CampoOrigem, string>>>

/** Origem dos campos preenchidos com prova nas linhas do histórico de um contrato, já em texto para a tela. */
export async function origensDoContrato(contratoId: string): Promise<OrigensDoHistorico> {
  const linhas = await prisma.historicoContrato.findMany({ where: { contratoId }, select: { id: true } })
  if (linhas.length === 0) return {}
  const origens = await prisma.origemCampoHistorico.findMany({
    where: { historicoId: { in: linhas.map((l) => l.id) } },
    select: { historicoId: true, campo: true, origem: true, prova: true },
  })
  const resultado: OrigensDoHistorico = {}
  for (const o of origens) {
    const campo = o.campo as CampoOrigem
    ;(resultado[o.historicoId] ??= {})[campo] = textoDaOrigem(campo, o.origem, o.prova)
  }
  return resultado
}
