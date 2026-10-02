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

function decodificarPalavras(valor: string): string {
  return valor.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, _charset, cod: string, texto: string) =>
    cod.toUpperCase() === 'B'
      ? Buffer.from(texto, 'base64').toString('utf8')
      : Buffer.from(texto.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8')
  )
}

function decodificarCorpo(corpo: string, encoding: string | undefined): string {
  const enc = (encoding ?? '').toLowerCase()
  if (enc === 'base64') return Buffer.from(corpo.replace(/\s/g, ''), 'base64').toString('utf8')
  if (enc === 'quoted-printable') {
    const bytes = corpo.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    return Buffer.from(bytes, 'latin1').toString('utf8')
  }
  // 7bit/8bit: o bruto foi lido como latin1 para preservar bytes; reconstrói o UTF-8.
  return Buffer.from(corpo, 'latin1').toString('utf8')
}

const nomeDoAnexo = (c: Record<string, string>) => {
  const m = /filename\*?="?([^";]+)"?/i.exec(c['content-disposition'] ?? '') ?? /name="?([^";]+)"?/i.exec(c['content-type'] ?? '')
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
  const corpo = plain
    ? decodificarCorpo(plain.corpo, plain.cabecalhos['content-transfer-encoding'])
    : html
      ? htmlParaTexto(decodificarCorpo(html.corpo, html.cabecalhos['content-transfer-encoding']))
      : ''
  const c = raiz.cabecalhos
  // Cabeçalhos também chegam como bytes latin1 quando o e-mail traz UTF-8 cru.
  const h = (k: string) => (c[k] ? decodificarPalavras(Buffer.from(c[k], 'latin1').toString('utf8')) : null)
  return { de: h('from'), para: h('to'), data: h('date'), assunto: h('subject'), corpo: corpo.replace(/\r\n/g, '\n').trim(), anexos }
}
