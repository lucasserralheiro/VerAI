import { Client } from 'pg'
import { config } from 'dotenv'
config({ path: '.env.development' })

const client = new Client({ connectionString: process.env.DATABASE_URL })

async function main() {
  await client.connect()

  const cols = await client.query(
    `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'PropostaComercial' ORDER BY ordinal_position`
  )
  console.log('Colunas de PropostaComercial:', JSON.stringify(cols.rows))

  const tabelaArquivo = await client.query(`SELECT to_regclass('public."PropostaComercialArquivo"') as existe`)
  console.log('PropostaComercialArquivo existe?', tabelaArquivo.rows[0].existe)

  const migracao = await client.query(
    `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name LIKE '%proposta_comercial_arquivo%'`
  )
  console.log('Registro da migração:', JSON.stringify(migracao.rows))

  await client.end()
}
main().catch((e) => { console.error('✗', e.message); process.exit(1) })
