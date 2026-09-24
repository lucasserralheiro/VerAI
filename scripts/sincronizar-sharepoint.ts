/**
 * Mantém o VerAI igual à biblioteca "ContratosReceita" do SharePoint (pasta sincronizada pelo
 * OneDrive): todos os arquivos na aba Documentos do cliente e cada pasta de termo na linha certa do
 * histórico do contrato. Spec: docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md
 *
 *   npx dotenv -e .env.production.local -- npx tsx scripts/sincronizar-sharepoint.ts            # só lista
 *   npx dotenv -e .env.production.local -- npx tsx scripts/sincronizar-sharepoint.ts --aplicar  # grava
 *
 * Opções: --pasta="C:\...\rede.sp - ContratosReceita" (padrão: ~/rede.sp/rede.sp - ContratosReceita ou
 * SHAREPOINT_PASTA), --clientes=SMS,SGM (só esses — listagem e remoção), --reler-tudo (reprocessa todos
 * os contratos). Configuração: scripts/sharepoint-clientes.json. Antes da primeira vez:
 * scripts/migrar-sharepoint-lugar-certo.ts. Idempotente; o agendador roda scripts/sincronizar-sharepoint.bat.
 */
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { sincronizarSharepoint, type ArquivoFonte, type FonteArquivos } from '../src/lib/arquivos/sharepoint/sincronizar'
import { textoDoPdf } from '../src/lib/importacao-sharepoint/pdf-texto'
import { extrairCampos } from '../src/lib/importacao-sharepoint/texto'

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
  const relerTudo = process.argv.includes('--reler-tudo')
  const clientes = argumento('clientes')?.split(',').map((s) => s.trim()).filter(Boolean)
  const raiz = argumento('pasta') ?? process.env.SHAREPOINT_PASTA ?? path.join(homedir(), 'rede.sp', 'rede.sp - ContratosReceita')
  if (!existsSync(raiz)) throw new Error(`pasta não encontrada: ${raiz}`)

  const arquivoConfig = path.join(__dirname, 'sharepoint-clientes.json')
  const configuracao = existsSync(arquivoConfig) ? JSON.parse(readFileSync(arquivoConfig, 'utf8')) : {}

  const destravar = travar()
  try {
    const inicio = Date.now()
    const r = await sincronizarSharepoint(prisma, {
      aplicar,
      relerTudo,
      clientes,
      fonte: fonteDaPasta(raiz),
      mapa: configuracao.pastas ?? {},
      nomes: configuracao.nomes ?? {},
      rotearPeloNome: configuracao.rotearPeloNome ?? [],
      lerCampos: async (conteudo, tipo) => extrairCampos(await textoDoPdf(conteudo), tipo),
    })
    const segundos = Math.round((Date.now() - inicio) / 1000)

    console.log(`\n${new Date().toLocaleString('pt-BR')} · ${aplicar ? 'APLICADO' : 'SÓ LISTAGEM (use --aplicar para gravar)'} · ${segundos}s`)
    console.log(`pasta: ${raiz}${clientes ? ` · só ${clientes.join(', ')}` : ''}`)
    console.log(
      `arquivos: listados ${r.listados} · novos ${r.novos} · já existiam ${r.reaproveitados} · conteúdo trocado ${r.conteudoTrocado} · ` +
        `inalterados ${r.inalterados} · sumiram ${r.sumiramDaOrigem} · removidos ${r.removidos} · falhas ${r.falhas.length}`
    )
    const c = r.contratos
    console.log(
      `contratos: processados ${c.processados} · novos ${c.contratosCriados} · completados ${c.contratosCompletados} · ` +
        `linhas novas ${c.linhasCriadas} · linhas completadas ${c.linhasCompletadas} · PDFs ligados ${c.anexosLigados} · PDFs soltos ${r.anexosSoltos}`
    )
    for (const x of r.clientes.criados) console.log(`  + cliente ${x}`)
    for (const x of r.clientes.renomeados) console.log(`  ~ cliente ${x}`)
    if (r.clientes.semNomeOficial.length) console.log(`  sem nome oficial (complete "nomes"): ${r.clientes.semNomeOficial.join(', ')}`)
    for (const [motivo, n] of Object.entries(r.ignorados)) console.log(`  ignorados (${motivo}): ${n}`)
    const semCliente = Object.entries(r.semCliente)
    if (semCliente.length > 0) {
      console.log('\nSem cliente (mapeie em scripts/sharepoint-clientes.json → "pastas"):')
      for (const [origem, n] of semCliente) console.log(`  "${origem}": ${n} arquivo(s)`)
    }
    const escaneados = c.avisos.filter((a) => a.includes('escaneado')).length
    for (const a of c.avisos.filter((x) => !x.includes('escaneado'))) console.log(`  ! ${a}`)
    if (escaneados) console.log(`  ${escaneados} PDF(s) escaneados sem texto — datas/valor ficam pra preencher na tela`)
    for (const m of r.mantidosEmUso) console.log(`  mantido (em uso no VerAI) ${m.arquivoId}: ${m.motivo}`)
    for (const f of r.falhas) console.log(`  falha ${f.caminho}: ${f.motivo}`)
    if (r.remocaoSuspensa) console.log(`\nATENÇÃO: ${r.remocaoSuspensa}`)

    if (r.conferencia) {
      const divergentes = r.conferencia.filter((l) => l.faltando.length > 0)
      const total = r.conferencia.reduce((s, l) => s + l.noSharepoint, 0)
      console.log(`\nConferência: ${total} arquivo(s) no SharePoint · ${divergentes.length === 0 ? 'TUDO NO VERAI' : `DIVERGÊNCIA em ${divergentes.length} cliente(s)`}`)
      for (const l of divergentes) {
        console.log(`  DIVERGÊNCIA ${l.cliente}: SharePoint ${l.noSharepoint} · VerAI ${l.noVerai}`)
        for (const f of l.faltando.slice(0, 20)) console.log(`    falta ${f}`)
      }
      if (divergentes.length > 0) process.exitCode = 2
    }

    mkdirSync('logs', { recursive: true })
    writeFileSync('logs/sharepoint-sincronizacao.json', JSON.stringify({ quando: new Date(), aplicar, resultado: r }, null, 1))
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
