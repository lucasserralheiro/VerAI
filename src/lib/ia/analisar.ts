import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'

export const PROMPT_VERSION_ATUAL = 'v1'

const schema = z.object({
  resumo: z.string(),
  pontosCriticos: z.array(
    z.object({
      texto: z.string(),
      severidade: z.enum(['alto', 'medio', 'baixo']),
    })
  ),
  pontosPositivos: z.array(z.object({ texto: z.string() })),
  // .nullable() em vez de .optional(): alguns provedores (Groq, OpenAI-compatíveis)
  // usam saída estruturada em modo estrito, que exige todo campo em "required" —
  // mesmo quando pode ser vazio. Precisa vir null, não ausente.
  metricasChave: z.array(z.object({ label: z.string(), valor: z.string() })).nullable(),
})

function montarPrompt(conteudoExtraido: string): string {
  return [
    'Você é um analista que revisa documentos internos e produz um relatório estruturado.',
    'Com base no conteúdo extraído do documento abaixo, gere um resumo executivo,',
    'os pontos críticos, os pontos positivos e, quando fizer sentido, métricas-chave.',
    '',
    'Conteúdo extraído:',
    conteudoExtraido,
  ].join('\n')
}

function getModel() {
  switch (process.env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.AI_API_KEY })(process.env.AI_MODEL!)
    case 'google':
      // Google AI Studio (aistudio.google.com/apikey) — tier gratuito, sem projeto GCP.
      return createGoogleGenerativeAI({ apiKey: process.env.AI_API_KEY })(process.env.AI_MODEL!)
    case 'vertex':
      // Sem apiKey: usa Application Default Credentials (gcloud auth application-default login).
      return createVertex({
        project: process.env.GOOGLE_VERTEX_PROJECT,
        location: process.env.GOOGLE_VERTEX_LOCATION,
      })(process.env.AI_MODEL!)
    case 'groq':
      // Groq (console.groq.com/keys) — tier gratuito sem cartão de crédito, "forever free".
      return createGroq({ apiKey: process.env.AI_API_KEY })(process.env.AI_MODEL!)
    default:
      throw new Error(`AI_PROVIDER "${process.env.AI_PROVIDER}" não suportado`)
  }
}

export async function analisarDocumento(conteudoExtraido: string, promptVersion: string) {
  const { object } = await generateObject({
    model: getModel(),
    schema,
    prompt: montarPrompt(conteudoExtraido),
  })
  return { ...object, promptVersion }
}
