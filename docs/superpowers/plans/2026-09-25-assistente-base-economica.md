# Assistente de IA — base econômica e completa (fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O assistente recebe os dados inteiros em texto compacto, gasta ≥30% menos token de entrada, não procura de novo o que a conversa já achou e consegue ler os PDFs do histórico dos contratos.

**Architecture:** As ferramentas continuam devolvendo o objeto de hoje (vai à tela pelo stream); o modelo recebe um texto compacto pelo `toModelOutput` do AI SDK (`compacto.ts`, corte por linha a 8.000 caracteres). Antes da IA, `prepararContexto()` junta data, tela aberta e os ids de cliente/contrato identificados na pergunta ou lembrados da conversa. Links viram `tipo:id` e passam por `/ir/[tipo]/[id]`. O índice ganha a origem `ARQUIVO_CLIENTE`, nova tentativa diária de erro e uma rodada no fim da sincronização do SharePoint. Uma régua (`scripts/regua-assistente.ts`) mede antes e depois.

**Tech Stack:** Next.js 15, AI SDK 7 (`ai` 7.0.67, `tool().toModelOutput`), Prisma 6/Postgres, Jest 30, tsx.

**Desenho:** `docs/superpowers/specs/2026-09-25-assistente-base-economica-design.md`.

## Andamento

- **25/09/2026 — Tasks 1–6 concluídas e Task 8 feita**: `80f0e37` (régua), `ed0e0d6` (compacto), `fa14898`
  (links), `30490f4` (identificação), `3877b57` (ARQUIVO_CLIENTE), `52dda58` (índice no SharePoint),
  `2ffc588` (conserto: contrato por número + ano — o cadastro de produção tem sufixo
  `TC 105/2025/SMS/1/CONTRATOS`).
- **Banco de dev zerado** nesse dia por outra sessão (`prisma migrate diff` usando o dev como shadow). A
  régua rodou em **produção**, só leitura. Linha de base: `.superpowers/regua-assistente/2026-09-25T22-17-07-895Z-sem-ia.json`
  e `…T22-19-27-458Z-com-ia.json`.
- **Sem IA**: cortados 7 → 0 de 138; caracteres ao modelo 166.800 → 51.030; SMIT inteiro em 2.932.
- **Com IA** (`…T22-37-28-964Z-com-ia.json`): mediana de entrada 10.714 → 7.815 (**−27%**, meta −30%);
  saída total 4.561 → 6.042 (**maior**; a linha de base não respondia a 2 — parava em "qual SMS?" — e
  respondia a 3 com lista cortada). Pergunta 5 usou o id da conversa, sem `buscarClientes` nem busca por
  número (critério 3 ok). Na 2, a IA abriu os 6 contratos ativos do SMS um a um porque em produção
  estão sem valor e sem vigência no cadastro (o SharePoint sincroniza produção a cada 30 min pelo
  agendador, mas vários termos não têm valor lido — "nenhum termo assinado com valor lido" no log).
- **Produção roda um deploy antigo** (hotfix sobre `824f1a2`): o agendador do SharePoint executa o código
  da pasta contra produção, então a etapa do índice ganhou uma guarda (`9421850`) — só roda em banco com
  a migração `20260925190000_assistente_arquivo_cliente`. Sem deploy, nada desta fase vai a produção.
- **Task 7 no dev (25/09, noite)** — o dev foi restaurado por outra sessão (backup + SharePoint). Migração
  aplicada no dev; carga do índice: 742 lidos, 168 escaneados, 4 erros (documentos antigos do Vercel
  Blob que não existem mais); `HISTORICO_*` 829 ok + 251 `sem_texto`, nenhum pendente;
  `TrechoDocumento` 55,7 MB. A carga achou três defeitos, corrigidos: `indexar-documentos.ts` não lia o
  `.env.local` (R2) — `160e8c3`; texto com 0x00 que o Postgres recusa — `b1900bb`; prazo de 2 s para
  abrir a transação estourava com PDF pesado — `ff10b7d`. E a IA trocava o tipo do link pronto do
  trecho — regra 7, `58a5271`.
- **Régua no dev, mesmos dados e mesmo índice**, código antigo (`80f0e37`, numa worktree) × novo:
  sem IA, cortados 9 → 0 e caracteres 208.161 → 65.925 (−68%). Com IA (`…T23-33-23-213Z` ×
  `…T23-36-28-957Z`): mediana de entrada 11.419 → 8.233 (**−28%**; −29% na rodada anterior), total de
  entrada 101 mil → 65 mil (**−35%**), chamadas de ferramenta 23 → 9, pergunta 7 de 7 chamadas/21 mil
  tokens para 2/8 mil citando arquivo e página; saída total 6.184 → 6.546 (**+6%**: as perguntas 2 e 3
  agora respondem inteiras). Critérios 1, 3, 4, 5, 6 atendidos; o 2 fica em −28% e +6% de saída.
- **Pendente**: produção — só com deploy (o site roda código antigo; ver acima). Na hora do deploy:
  `migrate deploy` (leva junto `20260925190000_assistente_arquivo_cliente`), `indexar-documentos.ts` com
  `.env.production.local`, régua com IA em produção.
- **A seguir**: quando `ArquivoCliente.conversoesMarkdown` (outra sessão) entrar no schema, excluir do
  `ARQUIVO_CLIENTE` os arquivos convertidos — hoje o texto deles entraria duas vezes (também como
  `PROPOSTA_COMERCIAL_ARQUIVO`).

## Global Constraints

- Esta fase **não muda a tela** além de: links `tipo:id` clicáveis e o conserto do `urlTransform` (sem ele `sei:` e `contrato:` viram texto puro).
- Teto do texto ao modelo: **8.000 caracteres**, corte **por linha**, aviso `… mostrando N de M linhas. Para ver o resto, use filtro ou limite menor.`
- O objeto que vai à tela **não** é cortado.
- Ativo, vigência, valor, faturado e saldo vêm **só** de `consolidarContratos()` (via `resumirContrato`).
- Identificação: só entra cliente/contrato **único** e **visível** ao usuário; sigla com até 3 letras só casa **em maiúsculas**. Vai na mensagem do usuário, **nunca** no `system`.
- Não muda: `deepseek-chat`, instrução fixa no início, `MAX_PASSOS` 4, `MAX_HISTORICO` 6, `MAX_SAIDA` 1.500, permissões.
- Índice: erro com mais de **24 h** volta a pendente; sincronização do SharePoint indexa até **200** por rodada; `TrechoDocumento` acima de **80 MB** para a indexação e devolve a decisão ao usuário. Erro de indexação **não muda** o código de saída do script do SharePoint.
- Carga em **produção só com o ok do usuário**.
- Migração escrita à mão (nunca `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`).
- Estilo em `src/lib/**`, `src/app/**` e `scripts/**`: 2 espaços, aspas simples, sem ponto e vírgula.
- Testes de servidor com `/** @jest-environment node */`; rodar `npx jest <caminhos>` (mais de um arquivo ou `--forceExit` em jsdom).
- Commits só com os arquivos da task (nunca `git add -A`); sem push; mensagem termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Régua do assistente e linha de base

**Files:**
- Create: `src/lib/assistente/preparar.ts`, `src/lib/assistente/preparar.test.ts`, `src/lib/assistente/indexacao/tamanho.ts`, `scripts/regua-assistente.ts`
- Modify: `src/lib/assistente/ferramentas/index.ts` (exporta `textoParaModelo`), `src/lib/assistente/ferramentas/index.test.ts`, `src/app/api/assistente/conversas/[id]/mensagens/route.ts`, `src/app/api/assistente/conversas/[id]/mensagens/route.test.ts`

**Interfaces:**
- Produces: `textoParaModelo(nome: string, saida: unknown): string` (nesta task = `JSON.stringify(saida)`, o que o modelo recebe hoje); `prepararContexto(entrada: { usuario: AuthUser; pergunta: string; rota: string | null; recentes: unknown[]; hoje?: Date }): Promise<string>`; `tamanhoDoIndice(): Promise<number>` e `LIMITE_BYTES_INDICE = 80 * 1024 * 1024`; `scripts/regua-assistente.ts [--com-ia] [--salvar] [--comparar=<json>]`.

- [ ] **Step 1: Testes que falham**

`src/lib/assistente/preparar.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/assistente/contexto-pagina', () => ({
  interpretarRota: jest.fn(() => ({ clienteId: 'c1' })),
  descreverContexto: jest.fn(async () => ({ texto: 'Tela aberta: SMIT', rotulo: 'SMIT' })),
}))

import { descreverContexto } from '@/lib/assistente/contexto-pagina'
import { prepararContexto } from './preparar'

const usuario = { id: 'u', nome: 'U', email: 'u@x', role: 'admin' as const }

it('data e tela aberta numa linha só', async () => {
  const texto = await prepararContexto({ usuario, pergunta: 'oi', rota: '/clientes/c1', recentes: [], hoje: new Date('2026-09-25T15:00:00Z') })
  expect(texto).toBe('Hoje é 25/09/2026. Tela aberta: SMIT')
})

it('sem rota, só a data', async () => {
  ;(descreverContexto as jest.Mock).mockResolvedValueOnce(null)
  const texto = await prepararContexto({ usuario, pergunta: 'oi', rota: null, recentes: [], hoje: new Date('2026-09-25T15:00:00Z') })
  expect(texto).toBe('Hoje é 25/09/2026.')
})
```

Em `src/lib/assistente/ferramentas/index.test.ts`, acrescentar:

```ts
it('textoParaModelo: hoje o modelo recebe o JSON do resultado', () => {
  expect(textoParaModelo('buscarClientes', { total: 0, clientes: [] })).toBe('{"total":0,"clientes":[]}')
})
```

(e `textoParaModelo` no import de `./index`).

Em `route.test.ts`: o mock de `mensagemAssistente.findMany` passa a devolver também `ferramentas`, e um `jest.mock('@/lib/assistente/preparar', () => ({ prepararContexto: jest.fn(async () => 'Hoje é 25/09/2026. Tela aberta: SMIT') }))` substitui o de `contexto-pagina`. O teste "grava a pergunta…" passa a conferir:

```ts
  ;(prisma.mensagemAssistente.findMany as jest.Mock).mockResolvedValue([
    { papel: 'assistente', conteudo: 'resposta antiga', ferramentas: [{ nome: 'resumoDoCliente', entrada: { clienteId: 'c1' } }] },
    { papel: 'usuario', conteudo: 'pergunta antiga', ferramentas: null },
  ])
  // …
  expect(entrada.contexto).toBe('Hoje é 25/09/2026. Tela aberta: SMIT')
  expect(prepararContexto).toHaveBeenCalledWith({
    usuario: expect.objectContaining({ id: 'u1' }),
    pergunta: 'qual o saldo?',
    rota: '/clientes/c1',
    recentes: [[{ nome: 'resumoDoCliente', entrada: { clienteId: 'c1' } }]],
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/assistente/preparar.test.ts src/lib/assistente/ferramentas/index.test.ts "src/app/api/assistente/conversas/\[id\]/mensagens/route.test.ts"`
Expected: FAIL (`Cannot find module './preparar'`, `textoParaModelo is not a function`).

