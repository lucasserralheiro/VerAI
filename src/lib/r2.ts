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

/** Codificação da AWS (RFC 3986): como `encodeURIComponent`, mais `!'()*`. */
const codificar = (texto: string) =>
  encodeURIComponent(texto).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/** Caminho do objeto na URL: cada segmento codificado uma vez (RFC 3986), barras preservadas. */
export function codificarChave(chave: string): string {
  return chave.split('/').map(codificar).join('/')
}

const chaveDeAssinatura = (segredo: string, dia: string, regiao: string, servico: string) =>
  hmac(hmac(hmac(hmac(`AWS4${segredo}`, dia), regiao), servico), 'aws4_request')

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
  const assinatura = createHmac('sha256', chaveDeAssinatura(p.segredo, dia, p.regiao, p.servico)).update(['AWS4-HMAC-SHA256', amzDate, escopo, hashCanonico].join('\n')).digest('hex')

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

export interface PedidoDeUrlAssinada {
  metodo: string
  host: string
  /** Caminho já codificado (`codificarChave`). */
  caminho: string
  /** Cabeçalhos a assinar além de `host` — quem usar a URL tem que mandar exatamente esses. */
  cabecalhos: Record<string, string>
  expiraEmSegundos: number
  chaveId: string
  segredo: string
  regiao: string
  servico: string
  quando: Date
}

/** URL pré-assinada (AWS SigV4 por query string, corpo não assinado — `UNSIGNED-PAYLOAD`). */
export function assinarUrlSigV4(p: PedidoDeUrlAssinada): string {
  const amzDate = dataAmz(p.quando)
  const dia = amzDate.slice(0, 8)
  const escopo = `${dia}/${p.regiao}/${p.servico}/aws4_request`
  const todos: Record<string, string> = {
    ...Object.fromEntries(Object.entries(p.cabecalhos).map(([nome, valor]) => [nome.toLowerCase(), valor.trim()])),
    host: p.host,
  }
  const nomes = Object.keys(todos).sort()
  const assinados = nomes.join(';')
  const parametros: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${p.chaveId}/${escopo}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(p.expiraEmSegundos),
    'X-Amz-SignedHeaders': assinados,
  }
  const consulta = Object.keys(parametros)
    .sort()
    .map((nome) => `${codificar(nome)}=${codificar(parametros[nome])}`)
    .join('&')
  const requisicaoCanonica = [p.metodo, p.caminho, consulta, nomes.map((n) => `${n}:${todos[n]}\n`).join(''), assinados, 'UNSIGNED-PAYLOAD'].join('\n')
  const assinatura = createHmac('sha256', chaveDeAssinatura(p.segredo, dia, p.regiao, p.servico))
    .update(['AWS4-HMAC-SHA256', amzDate, escopo, sha256(requisicaoCanonica)].join('\n'))
    .digest('hex')
  return `https://${p.host}${p.caminho}?${consulta}&X-Amz-Signature=${assinatura}`
}

const hostR2 = (cfg: ConfigR2) => `${cfg.contaId}.r2.cloudflarestorage.com`
const caminhoR2 = (cfg: ConfigR2, chave: string) => `/${cfg.bucket}/${codificarChave(chave)}`

async function pedirR2(cfg: ConfigR2, metodo: 'GET' | 'PUT' | 'DELETE', chave: string, corpo?: { dados: Buffer; contentType: string }) {
  const host = hostR2(cfg)
  const caminho = caminhoR2(cfg, chave)
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

/** Link pro NAVEGADOR gravar direto no R2 (PUT pré-assinado). Assina `content-type` e
 *  `content-length`: com ele só se grava aquele tipo e aquele tamanho, naquela chave. */
export function urlDeEnvioR2(
  chave: string,
  envio: { contentType: string; tamanhoBytes: number; expiraEmSegundos: number },
  cfg: ConfigR2 = exigirConfig(),
  quando: Date = new Date()
): string {
  return assinarUrlSigV4({
    metodo: 'PUT',
    host: hostR2(cfg),
    caminho: caminhoR2(cfg, chave),
    cabecalhos: { 'content-type': envio.contentType, 'content-length': String(envio.tamanhoBytes) },
    expiraEmSegundos: envio.expiraEmSegundos,
    chaveId: cfg.chaveId,
    segredo: cfg.segredo,
    regiao: 'auto',
    servico: 's3',
    quando,
  })
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
