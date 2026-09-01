import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createGroq } from '@ai-sdk/groq'

/**
 * Modelo do provedor configurado em AI_PROVIDER. `modelo` sobrepõe o AI_MODEL
 * padrão — usado pela revisão de português, que roda num modelo mais rápido
 * (AI_REVISAO_MODEL) por ser tarefa mecânica.
 */
export function getModel(modelo?: string) {
  const nomeModelo = modelo || process.env.AI_MODEL!
  switch (process.env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.AI_API_KEY })(nomeModelo)
    case 'google':
      // Google AI Studio (aistudio.google.com/apikey) — tier gratuito, sem projeto GCP.
      return createGoogleGenerativeAI({ apiKey: process.env.AI_API_KEY })(nomeModelo)
    case 'vertex':
      // Sem apiKey: usa Application Default Credentials (gcloud auth application-default login).
      return createVertex({
        project: process.env.GOOGLE_VERTEX_PROJECT,
        location: process.env.GOOGLE_VERTEX_LOCATION,
      })(nomeModelo)
    case 'groq':
      // Groq (console.groq.com/keys) — tier gratuito sem cartão de crédito, "forever free".
      return createGroq({ apiKey: process.env.AI_API_KEY })(nomeModelo)
    default:
      throw new Error(`AI_PROVIDER "${process.env.AI_PROVIDER}" não suportado`)
  }
}