- [ ] **Step 3: Implementação**

`src/lib/assistente/preparar.ts`:

```ts
import type { AuthUser } from '@/lib/auth'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { descreverContexto, interpretarRota } from './contexto-pagina'

/** Linha de contexto que vai junto da pergunta (nunca no `system`, que é fixo para o cache). */
export async function prepararContexto(entrada: {
  usuario: AuthUser
  pergunta: string
  rota: string | null
  /** `ferramentas` gravadas nas últimas respostas do assistente, da mais recente para a mais antiga. */
  recentes: unknown[]
  hoje?: Date
}): Promise<string> {
  const hoje = entrada.hoje ?? new Date()
  const tela = await descreverContexto(interpretarRota(entrada.rota ?? ''), entrada.usuario)
  return [`Hoje é ${formatarData(hoje.toISOString())}.`, tela?.texto].filter(Boolean).join(' ')
}
```

`src/lib/assistente/indexacao/tamanho.ts`:

```ts
import { prisma } from '@/lib/prisma'

/** Teto do índice no banco (spec fase 1 §7.5): acima disso a indexação para e a decisão volta ao usuário. */
export const LIMITE_BYTES_INDICE = 80 * 1024 * 1024

/** Tamanho de `TrechoDocumento` com `tsvector` e índices. */
export async function tamanhoDoIndice(): Promise<number> {
  const [linha] = await prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_total_relation_size('"TrechoDocumento"') AS bytes`
  return Number(linha?.bytes ?? 0)
}

export const emMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
```

Em `ferramentas/index.ts`, acrescentar:

```ts
/** O que o modelo recebe de uma ferramenta. A régua mede por aqui, antes e depois. */
export function textoParaModelo(_nome: string, saida: unknown): string {
  return JSON.stringify(saida) ?? ''
}
```

Na rota `mensagens/route.ts`: `select: { papel: true, conteudo: true, ferramentas: true }`; **antes** do `reverse()` (que muda o array):

```ts
  // Da mais recente para a mais antiga, antes do reverse() (que muda o array no lugar).
  const recentes = anteriores.filter((m) => m.papel === 'assistente').slice(0, 3).map((m) => m.ferramentas)
  const historico = anteriores.reverse().map(({ papel, conteudo }) => ({ papel, conteudo })) as MensagemHistorico[]
```

e trocar as duas linhas de `tela`/`contexto` por:

```ts
  const contexto = await prepararContexto({ usuario, pergunta, rota: rota ?? null, recentes })
```

(removendo os imports de `contexto-pagina` e `formatarData` que ficarem sem uso).

- [ ] **Step 4: Rodar e ver passar**

Run: o mesmo do Step 2. Expected: PASS.

- [ ] **Step 5: A régua**

`scripts/regua-assistente.ts`:

```ts
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
    medidas.push({
      pergunta,
      ferramentas: final.ferramentas.map((f) => `${f.nome}(${JSON.stringify(f.entrada)})`),
      tokensEntrada: final.tokensEntrada ?? 0,
      tokensCache: final.tokensCache ?? 0,
      tokensSaida: final.tokensSaida ?? 0,
      resposta: final.texto,
    })
    console.log(`\n[${i + 1}] ${pergunta}\n    entrada ${final.tokensEntrada} (cache ${final.tokensCache}) · saída ${final.tokensSaida}`)
    for (const f of final.ferramentas) console.log(`    → ${f.nome} ${JSON.stringify(f.entrada)}`)
    anterior = { historico: [{ papel: 'usuario', conteudo: pergunta }, { papel: 'assistente', conteudo: final.texto }], ferramentas: final.ferramentas }
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
```

- [ ] **Step 6: Linha de base (antes de qualquer mudança)**

Run: `npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts --salvar`
Expected: tabela por cliente com SMIT/SGM/SMS `resumoDoCliente` CORTADO; arquivo `…-sem-ia.json` salvo.

Run: `npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts --com-ia --salvar`
Expected: 8 perguntas com tokens; arquivo `…-com-ia.json` salvo. Anotar no "Andamento" os dois nomes de arquivo e a mediana de entrada.

- [ ] **Step 7: Commit**

```bash
git add scripts/regua-assistente.ts src/lib/assistente/preparar.ts src/lib/assistente/preparar.test.ts src/lib/assistente/indexacao/tamanho.ts src/lib/assistente/ferramentas/index.ts src/lib/assistente/ferramentas/index.test.ts "src/app/api/assistente/conversas/[id]/mensagens/route.ts" "src/app/api/assistente/conversas/[id]/mensagens/route.test.ts"
git commit -m "feat(assistente): régua antes × depois e contexto da pergunta num lugar só"
```

---

### Task 2: Formato compacto ao modelo, corte por linha e regra 3

**Files:**
- Create: `src/lib/assistente/ferramentas/compacto.ts`, `src/lib/assistente/ferramentas/compacto.test.ts`
- Modify: `src/lib/assistente/ferramentas/comum.ts` (tira `limitarResultado`/`MAX_CARACTERES_RESULTADO`, `Ferramenta.compactar?`, `avisosDoContrato`, `ContratoResumido`), `ferramentas/index.ts` (`executarComSeguranca` sem corte, `textoParaModelo` compacto, `toModelOutput`), `ferramentas/clientes.ts`, `ferramentas/contratos.ts` (+ `limite` em `contratosVencendo`), `ferramentas/operacao.ts` (`totalNotas`), `ferramentas/conteudo.ts`, `src/lib/assistente/instrucoes.ts`, testes `index.test.ts`, `clientes.test.ts`, `contratos.test.ts`, `operacao.test.ts`, `conteudo.test.ts`, `src/lib/assistente/agente.test.ts`

**Interfaces:**
- Consumes: `textoParaModelo` (Task 1).
- Produces: `compactar(valor: unknown): string`; `tabela(titulo: string, itens: Record<string, unknown>[], opcoes?: { total?: number; colunas?: string[] }): string`; `emLinha(valor: unknown): string`; `cortarPorLinha(texto: string, max?: number): string`; `MAX_CARACTERES_MODELO = 8000`; `Ferramenta.compactar?: (saida: unknown) => string`; `avisosDoContrato(c: Pick<ContratoResumido, 'vencimento' | 'situacaoDesatualizada' | 'prorrogacaoEmAndamento'>): string`; `ContratoResumido = ReturnType<typeof resumirContrato>`; `contratosVencendo` aceita `limite` (1–100, padrão 50); `faturamentos[].totalNotas`.

- [ ] **Step 1: Testes do compacto que falham**

`src/lib/assistente/ferramentas/compacto.test.ts`:

```ts
import { compactar, cortarPorLinha, emLinha, MAX_CARACTERES_MODELO, tabela } from './compacto'

describe('compactar', () => {
  it('objeto vira linhas chave: valor, sem vazios, sem href, true vira sim', () => {
    expect(compactar({ nome: 'SMIT', sigla: null, endereco: '', ativo: true, rescindido: false, fim: '—', obs: undefined, tags: [], href: '/x' })).toBe(
      'nome: SMIT\nativo: sim'
    )
  })

  it('lista de objetos vira tabela com cabeçalho uma vez; coluna sem valor some; célula vazia fica vazia', () => {
    const texto = compactar({
      total: 3,
      contratos: [
        { numero: 'TC 1/2023', id: 'k1', saldo: 'R$ 1,00', obs: null, href: '/a' },
        { numero: 'TC 2/2023', id: 'k2', saldo: null, obs: null, href: '/b' },
      ],
    })
    expect(texto).toBe('contratos (total 3, mostrando 2):\nnumero|id|saldo\nTC 1/2023|k1|R$ 1,00\nTC 2/2023|k2|')
  })

  it('"|" e quebra de linha dentro do valor não quebram a tabela', () => {
    expect(tabela('itens', [{ d: 'a | b\nc' }])).toBe('itens (total 1, mostrando 1):\nd\na / b c')
  })

  it('objeto e lista dentro da célula ficam numa linha', () => {
    expect(emLinha({ data: '01/01/2026', posicao: 'SMIT', vazio: null })).toBe('data 01/01/2026 · posicao SMIT')
    expect(emLinha([{ numero: '1', valor: 'R$ 2' }, { numero: '3' }])).toBe('numero 1 · valor R$ 2; numero 3')
  })

  it('total só vira cabeçalho quando há uma lista só; lista vazia some e o total fica', () => {
    expect(compactar({ total: 0, clientes: [] })).toBe('total: 0')
  })

  it('texto e número soltos', () => {
    expect(compactar('ok')).toBe('ok')
    expect(compactar({ dias: 0 })).toBe('dias: 0')
  })
})

