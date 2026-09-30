import { getDocumentProxy } from 'unpdf'
import type { ItemPdf } from './leitura'

/** Textos do PDF com a posição (x, y) e a página — a leitura dos links é por posição. */
export async function itensDoPdf(conteudo: Buffer): Promise<ItemPdf[]> {
  const pdf = await getDocumentProxy(new Uint8Array(conteudo))
  const saida: ItemPdf[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const c = await (await pdf.getPage(p)).getTextContent()
    for (const i of c.items) {
      if ('str' in i && i.str.trim() !== '') saida.push({ pagina: p, x: Math.round(i.transform[4] as number), y: Math.round(i.transform[5] as number), s: i.str.trim() })
    }
  }
  await pdf.cleanup?.()
  return saida
}
