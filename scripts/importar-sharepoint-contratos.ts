/**
 * Organiza no fluxo de cliente o que está na biblioteca "ContratosReceita" do SharePoint (pasta
 * sincronizada pelo OneDrive): cria os clientes que faltam, os contratos, as linhas do histórico
 * (contrato inicial, aditivos, prorrogações, rescisão) com SEI, datas, vigência e valor lidos do PDF
 * do termo, e anexa os PDFs de termo (TC/TA) e de proposta (PC/PA). Spec:
 * docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md §8
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/importar-sharepoint-contratos.ts            # só lista
 *   npx dotenv -e .env.development -- npx tsx scripts/importar-sharepoint-contratos.ts --aplicar  # grava
 *
 * Opções: --pasta="C:\...\rede.sp - ContratosReceita", --somente-novos (só contratos com termo que
 * ainda não foi importado — é o que o agendador usa), --cliente=SIGLA (só uma pasta de cliente).
 * NÃO sobrescreve nada que já esteja preenchido. Relatório completo em logs/sharepoint-contratos.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { montarEstrutura } from '../src/lib/importacao-sharepoint/estrutura'
import { extrairCampos } from '../src/lib/importacao-sharepoint/texto'
import { textoDoPdf } from '../src/lib/importacao-sharepoint/pdf-texto'
import { importarContratos, type ContratoLido } from '../src/lib/importacao-sharepoint/importar'
import { normalizarChave } from '../src/lib/arquivos/sharepoint/regras'

// .env.local completa o que faltar (ex.: BLOB_READ_WRITE_TOKEN) sem sobrescrever o que o dotenv -e já trouxe.
config({ path: '.env.local' })

const prisma = new PrismaClient()

function argumento(nome: string): string | undefined {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`))
  return achado?.slice(nome.length + 3).replace(/^"|"$/g, '')
}

async function listar(raiz: string): Promise<string[]> {
  const saida: string[] = []
  async function andar(relativo: string[]) {
    for (const e of await readdir(path.join(raiz, ...relativo), { withFileTypes: true })) {
      if (e.isDirectory()) await andar([...relativo, e.name])
      else if (e.isFile()) saida.push([...relativo, e.name].join('/').normalize('NFC'))
    }
  }
  await andar([])
  return saida
}

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const somenteNovos = process.argv.includes('--somente-novos')
  const soCliente = argumento('cliente')
  const raiz = argumento('pasta') ?? process.env.SHAREPOINT_PASTA ?? path.join(homedir(), 'rede.sp', 'rede.sp - ContratosReceita')
  if (!existsSync(raiz)) throw new Error(`pasta não encontrada: ${raiz}`)

  const arquivoConfig = path.join(__dirname, 'sharepoint-clientes.json')
  const configuracao = existsSync(arquivoConfig) ? JSON.parse(readFileSync(arquivoConfig, 'utf8')) : {}

  const lerArquivo = (caminho: string) => readFile(path.join(raiz, ...caminho.split('/')))
  let estrutura = montarEstrutura(await listar(raiz))
  if (soCliente) estrutura = estrutura.filter((c) => normalizarChave(c.pastaCliente) === normalizarChave(soCliente))
  if (somenteNovos) {
    const feitos = new Set(
      (await prisma.historicoContrato.findMany({ where: { chaveSharepoint: { not: null } }, select: { chaveSharepoint: true } })).map((l) => l.chaveSharepoint!)
    )
    estrutura = estrutura.filter((c) => c.termos.some((t) => !feitos.has(t.chave)))
  }

  const inicio = Date.now()
  const contratos: ContratoLido[] = []
  let lidos = 0
  for (const c of estrutura) {
    const termos = []
    for (const t of c.termos) {
      let campos = null
      if (t.termoPdf) {
        try {
          campos = extrairCampos(await textoDoPdf(await lerArquivo(t.termoPdf)), t.tipo)
          lidos++
        } catch (erro) {
          console.log(`  não li ${t.termoPdf}: ${erro instanceof Error ? erro.message : erro}`)
        }
      }
      termos.push({ ...t, campos })
    }
    contratos.push({ ...c, termos })
  }

  const r = await importarContratos(prisma, {
    aplicar,
    contratos,
    mapa: configuracao.pastas ?? {},
    nomes: configuracao.nomes ?? {},
    lerArquivo,
  })

  mkdirSync('logs', { recursive: true })
  writeFileSync('logs/sharepoint-contratos.json', JSON.stringify({ quando: new Date(), aplicar, resultado: r, contratos }, null, 1))

  const s = Math.round((Date.now() - inicio) / 1000)
  console.log(`\n${new Date().toLocaleString('pt-BR')} · ${aplicar ? 'APLICADO' : 'SÓ LISTAGEM (use --aplicar para gravar)'} · ${s}s · ${lidos} PDFs lidos`)
  console.log(
    `clientes novos ${r.clientesCriados.length} · renomeados ${r.clientesRenomeados.length} · contratos novos ${r.contratosCriados} · ` +
      `contratos completados ${r.contratosCompletados} · linhas novas ${r.linhasCriadas} · linhas completadas ${r.linhasCompletadas} · PDFs anexados ${r.pdfsAnexados}`
  )
  for (const c of r.clientesCriados) console.log(`  + cliente ${c}`)
  for (const c of r.clientesRenomeados) console.log(`  ~ cliente ${c}`)
  if (r.pastasIgnoradas.length) console.log(`  pastas ignoradas: ${r.pastasIgnoradas.join(', ')}`)
  if (r.semNomeOficial.length) console.log(`  sem nome oficial (ficou a sigla — complete "nomes" em scripts/sharepoint-clientes.json): ${r.semNomeOficial.join(', ')}`)
  const escaneados = r.avisos.filter((a) => a.includes('escaneado')).length
  for (const a of r.avisos.filter((a) => !a.includes('escaneado'))) console.log(`  ! ${a}`)
  if (escaneados) console.log(`  ${escaneados} PDF(s) escaneados sem texto — estrutura e PDF entram, datas/valor ficam pra preencher (lista em logs/sharepoint-contratos.json)`)
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