describe('cortarPorLinha', () => {
  it('abaixo do teto não mexe', () => {
    const texto = 'a\n'.repeat(100)
    expect(cortarPorLinha(texto)).toBe(texto)
  })

  it('acima do teto corta em linha inteira e avisa quantas ficaram', () => {
    const linhas = Array.from({ length: 1000 }, (_, i) => `linha ${String(i).padStart(4, '0')}|${'x'.repeat(20)}`)
    const cortado = cortarPorLinha(linhas.join('\n'))
    expect(cortado.length).toBeLessThanOrEqual(MAX_CARACTERES_MODELO)
    const partes = cortado.split('\n')
    expect(linhas).toContain(partes.at(-2))
    expect(partes.at(-1)).toMatch(/^… mostrando \d+ de 1000 linhas\. Para ver o resto, use filtro ou limite menor\.$/)
  })

  it('uma linha só maior que o teto é cortada no tamanho', () => {
    expect(cortarPorLinha('x'.repeat(20_000)).length).toBeLessThanOrEqual(MAX_CARACTERES_MODELO)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/assistente/ferramentas/compacto.test.ts`
Expected: FAIL (`Cannot find module './compacto'`).

- [ ] **Step 3: `compacto.ts`**

```ts
/**
 * Texto compacto que o MODELO recebe de uma ferramenta (spec fase 1 §4). A tela continua recebendo
 * o objeto inteiro pelo stream. Cabeçalho da tabela uma vez, sem campos vazios, sem `href`.
 */
export const MAX_CARACTERES_MODELO = 8000

const AVISO_CORTE = (mostradas: number, total: number) =>
  `… mostrando ${mostradas} de ${total} linhas. Para ver o resto, use filtro ou limite menor.`

function vazio(valor: unknown): boolean {
  return valor === null || valor === undefined || valor === false || valor === '' || valor === '—' || (Array.isArray(valor) && valor.length === 0)
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) && !(valor instanceof Date)
}

const campos = (objeto: Record<string, unknown>) => Object.entries(objeto).filter(([chave, valor]) => chave !== 'href' && !vazio(valor))

/** Qualquer valor numa linha só: objeto vira "chave valor · chave valor", lista vira "a; b". */
export function emLinha(valor: unknown): string {
  if (Array.isArray(valor)) return valor.filter((v) => !vazio(v)).map(emLinha).join('; ')
  if (ehObjeto(valor)) return campos(valor).map(([chave, v]) => `${chave} ${emLinha(v)}`).join(' · ')
  if (valor === true) return 'sim'
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return String(valor).replace(/\s+/g, ' ').trim()
}

const celula = (valor: unknown) => (vazio(valor) ? '' : emLinha(valor).replace(/\|/g, '/'))

export function tabela(titulo: string, itens: Record<string, unknown>[], opcoes: { total?: number; colunas?: string[] } = {}): string {
  if (itens.length === 0) return `${titulo}: nenhum`
  const todas = opcoes.colunas ?? [...new Set(itens.flatMap((i) => Object.keys(i)))]
  const colunas = todas.filter((c) => c !== 'href' && itens.some((i) => !vazio(i[c])))
  return [
    `${titulo} (total ${opcoes.total ?? itens.length}, mostrando ${itens.length}):`,
    colunas.join('|'),
    ...itens.map((i) => colunas.map((c) => celula(i[c])).join('|')),
  ].join('\n')
}

const listaDeObjetos = (valor: unknown): valor is Record<string, unknown>[] => Array.isArray(valor) && valor.length > 0 && valor.every(ehObjeto)

/** Formato genérico: linhas `chave: valor` e uma tabela por lista de objetos. */
export function compactar(valor: unknown): string {
  if (!ehObjeto(valor)) return emLinha(valor)
  const listas = Object.values(valor).filter(listaDeObjetos)
  const totalDaLista = typeof valor.total === 'number' && listas.length === 1 ? valor.total : undefined
  const linhas: string[] = []
  for (const [chave, v] of campos(valor)) {
    if (chave === 'total' && totalDaLista !== undefined) continue
    linhas.push(listaDeObjetos(v) ? tabela(chave, v, { total: totalDaLista }) : `${chave}: ${emLinha(v)}`)
  }
  return linhas.join('\n')
}

/** Corta em linha inteira, nunca no meio. */
export function cortarPorLinha(texto: string, max = MAX_CARACTERES_MODELO): string {
  if (texto.length <= max) return texto
  const linhas = texto.split('\n')
  const folga = AVISO_CORTE(linhas.length, linhas.length).length + 1
  const mantidas: string[] = []
  let tamanho = 0
  for (const linha of linhas) {
    if (tamanho + linha.length + 1 > max - folga) break
    mantidas.push(linha)
    tamanho += linha.length + 1
  }
  if (mantidas.length === 0) mantidas.push(linhas[0].slice(0, max - folga - 1))
  return `${mantidas.join('\n')}\n${AVISO_CORTE(mantidas.length, linhas.length)}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/assistente/ferramentas/compacto.test.ts` — Expected: PASS.

- [ ] **Step 5: Testes das ferramentas que falham**

Em `index.test.ts`, trocar o teste "resultado grande é truncado" e o de `textoParaModelo` por:

```ts
it('executarComSeguranca não corta mais o objeto (a tela recebe tudo)', async () => {
  const grande = definirFerramenta({ descricao: 'x', entrada: z.object({}), executar: async () => ({ s: 'x'.repeat(9000) }) })
  expect(await executarComSeguranca('grande', grande, {}, ctx)).toEqual({ s: 'x'.repeat(9000) })
})

it('textoParaModelo: compacto, cortado por linha, erro como linha', () => {
  expect(textoParaModelo('buscarClientes', { total: 1, clientes: [{ id: 'c1', nome: 'SMIT', href: '/clientes/c1' }] })).toBe(
    'clientes (total 1, mostrando 1):\nid|nome\nc1|SMIT'
  )
  expect(textoParaModelo('buscarClientes', { erro: 'não encontrado' })).toBe('erro: não encontrado')
  const muitas = { total: 2000, clientes: Array.from({ length: 2000 }, (_, i) => ({ id: `c${i}`, nome: 'Secretaria '.repeat(3) })) }
  expect(textoParaModelo('buscarClientes', muitas)).toMatch(/… mostrando \d+ de 2002 linhas/)
})

it('criarFerramentas liga o toModelOutput ao texto compacto', async () => {
  const ferramentas = criarFerramentas(ctx) as unknown as Record<string, { toModelOutput: (o: { output: unknown }) => unknown }>
  expect(await ferramentas.buscarClientes.toModelOutput({ output: { total: 0, clientes: [] } })).toEqual({ type: 'text', value: 'total: 0' })
})
```

Em `clientes.test.ts`, acrescentar (reaproveitando os mocks do arquivo; montar 30 contratos, 12 ativos):

```ts
it('toModelOutput do resumo com 30 contratos cabe inteiro: ativos, encerrados e totais', async () => {
  const contratos = Array.from({ length: 30 }, (_, i) => ({ ...contratoBase, id: `k${i}`, numeroTermo: `TC ${i}/SMIT/2023` }))
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ ...clienteBase, contratos })
  ;(consolidarContratos as jest.Mock).mockResolvedValue(new Map(contratos.map((c, i) => [c.id, consolidadoBase({ ativo: i < 12 })])))
  const saida = await rodar(resumoDoCliente, { clienteId: 'c1' })
  const texto = resumoDoCliente.compactar!(saida)
  expect(texto).toContain('contratos ativos (total 12, mostrando 12):')
  expect(texto).toContain('contratos encerrados (total 18, mostrando 18):')
  expect(texto).toMatch(/totais: contratos 30 · ativos 12/)
  expect(texto).not.toContain('href')
  expect(texto.length).toBeLessThanOrEqual(8000)
})
```

(`contratoBase`, `clienteBase` e `consolidadoBase` são os objetos que o arquivo já usa nos testes de `resumoDoCliente`; se estiverem inline, extrair para constantes no topo.)

Em `contratos.test.ts`, acrescentar:

```ts
it('contratosVencendo aceita limite e o compacto traz avisos em palavras', async () => {
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(null)
  const lista = Array.from({ length: 30 }, (_, i) => contrato(`k${i}`))
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue(lista)
  ;(consolidarContratos as jest.Mock).mockResolvedValue(
    new Map(lista.map((c) => [c.id, consolidado({ situacaoDesatualizada: true, prorrogacaoEmAndamento: true, vencimento: { nivel: 'critico', dias: 10 } })]))
  )
  const saida = (await rodar(contratosVencendo, { ate: '2026-12-31', limite: 25 })) as { contratos: unknown[] }
  expect(saida.contratos).toHaveLength(25)
  const texto = contratosVencendo.compactar!(saida)
  expect(texto.split('\n')[1]).toBe('cliente|numero|id|fim|dias|valor|saldo|avisos')
  expect(texto).toContain('vence em até 30 dias, situação desatualizada, prorrogação sem assinatura')
})
```

Em `operacao.test.ts`, no teste de `faturamentos`, conferir `totalNotas` e o compacto:

```ts
  expect(r.faturamentos[0].totalNotas).toBe('R$ 30,00') // duas NFs de R$ 10,00 e R$ 20,00 no mock
  expect(faturamentos.compactar!(r)).toContain('2 NFs, R$ 30,00')
```

Em `conteudo.test.ts`, no teste de `buscarNosDocumentos`:

```ts
  expect(buscarNosDocumentos.compactar!(r)).toBe('trechos (total 1):\n[TA_01.pdf, p. 3]\n"reajuste pelo IPCA"')
```

(ajustar arquivo/página/citação aos do mock existente).

Em `agente.test.ts`, trocar `toContain('"nome":"SMIT"')` por `toContain('c1|SMIT|SMIT|1')`.

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx jest src/lib/assistente`
Expected: FAIL nos testes novos (`compactar` indefinido, `limite` ignorado, `totalNotas` indefinido).

- [ ] **Step 7: Implementação nas ferramentas**

`comum.ts`: remover `MAX_CARACTERES_RESULTADO` e `limitarResultado`; na interface:

```ts
export interface Ferramenta<E extends z.ZodType = z.ZodType> {
  descricao: string
  entrada: E
  executar(entrada: z.output<E>, contexto: ContextoFerramenta): Promise<unknown>
  /** Texto compacto ao modelo, quando o genérico (`compactar`) não basta. */
  compactar?(saida: unknown): string
}
```

e, depois de `resumirContrato`:

```ts
export type ContratoResumido = ReturnType<typeof resumirContrato>

/** Avisos do consolidado em palavras curtas (regra 3 da instrução cita estes textos). */
export function avisosDoContrato(c: Pick<ContratoResumido, 'vencimento' | 'situacaoDesatualizada' | 'prorrogacaoEmAndamento'>): string {
  return [
    c.vencimento === 'vencido' && 'vencido',
    c.vencimento === 'critico' && 'vence em até 30 dias',
    c.situacaoDesatualizada && 'situação desatualizada',
    c.prorrogacaoEmAndamento && 'prorrogação sem assinatura',
  ]
    .filter(Boolean)
    .join(', ')
}
```

`index.ts`:

```ts
import { tool, type ToolSet } from 'ai'
import type { ContextoFerramenta, Ferramenta } from './comum'
import { compactar, cortarPorLinha } from './compacto'
// … imports das ferramentas iguais

export async function executarComSeguranca(nome: string, ferramenta: Ferramenta, entrada: unknown, contexto: ContextoFerramenta): Promise<unknown> {
  try {
    return await ferramenta.executar(entrada as never, contexto)
  } catch (erro) {
    console.error(`[assistente] ferramenta ${nome} falhou`, erro)
    return { erro: `falha ao consultar ${nome}` }
  }
}

const temErro = (saida: unknown): saida is { erro: string } =>
  typeof saida === 'object' && saida !== null && typeof (saida as { erro?: unknown }).erro === 'string'

/** O que o modelo recebe de uma ferramenta. A régua mede por aqui, antes e depois. */
export function textoParaModelo(nome: string, saida: unknown): string {
  if (temErro(saida)) return `erro: ${saida.erro}`
  const ferramenta = FERRAMENTAS[nome]
  return cortarPorLinha(ferramenta?.compactar ? ferramenta.compactar(saida) : compactar(saida))
}

export function criarFerramentas(contexto: ContextoFerramenta): ToolSet {
  return Object.fromEntries(
    Object.entries(FERRAMENTAS).map(([nome, ferramenta]) => [
      nome,
      tool({
        description: ferramenta.descricao,
        inputSchema: ferramenta.entrada,
        execute: async (entrada: unknown) => executarComSeguranca(nome, ferramenta, entrada, contexto),
        // A tela recebe o objeto (stream); o modelo, só o texto compacto.
        toModelOutput: ({ output }) => ({ type: 'text', value: textoParaModelo(nome, output) }),
      }),
    ])
  )
}
```

`clientes.ts` — em `resumoDoCliente`, depois de `executar`:

```ts
  compactar(saida) {
    const r = saida as { id?: string; nome?: string; sigla?: string | null; endereco?: string | null; responsaveis?: Record<string, unknown>[]; contratos?: ContratoResumido[]; totais?: Record<string, unknown> }
    if (!r.contratos) return compactar(saida)
    const ativos = r.contratos.filter((c) => c.ativo)
    const encerrados = r.contratos.filter((c) => !c.ativo)
    return [
      `cliente: ${r.nome}${r.sigla ? ` (${r.sigla})` : ''} id: ${r.id}`,
      r.endereco ? `endereco: ${r.endereco}` : null,
      r.responsaveis?.length ? tabela('responsaveis', r.responsaveis) : null,
      tabela(
        'contratos ativos',
        ativos.map((c) => ({
          numero: c.numero, id: c.id, descricao: c.descricao, seiCliente: c.seiCliente, seiProdam: c.seiProdam, situacao: c.situacao,
          inicio: c.inicio, fim: c.fimVigencia, dias: c.diasParaVencer, valor: c.valorContratado, faturado: c.faturado, saldo: c.saldo,
          '%': c.percentualFaturado, aditivos: c.aditivos, prorrogacoes: c.prorrogacoes, avisos: avisosDoContrato(c),
        }))
      ),
      tabela('contratos encerrados', encerrados.map((c) => ({ numero: c.numero, id: c.id, situacao: c.situacao, fim: c.fimVigencia, valor: c.valorContratado }))),
      `totais: ${emLinha(r.totais)}`,
    ]
      .filter(Boolean)
      .join('\n')
  },
```

(imports: `avisosDoContrato`, `type ContratoResumido` de `./comum`; `compactar`, `emLinha`, `tabela` de `./compacto`.)

`contratos.ts`:
- `contratosVencendo`: entrada ganha `limite: esquemaLimite.default(50)`; `lista.slice(0, limite)`; e

```ts
  compactar(saida) {
    const r = saida as { total?: number; contratos?: (ContratoResumido & { cliente: string })[] }
    if (!r.contratos) return compactar(saida)
    return tabela(
      'contratos',
      r.contratos.map((c) => ({ cliente: c.cliente, numero: c.numero, id: c.id, fim: c.fimVigencia, dias: c.diasParaVencer, valor: c.valorContratado, saldo: c.saldo, avisos: avisosDoContrato(c) })),
      { total: r.total }
    )
  },
```

- `detalheDoContrato`:

```ts
  compactar(saida) {
    const r = saida as ContratoResumido & { historico?: (Record<string, unknown> & { pdfProposta: { nome: string; leitura: string } | null; pdfTermo: { nome: string; leitura: string } | null })[] }
    if (!r.historico) return compactar(saida)
    const { historico, situacaoDesatualizada, prorrogacaoEmAndamento, vencimento, ...cabecalho } = r
    const pdf = (p: { nome: string; leitura: string } | null) => (p ? `${p.nome} (${p.leitura})` : null)
    return [
      compactar({ ...cabecalho, avisos: avisosDoContrato({ situacaoDesatualizada, prorrogacaoEmAndamento, vencimento }) }),
      tabela('historico', historico.map((h) => ({ ...h, pdfProposta: pdf(h.pdfProposta), pdfTermo: pdf(h.pdfTermo) }))),
    ].join('\n')
  },
```

`operacao.ts` — em `faturamentos`, na montagem de cada item acrescentar
`totalNotas: moeda(f.notasFiscais.reduce((soma, n) => soma.plus(n.valor ?? 0), new Prisma.Decimal(0)))` (import de valor `Prisma` de `@prisma/client`, trocando o `import type`), e:

```ts
  compactar(saida) {
    const r = saida as { total?: number; valorTotalPeriodo?: string; faturamentos?: (Record<string, unknown> & { notasFiscais: unknown[]; totalNotas: string })[] }
    if (!r.faturamentos) return compactar(saida)
    return [
      `valor do período: ${r.valorTotalPeriodo}`,
      tabela(
        'faturamentos',
        r.faturamentos.map(({ notasFiscais, totalNotas, ...f }) => ({
          ...f,
          notas: notasFiscais.length ? `${notasFiscais.length} NF${notasFiscais.length > 1 ? 's' : ''}, ${totalNotas}` : null,
        })),
        { total: r.total }
      ),
    ].join('\n')
  },
```

`conteudo.ts` — em `buscarNosDocumentos`:

```ts
  compactar(saida) {
    const r = saida as { total?: number; aviso?: string; trechos?: { arquivo: string; pagina: number | null; citacao: string }[] }
    if (!r.trechos) return compactar(saida)
    const blocos = r.trechos.map((t) => `[${t.arquivo}${t.pagina ? `, p. ${t.pagina}` : ''}]\n"${t.citacao.replace(/\s+/g, ' ').trim()}"`)
    return [`trechos (total ${r.total}):`, ...blocos, r.aviso ? `aviso: ${r.aviso}` : null].filter(Boolean).join('\n')
  },
```

`instrucoes.ts` — regra 3 passa a ser:

```
3. Contrato "ativo", fim de vigência, valor contratado, faturado e saldo: use EXATAMENTE o que as ferramentas devolvem. Não recalcule, não some por conta própria números que a ferramenta já totalizou. Se a coluna "avisos" trouxer "situação desatualizada", avise que a situação no cadastro precisa de conferência. Se trouxer "prorrogação sem assinatura", avise que há aditivo/prorrogação em andamento, ainda sem assinatura, que NÃO estende a vigência até ser assinado. Os resultados vêm em texto compacto: tabelas com colunas separadas por "|" e cabeçalho uma vez; célula vazia = sem valor.
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx jest src/lib/assistente` — Expected: PASS. Run: `npx tsc --noEmit -p .` — Expected: sem erro novo.

- [ ] **Step 9: Régua sem IA**

Run: `npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts --comparar=.superpowers/regua-assistente/<linha-de-base>-sem-ia.json`
Expected: `cortados N → 0`; SMIT `resumoDoCliente` abaixo de 8.000.

- [ ] **Step 10: Commit**

```bash
git add src/lib/assistente/ferramentas src/lib/assistente/instrucoes.ts src/lib/assistente/agente.test.ts
git commit -m "feat(assistente): texto compacto ao modelo, corte por linha e avisos em palavras"
```

---

### Task 3: Links curtos `tipo:id` e `/ir/[tipo]/[id]`

**Files:**
- Create: `src/app/ir/[tipo]/[id]/route.ts`, `src/app/ir/[tipo]/[id]/route.test.ts`
- Modify: `src/components/assistente/links.ts`, `links.test.ts`, `resposta-markdown.tsx`, `resposta-markdown.test.tsx`, `src/lib/assistente/ferramentas/contratos.ts` (`buscarPorSei` com `link`), `operacao.ts` (`id` em faturamentos e fornecedores), `conteudo.ts` (`linkDoTrecho`, `link` nos trechos, `id` em propostas, análises e execuções), testes dessas ferramentas, `src/lib/assistente/instrucoes.ts`

**Interfaces:**
- Produces: `TIPOS_LINK = ['cliente','contrato','faturamento','demanda','documento','proposta','confere','fornecedor'] as const`; `ESQUEMA_PROPRIO: RegExp` (esquemas `sei:` + `TIPOS_LINK`); `destinoDoLink('contrato:ID') → { tipo: 'interno', href: '/ir/contrato/ID' }`; `GET /ir/[tipo]/[id]` (307 para a tela, 404, 401); `linkDoTrecho(t: TrechoEncontrado): string | null`.

- [ ] **Step 1: Testes que falham**

`links.test.ts`, acrescentar:

```ts
it('esquemas curtos viram /ir/<tipo>/<id>; id estranho vira texto', () => {
  expect(destinoDoLink('contrato:ck1abc')).toEqual({ tipo: 'interno', href: '/ir/contrato/ck1abc' })
  expect(destinoDoLink('confere:ck9')).toEqual({ tipo: 'interno', href: '/ir/confere/ck9' })
  expect(destinoDoLink('contrato:../x')).toEqual({ tipo: 'texto' })
  expect(destinoDoLink('usuario:ck1')).toEqual({ tipo: 'texto' })
})

it('o markdown deixa passar os esquemas próprios', () => {
  expect(ESQUEMA_PROPRIO.test('sei:123')).toBe(true)
  expect(ESQUEMA_PROPRIO.test('contrato:ck1')).toBe(true)
  expect(ESQUEMA_PROPRIO.test('javascript:alert(1)')).toBe(false)
})
```

`resposta-markdown.test.tsx`, acrescentar:

```ts
it('urlTransform mantém sei:/contrato: e limpa javascript:', () => {
  expect(transformarUrl('sei:7010202600096354')).toBe('sei:7010202600096354')
  expect(transformarUrl('contrato:ck1')).toBe('contrato:ck1')
  expect(transformarUrl('javascript:alert(1)')).toBe('')
})
```

(Se o stub de `react-markdown` em `src/__mocks__/react-markdown.tsx` não exportar `defaultUrlTransform`, acrescentar ao stub: `export const defaultUrlTransform = (url: string) => (/^(https?|ircs?|mailto|xmpp):/i.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : '')`.)

`src/app/ir/[tipo]/[id]/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    contrato: { findUnique: jest.fn() },
    faturamento: { findUnique: jest.fn() },
    demanda: { findUnique: jest.fn() },
    documento: { findFirst: jest.fn() },
    propostaComercial: { findUnique: jest.fn() },
    confereExecucao: { findUnique: jest.fn() },
    fornecedor: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn(), documentosVisiveisWhere: jest.fn(async () => ({})) }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { GET } from './route'

const ir = (tipo: string, id: string) => GET(new NextRequest(`http://localhost/ir/${tipo}/${id}`), { params: Promise.resolve({ tipo, id }) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' })
  ;(podeVerCliente as jest.Mock).mockImplementation(async (_u, id) => id === 'c1')
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await ir('contrato', 'k1')).status).toBe(401)
})

it('redireciona cada tipo para a tela certa', async () => {
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.faturamento.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
  ;(prisma.demanda.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.documento.findFirst as jest.Mock).mockResolvedValue({ id: 'd1' })
  ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({ id: 'p1' })
  ;(prisma.confereExecucao.findUnique as jest.Mock).mockResolvedValue({ id: 'e1' })
  ;(prisma.fornecedor.findUnique as jest.Mock).mockResolvedValue({ id: 'f1' })
  const destino = async (tipo: string, id: string) => new URL((await ir(tipo, id)).headers.get('location')!).pathname
  expect(await destino('contrato', 'k1')).toBe('/clientes/c1/contratos/k1')
  expect(await destino('faturamento', 'f1')).toBe('/clientes/c1/faturamentos/f1')
  expect(await destino('cliente', 'c1')).toBe('/clientes/c1')
  expect(await destino('demanda', 'd1')).toBe('/demandas/d1')
  expect(await destino('documento', 'd1')).toBe('/documentos/d1')
  expect(await destino('proposta', 'p1')).toBe('/propostas-comerciais/p1')
  expect(await destino('confere', 'e1')).toBe('/confere/historico/e1')
  expect(await destino('fornecedor', 'f1')).toBe('/fornecedores/f1')
})

it('404 igual para inexistente, sem permissão e tipo desconhecido', async () => {
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ clienteId: 'c9' })
  const a = await ir('contrato', 'k0')
  const b = await ir('contrato', 'k9')
  const c = await ir('usuario', 'u1')
  expect([a.status, b.status, c.status]).toEqual([404, 404, 404])
  expect(await a.json()).toEqual(await b.json())
})
```

Nas ferramentas: `operacao.test.ts` — faturamentos e fornecedores trazem `id`; `contratos.test.ts` — ocorrências de `buscarPorSei` trazem `link` (`contrato:k1`, `faturamento:f1`, `demanda:d1`, `fornecedor:fo1`, e termo → `cliente:c1`); `conteudo.test.ts` — trechos trazem `link` (`HISTORICO_TERMO` com contrato → `contrato:k1`; `FATURAMENTO_PDF` → `faturamento:<origemId>`; `DOCUMENTO` → `documento:<origemId>`; `PROPOSTA_COMERCIAL_ARQUIVO` → `null`), e o compacto do trecho vira `[TA_01.pdf, p. 3] contrato:k1\n"…"`; propostas, análises e execuções trazem `id`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/components/assistente src/lib/assistente/ferramentas "src/app/ir"` — Expected: FAIL.

