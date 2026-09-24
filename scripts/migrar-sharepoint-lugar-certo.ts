/**
 * Prepara o banco para a sincronização "tudo no lugar certo" (spec
 * docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §6). Idempotente.
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts            # só lista
 *   npx dotenv -e .env.development -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts --aplicar  # grava
 *   ... --apagar-copias [--aplicar]   # DEPOIS do deploy do código novo: apaga os blobs das cópias antigas
 *
 * Ordem: 1) cópias de PDF do histórico → referência ao repositório; 2) chave dos contratos pela sigla
 * (funde o que a chave antiga duplicou); 3) linhas duplicadas com o mesmo PDF.
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { apagarCopiasMigradas, migrarAnexosParaReferencia } from '../src/lib/importacao-sharepoint/migracao-anexos'
import { fundirLinhasDuplicadas, migrarChavesDeContrato } from '../src/lib/importacao-sharepoint/migracao-chaves'

// .env.local completa o que faltar (ex.: BLOB_READ_WRITE_TOKEN) sem sobrescrever o que o dotenv -e já trouxe.
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const modo = aplicar ? 'APLICADO' : 'SÓ LISTAGEM (use --aplicar para gravar)'

  if (process.argv.includes('--apagar-copias')) {
    const r = await apagarCopiasMigradas(prisma, { aplicar })
    console.log(`${modo} · cópias antigas de PDF do histórico ${aplicar ? 'apagadas' : 'a apagar'}: ${r.apagadas}`)
    return
  }

  const anexos = await migrarAnexosParaReferencia(prisma, { aplicar })
  console.log(modo)
  console.log(`1) anexos → referência: ${anexos.referenciados} (novos no repositório ${anexos.novosNoRepositorio}, já existiam ${anexos.reaproveitados}), falhas ${anexos.falhas.length}`)
  for (const f of anexos.falhas) console.log(`   falha linha ${f.linhaId} (${f.coluna}): ${f.motivo}`)

  const chaves = await migrarChavesDeContrato(prisma, { aplicar })
  console.log(`2) contratos: chave renomeada ${chaves.renomeados}, fundidos ${chaves.fundidos.length}, para revisar ${chaves.revisar.length}`)
  for (const f of chaves.fundidos) console.log(`   fundido ${f}`)
  for (const f of chaves.revisar) console.log(`   REVISAR ${f}`)

  const linhas = await fundirLinhasDuplicadas(prisma, { aplicar })
  console.log(`3) linhas duplicadas fundidas: ${linhas.fundidas.length}, para revisar ${linhas.revisar.length}`)
  for (const f of linhas.fundidas) console.log(`   fundida ${f}`)
  for (const f of linhas.revisar) console.log(`   REVISAR ${f}`)
  if (!aplicar) console.log('(na listagem a etapa 3 não enxerga os PDFs da etapa 1 — o número real aparece com --aplicar)')
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
