import type { PrismaClient } from '@prisma/client'
import type { ResultadoSincronizacao } from './sincronizar'

// "Documentos do SharePoint atualizados em …" (spec
// docs/superpowers/specs/2026-09-28-sharepoint-atualizado-em-design.md): no fim de cada passada completa
// o script grava uma linha em `AtualizacaoSharepoint`, e as telas mostram a mais recente.

/** Migração da tabela `AtualizacaoSharepoint`. */
export const MIGRACAO_DA_ATUALIZACAO = '20260928120000_atualizacao_sharepoint'

type Passada = Pick<ResultadoSincronizacao, 'conferencia' | 'remocaoSuspensa' | 'falhas'>

/** Por que a passada NÃO vale como "documentos atualizados" (spec §3); `null` = vale. Arquivo com
 *  conteúdo trocado que falhou fica com a versão velha e a conferência não pega — por isso as falhas. */
export function motivoIncompleta(r: Passada, opcoes: { aplicar: boolean; clientes?: string[] }): string | null {
  if (!opcoes.aplicar) return 'só listagem'
  if (opcoes.clientes?.length) return 'só parte dos clientes'
  if (!r.conferencia) return 'sem conferência'
  if (r.conferencia.some((l) => l.faltando.length > 0)) return 'conferência com divergência'
  if (r.remocaoSuspensa) return 'remoção suspensa'
  if (r.falhas.length > 0) return `${r.falhas.length} arquivo(s) com falha`
  return null
}

/** O agendador roda o código da pasta contra PRODUÇÃO, que pode estar num deploy sem a tabela. */
async function migracaoAplicada(prisma: PrismaClient, nome: string): Promise<boolean> {
  const linhas = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "_prisma_migrations" WHERE migration_name = ${nome} AND finished_at IS NOT NULL`
  return Number(linhas[0]?.n ?? 0) > 0
}

/**
 * Grava a passada para as telas (chamado pelo scripts/sincronizar-sharepoint.ts depois da conferência).
 * Devolve a linha do log. Nunca lança: o código de saída do script é o da sincronização, que o `-Estado`
 * do agendador lê.
 */
export async function registrarAtualizacao(
  prisma: PrismaClient,
  r: Passada,
  opcoes: { aplicar: boolean; clientes?: string[]; iniciadaEm: Date },
  deps: { bancoPronto: () => Promise<boolean> } = { bancoPronto: () => migracaoAplicada(prisma, MIGRACAO_DA_ATUALIZACAO) }
): Promise<string> {
  const motivo = motivoIncompleta(r, opcoes)
  if (motivo) return `data das telas: não atualizada — ${motivo}`
  try {
    if (!(await deps.bancoPronto())) return `data das telas: pulada — migração ${MIGRACAO_DA_ATUALIZACAO} não aplicada neste banco`
    const arquivos = r.conferencia!.reduce((soma, l) => soma + l.noSharepoint, 0)
    await prisma.atualizacaoSharepoint.create({ data: { iniciadaEm: opcoes.iniciadaEm, arquivos } })
    return `data das telas: atualizada (${opcoes.iniciadaEm.toLocaleString('pt-BR')})`
  } catch (erro) {
    return `data das telas: falhou — ${erro instanceof Error ? erro.message : String(erro)} (a próxima rodada tenta de novo)`
  }
}
