import { sincronizarIndice } from './sincronizar'
import { emMb, LIMITE_BYTES_INDICE, tamanhoDoIndice } from './tamanho'

type Sincronizar = (opcoes: { clienteId?: string; limite?: number }) => ReturnType<typeof sincronizarIndice>

/**
 * Rodada do índice do assistente no fim da sincronização do SharePoint (spec
 * 2026-09-25-assistente-base-economica §3.7/§7). Nunca lança: o código de saída do script é o da
 * sincronização, que o `-Estado` do agendador lê.
 */
export async function atualizarIndiceDoAssistente(
  opcoes: { clienteIds?: string[]; limite?: number } = {},
  deps: { sincronizar: Sincronizar; tamanho: () => Promise<number> } = { sincronizar: sincronizarIndice, tamanho: tamanhoDoIndice }
): Promise<string> {
  try {
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
