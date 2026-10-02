import { htmlParaTexto } from '../indexacao/trechos'

// Leitor mínimo de .eml (RFC 822/2045): cabeçalhos, corpo de texto e nomes dos anexos. Anexos do e-mail não são lidos.

type Parte = { cabecalhos: Record<string, string>; corpo: string }

function separar(bruto: string): Parte {
  const fim = bruto.search(/\r?\n\r?\n/)
  const cab = fim < 0 ? bruto : bruto.slice(0, fim)
  const corpo = fim < 0 ? '' : bruto.slice(fim).replace(/^\r?\n\r?\n/, '')
  const cabecalhos: Record<string, string> = {}
  for (const linha of cab.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = linha.indexOf(':')
    if (i > 0) cabecalhos[linha.slice(0, i).trim().toLowerCase()] = linha.slice(i + 1).trim()
  }
  return { cabecalhos, corpo }
}

// Decodifica bytes no charset informado; charset desconhecido cai para UTF-8.
function bytesParaTexto(bytes: Buffer, charset: string | undefined): string {
  const nome = (charset ?? 'utf-8').trim().replace(/^"|"$/g, '').toLowerCase() || 'utf-8'
  try {
    return new TextDecoder(nome).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

const bytesQuotedPrintable = (texto: string): Buffer =>
  Buffer.from(texto.replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16))), 'latin1')

// RFC 2047: cada palavra codificada traz o seu charset; o espaço entre duas adjacentes é descartado.
// O que não está codificado chegou como bytes crus (latin1) e é lido como UTF-8.
function decodificarPalavras(valor: string): string {
  const semEspacos = valor.replace(/(\?=)\s+(?==\?[^?]+\?[QqBb]\?)/g, '$1')
  let fim = 0
  let saida = ''
  for (const m of semEspacos.matchAll(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g)) {
    const ini = m.index ?? 0
    saida += bytesParaTexto(Buffer.from(semEspacos.slice(fim, ini), 'latin1'), 'utf-8')
    const bytes = m[2].toUpperCase() === 'B' ? Buffer.from(m[3], 'base64') : bytesQuotedPrintable(m[3].replace(/_/g, ' '))
    saida += bytesParaTexto(bytes, m[1].replace(/\*.*$/, ''))
    fim = ini + m[0].length
  }
  return saida + bytesParaTexto(Buffer.from(semEspacos.slice(fim), 'latin1'), 'utf-8')
}

function decodificarCorpo(parte: Parte): string {
  const enc = (parte.cabecalhos['content-transfer-encoding'] ?? '').toLowerCase()
  const charset = /charset="?([^";\s]+)"?/i.exec(parte.cabecalhos['content-type'] ?? '')?.[1]
  const bytes =
    enc === 'base64'
      ? Buffer.from(parte.corpo.replace(/\s/g, ''), 'base64')
      : enc === 'quoted-printable'
        ? bytesQuotedPrintable(parte.corpo.replace(/=\r?\n/g, ''))
        : Buffer.from(parte.corpo, 'latin1') // 7bit/8bit: o bruto foi lido como latin1 para preservar bytes
  return bytesParaTexto(bytes, charset)
}

const nomeDoAnexo = (c: Record<string, string>) => {
  const rfc2231 = /filename\*=([^']*)'[^']*'([^;]+)/i.exec(c['content-disposition'] ?? '')
  if (rfc2231) {
    const bytes = Buffer.from(
      rfc2231[2].trim().replace(/^"|"$/g, '').replace(/%([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16))),
      'latin1'
    )
    return bytesParaTexto(bytes, rfc2231[1] || 'utf-8')
  }
  const m = /filename="?([^";]+)"?/i.exec(c['content-disposition'] ?? '') ?? /name="?([^";]+)"?/i.exec(c['content-type'] ?? '')
  return m ? decodificarPalavras(m[1]) : null
}

function partes(p: Parte): Parte[] {
  const m = /boundary="?([^";]+)"?/i.exec(p.cabecalhos['content-type'] ?? '')
  if (!/multipart\//i.test(p.cabecalhos['content-type'] ?? '') || !m) return [p]
  return p.corpo
    .split(`--${m[1]}`)
    .slice(1)
    .filter((b) => !b.startsWith('--'))
    .flatMap((b) => partes(separar(b.replace(/^\r?\n/, ''))))
}

export function lerEml(conteudo: Buffer) {
  const raiz = separar(conteudo.toString('latin1'))
  const todas = partes(raiz)
  const anexos = todas.map((p) => (/attachment/i.test(p.cabecalhos['content-disposition'] ?? '') ? nomeDoAnexo(p.cabecalhos) : null)).filter((n): n is string => !!n)
  const texto = (tipo: RegExp) => todas.find((p) => tipo.test(p.cabecalhos['content-type'] ?? 'text/plain') && !/attachment/i.test(p.cabecalhos['content-disposition'] ?? ''))
  const plain = texto(/text\/plain/i)
  const html = texto(/text\/html/i)
  const corpo = plain ? decodificarCorpo(plain) : html ? htmlParaTexto(decodificarCorpo(html)) : ''
  const c = raiz.cabecalhos
  const h = (k: string) => (c[k] ? decodificarPalavras(c[k]) : null)
  return { de: h('from'), para: h('to'), data: h('date'), assunto: h('subject'), corpo: corpo.replace(/\r\n/g, '\n').trim(), anexos }
}
