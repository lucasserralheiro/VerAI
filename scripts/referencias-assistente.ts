/**
 * Textos oficiais (leis, decretos, regulamento interno) que o assistente cita com artigo — spec
 * docs/superpowers/specs/2026-09-25-assistente-senior-design.md §4.2.
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/referencias-assistente.ts --pasta="C:\normas"            # só lista
 *   npx dotenv -e .env.development -- npx tsx scripts/referencias-assistente.ts --pasta="C:\normas" --aplicar  # grava
 *
 * Cada arquivo (pdf, docx, html, txt) da pasta sobe para o R2 (prefixo `referencias/`) e vira um
 * `DocumentoReferencia`; o título é o nome do arquivo sem extensão (ex.: "Lei 14.133-2021.html" →
 * "Lei 14.133-2021"). Arquivo que sumiu da pasta recebe remoção lógica. Com --aplicar, termina
 * indexando. Na pasta só entra texto público ou regulamento interno, nunca documento restrito.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'

// R2_* moram no .env.local (mesmo arranjo de scripts/sincronizar-sharepoint.ts).
config({ path: '.env.local' })

import { prisma } from '../src/lib/prisma'
import { putR2 } from '../src/lib/r2'
import { nomeSeguro } from '../src/lib/arquivos/caminhos'
import { extensaoDe } from '../src/lib/arquivos/tipos'
import { EXTENSOES_REFERENCIA } from '../src/lib/assistente/indexacao/fontes'
import { sincronizarIndice } from '../src/lib/assistente/indexacao/sincronizar'

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
}

function argumento(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3).replace(/^"|"$/g, '')
}

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const pasta = argumento('pasta')
  if (!pasta || !existsSync(pasta)) throw new Error(`informe --pasta com uma pasta que exista (recebido: ${pasta ?? 'nada'})`)

  const arquivos = readdirSync(pasta)
    .filter((nome) => EXTENSOES_REFERENCIA.includes(extensaoDe(nome)))
    .map((nome) => {
      const conteudo = readFileSync(path.join(pasta, nome))
      return { nome, titulo: nome.replace(/\.[^.]+$/, ''), conteudo, sha256: createHash('sha256').update(conteudo).digest('hex') }
    })
  const existentes = await prisma.documentoReferencia.findMany({ select: { id: true, sha256: true, titulo: true, removidoEm: true } })
  const porSha = new Map(existentes.map((e) => [e.sha256, e]))
  const naPasta = new Set(arquivos.map((a) => a.sha256))

  const novos = arquivos.filter((a) => !porSha.has(a.sha256))
  const reativar = arquivos.filter((a) => porSha.get(a.sha256)?.removidoEm)
  const sumiram = existentes.filter((e) => !e.removidoEm && !naPasta.has(e.sha256))
  console.log(`${pasta}: ${arquivos.length} arquivo(s) · novos ${novos.length} · voltaram ${reativar.length} · sumiram ${sumiram.length}`)
  for (const a of novos) console.log(`  + ${a.titulo}`)
  for (const a of reativar) console.log(`  ↺ ${a.titulo}`)
  for (const e of sumiram) console.log(`  − ${e.titulo}`)
  if (!aplicar) {
    console.log('\nSÓ LISTAGEM (use --aplicar para gravar)')
    return
  }

  for (const a of novos) {
    const registro = await prisma.documentoReferencia.create({
      data: { titulo: a.titulo, nomeArquivo: a.nome, urlBlob: '', sha256: a.sha256, contentType: CONTENT_TYPES[extensaoDe(a.nome)], tamanhoBytes: a.conteudo.length },
    })
    const url = await putR2(`referencias/${registro.id}-${nomeSeguro(a.nome)}`, a.conteudo, registro.contentType)
    await prisma.documentoReferencia.update({ where: { id: registro.id }, data: { urlBlob: url } })
  }
  for (const a of reativar) await prisma.documentoReferencia.update({ where: { sha256: a.sha256 }, data: { removidoEm: null, titulo: a.titulo } })
  if (sumiram.length > 0) await prisma.documentoReferencia.updateMany({ where: { id: { in: sumiram.map((e) => e.id) } }, data: { removidoEm: new Date() } })

  const r = await sincronizarIndice({ limite: 100 })
  console.log(`\níndice: indexados ${r.ok} · sem texto ${r.sem_texto} · erros ${r.erro} · removidos ${r.removidos} · pendentes ${r.restantes}`)
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
