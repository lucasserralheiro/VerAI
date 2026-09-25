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

/** Palavra da consulta com 6+ dígitos (SEI, nº de contrato, CNPJ), só os dígitos — o full-text
 *  quebra "6018.2023/0001234-5" em pedaços; o texto também é comparado sem pontuação. Remove
 *  TUDO que não é dígito (não só `.`, `/`, `-`): a palavra vira o valor do padrão LIKE, e deixar
 *  `%`/`_` (coringas do LIKE) passar da consulta do usuário pro SQL distorce a busca. */
function numerosDaConsulta(consulta: string): string[] {
  return consulta
    .split(/\s+/)
    .map((palavra) => palavra.replace(/\D/g, ''))
    .filter((digitos) => digitos.length >= 6)
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
  // Admin não tem restrição de cliente (clienteIds null) — também não filtra por documento: montar
  // a lista IN de TODOS os documentos visíveis (todos, pra admin) é um SQL enorme à toa.
  const condDocumento =
    permissao.clienteIds === null
      ? Prisma.sql`TRUE`
      : permissao.documentoIds.length > 0
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
  const clienteIds = await clienteIdsPermitidos(usuario)
  // Admin (clienteIds null) não filtra por documento (condDocumento vira TRUE) — listar todos os
  // documentos do banco só pra montar um IN que a query nem usa seria desperdício.
  const documentoIds =
    clienteIds === null
      ? []
      : (await prisma.documento.findMany({ where: await documentosVisiveisWhere(usuario), select: { id: true } })).map((d) => d.id)
  return prisma.$queryRaw<TrechoEncontrado[]>(montarConsultaTrechos(filtro, { clienteIds, documentoIds }))
}
