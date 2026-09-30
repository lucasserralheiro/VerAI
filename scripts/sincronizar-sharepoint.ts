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
 * os contratos), --pasta-documentos="C:\...\rede.sp - Documentos" (padrão: ~/rede.sp/rede.sp - Documentos ou
 * SHAREPOINT_PASTA_DOCUMENTOS), --sem-documentos (pula a biblioteca Documentos), --reler=TABELA_PRECOS (relê
 * a área da biblioteca Documentos mesmo sem mudança). Configuração: scripts/sharepoint-clientes.json. Os arquivos vão para o Cloudflare R2
 * (variáveis R2_* no .env.local — spec §11). Antes da primeira vez: scripts/migrar-sharepoint-lugar-certo.ts.
 * Idempotente; o agendador roda scripts/sincronizar-sharepoint.bat. Com --aplicar, a passada completa grava
 * a data que as telas mostram ("Documentos do SharePoint atualizados em …") e termina indexando para o
 * assistente de IA até 200 arquivos novos/trocados e preenchendo valor/vigência/assinatura vazios do histórico
 * que tenham prova (scripts/valores-contratos.ts roda só essa parte) — nada disso muda o código de saída.
 */
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { registrarAtualizacao } from '../src/lib/arquivos/sharepoint/atualizacao'
import { fonteDaPasta, pastaPadraoDaBiblioteca, pastaPadraoDosDocumentos } from '../src/lib/arquivos/sharepoint/fonte-pasta'
import { AREAS_BIBLIOTECA, ehArea } from '../src/lib/biblioteca/areas'
import { etapaDaBiblioteca } from '../src/lib/biblioteca/etapa'
import { sincronizarSharepoint } from '../src/lib/arquivos/sharepoint/sincronizar'
import { atualizarFichasDoAssistente, atualizarIndiceDoAssistente } from '../src/lib/assistente/indexacao/apos-sincronizacao'
import { ROTULO_ACHADO } from '../src/lib/importacao-sharepoint/auditoria'
import { auditarNoBanco } from '../src/lib/importacao-sharepoint/auditoria-banco'
import { textoDoPdf } from '../src/lib/importacao-sharepoint/pdf-texto'
import { extrairCampos } from '../src/lib/importacao-sharepoint/texto'
import { etapaDasDuplicatas } from '../src/lib/historico/duplicatas'
import { etapaDosValores } from '../src/lib/valores-contratos/etapa'

// .env.local completa o que faltar (ex.: BLOB_READ_WRITE_TOKEN) sem sobrescrever o que o dotenv -e já trouxe.
config({ path: '.env.local' })

const prisma = new PrismaClient()

function argumento(nome: string): string | undefined {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`))
  return achado?.slice(nome.length + 3).replace(/^"|"$/g, '')
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
  const raiz = argumento('pasta') ?? pastaPadraoDaBiblioteca()
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
      auditar: (clienteIds) => auditarNoBanco(prisma, clienteIds),
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

    if (r.auditoria) {
      console.log(`\nAuditoria das contas: ${r.auditoria.length === 0 ? 'nada a revisar' : `${r.auditoria.length} ponto(s) a revisar`}`)
      for (const [tipo, rotulo] of Object.entries(ROTULO_ACHADO)) {
        const doTipo = r.auditoria.filter((a) => a.tipo === tipo)
        if (doTipo.length === 0) continue
        console.log(`  ${rotulo}: ${doTipo.length}`)
        for (const a of doTipo.slice(0, 15)) console.log(`    ${a.cliente} ${a.contrato} — ${a.detalhe}`)
        if (doTipo.length > 15) console.log(`    … e mais ${doTipo.length - 15} (lista completa em logs/sharepoint-sincronizacao.json)`)
      }
    }

    // Data que as telas mostram (spec 2026-09-28-sharepoint-atualizado-em). Não muda o código de saída.
    if (aplicar) console.log(`\n${await registrarAtualizacao(prisma, r, { aplicar, clientes, iniciadaEm: new Date(inicio) })}`)

    // Biblioteca "Documentos" — tabela de preços, links, calendário, planilha de contratos (spec
    // 2026-09-29-biblioteca-documentos-prodam). Pulada com --clientes (teste parcial) e --sem-documentos.
    if (!clientes && !process.argv.includes('--sem-documentos')) {
      const relerAreas = argumento('reler')?.split(',').map((s) => s.trim().toUpperCase()).filter(ehArea)
      if (argumento('reler') && !relerAreas?.length) throw new Error(`--reler aceita: ${AREAS_BIBLIOTECA.join(', ')}`)
      const documentos = await etapaDaBiblioteca(prisma, {
        aplicar,
        raiz: argumento('pasta-documentos') ?? pastaPadraoDosDocumentos(),
        relerAreas,
      })
      console.log(`\n${documentos.linhas.join('\n')}`)
      if (documentos.problema && !process.exitCode) process.exitCode = 2
    }

    if (aplicar) {
      // Índice do assistente (spec 2026-09-25-assistente-base-economica §7). Não muda o código de saída.
      const clienteIds = clientes
        ? (await prisma.cliente.findMany({ where: { siglaLegado: { in: clientes.map((s) => s.toUpperCase()) } }, select: { id: true } })).map((c) => c.id)
        : undefined
      console.log(`\n${await atualizarIndiceDoAssistente({ clienteIds })}`)
      // Fichas dos PDFs do histórico (spec 2026-09-25-assistente-senior §5.3), depois do índice.
      console.log(await atualizarFichasDoAssistente())
    }

    // Linhas duplicadas do histórico (spec 2026-09-30-juntar-linhas-duplicadas), antes dos valores: o termo que
    // estava em duas linhas passa a casar com a planilha e o controle. Só com prova. Não muda o código de saída.
    if (!clientes) console.log(`\n${(await etapaDasDuplicatas(prisma, { aplicar })).join('\n')}`)
    // Valor, vigência e assinatura do histórico com prova (spec 2026-09-29-valor-vigencia-contratos §0), depois das
    // fichas e da biblioteca, que ela lê. Só em campo vazio; sem --aplicar simula. Não muda o código de saída.
    if (!clientes) console.log(`\n${(await etapaDosValores(prisma, { aplicar })).join('\n')}`)

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
