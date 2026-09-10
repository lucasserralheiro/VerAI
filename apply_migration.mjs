import { Client } from 'pg'
import { readFileSync } from 'fs'
import { config } from 'dotenv'
import crypto from 'crypto'

config({ path: '.env.local' })

const client = new Client({ connectionString: process.env.DATABASE_URL })

async function main() {
  await client.connect()

  const migrationDir = '20260831150824_add_proposta_comercial_arquivo'
  const sql = readFileSync(`prisma/migrations/${migrationDir}/migration.sql`, 'utf-8')
  const checksum = crypto.createHash('sha256').update(sql).digest('hex')

  // Verifica se já existe uma tabela PropostaComercialArquivo (idempotência)
  const check = await client.query(
    `SELECT to_regclass('public."PropostaComercialArquivo"') as exists`
  )
  if (check.rows[0].exists) {
    console.log('✓ Tabela já existe, pulando aplicação do SQL (idempotente)')
  } else {
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('COMMIT')
      console.log('✓ SQL da migração aplicado com sucesso')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  }

  // Registra no histórico do Prisma (_prisma_migrations) pra não conflitar com migrate futuro
  const existing = await client.query(
    `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1`,
    [migrationDir]
  )
  if (existing.rows.length === 0) {
    await client.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, $3, NULL, NULL, now(), 1)`,
      [crypto.randomUUID(), checksum, migrationDir]
    )
    console.log('✓ Registrada em _prisma_migrations')
  } else {
    console.log('✓ Já registrada em _prisma_migrations')
  }

  await client.end()
}

main().catch((err) => {
  console.error('✗ Erro:', err.message)
  process.exit(1)
})
