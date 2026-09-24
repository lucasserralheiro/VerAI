/**
 * Traz a biblioteca "ContratosReceita" do SharePoint (pasta sincronizada pelo OneDrive) para o
 * repositório de documentos do cliente. Spec:
 * docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md
 *
 *   npx dotenv -e .env.production.local -- npx tsx scripts/sincronizar-sharepoint.ts             # só lista
 *   npx dotenv -e .env.production.local -- npx tsx scripts/sincronizar-sharepoint.ts --aplicar   # grava
 *
 * Opções: --pasta="C:\...\rede.sp - ContratosReceita" (padrão: ~/rede.sp/rede.sp - ContratosReceita
 * ou SHAREPOINT_PASTA), --incluir-work (inclui rascunhos das pastas WORK).
 * Mapa de pastas que não são a sigla do cliente: scripts/sharepoint-clientes.json.
 * Idempotente; o agendador roda scripts/sincronizar-sharepoint.bat.
 */
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { sincronizarSharepoint, type ArquivoFonte, type FonteArquivos } from '../src/lib/arquivos/sharepoint/sincronizar'
import type { MapaPastas } from '../src/lib/arquivos/sharepoint/regras'

// .env.local completa o que faltar (ex.: BLOB_READ_WRITE_TOKEN) sem sobrescrever o que o dotenv -e já trouxe.
config({ path: '.env.local' })

const prisma = new PrismaClient()

function argumento(nome: string): string | undefined {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`))
  return achado?.slice(nome.length + 3).replace(/^"|"$/g, '')
}

function fonteDaPasta(raiz: string): FonteArquivos {
  return {
    async listar() {
      const saida: ArquivoFonte[] = []
      async function andar(relativo: string[]) {
        const entradas = await readdir(path.join(raiz, ...relativo), { withFileTypes: true })
        for (const e of entradas) {
          const proximo = [...relativo, e.name]
          if (e.isDirectory()) {
            await andar(proximo)
          } else if (e.isFile()) {
            // stat não baixa o conteúdo (Arquivos On-Demand) — só a leitura baixa.
            const s = await stat(path.join(raiz, ...proximo))
            saida.push({ caminho: proximo.join('/'), tamanhoBytes: s.size, modificadoEm: s.mtime })
          }
        }
      }
      await andar([])
      return saida
    },
    ler(caminho) {
      return readFile(path.join(raiz, ...caminho.split('/')))
    },
  }
}

/** Duas execuções ao mesmo tempo (agendador + manual) gravariam o mesmo arquivo duas vezes. */
function travar(): () => void {
  const trava = path.join(tmpdir(), 'verai-sincronizar-sharepoint.lock')
  if (existsSync(trava) && Date.now() - statSync(trava).mtimeMs < 2 * 60 * 60 * 1000) {
    throw new Error(`outra execução em andamento (${trava}); apague o arquivo se tiver certeza que não há`)
  }
  writeFileSync(trava, String(process.pid))
  return () => {
    try {
      unlinkSync(trava)
    } catch {}
  }
}

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const incluirWork = process.argv.includes('--incluir-work')
  const raiz =
    argumento('pasta') ?? process.env.SHAREPOINT_PASTA ?? path.join(homedir(), 'rede.sp', 'rede.sp - ContratosReceita')
  if (!existsSync(raiz)) throw new Error(`pasta não encontrada: ${raiz}`)

  const arquivoMapa = path.join(__dirname, 'sharepoint-clientes.json')
  const configuracao = existsSync(arquivoMapa) ? JSON.parse(readFileSync(arquivoMapa, 'utf8')) : {}
  const mapa: MapaPastas = configuracao.pastas ?? {}

  const destravar = travar()
  try {
    const inicio = Date.now()
    const r = await sincronizarSharepoint(prisma, { aplicar, incluirWork, mapa, fonte: fonteDaPasta(raiz) })
    const segundos = Math.round((Date.now() - inicio) / 1000)

    console.log(`\n${new Date().toLocaleString('pt-BR')} · ${aplicar ? 'APLICADO' : 'SÓ LISTAGEM (use --aplicar para gravar)'} · ${segundos}s`)
    console.log(`pasta: ${raiz}`)
    console.log(
      `listados ${r.listados} · novos ${r.novos} · já existiam ${r.reaproveitados} · conteúdo trocado ${r.conteudoTrocado} · ` +
        `inalterados ${r.inalterados} · sumiram da origem ${r.sumiramDaOrigem} · removidos ${r.removidos} · falhas ${r.falhas.length}`
    )
    for (const [motivo, n] of Object.entries(r.ignorados)) console.log(`  ignorados (${motivo}): ${n}`)
    const semCliente = Object.entries(r.semCliente)
    if (semCliente.length > 0) {
      console.log('\nPastas sem cliente (rode importar-sharepoint-contratos.ts pra criar, ou mapeie em scripts/sharepoint-clientes.json → "pastas"):')
      for (const [pasta, n] of semCliente) console.log(`  "${pasta}": ${n} arquivo(s)`)
    }
    for (const m of r.mantidosEmUso) console.log(`  mantido (em uso) ${m.arquivoId}: ${m.motivo}`)
    for (const f of r.falhas) console.log(`  falha ${f.caminho}: ${f.motivo}`)
    if (r.remocaoSuspensa) console.log(`\nATENÇÃO: ${r.remocaoSuspensa}`)
  } finally {
    destravar()
  }
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
