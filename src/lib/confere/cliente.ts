/**
 * Cliente HTTP do Confere (serviço externo, Python/FastAPI — ver
 * docs/superpowers/specs/2026-09-21-integracao-confere-design.md).
 *
 * Dois caminhos. **Assíncrono** (20/10/2026, o que a tela usa): `iniciarNoConfere`
 * entrega os arquivos e recebe um id, `consultarNoConfere` acompanha e
 * `resultadoDoConfere` busca o relatório — nenhuma chamada passa de segundos, e o
 * limite de 300 s da função da Vercel deixa de cortar a geração (no Render free
 * ela leva minutos). **Síncrono** (`chamarConfere`, `POST /reports`): espera a
 * resposta inteira; fica para quando o Confere no ar ainda não tem `/jobs`.
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

/** Quando o Confere cai no meio da geração (o Render reinicia a instância — foi
 *  o "Ran out of memory" de 19/10/2026), o que chega aqui é a conexão cortada ou
 *  a página de erro do provedor (502/503/504, sem JSON). Nenhum dos dois diz
 *  nada a quem está na tela; esta frase diz o que fazer. O 429 é da borda do
 *  Render enquanto a instância volta (20/10/2026) — nem o Confere nem o VerAI
 *  o devolvem. */
export const MENSAGEM_CONFERE_INDISPONIVEL =
  'O serviço do Confere reiniciou ou está indisponível no momento e a geração foi interrompida. ' +
  'Aguarde cerca de 1 minuto e tente de novo.'

const STATUS_DE_INDISPONIBILIDADE = new Set([429, 502, 503, 504])

function mensagemDeErro(corpo: unknown, status: number): string {
  if (corpo && typeof corpo === 'object') {
    const objeto = corpo as { detail?: unknown; detalhe?: unknown }
    if (typeof objeto.detail === 'string') return objeto.detail
    if (typeof objeto.detalhe === 'string') return objeto.detalhe
  }
  if (STATUS_DE_INDISPONIBILIDADE.has(status)) return MENSAGEM_CONFERE_INDISPONIVEL
  return `Confere respondeu ${status} sem uma mensagem reconhecível`
}

function configuracao(): { baseUrl: string; headers: Record<string, string> } {
  const baseUrl = process.env.CONFERE_SERVICE_URL
  if (!baseUrl) {
    throw new Error('CONFERE_SERVICE_URL não está configurado')
  }
  const headers: Record<string, string> = {}
  const segredo = process.env.CONFERE_SHARED_SECRET
  if (segredo) headers['X-Confere-Secret'] = segredo
  return { baseUrl, headers }
}

export async function chamarConfere(
  parametros: ParametrosChamarConfere,
  { tempoLimiteMs = TEMPO_LIMITE_PADRAO_MS }: OpcoesChamarConfere = {}
): Promise<ResultadoChamarConfere> {
  const { baseUrl, headers } = configuracao()

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
    // `fetch failed` / `socket hang up` não servem para a tela; o detalhe fica no log.
    console.error('[confere] falha de rede ao chamar o Confere —', erro)
    return { tipo: 'erro', mensagem: MENSAGEM_CONFERE_INDISPONIVEL }
  }

  return interpretarResultado(resposta)
}

/** 200 relatório / 422 bloqueado / o resto erro — a mesma leitura para
 *  `/reports` e para `/jobs/{id}/resultado`, que devolve exatamente o mesmo. */
