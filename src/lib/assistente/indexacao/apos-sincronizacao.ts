import { prisma } from '@/lib/prisma'
import { sincronizarIndice } from './sincronizar'
import { emMb, LIMITE_BYTES_INDICE, tamanhoDoIndice } from './tamanho'

type Sincronizar = (opcoes: { clienteId?: string; limite?: number }) => ReturnType<typeof sincronizarIndice>

/** Migração que traz a origem `ARQUIVO_CLIENTE`. Sem ela o banco recusa gravar esses índices. */
export const MIGRACAO_DO_INDICE = '20260925190000_assistente_arquivo_cliente'

/**
 * O agendador do SharePoint roda o código da pasta do projeto contra PRODUÇÃO, que pode estar num
 * deploy anterior a esta fase: sem a migração, o banco recusa `ARQUIVO_CLIENTE` e o cron do código
 * antigo apagaria o que fosse indexado. A etapa só roda quando a migração já foi aplicada ali.
 */
async function migracaoAplicada(): Promise<boolean> {
  const linhas = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "_prisma_migrations" WHERE migration_name = ${MIGRACAO_DO_INDICE} AND finished_at IS NOT NULL`
  return Number(linhas[0]?.n ?? 0) > 0
}

/**
 * Rodada do índice do assistente no fim da sincronização do SharePoint (spec
 * 2026-09-25-assistente-base-economica §3.7/§7). Nunca lança: o código de saída do script é o da
 * sincronização, que o `-Estado` do agendador lê.
 */
export async function atualizarIndiceDoAssistente(
  opcoes: { clienteIds?: string[]; limite?: number } = {},
  deps: { sincronizar: Sincronizar; tamanho: () => Promise<number>; bancoPronto: () => Promise<boolean> } = {
    sincronizar: sincronizarIndice,
    tamanho: tamanhoDoIndice,
    bancoPronto: migracaoAplicada,
  }
): Promise<string> {
  try {
    if (!(await deps.bancoPronto())) return `índice do assistente: pulado — migração ${MIGRACAO_DO_INDICE} não aplicada neste banco`
    const bytes = await deps.tamanho()
    if (bytes > LIMITE_BYTES_INDICE) {
      return `índice do assistente: PARADO — TrechoDocumento com ${emMb(bytes)}, acima do teto de 80 MB; a decisão é do usuário`
    }
    const soma = { ok: 0, sem_texto: 0, erro: 0, removidos: 0, restantes: 0 }
    for (const clienteId of opcoes.clienteIds ?? [undefined]) {
      const r = await deps.sincronizar({ clienteId, limite: opcoes.limite ?? 200 })
      for (const k of Object.keys(soma) as (keyof typeof soma)[]) soma[k] += r[k]
    }
    return `índice do assistente: indexados ${soma.ok} · sem texto ${soma.sem_texto} · removidos ${soma.removidos} · erros ${soma.erro} · pendentes ${soma.restantes}`
  } catch (erro) {
    return `índice do assistente: falhou — ${erro instanceof Error ? erro.message : String(erro)} (a próxima rodada tenta de novo)`
  }
}
