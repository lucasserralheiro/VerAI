/**
 * Junta as linhas duplicadas do histórico dos contratos — o mesmo termo do legado e da pasta do SharePoint
 * (spec docs/superpowers/specs/2026-09-30-juntar-linhas-duplicadas-design.md). Sem --aplicar só simula. O
 * agendador roda a mesma coisa no fim da sincronização, antes dos valores.
 *   npx dotenv -e .env.development -- npx tsx scripts/juntar-duplicatas.ts [--aplicar] [--detalhe]
 */
import { PrismaClient } from '@prisma/client'
import { juntarDuplicatas, linhasDaJuncao } from '../src/lib/historico/duplicatas'

const prisma = new PrismaClient()

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const r = await juntarDuplicatas(prisma, { aplicar })
  console.log(linhasDaJuncao(r, aplicar, process.argv.includes('--detalhe') ? Infinity : 20).join('\n'))
  if (!aplicar) console.log('\n(simulação — nada gravado; --aplicar junta)')
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