- [ ] **Step 3: Implementação**

`links.ts`:

```ts
export const TIPOS_LINK = ['cliente', 'contrato', 'faturamento', 'demanda', 'documento', 'proposta', 'confere', 'fornecedor'] as const
export type TipoLink = (typeof TIPOS_LINK)[number]

/** Esquemas que o markdown da resposta precisa deixar passar (o `urlTransform` padrão os apaga). */
export const ESQUEMA_PROPRIO = new RegExp(`^(sei|${TIPOS_LINK.join('|')}):`)
const LINK_CURTO = new RegExp(`^(${TIPOS_LINK.join('|')}):([A-Za-z0-9_-]{1,64})$`)
```

e em `destinoDoLink`, logo depois do `sei:`:

```ts
  const curto = LINK_CURTO.exec(href)
  if (curto) return { tipo: 'interno', href: `/ir/${curto[1]}/${curto[2]}` }
  if (ESQUEMA_PROPRIO.test(href)) return { tipo: 'texto' }
```

`resposta-markdown.tsx`:

```tsx
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import { destinoDoLink, ESQUEMA_PROPRIO } from './links'

/** O `urlTransform` padrão do react-markdown apaga qualquer esquema fora de http/mailto — `sei:` e
 *  `contrato:` chegavam vazios e o link virava texto. `destinoDoLink` valida o resto. */
export const transformarUrl = (url: string) => (ESQUEMA_PROPRIO.test(url) ? url : defaultUrlTransform(url))
```

