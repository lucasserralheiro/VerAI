import { createHash } from 'node:crypto'

import { Prisma } from '@prisma/client'

// Hash estável de um registro do feed: JSON com as chaves em ordem, Decimal/Date como texto. É o que
// deixa o espelho barato — o consumidor só regrava o registro cujo hash mudou e pula a entidade
// inteira quando o hash dela é o mesmo da última vez. O AIBertinho tem a mesma função.

function normalizar(valor: unknown): unknown {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === 'bigint') return valor.toString()
  if (Array.isArray(valor)) return valor.map(normalizar)
  if (typeof valor === 'object') {
    if (Prisma.Decimal.isDecimal(valor)) return (valor as Prisma.Decimal).toString()
    return Object.fromEntries(
      Object.keys(valor as Record<string, unknown>)
        .sort()
        .map((k) => [k, normalizar((valor as Record<string, unknown>)[k])])
    )
  }
  return valor
}

export function jsonCanonico(valor: unknown): string {
  return JSON.stringify(normalizar(valor))
}

export function hashDe(valor: unknown): string {
  return createHash('sha256').update(jsonCanonico(valor)).digest('hex')
}

/** Hash da entidade inteira: a lista "id:hash" em ordem de id. */
export function hashDaEntidade(registros: { id: string; hash: string }[]): string {
  return hashDe(
    registros
      .map((r) => `${r.id}:${r.hash}`)
      .sort()
      .join('\n')
  )
}
