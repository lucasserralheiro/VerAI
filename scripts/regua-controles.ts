/**
 * Régua da leitura dos Controles de Contratos (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md
 * §8): lê os PDFs da pasta sincronizada e conta quantas tabelas fecham. Rodar antes e depois de mexer em
 * src/lib/controles-contratos/leitura.ts. Só lê — não grava nada.
 *   npx tsx scripts/regua-controles.ts [--pasta="…\Controles de Contratos"]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { lerControle } from '../src/lib/controles-contratos/leitura'
import { contratoDoNome } from '../src/lib/controles-contratos/nome'
import { linhasDoPdf } from '../src/lib/controles-contratos/pdf'

async function main() {
  const pasta =
    process.argv.find((a) => a.startsWith('--pasta='))?.slice(8).replace(/^"|"$/g, '') ??
    path.join(homedir(), 'rede.sp', 'rede.sp - Documentos', 'FATURAMENTO SERVIÇOS PRODAM', 'Controles de Contratos')
  const r = { total: 0, vigencia: 0, previsto: 0, faturado: 0, ambos: 0, semChave: 0 }
  const falhas: string[] = []
  for (const mes of readdirSync(pasta)) {
    for (const nome of readdirSync(path.join(pasta, mes)).filter((n) => n.toLowerCase().endsWith('.pdf'))) {
      r.total++
      const c = lerControle(await linhasDoPdf(readFileSync(path.join(pasta, mes, nome))))
      if (c.vigenciaTexto) r.vigencia++
      if (c.previsto?.conferida) r.previsto++
      if (c.faturado?.conferida) r.faturado++
      if (c.previsto?.conferida && c.faturado?.conferida) r.ambos++
      else {
        const estado = (t: typeof c.previsto) => (t ? (t.conferida ? 'ok' : `não fecha (${t.linhas.length} linhas)`) : 'não achado')
        falhas.push(`${mes}/${nome}: previsto ${estado(c.previsto)} · faturado ${estado(c.faturado)}`)
      }
      if (!contratoDoNome(nome).chave) r.semChave++
    }
  }
  console.log(
    `PDFs ${r.total} · vigência ${r.vigencia} · previsto fecha ${r.previsto} · faturado fecha ${r.faturado} · os dois ${r.ambos} (${Math.round((r.ambos / Math.max(1, r.total)) * 100)}%) · sem nº no nome ${r.semChave}`
  )
  for (const f of falhas.slice(0, 60)) console.log(`  ${f}`)
}
main()
