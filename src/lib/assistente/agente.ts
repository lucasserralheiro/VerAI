import { stepCountIs, streamText, type LanguageModel, type ModelMessage } from 'ai'
import type { AuthUser } from '@/lib/auth'
import { criarFerramentas } from './ferramentas'
import { INSTRUCOES_SISTEMA } from './instrucoes'
import { modeloDoAssistente } from './configuracao'

export const MAX_PASSOS = 4
export const MAX_HISTORICO = 6
export const MAX_SAIDA = 1500

export interface MensagemHistorico {
  papel: 'usuario' | 'assistente'
  conteudo: string
}

export interface ResultadoAgente {
  texto: string
  ferramentas: { nome: string; entrada: unknown }[]
  tokensEntrada?: number
  tokensSaida?: number
  tokensCache?: number
}

/** Histórico curto primeiro (prefixo estável, cacheável) e o contexto só na última mensagem. */
export function montarMensagens(historico: MensagemHistorico[], pergunta: string, contexto: string | null): ModelMessage[] {
  return [
    ...historico.slice(-MAX_HISTORICO).map(
      (m): ModelMessage => (m.papel === 'usuario' ? { role: 'user', content: m.conteudo } : { role: 'assistant', content: m.conteudo })
    ),
    { role: 'user', content: contexto ? `${contexto}\n\nPergunta: ${pergunta}` : pergunta },
  ]
}

export function executarAgente(
  entrada: {
    usuario: AuthUser
    historico: MensagemHistorico[]
    pergunta: string
    contexto: string | null
    hoje?: Date
    modelo?: LanguageModel
    abortSignal?: AbortSignal
  },
  aoTerminar: (resultado: ResultadoAgente) => Promise<void>
) {
  return streamText({
    model: entrada.modelo ?? modeloDoAssistente(),
    system: INSTRUCOES_SISTEMA,
    messages: montarMensagens(entrada.historico, entrada.pergunta, entrada.contexto),
    tools: criarFerramentas({ usuario: entrada.usuario, hoje: entrada.hoje ?? new Date() }),
    stopWhen: stepCountIs(MAX_PASSOS),
    // No último passo permitido, sem ferramenta: força a IA a responder com o que já tem.
    prepareStep: ({ stepNumber }) => (stepNumber >= MAX_PASSOS - 1 ? { toolChoice: 'none' } : {}),
    maxOutputTokens: MAX_SAIDA,
    abortSignal: entrada.abortSignal,
    onFinish: async ({ steps, totalUsage }) => {
      await aoTerminar({
        texto: steps.map((s) => s.text).filter(Boolean).join('\n\n'),
        ferramentas: steps.flatMap((s) => s.toolCalls.map((c) => ({ nome: c.toolName, entrada: c.input }))),
        tokensEntrada: totalUsage.inputTokens,
        tokensSaida: totalUsage.outputTokens,
        tokensCache: totalUsage.inputTokenDetails?.cacheReadTokens,
      })
    },
  })
}
