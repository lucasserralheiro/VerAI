import { extractText, getDocumentProxy } from 'unpdf'
import { localizarImagensDeConteudo, type ImagemLocalizada } from './pdfImagens'

const TEXTO_MAX_CARACTERES = 60000

/**
 * Extrai o texto de um PDF pra análise por IA, sinalizando onde havia imagem.
 *
 * Texto e imagem são canais separados dentro do PDF: um diagrama de
 * arquitetura, um print de tela ou uma tabela que veio como figura não deixam
 * NENHUM rastro no texto extraído. Sem os marcadores abaixo, a análise lê um
 * documento que parece completo e conclui, com toda a confiança, que ali não
 * havia diagrama nenhum. O marcador não recupera o conteúdo da imagem — deixa
 * explícito que ele existe e não está no texto.
 */
export async function extrairPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text: textoPorPagina, totalPages } = await extractText(pdf, { mergePages: false })
  const imagensPorPagina = await localizarImagensPorPagina(pdf, totalPages)

  const paginas = textoPorPagina.map((texto, indice) => {
    const marcadores = (imagensPorPagina.get(indice) ?? []).map(marcadorDeImagem)
    return [texto.trim(), ...marcadores].filter(Boolean).join('\n')
  })

  const texto = paginas.join('\n\n')
  const truncado = texto.length > TEXTO_MAX_CARACTERES
  const textoFinal = truncado ? texto.slice(0, TEXTO_MAX_CARACTERES) + '\n[... texto truncado ...]' : texto

  return [`PDF com ${totalPages} página(s).`, '', textoFinal].join('\n')
}

function marcadorDeImagem(imagem: ImagemLocalizada): string {
  return `[imagem na página ${imagem.pagina + 1} (${imagem.larguraPx}x${imagem.alturaPx}px) — figura do documento; o conteúdo dela não aparece no texto extraído]`
}

/** Falha na leitura das imagens não pode derrubar a extração de texto: o texto
 *  sozinho já é útil, e é o que o resto do fluxo espera. */
async function localizarImagensPorPagina(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  totalPaginas: number
): Promise<Map<number, ImagemLocalizada[]>> {
  const porPagina = new Map<number, ImagemLocalizada[]>()
  try {
    for (const imagem of await localizarImagensDeConteudo(pdf, totalPaginas)) {
      porPagina.set(imagem.pagina, [...(porPagina.get(imagem.pagina) ?? []), imagem])
    }
  } catch {
    return new Map()
  }
  return porPagina
}
