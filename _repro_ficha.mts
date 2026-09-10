import { readFileSync } from 'node:fs'
import { converterPdfParaMarkdown } from './src/lib/extracao/pdfMarkdown.ts'

const DL = 'C:/Users/p017886/Downloads'
const NOME = 'Ficha Inscrição EA Lucas-Serralheiro (1).pdf'

async function main() {
  const buf = readFileSync(`${DL}/${NOME}`)
  const md = await converterPdfParaMarkdown(buf)
  const str = typeof md === 'string' ? md : (md as { markdown: string }).markdown
  console.log(str)
}

main().catch((e) => { console.error(e); process.exit(1) })
