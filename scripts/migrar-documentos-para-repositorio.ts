/**
 * Leva os `Documento` (upload por competência) para o repositório de documentos do cliente
 * (docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md §3.7).
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/migrar-documentos-para-repositorio.ts            # só conta
 *   npx dotenv -e .env.development -- npx tsx scripts/migrar-documentos-para-repositorio.ts --aplicar  # grava
 *
 * Não copia blob: o `ArquivoCliente` aponta para a mesma URL do `Documento`. Idempotente.
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { migrarDocumentos } from '../src/lib/arquivos/migracao-documentos'

if (!process.env.DATABASE_URL) config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const r = await migrarDocumentos(prisma, { aplicar })
  console.log(`${aplicar ? 'APLICADO' : 'SÓ LISTAGEM (use --aplicar para gravar)'}`)
  console.log(`documentos sem arquivo: ${r.total} · criados: ${r.criados} · reaproveitados: ${r.reaproveitados} · falhas: ${r.falhas.length}`)
  for (const falha of r.falhas) console.log(`  falha ${falha.documentoId}: ${falha.motivo}`)
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