async function interpretarResultado(resposta: Response): Promise<ResultadoChamarConfere> {
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

// ── Geração assíncrona (`/jobs`, 20/10/2026) ─────────────────────────────────

/** Cada chamada é curta; o teto só protege contra conexão pendurada. O envio
 *  leva os PDFs, e o serviço pode estar acordando (~23 s no free). */
const TEMPO_DO_ENVIO_MS = 90_000
const TEMPO_DA_CONSULTA_MS = 20_000
const TEMPO_DO_RESULTADO_MS = 60_000

export type InicioNoConfere =
  | { tipo: 'iniciado'; id: string }
  // O Confere no ar é anterior a `/jobs` (deploy pendente): quem chama volta ao
  // caminho síncrono em vez de falhar.
  | { tipo: 'sem-suporte' }
  | { tipo: 'erro'; mensagem: string }

export async function iniciarNoConfere(parametros: ParametrosChamarConfere): Promise<InicioNoConfere> {
  const { baseUrl, headers } = configuracao()
  let resposta: Response
  try {
    resposta = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers,
      body: montarFormData(parametros),
      signal: AbortSignal.timeout(TEMPO_DO_ENVIO_MS),
    })
  } catch (erro) {
    console.error('[confere] falha de rede ao iniciar a geração —', erro)
    return { tipo: 'erro', mensagem: MENSAGEM_CONFERE_INDISPONIVEL }
  }
  if (resposta.status === 404 || resposta.status === 405) return { tipo: 'sem-suporte' }
  const corpo: unknown = await resposta.json().catch(() => null)
  const id = (corpo as { id?: unknown } | null)?.id
  if (resposta.status === 202 && typeof id === 'string' && id !== '') return { tipo: 'iniciado', id }
  return { tipo: 'erro', mensagem: mensagemDeErro(corpo, resposta.status) }
}

export interface AndamentoNoConfere {
  situacao: 'na_fila' | 'processando'
  fase: string | null
  posicao: number
  segundos: number
}

export type ConsultaNoConfere =
  | ({ tipo: 'andamento' } & AndamentoNoConfere)
  | { tipo: 'pronto' }
  // O job não existe mais: o serviço reiniciou ou o resultado expirou.
  | { tipo: 'perdido'; mensagem: string }
  | { tipo: 'erro'; mensagem: string }

export async function consultarNoConfere(id: string): Promise<ConsultaNoConfere> {
  const { baseUrl, headers } = configuracao()
  let resposta: Response
  try {
    resposta = await fetch(`${baseUrl}/jobs/${encodeURIComponent(id)}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(TEMPO_DA_CONSULTA_MS),
    })
  } catch (erro) {
    console.error('[confere] falha de rede ao consultar a geração —', erro)
    return { tipo: 'erro', mensagem: MENSAGEM_CONFERE_INDISPONIVEL }
  }
  const corpo = (await resposta.json().catch(() => null)) as {
    situacao?: string
    fase?: unknown
    posicao?: unknown
    segundos?: unknown
  } | null
  if (resposta.status === 404) return { tipo: 'perdido', mensagem: mensagemDeErro(corpo, 404) }
  if (resposta.status !== 200 || !corpo) return { tipo: 'erro', mensagem: mensagemDeErro(corpo, resposta.status) }
  if (corpo.situacao === 'concluido') return { tipo: 'pronto' }
  if (corpo.situacao === 'na_fila' || corpo.situacao === 'processando') {
    return {
      tipo: 'andamento',
      situacao: corpo.situacao,
      fase: typeof corpo.fase === 'string' ? corpo.fase : null,
      posicao: typeof corpo.posicao === 'number' ? corpo.posicao : 0,
      segundos: typeof corpo.segundos === 'number' ? corpo.segundos : 0,
    }
  }
  return { tipo: 'erro', mensagem: `Confere respondeu uma situação desconhecida (${String(corpo.situacao)})` }
}

export async function resultadoDoConfere(id: string): Promise<ResultadoChamarConfere> {
  const { baseUrl, headers } = configuracao()
  let resposta: Response
  try {
    resposta = await fetch(`${baseUrl}/jobs/${encodeURIComponent(id)}/resultado`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(TEMPO_DO_RESULTADO_MS),
    })
  } catch (erro) {
    if (esgotouTempo(erro)) return { tipo: 'tempo-esgotado' }
    console.error('[confere] falha de rede ao buscar o resultado —', erro)
    return { tipo: 'erro', mensagem: MENSAGEM_CONFERE_INDISPONIVEL }
  }
  return interpretarResultado(resposta)
}
