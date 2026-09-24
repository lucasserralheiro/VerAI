import { createHash, createHmac } from 'node:crypto'

// Cloudflare R2 (API compatível com S3) para os arquivos que a sincronização traz da biblioteca
// ContratosReceita do SharePoint (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md
// §11). Bucket PRIVADO: só o servidor lê, e a entrega ao navegador é sempre por /api/arquivos/[id].
// A assinatura AWS SigV4 é feita aqui com node:crypto — sem SDK, para não trazer dependência nova.
// Só servidor.

export const PREFIXO_R2 = 'r2:'

export interface ConfigR2 {
  contaId: string
  bucket: string
  chaveId: string
  segredo: string
}

/** As 4 variáveis `R2_*`; faltando qualquer uma, o R2 não está configurado. */
export function configR2(env: Record<string, string | undefined> = process.env): ConfigR2 | null {
  const contaId = env.R2_ACCOUNT_ID?.trim()
  const bucket = env.R2_BUCKET?.trim()
  const chaveId = env.R2_ACCESS_KEY_ID?.trim()
  const segredo = env.R2_SECRET_ACCESS_KEY?.trim()
  return contaId && bucket && chaveId && segredo ? { contaId, bucket, chaveId, segredo } : null
}

function exigirConfig(): ConfigR2 {
  const cfg = configR2()
  if (!cfg) throw new Error('Cloudflare R2 não configurado — defina R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY')
  return cfg
}

const sha256 = (dado: string | Buffer) => createHash('sha256').update(dado).digest('hex')
const hmac = (chave: string | Buffer, dado: string) => createHmac('sha256', chave).update(dado).digest()

export const HASH_VAZIO = sha256('')

/** "2013-05-24T00:00:00.000Z" → "20130524T000000Z". */
function dataAmz(quando: Date): string {
  return quando.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Caminho do objeto na URL: cada segmento codificado uma vez (RFC 3986), barras preservadas. */
export function codificarChave(chave: string): string {
  return chave
    .split('/')
    .map((segmento) => encodeURIComponent(segmento).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/')
}

export interface PedidoParaAssinar {
  metodo: string
  host: string
  /** Caminho já codificado (`codificarChave`). */
  caminho: string
  /** Cabeçalhos a assinar além de host, x-amz-date e x-amz-content-sha256. */
  cabecalhos: Record<string, string>
  hashCorpo: string
  chaveId: string
  segredo: string
  regiao: string
  servico: string
  quando: Date
}

/** Assinatura AWS Signature Version 4 (cabeçalho Authorization, sem query string). Devolve os
 *  cabeçalhos a enviar (sem `host`, que o fetch põe) e, para teste, o hash da requisição canônica. */
export function assinarSigV4(p: PedidoParaAssinar): { cabecalhos: Record<string, string>; hashCanonico: string; assinatura: string } {
  const amzDate = dataAmz(p.quando)
  const dia = amzDate.slice(0, 8)
  const todos: Record<string, string> = {
    ...Object.fromEntries(Object.entries(p.cabecalhos).map(([nome, valor]) => [nome.toLowerCase(), valor.trim()])),
    host: p.host,
    'x-amz-content-sha256': p.hashCorpo,
    'x-amz-date': amzDate,
  }
  const nomes = Object.keys(todos).sort()
  const assinados = nomes.join(';')
  const requisicaoCanonica = [p.metodo, p.caminho, '', nomes.map((n) => `${n}:${todos[n]}\n`).join(''), assinados, p.hashCorpo].join('\n')
  const hashCanonico = sha256(requisicaoCanonica)
  const escopo = `${dia}/${p.regiao}/${p.servico}/aws4_request`
  const chave = hmac(hmac(hmac(hmac(`AWS4${p.segredo}`, dia), p.regiao), p.servico), 'aws4_request')
  const assinatura = createHmac('sha256', chave).update(['AWS4-HMAC-SHA256', amzDate, escopo, hashCanonico].join('\n')).digest('hex')

  const { host: _host, ...semHost } = todos
  return {
    cabecalhos: {
      ...semHost,
      authorization: `AWS4-HMAC-SHA256 Credential=${p.chaveId}/${escopo}, SignedHeaders=${assinados}, Signature=${assinatura}`,
    },
    hashCanonico,
    assinatura,
  }
}

async function pedirR2(cfg: ConfigR2, metodo: 'GET' | 'PUT' | 'DELETE', chave: string, corpo?: { dados: Buffer; contentType: string }) {
  const host = `${cfg.contaId}.r2.cloudflarestorage.com`
  const caminho = `/${cfg.bucket}/${codificarChave(chave)}`
  const { cabecalhos } = assinarSigV4({
    metodo,
    host,
    caminho,
    cabecalhos: corpo ? { 'content-type': corpo.contentType } : {},
    hashCorpo: corpo ? sha256(corpo.dados) : HASH_VAZIO,
    chaveId: cfg.chaveId,
    segredo: cfg.segredo,
    regiao: 'auto',
    servico: 's3',
    quando: new Date(),
  })
  return fetch(`https://${host}${caminho}`, { method: metodo, headers: cabecalhos, body: corpo ? new Uint8Array(corpo.dados) : undefined })
}

/** Grava e devolve o endereço guardado em `ArquivoCliente.urlBlob` (`r2:<chave>`). */
export async function putR2(chave: string, dados: Buffer, contentType: string, cfg: ConfigR2 = exigirConfig()): Promise<string> {
  const resposta = await pedirR2(cfg, 'PUT', chave, { dados, contentType })
  if (!resposta.ok) throw new Error(`R2 recusou a gravação (${resposta.status}): ${(await resposta.text()).slice(0, 200)}`)
  return `${PREFIXO_R2}${chave}`
}

/** Resposta crua (corpo em streaming) — quem chama confere `ok`. */
export function getR2(chave: string, cfg: ConfigR2 = exigirConfig()): Promise<Response> {
  return pedirR2(cfg, 'GET', chave)
}

/** Apaga; o que já não existe (404) conta como apagado. */
export async function deleteR2(chave: string, cfg: ConfigR2 = exigirConfig()): Promise<void> {
  const resposta = await pedirR2(cfg, 'DELETE', chave)
  if (!resposta.ok && resposta.status !== 404) throw new Error(`R2 recusou a exclusão (${resposta.status})`)
}
