import type { getDocumentProxy } from 'unpdf'

/** Negrito/itálico de um trecho de texto — um valor por item, na MESMA ordem
 *  e com o MESMO filtro (`item.str != null`) que `unpdf.extractTextItems`
 *  usa pra montar `items[pagina]`, então dá pra combinar os dois por índice. */
export interface EstiloDeFonte {
  negrito: boolean
  italico: boolean
}

const REGEX_NEGRITO = /bold|negrito|black/i
const REGEX_ITALICO = /italic|oblique|itálico/i

/**
 * Resolve negrito/itálico a partir do NOME REAL da fonte embutida no PDF
 * (ex.: "BCDGEE+Arial-BoldMT"), não do `fontFamily` que `unpdf.extractTextItems`
 * devolve — esse campo é só a classificação CSS genérica que o pdf.js atribui a
 * QUALQUER fonte embutida/subconjunto (o caso comum: PDF gerado por Word,
 * LibreOffice, etc.), sem carregar peso nem estilo nela.
 *
 * Medido na proposta de referência: os 127.327 caracteres do documento inteiro
 * saem com `fontFamily` "sans-serif" — negrito/itálico nunca eram detectados
 * por esse campo, mesmo em título visivelmente em negrito no PDF original
 * ("INTRODUÇÃO", fonte real "BCDGEE+Arial-BoldMT" — o corpo do texto ao redor
 * usa "BCDEEE+ArialMT", sem "Bold" no nome).
 *
 * O nome real só fica disponível depois que a fonte é CARREGADA pelo pdf.js —
 * daí o `page.getOperatorList()` antes de ler `commonObjs`. Isso já acontece
 * de qualquer forma em `pdfTracos.ts` (que lê a mesma lista de operações pra
 * extrair traço vetorial); chamar de novo aqui é barato — pdf.js cacheia o
 * resultado por página, não reprocessa o content stream duas vezes — e deixa
 * este módulo independente da ordem de chamada no pipeline.
 */
export async function obterEstilosDeFontePorPagina(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  totalPaginas: number
): Promise<EstiloDeFonte[][]> {
  const porPagina: EstiloDeFonte[][] = []
  for (let i = 0; i < totalPaginas; i++) {
    const pagina = await pdf.getPage(i + 1)
    await pagina.getOperatorList()
    const conteudo = await pagina.getTextContent()
    const estilos = (conteudo.items as Array<{ str: string | null; fontName?: string }>)
      .filter((item) => item.str != null)
      .map((item) => {
        let nomeReal = ''
        try {
          nomeReal = item.fontName ? (pagina.commonObjs.get(item.fontName)?.name ?? '') : ''
        } catch {
          nomeReal = '' // fonte não resolvida (raríssimo já com getOperatorList acima) — trata como sem estilo
        }
        return { negrito: REGEX_NEGRITO.test(nomeReal), italico: REGEX_ITALICO.test(nomeReal) }
      })
    porPagina.push(estilos)
  }
  return porPagina
}