e `<ReactMarkdown remarkPlugins={[remarkGfm]} components={componentesMarkdown} urlTransform={transformarUrl}>`.

`src/app/ir/[tipo]/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { documentosVisiveisWhere, podeVerCliente } from '@/lib/visibilidade'

type Contexto = { params: Promise<{ tipo: string; id: string }> }

const doCliente = async (usuario: AuthUser, registro: { clienteId: string } | null, caminho: (clienteId: string) => string) =>
  registro && (await podeVerCliente(usuario, registro.clienteId)) ? caminho(registro.clienteId) : null

/** Destino de cada link curto `tipo:id` escrito pelo assistente. `null` = inexistente ou sem permissão. */
const DESTINOS: Record<string, (id: string, usuario: AuthUser) => Promise<string | null>> = {
  cliente: async (id, u) => doCliente(u, (await prisma.cliente.findUnique({ where: { id }, select: { id: true } })) && { clienteId: id }, (c) => `/clientes/${c}`),
  contrato: async (id, u) => doCliente(u, await prisma.contrato.findUnique({ where: { id }, select: { clienteId: true } }), (c) => `/clientes/${c}/contratos/${id}`),
  faturamento: async (id, u) => doCliente(u, await prisma.faturamento.findUnique({ where: { id }, select: { clienteId: true } }), (c) => `/clientes/${c}/faturamentos/${id}`),
  demanda: async (id, u) => doCliente(u, await prisma.demanda.findUnique({ where: { id }, select: { clienteId: true } }), () => `/demandas/${id}`),
  documento: async (id, u) =>
    (await prisma.documento.findFirst({ where: { AND: [{ id }, await documentosVisiveisWhere(u)] }, select: { id: true } })) ? `/documentos/${id}` : null,
  proposta: async (id) => ((await prisma.propostaComercial.findUnique({ where: { id }, select: { id: true } })) ? `/propostas-comerciais/${id}` : null),
  confere: async (id) => ((await prisma.confereExecucao.findUnique({ where: { id }, select: { id: true } })) ? `/confere/historico/${id}` : null),
  fornecedor: async (id) => ((await prisma.fornecedor.findUnique({ where: { id }, select: { id: true } })) ? `/fornecedores/${id}` : null),
}

export async function GET(request: NextRequest, { params }: Contexto) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { tipo, id } = await params
  const destino = Object.hasOwn(DESTINOS, tipo) ? await DESTINOS[tipo](id, autenticado.usuario) : null
  // Mesma resposta para inexistente e sem permissão: não revela que o registro existe.
  if (!destino) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  return NextResponse.redirect(new URL(destino, request.url))
}
```

(Se `demanda.clienteId` for opcional no schema, `doCliente` recebe `registro?.clienteId ? registro : null`.)

Ferramentas:
- `buscarPorSei`: `ocorrencias: linhas.slice(0, LIMITE_PADRAO).map((l) => ({ tipo: l.tipo, rotulo: l.rotulo, sei: sei(l.sei), link: linkDaOcorrencia(l), href: hrefDaOcorrencia(l) }))` com

```ts
function linkDaOcorrencia(o: OcorrenciaSei): string {
  return o.tipo === 'termo' ? `cliente:${o.clienteId}` : `${o.tipo}:${o.id}`
}
```

- `faturamentos`: `id: f.id` no item; `fornecedores`: `id: f.id`; `propostasComerciais`: `id: p.id`; `analisesDeDocumentos`: `id: d.id`; `execucoesConfere`: `id: e.id`.
- `conteudo.ts`:

```ts
/** Link curto do trecho (`tipo:id`) para o modelo citar; `null` quando não há tela própria. */
export function linkDoTrecho(t: TrechoEncontrado): string | null {
  switch (t.origem) {
    case 'HISTORICO_PROPOSTA':
    case 'HISTORICO_TERMO':
      return t.contratoId ? `contrato:${t.contratoId}` : t.clienteId ? `cliente:${t.clienteId}` : null
    case 'FATURAMENTO_PDF':
      return `faturamento:${t.origemId}`
    case 'DOCUMENTO':
      return `documento:${t.origemId}`
    case 'PROPOSTA_COMERCIAL_ARQUIVO':
      return null
  }
}
```

  trechos com `link: linkDoTrecho(t)`, e no `compactar` o cabeçalho do bloco vira `` `[${t.arquivo}${t.pagina ? `, p. ${t.pagina}` : ''}]${t.link ? ` ${t.link}` : ''}` ``.

`instrucoes.ts` — regra 7 passa a ser:

```
7. Cite a fonte com link markdown [texto](tipo:id): tipo é cliente, contrato, faturamento, demanda, documento, proposta, confere ou fornecedor, conforme o registro, e id é o devolvido pela ferramenta (coluna "id", ou a coluna "link" quando ela já vem pronta). Ex.: [TC 45/SMIT/2023](contrato:ck123).
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/components/assistente src/lib/assistente "src/app/ir"` — Expected: PASS. `npx tsc --noEmit -p .` — sem erro novo.

- [ ] **Step 5: Commit**

```bash
git add src/components/assistente src/__mocks__/react-markdown.tsx src/app/ir src/lib/assistente/ferramentas src/lib/assistente/instrucoes.ts
git commit -m "feat(assistente): links curtos tipo:id, rota /ir e SEI clicável na resposta"
```

---

### Task 4: Cliente e contrato identificados antes da IA, e memória de ids

**Files:**
- Create: `src/lib/assistente/entidades.ts`, `src/lib/assistente/entidades.test.ts`
- Modify: `src/lib/assistente/preparar.ts`, `preparar.test.ts`, `src/lib/assistente/instrucoes.ts`, `src/lib/assistente/agente.test.ts`

**Interfaces:**
- Consumes: `prepararContexto` (Task 1), `chaveNumerica` (`src/lib/relatorios-clientes/vincular-itens.ts`), `clienteIdsPermitidos`.
- Produces: `identificarEntidades(entrada: { pergunta: string; usuario: AuthUser; recentes: unknown[] }): Promise<EntidadesIdentificadas>` com `EntidadesIdentificadas = { clientes: { id: string; nome: string; sigla: string | null }[]; contratos: { id: string; numero: string; clienteId: string }[]; texto: string | null }`. (A spec previa `conversaId`; recebe `recentes` — a rota já lê essas mensagens, e a régua consegue testar a pergunta 5 sem gravar conversa.)

- [ ] **Step 1: Testes que falham**

