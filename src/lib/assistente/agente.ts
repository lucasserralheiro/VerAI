import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type StepResult,
  type ToolSet,
} from 'ai'
import type { AuthUser } from '@/lib/auth'
import { criarFerramentas, textoParaModelo } from './ferramentas'
import { INSTRUCOES_SISTEMA } from './instrucoes'
import { modeloDoAssistente } from './configuracao'
import { conferirResposta, type Conferencia } from './conferencia'
import { NAO_ENCONTREI, separarBlocos, tiposDaResposta } from './blocos'

export const MAX_PASSOS = 6
export const MAX_HISTORICO = 6
export const MAX_SAIDA = 2000

const MENSAGEM_DE_FALHA = 'O assistente não respondeu. Tente de novo.'

export interface MensagemHistorico {
  papel: 'usuario' | 'assistente'
  conteudo: string
}

export interface ResultadoAgente {
  /** Texto final: o do modelo, ou "Não encontrei" + blocos gerais quando bloqueada. */
  texto: string
  ferramentas: { nome: string; entrada: unknown }[]
  conferencia: Conferencia
  tipos: string[]
  bloqueada: boolean
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

/**
 * Confere os números da parte do VerAI (fora de :::geral) contra as saídas das ferramentas e o contexto.
 * Resposta com número sem nenhuma consulta vira "Não encontrei isso no VerAI." (os blocos gerais ficam).
 */
export function finalizarResposta(e: { texto: string; saidas: string[]; contexto: string | null; houveFerramenta: boolean }): {
  texto: string
  conferencia: Conferencia
  tipos: string[]
  bloqueada: boolean
} {
  const blocos = separarBlocos(e.texto)
  const textoVerai = blocos.filter((b) => b.tipo === 'verai').map((b) => b.texto).join('\n')
  const conferencia = conferirResposta({ textoVerai, fontes: [...e.saidas, e.contexto ?? ''] })
  const bloqueada = !e.houveFerramenta && conferencia.naoConfirmados.length > 0
  const texto = bloqueada
    ? [NAO_ENCONTREI, ...blocos.filter((b) => b.tipo === 'geral').map((b) => `:::geral\n${b.texto}\n:::`)].join('\n\n')
    : e.texto
  return { texto, conferencia: bloqueada ? { conferidos: 0, naoConfirmados: [] } : conferencia, tipos: tiposDaResposta(texto), bloqueada }
}

/** A conferência nunca derruba a resposta: na falha, a resposta segue sem marcas. */
function finalizarComSeguranca(entrada: Parameters<typeof finalizarResposta>[0]): ReturnType<typeof finalizarResposta> {
  try {
    return finalizarResposta(entrada)
  } catch (erro) {
    console.error('[assistente] conferência da resposta falhou; seguindo sem marcas', erro)
    return { texto: entrada.texto, conferencia: { conferidos: 0, naoConfirmados: [] }, tipos: tiposDaResposta(entrada.texto), bloqueada: false }
  }
}

/**
 * Roda o agente e devolve a Response do stream para o navegador. Ordem garantida: o stream do modelo
 * é repassado INTEIRO ao writer (lido aqui, não com merge, que corre em paralelo), só depois vem a
 * parte `data-conferencia` e, por último, o `finish`.
 */
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
): { resposta: Response } {
  const resultado = streamText({
    model: entrada.modelo ?? modeloDoAssistente(),
    system: INSTRUCOES_SISTEMA,
    messages: montarMensagens(entrada.historico, entrada.pergunta, entrada.contexto),
    tools: criarFerramentas({ usuario: entrada.usuario, hoje: entrada.hoje ?? new Date() }),
    stopWhen: stepCountIs(MAX_PASSOS),
    // No último passo permitido, sem ferramenta: força a IA a responder com o que já tem.
    prepareStep: ({ stepNumber }) => (stepNumber >= MAX_PASSOS - 1 ? { toolChoice: 'none' } : {}),
    maxOutputTokens: MAX_SAIDA,
    abortSignal: entrada.abortSignal,
  })

  const aoErrar = (erro: unknown) => {
    console.error('[assistente] falha ao responder', erro)
    return MENSAGEM_DE_FALHA
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let interrompida = false
      for await (const parte of resultado.toUIMessageStream({ sendFinish: false, onError: aoErrar })) {
        if (parte.type === 'error' || parte.type === 'abort') interrompida = true
        writer.write(parte)
      }

      let steps: StepResult<ToolSet>[] = []
      let uso: Awaited<typeof resultado.totalUsage> | undefined
      try {
        ;[steps, uso] = await Promise.all([resultado.steps, resultado.totalUsage])
      } catch {
        // Sem nenhum passo (falha ou abortado antes de responder): já logado por aoErrar.
        interrompida = true
      }

      const texto = steps.map((s) => s.text).filter(Boolean).join('\n\n')
      const ferramentas = steps.flatMap((s) => s.toolCalls.map((c) => ({ nome: c.toolName, entrada: c.input })))
      // Fonte da conferência: o que as ferramentas devolveram e também o que a IA passou a elas (datas, mês).
      const saidas = steps.flatMap((s) => [
        ...s.toolResults.map((r) => textoParaModelo(r.toolName, r.output)),
        ...s.toolCalls.map((c) => JSON.stringify(c.input)),
      ])
      const final = texto.trim()
        ? finalizarComSeguranca({ texto, saidas, contexto: entrada.contexto, houveFerramenta: ferramentas.length > 0 })
        : { texto: '', conferencia: { conferidos: 0, naoConfirmados: [] }, tipos: [], bloqueada: false }

      if (!interrompida) {
        writer.write({
          type: 'data-conferencia',
          data: { naoConfirmados: final.conferencia.naoConfirmados, bloqueada: final.bloqueada, ...(final.bloqueada ? { texto: final.texto } : {}) },
        })
        writer.write({ type: 'finish' })
      }

      try {
        await aoTerminar({
          // Vazio quando abortou/falhou (mesmo com passos prontos): a rota não grava resposta parcial como completa.
          texto: interrompida ? '' : final.texto,
          ferramentas,
          conferencia: final.conferencia,
          tipos: final.tipos,
          bloqueada: final.bloqueada,
          tokensEntrada: uso?.inputTokens,
          tokensSaida: uso?.outputTokens,
          tokensCache: uso?.inputTokenDetails?.cacheReadTokens,
        })
      } catch (erro) {
        // O `finish` já foi: falha de gravação não pode virar erro na tela.
        console.error('[assistente] falha ao registrar o fim da resposta', erro)
      }
    },
    onError: aoErrar,
  })
  return { resposta: createUIMessageStreamResponse({ stream }) }
}
