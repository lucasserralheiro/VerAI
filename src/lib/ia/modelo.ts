import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createGroq } from '@ai-sdk/groq'
import { createDeepSeek } from '@ai-sdk/deepseek'

/**
 * Modelo do provedor configurado em AI_PROVIDER (anthropic | google | vertex |
 * groq | deepseek). `modelo` sobrepõe o AI_MODEL
 * padrão — usado pela revisão de português, que roda num modelo mais rápido
 * (AI_REVISAO_MODEL) por ser tarefa mecânica.
 */
export function getModel(modelo?: string, opcoes: { provedor?: string; apiKey?: string } = {}) {
  const nomeModelo = modelo || process.env.AI_MODEL!
  const apiKey = opcoes.apiKey ?? process.env.AI_API_KEY
  const provedor = opcoes.provedor ?? process.env.AI_PROVIDER
  switch (provedor) {
    case 'anthropic':
      return createAnthropic({ apiKey })(nomeModelo)
    case 'google':
      // Google AI Studio (aistudio.google.com/apikey) — tier gratuito, sem projeto GCP.
      return createGoogleGenerativeAI({ apiKey })(nomeModelo)
    case 'vertex':
      // Sem apiKey: usa Application Default Credentials (gcloud auth application-default login).
      return createVertex({
        project: process.env.GOOGLE_VERTEX_PROJECT,
        location: process.env.GOOGLE_VERTEX_LOCATION,
      })(nomeModelo)
    case 'groq':
      // Groq (console.groq.com/keys) — tier gratuito sem cartão de crédito, "forever free".
      return createGroq({ apiKey })(nomeModelo)
    case 'deepseek':
      // DeepSeek (platform.deepseek.com/api_keys) — OpenAI-compatible; deepseek-chat
      // suporta saída JSON estruturada (deepseek-reasoner não de forma confiável).
      return createDeepSeek({ apiKey })(nomeModelo)
    default:
      throw new Error(`AI_PROVIDER "${provedor}" não suportado`)
  }
}
