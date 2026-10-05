import type { UIMessage } from 'ai'

export interface Conferencia {
  naoConfirmados: string[]
  bloqueada: boolean
  texto?: string
}

export function lerMensagemDoStream(mensagem: UIMessage): { texto: string; ferramenta: string | null; conferencia: Conferencia | null } {
  let texto = ''
  let ferramenta: string | null = null
  let conferencia: Conferencia | null = null
  for (const parte of mensagem.parts) {
    if (parte.type === 'text') texto += parte.text
    else if (parte.type === 'data-conferencia') conferencia = (parte as unknown as { data: Conferencia }).data
    else if (parte.type.startsWith('tool-') && 'state' in parte) {
      const estado = (parte as { state: string }).state
      ferramenta = estado === 'output-available' || estado === 'output-error' ? null : parte.type.slice(5)
    }
  }
  // O servidor manda `texto` quando bloqueou a resposta ou tirou dela uma chamada de ferramenta vazada.
  if (conferencia?.texto) texto = conferencia.texto
  return { texto, ferramenta, conferencia }
}

const PADRAO = 'O assistente não respondeu. Tente de novo.'

/** O transporte lança `Error(corpo da resposta)` em status ≠ 2xx; as rotas respondem `{ error }`. */
export function mensagemDeErro(erro: unknown): string {
  const bruto = erro instanceof Error ? erro.message : ''
  try {
    const corpo = JSON.parse(bruto) as { error?: unknown }
    return typeof corpo.error === 'string' ? corpo.error : PADRAO
  } catch {
    return PADRAO
  }
}
