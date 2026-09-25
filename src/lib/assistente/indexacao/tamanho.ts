import { prisma } from '@/lib/prisma'

/** Teto do índice no banco (spec 2026-09-25-assistente-base-economica §7.5): acima disso a
 *  indexação para e a decisão volta ao usuário. */
export const LIMITE_BYTES_INDICE = 80 * 1024 * 1024

/** Tamanho de `TrechoDocumento` com `tsvector` e índices. */
export async function tamanhoDoIndice(): Promise<number> {
  const [linha] = await prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_total_relation_size('"TrechoDocumento"') AS bytes`
  return Number(linha?.bytes ?? 0)
}

export const emMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