`src/lib/assistente/entidades.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { cliente: { findMany: jest.fn() }, contrato: { findMany: jest.fn() } } }))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { identificarEntidades } from './entidades'

const usuario = { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' as const }
const CLIENTES = [
  { id: 'sms', nome: 'Secretaria Municipal da Saúde', siglaLegado: 'SMS' },
  { id: 'smsu', nome: 'Secretaria Municipal de Segurança Urbana', siglaLegado: 'SMSU' },
  { id: 'smsub', nome: 'Secretaria Municipal das Subprefeituras', siglaLegado: 'SMSUB' },
  { id: 'sf', nome: 'Secretaria Municipal da Fazenda', siglaLegado: 'SF' },
  { id: 'spcine', nome: 'Empresa de Cinema e Audiovisual de São Paulo - SPCine', siglaLegado: 'SPCINE' },
  { id: 'smit', nome: 'Secretaria Municipal de Inovação e Tecnologia', siglaLegado: 'SMIT' },
]
const CONTRATOS = [
  { id: 'k45', numeroTermo: 'TC 045/SMIT/2023', clienteId: 'smit' },
  { id: 'k13', numeroTermo: 'TC 13/SMIT/2024', clienteId: 'smit' },
  { id: 'k32', numeroTermo: '032/2025/SEHAB', clienteId: 'sms' },
  { id: 'k32b', numeroTermo: 'TC 32/2025', clienteId: 'smsu' },
]
const ids = async (pergunta: string, recentes: unknown[] = []) => {
  const r = await identificarEntidades({ pergunta, usuario, recentes })
  return { clientes: r.clientes.map((c) => c.id), contratos: r.contratos.map((c) => c.id) }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(null)
  ;(prisma.cliente.findMany as jest.Mock).mockImplementation(async ({ where }) => CLIENTES.filter((c) => !where?.id?.in || where.id.in.includes(c.id)))
  ;(prisma.contrato.findMany as jest.Mock).mockImplementation(async ({ where }) =>
    CONTRATOS.filter((c) => (!where?.clienteId || (typeof where.clienteId === 'string' ? c.clienteId === where.clienteId : where.clienteId.in.includes(c.clienteId))) && (!where?.id || where.id.in.includes(c.id)))
  )
})

it('SMS × SMSU × SMSUB por palavra inteira', async () => {
  expect((await ids('contratos do SMS')).clientes).toEqual(['sms'])
  expect((await ids('e o SMSU?')).clientes).toEqual(['smsu'])
  expect((await ids('smsub tem saldo?')).clientes).toEqual(['smsub'])
})

it('sigla curta só em maiúsculas', async () => {
  expect((await ids('faturamento da SF')).clientes).toEqual(['sf'])
  expect((await ids('sf é uma sigla?')).clientes).toEqual([])
})

it('apelido e nome sem acento', async () => {
  expect((await ids('contratos da spcine')).clientes).toEqual(['spcine'])
  expect((await ids('secretaria municipal de inovacao e tecnologia')).clientes).toEqual(['smit'])
})

it('dois clientes citados: nenhum entra', async () => {
  expect((await ids('compare SMS e SMIT')).clientes).toEqual([])
})

it('cliente sem permissão não entra', async () => {
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['sms'])
  expect((await ids('fale do SMIT')).clientes).toEqual([])
})

it('contrato pela chave numérica: zero à esquerda e sigla no meio', async () => {
  expect((await ids('saldo do TC 45/SMIT/2023')).contratos).toEqual(['k45'])
  expect((await ids('o 13/2024 tem reajuste?')).contratos).toEqual(['k13'])
})

it('contrato ambíguo não entra; com cliente identificado, desempata', async () => {
  expect((await ids('o 32/2025')).contratos).toEqual([])
  expect((await ids('o 032/2025/SEHAB do SMS')).contratos).toEqual(['k32'])
})

it('SEI e data não viram contrato', async () => {
  expect((await ids('SEI 6018.2023/0122629-0 de 31/12/2026')).contratos).toEqual([])
})

it('memória: ids das últimas respostas, só os visíveis', async () => {
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['smit'])
  const recentes = [[{ nome: 'detalheDoContrato', entrada: { contratoId: 'k45' } }], [{ nome: 'resumoDoCliente', entrada: { clienteId: 'smit' } }, { nome: 'x', entrada: { clienteId: 'sms' } }], null]
  expect(await ids('e quando ele vence?', recentes)).toEqual({ clientes: ['smit'], contratos: ['k45'] })
})

it('texto pronto para o contexto', async () => {
  const r = await identificarEntidades({ pergunta: 'saldo do TC 45/SMIT/2023 do SMIT', usuario, recentes: [] })
  expect(r.texto).toBe(
    'Já identificados (use estes ids, não procure de novo): cliente SMIT – Secretaria Municipal de Inovação e Tecnologia (clienteId: smit); contrato TC 045/SMIT/2023 (contratoId: k45).'
  )
  expect((await identificarEntidades({ pergunta: 'oi', usuario, recentes: [] })).texto).toBeNull()
})
```

`preparar.test.ts`, acrescentar (com `jest.mock('./entidades', () => ({ identificarEntidades: jest.fn(async () => ({ clientes: [], contratos: [], texto: 'Já identificados (…): cliente SMIT.' })) }))`):

```ts
it('acrescenta os já identificados ao fim da linha', async () => {
  const texto = await prepararContexto({ usuario, pergunta: 'saldo do SMIT', rota: null, recentes: [['x']], hoje: new Date('2026-09-25T15:00:00Z') })
  expect(texto).toBe('Hoje é 25/09/2026. Tela aberta: SMIT Já identificados (…): cliente SMIT.')
  expect(identificarEntidades).toHaveBeenCalledWith({ pergunta: 'saldo do SMIT', usuario, recentes: [['x']] })
})
```

(ajustar os dois testes antigos: o mock devolve `texto: null` neles.)

`agente.test.ts`, acrescentar:

```ts
it('"Já identificados" vai na última mensagem do usuário, nunca no system', async () => {
  const modelo = new MockLanguageModelV4({
    doStream: [{ stream: simulateReadableStream({ chunks: [{ type: 'stream-start', warnings: [] }, { type: 'text-start', id: '1' }, { type: 'text-delta', id: '1', delta: 'ok' }, { type: 'text-end', id: '1' }, { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: uso(1, 0, 1) }] }) }],
  })
  const contexto = 'Hoje é 25/09/2026. Já identificados (use estes ids, não procure de novo): cliente SMIT (clienteId: c1).'
  await executarAgente({ usuario, historico: [], pergunta: 'saldo?', contexto, modelo }, async () => {}).consumeStream()
  const prompt = modelo.doStreamCalls[0].prompt
  expect(JSON.stringify(prompt.filter((m) => m.role === 'system'))).not.toContain('Já identificados')
  expect(JSON.stringify(prompt.at(-1))).toContain('Já identificados')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/assistente/entidades.test.ts src/lib/assistente/preparar.test.ts src/lib/assistente/agente.test.ts` — Expected: FAIL (`Cannot find module './entidades'`).

- [ ] **Step 3: `entidades.ts`**

```ts
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'

export interface EntidadesIdentificadas {
  clientes: { id: string; nome: string; sigla: string | null }[]
  contratos: { id: string; numero: string; clienteId: string }[]
  texto: string | null
}

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
/** Palavras separadas por um espaço, com espaço nas pontas: casa palavra inteira com `includes`. */
const palavras = (texto: string) => ` ${semAcento(texto).toLowerCase().replace(/[^a-z0-9-]+/g, ' ').trim()} `
const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function cita(pergunta: string, termo: string | null | undefined): boolean {
  const alvo = palavras(termo ?? '').trim()
  if (!alvo) return false
  if (alvo.replace(/[^a-z0-9]/g, '').length <= 3) {
    // Sigla curta ("SF", "SME") só em maiúsculas: em minúscula é palavra comum.
    const exato = escapar(semAcento(termo!.trim()).toUpperCase())
    return new RegExp(`(^|[^A-Za-z0-9-])${exato}($|[^A-Za-z0-9-])`).test(semAcento(pergunta))
  }
  return palavras(pergunta).includes(` ${alvo} `)
}

const apelido = (nome: string) => (nome.includes(' - ') ? nome.slice(nome.lastIndexOf(' - ') + 3) : null)

/** "45/2023", "TC 45/SMIT/2023", "032/2025/SEHAB" — nunca pedaço de SEI ("6018.2023/0122629-0") nem data. */
const NUMERO_DE_CONTRATO = /(?<![\d./])\d{1,4}\s*\/\s*(?:[A-Za-zÀ-ú]+\s*\/\s*)?\d{4}(?:\s*\/\s*[A-Za-zÀ-ú]+)?(?![\d/])/g

function idsDaMemoria(recentes: unknown[]): { clientes: string[]; contratos: string[] } {
  const clientes = new Set<string>()
  const contratos = new Set<string>()
  for (const ferramentas of recentes) {
    if (!Array.isArray(ferramentas)) continue
    for (const chamada of ferramentas) {
      const entrada = (chamada as { entrada?: Record<string, unknown> } | null)?.entrada
      if (typeof entrada?.clienteId === 'string') clientes.add(entrada.clienteId)
      if (typeof entrada?.contratoId === 'string') contratos.add(entrada.contratoId)
    }
  }
  return { clientes: [...clientes], contratos: [...contratos] }
}

/**
 * Cliente e contrato citados na pergunta (ou usados nas últimas respostas), achados sem IA — poupa
 * uma chamada inteira ao modelo só para descobrir o id. Só entra o que é único e visível ao usuário.
 */
export async function identificarEntidades(entrada: { pergunta: string; usuario: AuthUser; recentes: unknown[] }): Promise<EntidadesIdentificadas> {
  const permitidos = await clienteIdsPermitidos(entrada.usuario)
  const visiveis = await prisma.cliente.findMany({
    where: permitidos === null ? {} : { id: { in: permitidos } },
    select: { id: true, nome: true, siglaLegado: true },
  })
  const citados = visiveis.filter((c) => cita(entrada.pergunta, c.siglaLegado) || cita(entrada.pergunta, apelido(c.nome)) || cita(entrada.pergunta, c.nome))
  const cliente = citados.length === 1 ? citados[0] : null

  const chaves = [...new Set((entrada.pergunta.match(NUMERO_DE_CONTRATO) ?? []).map(chaveNumerica).filter((c): c is string => c !== null))]
  const memoria = idsDaMemoria(entrada.recentes)
  const filtroCliente = cliente ? cliente.id : permitidos === null ? undefined : { in: permitidos }

  let contrato: { id: string; numeroTermo: string; clienteId: string } | null = null
  if (chaves.length === 1) {
    const candidatos = await prisma.contrato.findMany({ where: filtroCliente ? { clienteId: filtroCliente } : {}, select: { id: true, numeroTermo: true, clienteId: true } })
    const casados = candidatos.filter((c) => chaveNumerica(c.numeroTermo) === chaves[0])
    contrato = casados.length === 1 ? casados[0] : null
  }
  const lembrados = memoria.contratos.length
    ? await prisma.contrato.findMany({
        where: { id: { in: memoria.contratos }, ...(permitidos === null ? {} : { clienteId: { in: permitidos } }) },
        select: { id: true, numeroTermo: true, clienteId: true },
      })
    : []

  const porId = new Map(visiveis.map((c) => [c.id, c]))
  const clientes = [...new Map([cliente, ...memoria.clientes.map((id) => porId.get(id))].filter((c) => !!c).map((c) => [c!.id, c!])).values()].map((c) => ({
    id: c.id,
    nome: c.nome,
    sigla: c.siglaLegado,
  }))
  const contratos = [...new Map([contrato, ...lembrados].filter((c) => !!c).map((c) => [c!.id, c!])).values()].map((c) => ({
    id: c.id,
    numero: c.numeroTermo,
    clienteId: c.clienteId,
  }))

  const partes = [
    ...clientes.map((c) => `cliente ${c.sigla ? `${c.sigla} – ` : ''}${c.nome} (clienteId: ${c.id})`),
    ...contratos.map((c) => `contrato ${c.numero} (contratoId: ${c.id})`),
  ]
  return { clientes, contratos, texto: partes.length ? `Já identificados (use estes ids, não procure de novo): ${partes.join('; ')}.` : null }
}
```

