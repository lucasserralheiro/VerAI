/**
 * Cliente HTTP do Confere (serviço externo, Python/FastAPI — ver
 * docs/superpowers/specs/2026-09-21-integracao-confere-design.md). Chamada
 * síncrona, sem fila/polling: espera a resposta (~30s + eventual cold-start
 * do Render no plano free).
 *
 * `POST /reports` do Confere devolve três formas, pelo status HTTP:
 *  - 200: sucesso, corpo é `RespostaRelatorio` (grid + os dois arquivos em base64).
 *  - 422 com "bloqueantes": bloqueado por validação, corpo é `RespostaBloqueada`
 *    — não é erro de infraestrutura, é resultado de negócio (ver `Resultado`).
 *  - qualquer outra coisa (422 sem "bloqueantes" — falha de extração; 401 —
 *    segredo incorreto; 500; falha de rede; timeout): erro de verdade.
 */

interface ArquivoDeEntrada {
  nome: string
  bytes: Buffer
}

export interface ParametrosChamarConfere {
  contrato: ArquivoDeEntrada
  levantamento: ArquivoDeEntrada
  aditivos: ArquivoDeEntrada[]
  identidadeConfirmada: boolean
}

// Só os campos que a rota usa hoje — o Confere devolve mais (ver
// services/confere/backend/src/api/schemas.py `RespostaRelatorio`), mas
// tratamos o resto como Json opaco (`resultado` no banco).
export interface RespostaRelatorioConfere {
  docx_base64: string
  analise_xlsx_base64: string
  [chave: string]: unknown
}

export interface AchadoConfere {
  validacao: string
  severidade: string
  mensagem: string
  [chave: string]: unknown
}

export interface RespostaBloqueadaConfere {
  bloqueantes: AchadoConfere[]
  avisos: AchadoConfere[]
  confirmaveis: AchadoConfere[]
  pode_prosseguir: boolean
  [chave: string]: unknown
}

export type ResultadoChamarConfere =
  | { tipo: 'concluido'; resposta: RespostaRelatorioConfere }
  | { tipo: 'bloqueado'; resposta: RespostaBloqueadaConfere }
  | { tipo: 'erro'; mensagem: string }

function montarFormData(parametros: ParametrosChamarConfere): FormData {
  const formData = new FormData()
  formData.set('contrato', new Blob([new Uint8Array(parametros.contrato.bytes)]), parametros.contrato.nome)
  formData.set(
    'levantamento',
    new Blob([new Uint8Array(parametros.levantamento.bytes)]),
    parametros.levantamento.nome
  )
  for (const aditivo of parametros.aditivos) {
    formData.append('aditivos', new Blob([new Uint8Array(aditivo.bytes)]), aditivo.nome)
  }
  formData.set('identidade_confirmada', String(parametros.identidadeConfirmada))
  return formData
}

function ehRespostaBloqueada(corpo: unknown): corpo is RespostaBloqueadaConfere {
  return !!corpo && typeof corpo === 'object' && Array.isArray((corpo as { bloqueantes?: unknown }).bloqueantes)
}

function mensagemDeErro(corpo: unknown, status: number): string {
  if (corpo && typeof corpo === 'object') {
    const objeto = corpo as { detail?: unknown; detalhe?: unknown }
    if (typeof objeto.detail === 'string') return objeto.detail
    if (typeof objeto.detalhe === 'string') return objeto.detalhe
  }
  return `Confere respondeu ${status} sem uma mensagem reconhecível`
}

export async function chamarConfere(parametros: ParametrosChamarConfere): Promise<ResultadoChamarConfere> {
  const baseUrl = process.env.CONFERE_SERVICE_URL
  if (!baseUrl) {
    throw new Error('CONFERE_SERVICE_URL não está configurado')
  }

  const headers: Record<string, string> = {}
  const segredo = process.env.CONFERE_SHARED_SECRET
  if (segredo) headers['X-Confere-Secret'] = segredo

  let resposta: Response
  try {
    resposta = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers,
      body: montarFormData(parametros),
    })
  } catch (erro) {
    return { tipo: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) }
  }

  const corpo = await resposta.json().catch(() => null)

  if (resposta.status === 200) {
    return { tipo: 'concluido', resposta: corpo as RespostaRelatorioConfere }
  }

  if (resposta.status === 422 && ehRespostaBloqueada(corpo)) {
    return { tipo: 'bloqueado', resposta: corpo }
  }

  return { tipo: 'erro', mensagem: mensagemDeErro(corpo, resposta.status) }
}
