import type { LanguageModel } from 'ai'
import { getModel } from '@/lib/ia/modelo'

/** Provedor do assistente, separado do da análise de documentos (spec §3.5). `null` = não configurado. */
export function configuracaoDoAssistente(): { provedor: string; modelo: string; apiKey: string | undefined } | null {
  const provedor = process.env.ASSISTENTE_AI_PROVIDER || process.env.AI_PROVIDER
  const modelo = process.env.ASSISTENTE_AI_MODEL || process.env.AI_MODEL
  const apiKey = process.env.ASSISTENTE_AI_API_KEY || process.env.AI_API_KEY || undefined
  if (!provedor || !modelo) return null
  if (provedor !== 'vertex' && !apiKey) return null
  return { provedor, modelo, apiKey }
}

export function modeloDoAssistente(): LanguageModel {
  const config = configuracaoDoAssistente()
  if (!config) throw new Error('Assistente não configurado')
  return getModel(config.modelo, { provedor: config.provedor, apiKey: config.apiKey })
}
