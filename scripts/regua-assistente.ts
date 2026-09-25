/**
 * Régua do assistente — mede antes e depois, nos mesmos dados, o que vai ao modelo.
 * Spec: docs/superpowers/specs/2026-09-25-assistente-base-economica-design.md §8.
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts            # sem IA, custo zero
 *   npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts --com-ia   # 8 perguntas ao modelo (~100 mil tokens)
 *
 * --salvar grava a rodada em .superpowers/regua-assistente/; --comparar=<arquivo.json> mostra a
 * diferença para uma rodada salva do mesmo tipo.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'
import type { AuthUser } from '../src/lib/auth'
import { executarComSeguranca, FERRAMENTAS, textoParaModelo } from '../src/lib/assistente/ferramentas'
import { executarAgente, type MensagemHistorico, type ResultadoAgente } from '../src/lib/assistente/agente'
import { prepararContexto } from '../src/lib/assistente/preparar'
import { emMb, tamanhoDoIndice } from '../src/lib/assistente/indexacao/tamanho'

const PASTA = '.superpowers/regua-assistente'
const CORTADO = /"truncado":true|… mostrando \d+ de \d+ linhas/

const PERGUNTAS = [
  'Me fale tudo do cliente SMIT',
  'Quais contratos do SMS estão ativos e quanto falta faturar?',
  'Quais contratos vencem até 31/12/2026?',
  'Qual o saldo do TC 45/SMIT/2023?',
  'E quando ele vence?', // continua a conversa da anterior: testa a memória de ids
  'Onde aparece o SEI 6018.2023/0122629-0?',
  'O que diz o termo do contrato TC 13/SMIT/2024 sobre reajuste?',
  'Faturamento do SGM nos últimos 6 meses',
]

interface MedidaSemIa { cliente: string; ferramenta: string; caracteres: number; cortado: boolean }
interface MedidaComIa { pergunta: string; ferramentas: string[]; tokensEntrada: number; tokensCache: number; tokensSaida: number; resposta: string }
interface Rodada { tipo: 'sem-ia' | 'com-ia'; quando: string; medidas: (MedidaSemIa | MedidaComIa)[] }

function argumento(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3)
}
const dia = (d: Date) => d.toISOString().slice(0, 10)
const competencia = (d: Date) => d.toISOString().slice(0, 7)
const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b)
  return o.length === 0 ? 0 : o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2
}

async function semIa(hoje: Date): Promise<MedidaSemIa[]> {
  const admin: AuthUser = { id: 'regua', nome: 'régua', email: 'regua@verai.invalido', role: 'admin' }
  const contexto = { usuario: admin, hoje }
  const ate = dia(new Date(hoje.getTime() + 365 * 86_400_000))
  const de = competencia(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 11, 1)))
  const clientes = await prisma.cliente.findMany({ select: { id: true, nome: true, siglaLegado: true }, orderBy: { siglaLegado: 'asc' } })
  const medidas: MedidaSemIa[] = []
  for (const c of clientes) {
    const chamadas: [string, Record<string, unknown>][] = [
      ['resumoDoCliente', { clienteId: c.id }],
      ['contratosVencendo', { ate, clienteId: c.id, limite: 100 }],
      ['faturamentos', { clienteId: c.id, de }],
    ]
    for (const [nome, entrada] of chamadas) {
      const ferramenta = FERRAMENTAS[nome]
      const saida = await executarComSeguranca(nome, ferramenta, ferramenta.entrada.parse(entrada), contexto)
      const texto = textoParaModelo(nome, saida)
      medidas.push({ cliente: c.siglaLegado ?? c.nome, ferramenta: nome, caracteres: texto.length, cortado: CORTADO.test(texto) })
    }
  }
  return medidas
}

async function mostrarIndice() {
  const grupos = await prisma.indiceDocumento.groupBy({ by: ['origem', 'status'], _count: { _all: true }, orderBy: [{ origem: 'asc' }, { status: 'asc' }] })
  console.log('\níndice (origem × status):')
  for (const g of grupos) console.log(`  ${g.origem.padEnd(28)} ${g.status.padEnd(10)} ${g._count._all}`)
  console.log(`TrechoDocumento: ${emMb(await tamanhoDoIndice())}`)
}

async function comIa(): Promise<MedidaComIa[]> {
  const admin = await prisma.usuario.findFirst({ where: { role: 'admin' }, select: { id: true, nome: true, email: true, role: true } })
  if (!admin) throw new Error('nenhum usuário admin no banco')
  const usuario = admin as AuthUser
  const medidas: MedidaComIa[] = []
  let anterior: { historico: MensagemHistorico[]; ferramentas: unknown } | null = null
  for (const [i, pergunta] of PERGUNTAS.entries()) {
    const continua = i === 4 && anterior !== null
    const historico = continua ? anterior!.historico : []
    const recentes = continua ? [anterior!.ferramentas] : []
    const contexto = await prepararContexto({ usuario, pergunta, rota: null, recentes })
    let final: ResultadoAgente | undefined
    const resposta = executarAgente({ usuario, historico, pergunta, contexto }, async (r) => {
      final = r
    })
    await resposta.consumeStream()
    await new Promise((r) => setTimeout(r, 0))
    if (!final) throw new Error(`sem resposta para "${pergunta}"`)
    const f: ResultadoAgente = final
    medidas.push({
      pergunta,
      ferramentas: f.ferramentas.map((x) => `${x.nome}(${JSON.stringify(x.entrada)})`),
      tokensEntrada: f.tokensEntrada ?? 0,
      tokensCache: f.tokensCache ?? 0,
      tokensSaida: f.tokensSaida ?? 0,
      resposta: f.texto,
    })
    console.log(`\n[${i + 1}] ${pergunta}\n    entrada ${f.tokensEntrada} (cache ${f.tokensCache}) · saída ${f.tokensSaida}`)
    for (const x of f.ferramentas) console.log(`    → ${x.nome} ${JSON.stringify(x.entrada)}`)
    anterior = { historico: [{ papel: 'usuario', conteudo: pergunta }, { papel: 'assistente', conteudo: f.texto }], ferramentas: f.ferramentas }
  }
  const entrada = medidas.map((m) => m.tokensEntrada)
  console.log(`\nmediana de entrada: ${mediana(entrada)} · total entrada ${entrada.reduce((a, b) => a + b, 0)} · total saída ${medidas.reduce((a, m) => a + m.tokensSaida, 0)}`)
  return medidas
}

function comparar(rodada: Rodada, arquivo: string) {
  const antes = JSON.parse(readFileSync(arquivo, 'utf8')) as Rodada
  if (antes.tipo !== rodada.tipo) throw new Error(`--comparar com rodada ${antes.tipo}, esta é ${rodada.tipo}`)
  console.log(`\ncomparação com ${path.basename(arquivo)} (${antes.quando}):`)
  if (rodada.tipo === 'sem-ia') {
    const chave = (m: MedidaSemIa) => `${m.cliente}|${m.ferramenta}`
    const velhas = new Map((antes.medidas as MedidaSemIa[]).map((m) => [chave(m), m]))
    const novas = rodada.medidas as MedidaSemIa[]
    for (const m of novas) {
      const v = velhas.get(chave(m))
      if (v && (v.caracteres !== m.caracteres || v.cortado !== m.cortado)) {
        console.log(`  ${chave(m).padEnd(34)} ${v.caracteres} → ${m.caracteres}${v.cortado !== m.cortado ? ` · cortado ${v.cortado ? 'sim' : 'não'} → ${m.cortado ? 'sim' : 'não'}` : ''}`)
      }
    }
    const cortados = (ms: MedidaSemIa[]) => ms.filter((m) => m.cortado).length
    const soma = (ms: MedidaSemIa[]) => ms.reduce((a, m) => a + m.caracteres, 0)
    console.log(`  cortados ${cortados(antes.medidas as MedidaSemIa[])} → ${cortados(novas)} · caracteres ${soma(antes.medidas as MedidaSemIa[])} → ${soma(novas)}`)
  } else {
    const velhas = antes.medidas as MedidaComIa[]
    const novas = rodada.medidas as MedidaComIa[]
    novas.forEach((m, i) => {
      const v = velhas[i]
      console.log(`  [${i + 1}] entrada ${v?.tokensEntrada} → ${m.tokensEntrada} · saída ${v?.tokensSaida} → ${m.tokensSaida} · ferramentas ${v?.ferramentas.length} → ${m.ferramentas.length}`)
    })
    const [ma, md] = [mediana(velhas.map((m) => m.tokensEntrada)), mediana(novas.map((m) => m.tokensEntrada))]
    const [sa, sd] = [velhas.reduce((a, m) => a + m.tokensSaida, 0), novas.reduce((a, m) => a + m.tokensSaida, 0)]
    console.log(`  mediana de entrada ${ma} → ${md} (${ma ? Math.round(((md - ma) / ma) * 100) : 0}%) · saída total ${sa} → ${sd}`)
  }
}

async function main() {
  const hoje = new Date()
  const tipo = process.argv.includes('--com-ia') ? 'com-ia' : 'sem-ia'
  let medidas: Rodada['medidas']
  if (tipo === 'sem-ia') {
    const m = await semIa(hoje)
    for (const x of m) console.log(`${x.cliente.padEnd(12)} ${x.ferramenta.padEnd(18)} ${String(x.caracteres).padStart(7)}${x.cortado ? '  CORTADO' : ''}`)
    console.log(`\ncortados: ${m.filter((x) => x.cortado).length} de ${m.length}`)
    await mostrarIndice()
    medidas = m
  } else {
    medidas = await comIa()
  }
  const rodada: Rodada = { tipo, quando: hoje.toISOString(), medidas }
  const arquivoComparar = argumento('comparar')
  if (arquivoComparar) comparar(rodada, arquivoComparar)
  if (process.argv.includes('--salvar')) {
    mkdirSync(PASTA, { recursive: true })
    const arquivo = path.join(PASTA, `${hoje.toISOString().replace(/[:.]/g, '-')}-${tipo}.json`)
    writeFileSync(arquivo, JSON.stringify(rodada, null, 1))
    console.log(`\nsalvo em ${arquivo}`)
  }
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
