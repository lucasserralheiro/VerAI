import { extractTextItems, getDocumentProxy } from 'unpdf'
import { extrairConteudo } from '@/lib/extracao'
import { repararTextosDoPdf } from '@/lib/extracao/repararTextoPdf'
import { htmlParaTexto, type PaginaDeTexto } from './trechos'

/**
 * Texto de um PDF página a página, SEM o limite de 60 mil caracteres do `extrairPdf` (aquele é pra
 * análise por IA; aqui cada página vira seus trechos). Passa pelo mesmo reparo de `ToUnicode` da
 * conversão (`repararTextosDoPdf`), que nunca altera token com dígito.
 */
async function extrairPaginasPdf(buffer: Buffer): Promise<PaginaDeTexto[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { items } = await extractTextItems(pdf)
  const reparo = repararTextosDoPdf(items.map((pagina) => pagina.map((item) => item.str ?? '')))
  return items.map((pagina, indice) => ({
    pagina: indice + 1,
    texto: pagina
      .map((item, posicao) => reparo.textosPorPagina[indice][posicao] + (item.hasEOL ? '\n' : ' '))
      .join('')
      .replace(/[ \t]+/g, ' ')
      .replace(/ \n/g, '\n')
      .trim(),
  }))
}

export async function extrairPaginas(buffer: Buffer, tipo: string): Promise<PaginaDeTexto[]> {
  if (tipo === 'pdf') return extrairPaginasPdf(buffer)
  // Texto oficial baixado do site (lei, decreto): txt ou html, sem página.
  if (tipo === 'txt') return [{ pagina: null, texto: buffer.toString('utf8') }]
  if (tipo === 'html' || tipo === 'htm') return [{ pagina: null, texto: htmlParaTexto(buffer.toString('utf8')) }]
  return [{ pagina: null, texto: await extrairConteudo(buffer, tipo) }]
}

/** PDF escaneado: nenhuma página com ao menos 20 caracteres não-brancos. O OCR do projeto roda no
 *  navegador, então esse arquivo fica `sem_texto` (spec §5.2). */
export function semCamadaDeTexto(paginas: PaginaDeTexto[]): boolean {
  return paginas.every((p) => p.texto.replace(/\s/g, '').length < 20)
}
