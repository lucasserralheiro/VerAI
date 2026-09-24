import { getDocumentProxy } from 'unpdf'

// Texto de um PDF de termo pra `extrairCampos`. Só as primeiras e as últimas páginas: o cabeçalho
// (SEI, objeto, valor) e as cláusulas de vigência ficam no começo, as assinaturas no fim — e PDF
// escaneado de 10 MB com 40 páginas travava a leitura inteira.

const PRIMEIRAS = 8
const ULTIMAS = 3
const LIMITE_MS = 30_000

export async function textoDoPdf(buffer: Buffer): Promise<string> {
  const leitura = (async () => {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const total = pdf.numPages
    const paginas = new Set<number>()
    for (let p = 1; p <= Math.min(PRIMEIRAS, total); p++) paginas.add(p)
    for (let p = Math.max(1, total - ULTIMAS + 1); p <= total; p++) paginas.add(p)
    const partes: string[] = []
    for (const numero of [...paginas].sort((a, b) => a - b)) {
      const pagina = await pdf.getPage(numero)
      const conteudo = await pagina.getTextContent()
      // Quebra de linha onde o PDF marca fim de linha — `achatar` junta tudo depois.
      partes.push(conteudo.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : '') : '')).join(''))
    }
    await pdf.cleanup?.()
    return partes.join('\n')
  })()
  const limite = new Promise<string>((_, rejeitar) => setTimeout(() => rejeitar(new Error('leitura do PDF passou de 30 s')), LIMITE_MS).unref())
  return Promise.race([leitura, limite])
}
