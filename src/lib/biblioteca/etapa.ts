import { existsSync } from 'node:fs'
import type { PrismaClient } from '@prisma/client'
import { fonteDaPasta } from '@/lib/arquivos/sharepoint/fonte-pasta'
import { migracaoAplicada } from '@/lib/migracao-aplicada'
import { BIBLIOTECA_DOCUMENTOS, type AreaBiblioteca } from './areas'
import { LEITORES } from './registro-leitores'
import { sincronizarBiblioteca, type ResultadoBiblioteca } from './sincronizar'

// Etapa da biblioteca "Documentos" no scripts/sincronizar-sharepoint.ts (spec
// docs/superpowers/specs/2026-09-29-biblioteca-documentos-prodam-design.md §5.1–5.4). Isolada: nunca lança
// e nunca desfaz a passada dos contratos; `problema` vira código de saída 2 no script.

export const MIGRACAO_DA_BIBLIOTECA = '20260929100000_biblioteca_documentos'

/** Mesma regra de "passada completa" da ContratosReceita; `null` = vale para a data das telas. */
export function motivoIncompletaBiblioteca(r: ResultadoBiblioteca, aplicar: boolean): string | null {
  if (!aplicar) return 'só listagem'
  if (!r.conferencia) return 'sem conferência'
  if (r.conferencia.some((l) => l.faltando.length > 0)) return 'conferência com divergência'
  if (r.remocaoSuspensa) return 'remoção suspensa'
  if (r.falhas.length > 0) return `${r.falhas.length} arquivo(s) com falha`
  return null
}

export interface DepsEtapa {
  existe: (caminho: string) => boolean
  bancoPronto: () => Promise<boolean>
  fonte: typeof fonteDaPasta
  sincronizar: typeof sincronizarBiblioteca
  agora: () => Date
}

export async function etapaDaBiblioteca(
  prisma: PrismaClient,
  opcoes: { aplicar: boolean; raiz: string; relerAreas?: AreaBiblioteca[] },
  deps: DepsEtapa = {
    existe: existsSync,
    bancoPronto: () => migracaoAplicada(prisma, MIGRACAO_DA_BIBLIOTECA),
    fonte: fonteDaPasta,
    sincronizar: sincronizarBiblioteca,
    agora: () => new Date(),
  }
): Promise<{ linhas: string[]; problema: boolean }> {
  const iniciadaEm = deps.agora()
  if (!deps.existe(opcoes.raiz)) return { linhas: [`biblioteca Documentos: pasta não encontrada (${opcoes.raiz}) — pulada`], problema: false }
  try {
    if (!(await deps.bancoPronto())) {
      return { linhas: [`biblioteca Documentos: pulada — migração ${MIGRACAO_DA_BIBLIOTECA} não aplicada neste banco`], problema: false }
    }
    const r = await deps.sincronizar(prisma, {
      aplicar: opcoes.aplicar,
      fonte: deps.fonte(opcoes.raiz),
      leitores: LEITORES,
      relerAreas: opcoes.relerAreas,
    })
    const linhas = [
      `biblioteca Documentos: ${r.listados} arquivo(s) · novos ${r.novos} · mudados ${r.mudados} · iguais ${r.iguais} · removidos ${r.removidos}${r.ignorados ? ` · ignorados ${r.ignorados}` : ''}`,
    ]
    for (const f of r.falhas) linhas.push(`  falha ${f.caminho}: ${f.motivo}`)
    if (r.remocaoSuspensa) linhas.push(`  ATENÇÃO: ${r.remocaoSuspensa}`)
    for (const l of r.leituras) linhas.push(`  ${l}`)
    const divergentes = r.conferencia?.filter((l) => l.faltando.length > 0) ?? []
    if (r.conferencia) {
      linhas.push(`  conferência: ${divergentes.length === 0 ? 'TUDO NO VERAI' : `DIVERGÊNCIA em ${divergentes.map((l) => l.area).join(', ')}`}`)
      for (const l of divergentes) for (const f of l.faltando.slice(0, 20)) linhas.push(`    falta ${f}`)
    }
    const motivo = motivoIncompletaBiblioteca(r, opcoes.aplicar)
    if (!motivo) {
      await prisma.atualizacaoBiblioteca.create({ data: { biblioteca: BIBLIOTECA_DOCUMENTOS, iniciadaEm, arquivos: r.listados } })
      linhas.push('  data das telas: atualizada')
    } else if (opcoes.aplicar) {
      linhas.push(`  data das telas: não atualizada — ${motivo}`)
    }
    return { linhas, problema: opcoes.aplicar && divergentes.length > 0 }
  } catch (erro) {
    return {
      linhas: [`biblioteca Documentos: falhou — ${erro instanceof Error ? erro.message : String(erro)} (a próxima rodada tenta de novo)`],
      problema: true,
    }
  }
}
