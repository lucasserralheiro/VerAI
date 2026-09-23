import { Prisma, type OrigemTrecho } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clienteIdsPermitidos, documentosVisiveisWhere } from '@/lib/visibilidade'

export interface TrechoEncontrado {
  origem: OrigemTrecho
  origemId: string
  clienteId: string | null
  contratoId: string | null
  nomeArquivo: string
  pagina: number | null
  texto: string
}

export interface FiltroBusca {
  consulta: string
  clienteId?: string
  contratoId?: string
  limite?: number
}

export const LIMITE_TRECHOS = 6

/** Palavra da consulta com 6+ dígitos (SEI, nº de contrato, CNPJ) sem a pontuação — o full-text
 *  quebra "6018.2023/0001234-5" em pedaços; o texto também é comparado sem `.`, `/` e `-`. */
function numerosDaConsulta(consulta: string): string[] {
  return consulta
    .split(/\s+/)
    .map((palavra) => palavra.replace(/[./-]/g, ''))
    .filter((palavra) => (palavra.match(/\d/g) ?? []).length >= 6)
}

export function montarConsultaTrechos(
  filtro: FiltroBusca,
  permissao: { clienteIds: string[] | null; documentoIds: string[] }
): Prisma.Sql {
  const { consulta, clienteId, contratoId, limite = LIMITE_TRECHOS } = filtro
  const tsquery = Prisma.sql`websearch_to_tsquery('portuguese', unaccent(${consulta}))`

  const condCliente =
    permissao.clienteIds === null
      ? Prisma.sql`TRUE`
      : permissao.clienteIds.length > 0
        ? Prisma.sql`(t."clienteId" IS NULL OR t."clienteId" IN (${Prisma.join(permissao.clienteIds)}))`
        : Prisma.sql`t."clienteId" IS NULL`
  const condDocumento =
    permissao.documentoIds.length > 0
      ? Prisma.sql`(t.origem <> 'DOCUMENTO' OR t."origemId" IN (${Prisma.join(permissao.documentoIds)}))`
      : Prisma.sql`t.origem <> 'DOCUMENTO'`
  const numeros = numerosDaConsulta(consulta)
  const condNumeros =
    numeros.length > 0
      ? Prisma.sql`OR regexp_replace(t.texto, '[./-]', '', 'g') LIKE ANY (ARRAY[${Prisma.join(numeros.map((n) => `%${n}%`))}])`
      : Prisma.empty

  return Prisma.sql`
    SELECT t.origem, t."origemId", t."clienteId", t."contratoId", t."nomeArquivo", t.pagina, t.texto
    FROM "TrechoDocumento" t
    WHERE ${condCliente}
      AND ${condDocumento}
      ${clienteId ? Prisma.sql`AND t."clienteId" = ${clienteId}` : Prisma.empty}
      ${contratoId ? Prisma.sql`AND t."contratoId" = ${contratoId}` : Prisma.empty}
      AND (t.busca @@ ${tsquery} ${condNumeros})
    ORDER BY ts_rank(t.busca, ${tsquery}) DESC, t.ordem ASC
    LIMIT ${limite}`
}

export async function buscarTrechos(filtro: FiltroBusca, usuario: AuthUser): Promise<TrechoEncontrado[]> {
  const [clienteIds, documentos] = await Promise.all([
    clienteIdsPermitidos(usuario),
    prisma.documento.findMany({ where: await documentosVisiveisWhere(usuario), select: { id: true } }),
  ])
  return prisma.$queryRaw<TrechoEncontrado[]>(
    montarConsultaTrechos(filtro, { clienteIds, documentoIds: documentos.map((d) => d.id) })
  )
}
