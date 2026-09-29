import type { PrismaClient } from '@prisma/client'
import { migracaoAplicada } from '@/lib/migracao-aplicada'
import { aplicarValoresProvados, type ResumoValores } from './aplicar'

// Etapa "valor e vigência com prova" no fim de scripts/sincronizar-sharepoint.ts (spec
// docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md §0), depois das fichas — que ela lê.
// Nunca lança e nunca muda o código de saída: grava só com prova e só em campo vazio; o resto vira aviso.

/** Tabelas `LinhaPlanilhaContratos` e `OrigemCampoHistorico`. Aplicada ela, as das fichas e dos controles também estão. */
export const MIGRACAO_DOS_VALORES = '20260929170000_valor_vigencia'

export interface DepsValores {
  bancoPronto: () => Promise<boolean>
  aplicar: typeof aplicarValoresProvados
}

export function linhasDoResumo(r: ResumoValores, aplicar: boolean, limite = 20): string[] {
  const verbo = aplicar ? 'gravados' : 'a gravar'
  const linhas = [
    `valores dos contratos: ${r.linhas} linha(s) do histórico · ${verbo}: valor ${r.valor} · vigência ${r.vigencia} · assinatura ${r.assinatura} · avisos ${r.avisos.length}`,
  ]
  for (const g of r.gravacoes.slice(0, limite)) linhas.push(`  ${g.contrato} ${g.linha} — ${g.campo} ${g.dado} (${g.origem})`)
  if (r.gravacoes.length > limite) linhas.push(`  … e mais ${r.gravacoes.length - limite} gravação(ões)`)
  for (const a of r.avisos.slice(0, limite)) linhas.push(`  aviso ${a.contrato} ${a.linha}: ${a.aviso}`)
  if (r.avisos.length > limite) linhas.push(`  … e mais ${r.avisos.length - limite} aviso(s) (npx tsx scripts/valores-contratos.ts --detalhe)`)
  return linhas
}

export async function etapaDosValores(
  prisma: PrismaClient,
  opcoes: { aplicar: boolean },
  deps: DepsValores = { bancoPronto: () => migracaoAplicada(prisma, MIGRACAO_DOS_VALORES), aplicar: aplicarValoresProvados }
): Promise<string[]> {
  try {
    if (!(await deps.bancoPronto())) return [`valores dos contratos: pulado — migração ${MIGRACAO_DOS_VALORES} não aplicada neste banco`]
    return linhasDoResumo(await deps.aplicar(prisma, opcoes), opcoes.aplicar)
  } catch (erro) {
    return [`valores dos contratos: falhou — ${erro instanceof Error ? erro.message : String(erro)} (a próxima rodada tenta de novo)`]
  }
}