`preparar.ts`: depois de `tela`, `const entidades = await identificarEntidades({ pergunta: entrada.pergunta, usuario: entrada.usuario, recentes: entrada.recentes })` e o retorno vira `[…, tela?.texto, entidades.texto].filter(Boolean).join(' ')`.

`instrucoes.ts` — regra 4 passa a ser:

```
4. Se o contexto da pergunta já traz o id do cliente ou do contrato ("Já identificados"), use-o direto. Se não traz, chame buscarClientes. Se vier mais de um candidato ou um resultado "ambiguo", mostre as opções e pergunte qual é.
```

- [ ] **Step 4: Rodar e ver passar**

Run: o mesmo do Step 2 e `npx jest src/lib/assistente "src/app/api/assistente"` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/assistente/entidades.ts src/lib/assistente/entidades.test.ts src/lib/assistente/preparar.ts src/lib/assistente/preparar.test.ts src/lib/assistente/instrucoes.ts src/lib/assistente/agente.test.ts
git commit -m "feat(assistente): cliente e contrato identificados antes da IA e memória de ids"
```

---

### Task 5: Índice — origem `ARQUIVO_CLIENTE` e nova tentativa de erro

**Files:**
- Create: `prisma/migrations/20260925190000_assistente_arquivo_cliente/migration.sql`
- Modify: `prisma/schema.prisma` (enum `OrigemTrecho`), `src/lib/assistente/indexacao/fontes.ts`, `fontes.test.ts`, `sincronizar.ts`, `sincronizar.test.ts`, `src/lib/assistente/ferramentas/conteudo.ts` (`hrefDoTrecho`/`linkDoTrecho`), `conteudo.test.ts`

**Interfaces:**
- Produces: `OrigemTrecho.ARQUIVO_CLIENTE`; `EXTENSOES_INDEXAVEIS = ['pdf', 'docx', 'xlsx', 'csv']`; `sincronizarIndice({ …, agora?: Date })` — `erro` com `indexadoEm` há mais de 24 h volta a pendente.

- [ ] **Step 1: Migração e schema**

`prisma/schema.prisma`, no `enum OrigemTrecho`, acrescentar `ARQUIVO_CLIENTE`.

`prisma/migrations/20260925190000_assistente_arquivo_cliente/migration.sql`:

```sql
-- Arquivo do repositório do cliente como fonte do índice do assistente (spec 2026-09-25-assistente-base-economica §3.8).
ALTER TYPE "OrigemTrecho" ADD VALUE 'ARQUIVO_CLIENTE';
```

Run: `npx dotenv -e .env.development -- npx prisma migrate deploy` e `npm run dev:generate` (parar o `next dev` antes: no Windows o generate falha com a DLL do Prisma em uso).
Expected: migração aplicada; client gerado.

- [ ] **Step 2: Testes que falham**

`fontes.test.ts`: acrescentar `arquivoCliente: { findMany: jest.fn() }` ao mock do prisma; no `beforeEach`, `(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([{ id: 'a1', clienteId: 'c3', nome: 'Publicação DOC.pdf', extensao: 'pdf', urlBlob: 'r2:a1' }])`; o teste "junta as cinco origens" passa a esperar também
`{ origem: 'ARQUIVO_CLIENTE', origemId: 'a1', url: 'r2:a1', nomeArquivo: 'Publicação DOC.pdf', tipo: 'pdf', clienteId: 'c3', contratoId: null, textoPronto: null }` no fim, e:

```ts
it('ARQUIVO_CLIENTE: só ativo, legível, sem uso no histórico nem em Documento', async () => {
  await listarFontes({ clienteId: 'c3' })
  expect((prisma.arquivoCliente.findMany as jest.Mock).mock.calls[0][0].where).toEqual({
    removidoEm: null,
    extensao: { in: ['pdf', 'docx', 'xlsx', 'csv'] },
    linhasComoProposta: { none: {} },
    linhasComoTermo: { none: {} },
    documentos: { none: {} },
    clienteId: 'c3',
  })
})
```

`sincronizar.test.ts`, no `describe('sincronizarIndice')`:

```ts
  it('erro com mais de 24 h volta a pendente; com menos, não', async () => {
    const agora = new Date('2026-09-25T12:00:00Z')
    ;(listarFontes as jest.Mock).mockResolvedValue([fonte({ origemId: 'velho', url: 'r2:velho' }), fonte({ origemId: 'recente', url: 'r2:recente' })])
    ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([
      { id: 'i1', origem: 'HISTORICO_TERMO', origemId: 'velho', url: 'r2:velho', versao: null, status: 'erro', indexadoEm: new Date('2026-09-24T11:00:00Z') },
      { id: 'i2', origem: 'HISTORICO_TERMO', origemId: 'recente', url: 'r2:recente', versao: null, status: 'erro', indexadoEm: new Date('2026-09-25T01:00:00Z') },
    ])
    const resumo = await sincronizarIndice({ deps, agora })
    expect(resumo).toEqual({ ok: 1, sem_texto: 0, erro: 0, removidos: 0, restantes: 0 })
    expect(extrairPaginas).toHaveBeenCalledTimes(1)
  })
```

`conteudo.test.ts`: `hrefDoTrecho` de `ARQUIVO_CLIENTE` com `clienteId: 'c3'` é `/clientes/c3?aba=documentos` e `linkDoTrecho` é `cliente:c3`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/lib/assistente/indexacao src/lib/assistente/ferramentas/conteudo.test.ts` — Expected: FAIL.

- [ ] **Step 4: Implementação**

`fontes.ts`: exportar `export const EXTENSOES_INDEXAVEIS = ['pdf', 'docx', 'xlsx', 'csv']` (o que `extrairPaginas` lê); no `Promise.all`, quinta consulta:

```ts
    // Arquivo do repositório que não é PC/PA/TC/TA do histórico nem Documento (esses têm origem própria).
    // Arquivo não tem contrato (CLAUDE.md, §7 da spec do repositório): contratoId fica null.
    prisma.arquivoCliente.findMany({
      where: {
        removidoEm: null,
        extensao: { in: EXTENSOES_INDEXAVEIS },
        linhasComoProposta: { none: {} },
        linhasComoTermo: { none: {} },
        documentos: { none: {} },
        ...(clienteId ? { clienteId } : {}),
      },
      select: { id: true, clienteId: true, nome: true, extensao: true, urlBlob: true },
    }),
```

e no fim:

```ts
  for (const a of arquivosCliente) {
    fontes.push({ origem: 'ARQUIVO_CLIENTE', origemId: a.id, url: a.urlBlob, nomeArquivo: a.nome, tipo: a.extensao, clienteId: a.clienteId, contratoId: null, textoPronto: null })
  }
```

(Atualizar o comentário do `FonteDocumento` que diz "Quando o ArquivoCliente existir…".)

`sincronizar.ts`: `select` dos índices ganha `status: true, indexadoEm: true`; opções ganham `agora?: Date`; e

```ts
const UM_DIA_MS = 24 * 60 * 60 * 1000
/** Falha não fica para sempre: é tentada de novo no máximo uma vez por dia (spec fase 1 §3.9). */
const falhaVencida = (indice: { status: string; indexadoEm: Date }, agora: Date) =>
  indice.status === 'erro' && agora.getTime() - indice.indexadoEm.getTime() > UM_DIA_MS
```

com a condição `if (!indice || indice.url !== fonte.url || falhaVencida(indice, agora))`.

`conteudo.ts`: `hrefDoTrecho` ganha `case 'ARQUIVO_CLIENTE': return \`/clientes/${t.clienteId}?aba=documentos\``; `linkDoTrecho` ganha `case 'ARQUIVO_CLIENTE': return t.clienteId ? \`cliente:${t.clienteId}\` : null`. Na descrição de `buscarNosDocumentos`, acrescentar "arquivos do repositório do cliente (publicações, planilhas, documentos da pasta)".

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest src/lib/assistente` — Expected: PASS. `npx tsc --noEmit -p .` — sem erro novo.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260925190000_assistente_arquivo_cliente src/lib/assistente/indexacao src/lib/assistente/ferramentas/conteudo.ts src/lib/assistente/ferramentas/conteudo.test.ts
git commit -m "feat(assistente): arquivos do repositório no índice e nova tentativa diária de falha"
```

---

### Task 6: Índice no fim da sincronização do SharePoint e teto de tamanho

**Files:**
- Create: `src/lib/assistente/indexacao/apos-sincronizacao.ts`, `src/lib/assistente/indexacao/apos-sincronizacao.test.ts`
- Modify: `scripts/sincronizar-sharepoint.ts`, `scripts/indexar-documentos.ts`

**Interfaces:**
- Consumes: `sincronizarIndice`, `tamanhoDoIndice`, `LIMITE_BYTES_INDICE`, `emMb` (Task 1).
- Produces: `atualizarIndiceDoAssistente(opcoes?: { clienteIds?: string[]; limite?: number }, deps?: { sincronizar: typeof sincronizarIndice; tamanho: () => Promise<number> }): Promise<string>` — nunca lança; devolve a linha do log.

- [ ] **Step 1: Testes que falham**

`apos-sincronizacao.test.ts`:

```ts
/** @jest-environment node */
jest.mock('./sincronizar', () => ({ sincronizarIndice: jest.fn() }))
jest.mock('./tamanho', () => ({ ...jest.requireActual('./tamanho'), tamanhoDoIndice: jest.fn() }))

import { atualizarIndiceDoAssistente } from './apos-sincronizacao'

const resumo = (over = {}) => ({ ok: 2, sem_texto: 1, erro: 0, removidos: 1, restantes: 3, ...over })

it('uma rodada com teto 200 e a linha do log', async () => {
  const sincronizar = jest.fn(async () => resumo())
  const linha = await atualizarIndiceDoAssistente({}, { sincronizar, tamanho: async () => 10 })
  expect(sincronizar).toHaveBeenCalledWith({ clienteId: undefined, limite: 200 })
  expect(linha).toBe('índice do assistente: indexados 2 · sem texto 1 · removidos 1 · erros 0 · pendentes 3')
})

it('com clientes, uma rodada por cliente e soma', async () => {
  const sincronizar = jest.fn(async () => resumo({ erro: 1 }))
  const linha = await atualizarIndiceDoAssistente({ clienteIds: ['c1', 'c2'] }, { sincronizar, tamanho: async () => 10 })
  expect(sincronizar.mock.calls.map((c) => c[0].clienteId)).toEqual(['c1', 'c2'])
  expect(linha).toBe('índice do assistente: indexados 4 · sem texto 2 · removidos 2 · erros 2 · pendentes 6')
})

it('acima de 80 MB não indexa e avisa', async () => {
  const sincronizar = jest.fn()
  const linha = await atualizarIndiceDoAssistente({}, { sincronizar, tamanho: async () => 81 * 1024 * 1024 })
  expect(sincronizar).not.toHaveBeenCalled()
  expect(linha).toMatch(/PARADO .* 81\.0 MB .* 80 MB/)
})

it('falha vira linha no log, nunca exceção', async () => {
  const linha = await atualizarIndiceDoAssistente({}, { sincronizar: jest.fn(async () => { throw new Error('R2 fora') }), tamanho: async () => 10 })
  expect(linha).toBe('índice do assistente: falhou — R2 fora (a próxima rodada tenta de novo)')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/assistente/indexacao/apos-sincronizacao.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementação**

`apos-sincronizacao.ts`:

```ts
import { sincronizarIndice } from './sincronizar'
import { emMb, LIMITE_BYTES_INDICE, tamanhoDoIndice } from './tamanho'

/**
 * Rodada do índice do assistente no fim da sincronização do SharePoint (spec fase 1 §3.7/§7). Nunca
 * lança: o código de saída do script é o da sincronização, que o `-Estado` do agendador lê.
 */
export async function atualizarIndiceDoAssistente(
  opcoes: { clienteIds?: string[]; limite?: number } = {},
  deps: { sincronizar: typeof sincronizarIndice; tamanho: () => Promise<number> } = { sincronizar: sincronizarIndice, tamanho: tamanhoDoIndice }
): Promise<string> {
  try {
    const bytes = await deps.tamanho()
    if (bytes > LIMITE_BYTES_INDICE) {
      return `índice do assistente: PARADO — TrechoDocumento com ${emMb(bytes)} (teto ${emMb(LIMITE_BYTES_INDICE).replace('.0', '')}); a decisão é do usuário`
    }
    const soma = { ok: 0, sem_texto: 0, erro: 0, removidos: 0, restantes: 0 }
    for (const clienteId of opcoes.clienteIds ?? [undefined]) {
      const r = await deps.sincronizar({ clienteId, limite: opcoes.limite ?? 200 })
      for (const k of Object.keys(soma) as (keyof typeof soma)[]) soma[k] += r[k]
    }
    return `índice do assistente: indexados ${soma.ok} · sem texto ${soma.sem_texto} · removidos ${soma.removidos} · erros ${soma.erro} · pendentes ${soma.restantes}`
  } catch (erro) {
    return `índice do assistente: falhou — ${erro instanceof Error ? erro.message : String(erro)} (a próxima rodada tenta de novo)`
  }
}
```

`scripts/sincronizar-sharepoint.ts`: import `atualizarIndiceDoAssistente` de `'../src/lib/assistente/indexacao/apos-sincronizacao'`; depois do bloco `if (r.auditoria) {…}` e antes do `writeFileSync` do log:

```ts
    if (aplicar) {
      // Índice do assistente (spec 2026-09-25-assistente-base-economica §7). Não muda o código de saída.
      const clienteIds = clientes
        ? (await prisma.cliente.findMany({ where: { siglaLegado: { in: clientes.map((s) => s.toUpperCase()) } }, select: { id: true } })).map((c) => c.id)
        : undefined
      console.log(`\n${await atualizarIndiceDoAssistente({ clienteIds })}`)
    }
```

(e uma linha no comentário do topo: "Com --aplicar, termina indexando para o assistente até 200 arquivos novos/trocados.")

`scripts/indexar-documentos.ts`: import `emMb`, `LIMITE_BYTES_INDICE`, `tamanhoDoIndice` de `'../src/lib/assistente/indexacao/tamanho'`; no começo do `for (;;)`:

```ts
    const bytes = await tamanhoDoIndice()
    if (bytes > LIMITE_BYTES_INDICE) {
      console.log(`PARADO: TrechoDocumento com ${emMb(bytes)}, acima do teto — a decisão é do usuário (spec fase 1 §7.5)`)
      break
    }
```

e ao fim, `console.log(\`TrechoDocumento: ${emMb(await tamanhoDoIndice())}\`)`. Trocar `limite: 20` por `limite: 50`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/assistente/indexacao` — Expected: PASS. `npx tsc --noEmit -p .` — sem erro novo.

- [ ] **Step 5: Conferir o script sem gravar**

Run: `npx dotenv -e .env.development -- npx tsx scripts/sincronizar-sharepoint.ts --clientes=SMIT`
Expected: listagem normal e **nenhuma** linha "índice do assistente" (sem `--aplicar`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/assistente/indexacao/apos-sincronizacao.ts src/lib/assistente/indexacao/apos-sincronizacao.test.ts scripts/sincronizar-sharepoint.ts scripts/indexar-documentos.ts
git commit -m "feat(assistente): índice atualizado no fim da sincronização do SharePoint, com teto de 80 MB"
```

---

### Task 7: Carga inicial no dev e régua depois × antes

**Files:** nenhum de código (só `docs/…/plans` no Andamento).

- [ ] **Step 1: Carga no banco de dev**

Run: `npx dotenv -e .env.development -- npx tsx scripts/indexar-documentos.ts` (roda em rodadas de 50; pode levar dezenas de minutos — `run_in_background`).
Expected: fim com `total: {…}` e `TrechoDocumento: N MB` ≤ 80 MB. Os `DOCUMENTO` em `erro` por "No blob credentials" continuam `erro` (Vercel Blob suspenso — fora do escopo, §10).

- [ ] **Step 2: Régua sem IA**

Run: `npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts --salvar --comparar=<linha-de-base-sem-ia>`
Expected (critérios 1, 5, 6): cortados → 0; `HISTORICO_PROPOSTA`/`HISTORICO_TERMO` só `ok`/`sem_texto` (e `erro` com motivo), nenhum pendente; `TrechoDocumento` ≤ 80 MB.

- [ ] **Step 3: Régua com IA**

Run: `npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts --com-ia --salvar --comparar=<linha-de-base-com-ia>`
Expected (critérios 2, 3, 5): mediana de entrada ≥30% menor; saída total não maior; pergunta 5 sem `buscarClientes` nem `detalheDoContrato` por `numero`; pergunta 7 citando arquivo e página.

- [ ] **Step 4: Conferir números (critério 4)**

Comparar as respostas 1–4 com a tela do cliente/contrato (ou `consolidarContratos()` num script descartável em `.superpowers/tmp/`): ativos, valor, faturado, saldo e vencimento iguais. Divergência → parar e investigar antes de seguir.

- [ ] **Step 5: Produção — só com o ok do usuário**

Mostrar ao usuário o resultado da régua e pedir o ok para: aplicar a migração em produção (`npx dotenv -e .env.production.local -- npx prisma migrate deploy`) e rodar a carga (`npx dotenv -e .env.production.local -- npx tsx scripts/indexar-documentos.ts`: lê ~1,1 GB do R2, grava ~50 MB no Neon). **Não executar sem o ok.**

---

### Task 8: Documentação

**Files:**
- Modify: `CLAUDE.md` (seção "Assistente de IA (botão flutuante)"), `docs/superpowers/specs/2026-09-25-assistente-base-economica-design.md` (Status), este plano (Andamento)

- [ ] **Step 1: CLAUDE.md**

Na seção do assistente, acrescentar os parágrafos:

```md
**O modelo recebe texto compacto, a tela recebe o objeto** (`ferramentas/compacto.ts`, `toModelOutput`):
tabela com cabeçalho uma vez, sem vazios nem `href`, corte por linha a 8.000 caracteres. Ferramenta nova
devolve o objeto de sempre e, se o genérico não servir, um `compactar`. Links que a IA escreve são
`tipo:id` e passam por `/ir/[tipo]/[id]` (confere permissão). Cliente e contrato citados na pergunta
(e os ids das últimas 3 respostas) entram no contexto antes da IA (`entidades.ts`, `preparar.ts`),
nunca no `system`. Antes e depois de mexer em ferramenta, formato ou instrução, rode a régua:
`npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts [--com-ia] --comparar=<rodada salva>`.

**Índice**: além das origens antigas, `ARQUIVO_CLIENTE` (arquivo do repositório que não é PC/PA/TC/TA
nem `Documento`). A sincronização do SharePoint com `--aplicar` termina indexando até 200 arquivos
(não muda o código de saída); erro é tentado de novo depois de 24 h; acima de 80 MB em `TrechoDocumento`
a indexação para e a decisão é do usuário.
```

e trocar "Origem de arquivo nova (ex.: `ArquivoCliente`) = mais um caso em `indexacao/fontes.ts`" por "Origem de arquivo nova = mais um caso em `indexacao/fontes.ts` (e em `hrefDoTrecho`/`linkDoTrecho`)". Acrescentar em Design: `docs/superpowers/specs/2026-09-25-assistente-base-economica-design.md` e Plano: `docs/superpowers/plans/2026-09-25-assistente-base-economica.md`.

- [ ] **Step 2: Spec e plano**

Status da spec: "Implementada em 25/09/2026 (ver Andamento do plano). Produção: <pendente/feita com ok do usuário em DD/MM>." No Andamento do plano, os commits de cada task e os números da régua antes × depois.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-25-assistente-base-economica-design.md docs/superpowers/plans/2026-09-25-assistente-base-economica.md
git commit -m "docs(assistente): fase 1 — texto compacto, identificação, links curtos e índice"
```
