import mammoth from 'mammoth'

const TEXTO_MAX_CARACTERES = 60000

export async function extrairDocx(buffer: Buffer): Promise<string> {
  const { value: texto } = await mammoth.extractRawText({ buffer })

  const truncado = texto.length > TEXTO_MAX_CARACTERES
  const textoFinal = truncado
    ? texto.slice(0, TEXTO_MAX_CARACTERES) + '\n[... texto truncado ...]'
    : texto

  return textoFinal
}

export async function converterDocxParaHtml(buffer: Buffer): Promise<string> {
  const { value: html } = await mammoth.convertToHtml({ buffer })
  return html
}
