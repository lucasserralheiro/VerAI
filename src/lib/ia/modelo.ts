import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createGroq } from '@ai-sdk/groq'

export function getModel() {
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
