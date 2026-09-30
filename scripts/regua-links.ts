/**
 * Régua da leitura dos relatórios de Links MPLS (spec docs/superpowers/specs/2026-09-29-links-mpls-design.md §4):
 * lê os PDFs da pasta sincronizada e conta quantos fecham pela prova (códigos lidos = Total Geral = TOTAL =).
 * Rodar antes e depois de mexer em src/lib/links-mpls/leitura.ts. Só lê — não grava nada.
 *   npx tsx scripts/regua-links.ts [--pasta="…\Links MPLS - Relatórios para Faturamento"] [--detalhe]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { lerRelatorioLinks } from '../src/lib/links-mpls/leitura'
import { itensDoPdf } from '../src/lib/links-mpls/pdf'

function* pdfs(pasta: string): Generator<string> {
  for (const nome of readdirSync(pasta)) {
    const p = path.join(pasta, nome)
    if (statSync(p).isDirectory()) yield* pdfs(p)
    else if (/\.pdf$/i.test(nome)) yield p
  }
}

async function main() {
  const pasta =
    process.argv.find((a) => a.startsWith('--pasta='))?.slice(8).replace(/^"|"$/g, '') ??
    path.join(homedir(), 'rede.sp', 'rede.sp - Documentos', 'FATURAMENTO SERVIÇOS PRODAM', 'Links MPLS - Relatórios para Faturamento')
  const r = { total: 0, conferidos: 0, links: 0, semTitulo: 0, semContrato: 0, semSituacao: 0, semEntidade: 0, semEndereco: 0 }
  const falhas: string[] = []
  for (const arquivo of pdfs(pasta)) {
    r.total++
    const lido = lerRelatorioLinks(await itensDoPdf(readFileSync(arquivo)))
    if (lido.conferido) r.conferidos++
    else falhas.push(`${path.relative(pasta, arquivo)}: ${lido.avisos.join(' · ') || 'sem aviso'}`)
    r.links += lido.links.length
    if (!lido.titulo) r.semTitulo++
    if (!lido.contratoTexto && !lido.links.some((l) => l.contratoTexto)) r.semContrato++
    if (!lido.secoes.some((s) => s.situacao)) r.semSituacao++
    r.semEntidade += lido.links.filter((l) => !l.entidade).length
    r.semEndereco += lido.links.filter((l) => !l.endereco).length
    if (process.argv.includes('--detalhe') && lido.links[0]) console.log(path.basename(arquivo), JSON.stringify(lido.links[0]))
  }
  console.log(
    `PDFs ${r.total} · conferidos ${r.conferidos} (${Math.round((r.conferidos / Math.max(1, r.total)) * 100)}%) · links ${r.links} · sem título ${r.semTitulo} · sem contrato ${r.semContrato} · sem situação ${r.semSituacao} · links sem entidade ${r.semEntidade} · sem endereço ${r.semEndereco}`
  )
  for (const f of falhas.slice(0, 60)) console.log(`  ${f}`)
}
main()
