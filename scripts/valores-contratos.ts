/**
 * Valor, vigência e assinatura do histórico dos contratos com prova (spec
 * docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md §0). Sem --aplicar só simula: mostra o
 * que gravaria e os avisos. Grava só em campo vazio. O agendador roda a mesma coisa no fim da sincronização.
 *   npx dotenv -e .env.development -- npx tsx scripts/valores-contratos.ts [--aplicar] [--detalhe]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { aplicarValoresProvados } from '../src/lib/valores-contratos/aplicar'
import { linhasDoResumo } from '../src/lib/valores-contratos/etapa'

const prisma = new PrismaClient()

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const r = await aplicarValoresProvados(prisma, { aplicar })
  const limite = process.argv.includes('--detalhe') ? Infinity : 20
  console.log(linhasDoResumo(r, aplicar, limite).join('\n'))
  const porOrigem = new Map<string, number>()
  for (const g of r.gravacoes) porOrigem.set(`${g.campo} ${g.origem}`, (porOrigem.get(`${g.campo} ${g.origem}`) ?? 0) + 1)
  console.log('\npor origem:')
  for (const [origem, n] of [...porOrigem].sort((a, b) => b[1] - a[1])) console.log(`  ${origem}: ${n}`)
  const tiposDeAviso = new Map<string, number>()
  for (const a of r.avisos) {
    const tipo = a.aviso.replace(/R\$\s?[\d.,]+|\d{2}\/\d{2}\/\d{4}|\([^)]*\)/g, '…')
    tiposDeAviso.set(tipo, (tiposDeAviso.get(tipo) ?? 0) + 1)
  }
  console.log('\navisos por tipo:')
  for (const [tipo, n] of [...tiposDeAviso].sort((a, b) => b[1] - a[1])) console.log(`  ${n} × ${tipo}`)
  mkdirSync('logs', { recursive: true })
  writeFileSync('logs/valores-contratos.json', JSON.stringify({ quando: new Date(), aplicar, resultado: r }, null, 1))
  if (!aplicar) console.log('\n(simulação — nada gravado; --aplicar grava)')
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
