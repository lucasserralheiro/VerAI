import { prisma } from '@/lib/prisma'
import { configuracaoDoAssistente } from '@/lib/assistente/configuracao'
import { gerarFichasPendentes, type ResumoFichas } from '@/lib/assistente/fichas/gerar'
import { sincronizarIndice } from './sincronizar'
import { emMb, LIMITE_BYTES_INDICE, tamanhoDoIndice } from './tamanho'

type Sincronizar = (opcoes: { clienteId?: string; limite?: number }) => ReturnType<typeof sincronizarIndice>

/** A mais recente das migrações que o índice usa (origens `ARQUIVO_CLIENTE` e `REFERENCIA`, tabela
 *  `DocumentoReferencia`): aplicada ela, as anteriores também estão. Sem ela o banco recusa gravar. */
export const MIGRACAO_DO_INDICE = '20260926100000_assistente_referencias'

/**
 * O agendador do SharePoint roda o código da pasta do projeto contra PRODUÇÃO, que pode estar num
 * deploy anterior a esta fase: sem a migração, o banco recusa `ARQUIVO_CLIENTE` e o cron do código
 * antigo apagaria o que fosse indexado. A etapa só roda quando a migração já foi aplicada ali.
 */
async function migracaoAplicada(nome: string): Promise<boolean> {
  const linhas = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "_prisma_migrations" WHERE migration_name = ${nome} AND finished_at IS NOT NULL`
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
    bancoPronto: () => migracaoAplicada(MIGRACAO_DO_INDICE),
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

/** Migração da tabela `FichaDocumento` (spec fase 2 §5). */
export const MIGRACAO_DAS_FICHAS = '20260926110000_assistente_fichas'

/**
 * Fichas dos PDFs do histórico, depois do índice (spec 2026-09-25-assistente-senior §5.3): até 50 por
 * rodada. Sem chave de IA, roda só as regras. Mesma guarda e mesmo contrato do índice: nunca lança.
 */
export async function atualizarFichasDoAssistente(
  deps: { gerar: (opcoes: { limite: number; comIa: boolean }) => Promise<ResumoFichas>; bancoPronto: () => Promise<boolean>; comIa: () => boolean } = {
    gerar: gerarFichasPendentes,
    bancoPronto: () => migracaoAplicada(MIGRACAO_DAS_FICHAS),
    comIa: () => configuracaoDoAssistente() !== null,
  }
): Promise<string> {
  try {
    if (!(await deps.bancoPronto())) return `fichas: pulado — migração ${MIGRACAO_DAS_FICHAS} não aplicada neste banco`
    const comIa = deps.comIa()
    const r = await deps.gerar({ limite: 50, comIa })
    return (
      `fichas: por regra ${r.porRegra} · com IA ${r.comIa} · parciais ${r.parciais} · sem texto ${r.semTexto} · erros ${r.erros} · tokens ${r.tokens} · pendentes ${r.restantes}` +
      (comIa ? '' : ' (sem IA: chave não configurada)')
    )
  } catch (erro) {
    return `fichas: falhou — ${erro instanceof Error ? erro.message : String(erro)} (a próxima rodada tenta de novo)`
  }
}
