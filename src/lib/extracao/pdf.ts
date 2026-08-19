import { extractText, getDocumentProxy } from 'unpdf'

const TEXTO_MAX_CARACTERES = 60000

export async function extrairPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text, totalPages } = await extractText(pdf, { mergePages: true })

  const truncado = text.length > TEXTO_MAX_CARACTERES
  const textoFinal = truncado ? text.slice(0, TEXTO_MAX_CARACTERES) + '\n[... texto truncado ...]' : text

  return [`PDF com ${totalPages} página(s).`, '', textoFinal].join('\n')
}
