/**
 * Fichas dos PDFs do histórico (proposta e termo) — spec
 * docs/superpowers/specs/2026-09-25-assistente-senior-design.md §5.
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/fichas-documentos.ts                    # régua: cobertura por regra, sem gravar
 *   npx dotenv -e .env.development -- npx tsx scripts/fichas-documentos.ts --aplicar          # gera (regra + IA uma vez)
 *   npx dotenv -e .env.development -- npx tsx scripts/fichas-documentos.ts --aplicar --sem-ia # só regras
 *
 * --limite=N para no total de N PDFs nesta execução. A ficha é refeita só quando a versão do PDF no
 * índice muda. Qualquer mudança nas regras de palavra-chave passa pela régua antes e depois.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

import { prisma } from '../src/lib/prisma'
import { NOMES_CAMPOS } from '../src/lib/assistente/fichas/campos'
import { camposDoTipo, gerarFichasPendentes, ORIGENS_FICHA, type ResumoFichas } from '../src/lib/assistente/fichas/gerar'
import { juntarTrechos } from '../src/lib/assistente/fichas/paginas'
import { camposPorRegra } from '../src/lib/assistente/fichas/regras'

function argumento(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3)
}

async function regua() {
  const indices = await prisma.indiceDocumento.findMany({ where: { status: 'ok', origem: { in: ORIGENS_FICHA } }, select: { origem: true, origemId: true } })
  const tipos = new Map(
    (await prisma.historicoContrato.findMany({ where: { id: { in: indices.map((i) => i.origemId) } }, select: { id: true, tipo: true } })).map((h) => [h.id, h.tipo])
  )
  const conta: Record<string, { total: number; campos: Record<string, [number, number]> }> = {}
  for (const i of indices) {
    const tipo = tipos.get(i.origemId) ?? 'CONTRATO'
    const trechos = await prisma.trechoDocumento.findMany({ where: { origem: i.origem, origemId: i.origemId }, select: { pagina: true, ordem: true, texto: true } })
    const achados = camposPorRegra(juntarTrechos(trechos), tipo)
    const o = (conta[i.origem] ??= { total: 0, campos: {} })
    o.total++
    for (const n of camposDoTipo(tipo)) {
      const [achou, aplica] = o.campos[n] ?? [0, 0]
      o.campos[n] = [achou + (achados[n] ? 1 : 0), aplica + 1]
    }
  }
  for (const [origem, o] of Object.entries(conta)) {
    console.log(`\n${origem} — ${o.total} PDFs com texto (achado por regra × faltando)`)
    for (const n of NOMES_CAMPOS) {
      const [achou, aplica] = o.campos[n] ?? [0, 0]
      if (aplica) console.log(`  ${n.padEnd(22)} ${String(achou).padStart(4)} × ${String(aplica - achou).padStart(4)}  (${Math.round((achou / aplica) * 100)}%)`)
    }
  }
}

async function main() {
  if (!process.argv.includes('--aplicar')) {
    await regua()
    console.log('\nSÓ A RÉGUA (use --aplicar para gerar as fichas)')
    return
  }
  const comIa = !process.argv.includes('--sem-ia')
  const teto = Number(argumento('limite') ?? Number.POSITIVE_INFINITY)
  const total: ResumoFichas = { porRegra: 0, comIa: 0, parciais: 0, semTexto: 0, erros: 0, tokens: 0, restantes: 0 }
  let feitos = 0
  for (;;) {
    const r = await gerarFichasPendentes({ limite: Math.min(50, teto - feitos), comIa })
    const nesta = r.porRegra + r.comIa + r.semTexto + r.erros
    feitos += nesta
    for (const k of ['porRegra', 'comIa', 'parciais', 'semTexto', 'erros', 'tokens'] as const) total[k] += r[k]
    total.restantes = r.restantes
    console.log(`rodada: ${JSON.stringify(r)}`)
    if (r.restantes === 0 || nesta === 0 || feitos >= teto) break
  }
  console.log(`total: ${JSON.stringify(total)}`)
  const erros = await prisma.fichaDocumento.findMany({ where: { status: 'erro' }, select: { origem: true, origemId: true, mensagem: true }, take: 20 })
  for (const e of erros) console.log(`  [erro] ${e.origem} ${e.origemId} — ${e.mensagem}`)
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
