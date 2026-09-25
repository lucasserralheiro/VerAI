/**
 * Cliente HTTP do Confere (serviço externo, Python/FastAPI — ver
 * docs/superpowers/specs/2026-09-21-integracao-confere-design.md). Chamada
 * síncrona, sem fila/polling: espera a resposta — medido em 24/09/2026 no
 * Render free, 69 s no piloto e 134 s num contrato com aditivo, mais ~23 s
 * quando o serviço hiberna.
 *
 * `POST /reports` do Confere devolve três formas, pelo status HTTP:
 *  - 200: sucesso, corpo é `RespostaRelatorio` (grid + os dois arquivos em base64).
 *  - 422 com "bloqueantes": bloqueado por validação, corpo é `RespostaBloqueada`
 *    — não é erro de infraestrutura, é resultado de negócio (ver `Resultado`).
 *  - qualquer outra coisa (422 sem "bloqueantes" — falha de extração; 401 —
 *    segredo incorreto; 500; falha de rede): erro de verdade.
 * Passar de `tempoLimiteMs` é um quarto caso, `tempo-esgotado`.
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
  // À parte de `erro` porque pede outra resposta de quem chama: é demora, não
  // defeito — e o Confere segue processando o envio abandonado por mais algum
  // tempo (a geração dele não é cancelável).
  | { tipo: 'tempo-esgotado' }
  | { tipo: 'erro'; mensagem: string }

export interface OpcoesChamarConfere {
  /** Quanto esperar pelo Confere antes de desistir. Sem teto próprio, quem
   *  corta a espera é a plataforma que hospeda a função — e o que chega na
   *  tela é o erro cru dela (o 504 de 24/09/2026). */
  tempoLimiteMs?: number
}

/** Cabe no `maxDuration` de 300 s do plano Hobby com folga para o que vem
 *  depois da resposta. Quem chama pode (e a rota deve) passar o que sobra do
 *  próprio orçamento. */
const TEMPO_LIMITE_PADRAO_MS = 270_000

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

function ehRelatorio(corpo: unknown): corpo is RespostaRelatorioConfere {
  const relatorio = corpo as { docx_base64?: unknown; analise_xlsx_base64?: unknown } | null
  return (
    !!relatorio && typeof relatorio.docx_base64 === 'string' && typeof relatorio.analise_xlsx_base64 === 'string'
  )
}

/** `AbortSignal.timeout()` aborta com um `DOMException` de nome `TimeoutError`,
 *  e o fetch rejeita com esse mesmo motivo — no envio ou na leitura do corpo. */
function esgotouTempo(erro: unknown): boolean {
  return erro instanceof DOMException && erro.name === 'TimeoutError'
}

function mensagemDeErro(corpo: unknown, status: number): string {
  if (corpo && typeof corpo === 'object') {
    const objeto = corpo as { detail?: unknown; detalhe?: unknown }
    if (typeof objeto.detail === 'string') return objeto.detail
    if (typeof objeto.detalhe === 'string') return objeto.detalhe
  }
  return `Confere respondeu ${status} sem uma mensagem reconhecível`
}

export async function chamarConfere(
  parametros: ParametrosChamarConfere,
  { tempoLimiteMs = TEMPO_LIMITE_PADRAO_MS }: OpcoesChamarConfere = {}
): Promise<ResultadoChamarConfere> {
  const baseUrl = process.env.CONFERE_SERVICE_URL
  if (!baseUrl) {
    throw new Error('CONFERE_SERVICE_URL não está configurado')
  }

  const headers: Record<string, string> = {}
  const segredo = process.env.CONFERE_SHARED_SECRET
  if (segredo) headers['X-Confere-Secret'] = segredo

  // O mesmo sinal cobre o envio e a leitura do corpo, que no sucesso são ~5 MB.
  const sinal = AbortSignal.timeout(tempoLimiteMs)

  let resposta: Response
  try {
    resposta = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers,
      body: montarFormData(parametros),
      signal: sinal,
    })
  } catch (erro) {
    if (esgotouTempo(erro)) return { tipo: 'tempo-esgotado' }
    return { tipo: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) }
  }

  let corpo: unknown = null
  try {
    corpo = await resposta.json()
  } catch (erro) {
    if (esgotouTempo(erro)) return { tipo: 'tempo-esgotado' }
    // Corpo que não é JSON (página de erro do provedor, conexão cortada no
    // meio) segue como `null` e cai no tratamento por status abaixo.
  }

  if (resposta.status === 200) {
    // 200 sem o relatório inteiro não é sucesso: a tela leria os base64 de
    // `null` e o modal de progresso ficaria aberto para sempre.
    if (ehRelatorio(corpo)) return { tipo: 'concluido', resposta: corpo }
    return { tipo: 'erro', mensagem: 'O Confere respondeu, mas o relatório não chegou inteiro. Tente de novo.' }
  }

  if (resposta.status === 422 && ehRespostaBloqueada(corpo)) {
    return { tipo: 'bloqueado', resposta: corpo }
  }

  return { tipo: 'erro', mensagem: mensagemDeErro(corpo, resposta.status) }
}
