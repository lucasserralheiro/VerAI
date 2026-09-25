/**
 * Carga/atualização do índice de texto dos documentos usado pelo assistente de IA.
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/indexar-documentos.ts              # sincroniza (confere versão no Blob)
 *   npx dotenv -e .env.development -- npx tsx scripts/indexar-documentos.ts --reindexar  # apaga tudo e reindexa
 *
 * Ver docs/superpowers/specs/2026-09-23-assistente-ia-design.md §5.
 */
import { prisma } from '../src/lib/prisma'
import { sincronizarIndice } from '../src/lib/assistente/indexacao/sincronizar'
import { emMb, LIMITE_BYTES_INDICE, tamanhoDoIndice } from '../src/lib/assistente/indexacao/tamanho'

async function main() {
  const reindexar = process.argv.includes('--reindexar')
  if (reindexar) {
    const { count } = await prisma.indiceDocumento.deleteMany({})
    console.log(`índice apagado (${count} arquivos)`)
  }
  const total = { ok: 0, sem_texto: 0, erro: 0, removidos: 0 }
  for (;;) {
    const bytes = await tamanhoDoIndice()
    if (bytes > LIMITE_BYTES_INDICE) {
      console.log(`PARADO: TrechoDocumento com ${emMb(bytes)}, acima do teto de 80 MB — a decisão é do usuário (spec 2026-09-25-assistente-base-economica §7.5)`)
      break
    }
    const r = await sincronizarIndice({ conferirVersao: !reindexar, limite: 50 })
    total.ok += r.ok
    total.sem_texto += r.sem_texto
    total.erro += r.erro
    total.removidos += r.removidos
    console.log(`rodada: ${JSON.stringify(r)}`)
    if (r.restantes === 0 || r.ok + r.sem_texto + r.erro === 0) break
  }
  console.log(`total: ${JSON.stringify(total)}`)
  const erros = await prisma.indiceDocumento.findMany({ where: { status: { not: 'ok' } }, select: { status: true, nomeArquivo: true, mensagem: true } })
  for (const e of erros) console.log(`  [${e.status}] ${e.nomeArquivo}${e.mensagem ? ` — ${e.mensagem}` : ''}`)
  console.log(`TrechoDocumento: ${emMb(await tamanhoDoIndice())}`)
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
