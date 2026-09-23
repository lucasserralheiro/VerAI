import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Itens do legado que ainda não têm contrato mas PERTENCEM a um cliente — pela sigla gravada no item
 * (`clienteSiglaLegado`) ou, na falta dela, porque o texto do contrato cita a sigla ("130/SMSUB/…").
 *
 * É isso que faz um cliente criado depois "reconhecer" o que já estava esperando por ele: a ficha
 * mostra os grupos e, ao criar o contrato com aquele número, `vincularItensOrfaos` liga tudo.
 */
export interface GrupoItensAguardando {
  /** Texto do contrato como veio do legado (vira o "Nº do termo" sugerido). */
  texto: string
  itens: number
  /** Soma do valor total dos itens do grupo (string decimal). */
  valor: string
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A sigla aparece no texto como palavra inteira (não dentro de outra: "SMS" ≠ "SMSUB"). */
export function textoCitaSigla(texto: string | null | undefined, sigla: string): boolean {
  if (!texto || !sigla.trim()) return false
  return new RegExp(`(^|[^A-Za-z0-9])${escapar(sigla.trim())}([^A-Za-z0-9]|$)`, 'i').test(texto)
}

export async function itensAguardandoDoCliente(
  db: Db,
  cliente: { siglaLegado: string | null }
): Promise<GrupoItensAguardando[]> {
  const sigla = cliente.siglaLegado?.trim().toUpperCase()
  if (!sigla) return []

  const orfaos = await db.itemContrato.findMany({
    where: { contratoId: null, contratoTextoLegado: { not: null } },
    select: { contratoTextoLegado: true, clienteSiglaLegado: true, valorTotal: true },
  })
  const grupos = new Map<string, { itens: number; centavos: bigint }>()
  for (const item of orfaos) {
    const daSigla = item.clienteSiglaLegado?.trim().toUpperCase()
    // Sigla gravada no item manda; sem ela, vale a citação no texto.
    const pertence = daSigla ? daSigla === sigla : textoCitaSigla(item.contratoTextoLegado, sigla)
    if (!pertence) continue
    const texto = item.contratoTextoLegado!.trim()
    const atual = grupos.get(texto) ?? { itens: 0, centavos: BigInt(0) }
    atual.itens++
    atual.centavos += BigInt(Math.round(Number(item.valorTotal.toString()) * 100))
    grupos.set(texto, atual)
  }
  const emReais = (centavos: bigint) => `${centavos / BigInt(100)}.${String(centavos % BigInt(100)).padStart(2, '0')}`
  return [...grupos.entries()]
    .map(([texto, g]) => ({ texto, itens: g.itens, valor: emReais(g.centavos) }))
    .sort((a, b) => b.itens - a.itens || a.texto.localeCompare(b.texto, 'pt-BR'))
}
