import { getDocumentProxy } from 'unpdf'
import type { LinhaPdf } from './leitura'

/** Itens do PDF agrupados em linhas pela altura (y), páginas em sequência, textos da esquerda para a direita.
 *  É a posição, não a ordem do texto extraído, que diz a que tabela uma linha pertence (o título "FATURADO"
 *  pode vir no fim do texto e estar desenhado acima da tabela). */
export async function linhasDoPdf(conteudo: Buffer): Promise<LinhaPdf[]> {
  const pdf = await getDocumentProxy(new Uint8Array(conteudo))
  const saida: LinhaPdf[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const c = await (await pdf.getPage(p)).getTextContent()
    const itens = c.items
      .flatMap((i) => ('str' in i && i.str.trim() !== '' ? [{ x: i.transform[4] as number, y: i.transform[5] as number, s: i.str.trim() }] : []))
      .sort((a, b) => b.y - a.y || a.x - b.x)
    const linhas: { y: number; itens: typeof itens }[] = []
    for (const i of itens) {
      const l = linhas.find((x) => Math.abs(x.y - i.y) < 3)
      if (l) l.itens.push(i)
      else linhas.push({ y: i.y, itens: [i] })
    }
    for (const l of linhas) saida.push({ pagina: p, textos: l.itens.sort((a, b) => a.x - b.x).map((i) => i.s) })
  }
  await pdf.cleanup?.()
  return saida
}
