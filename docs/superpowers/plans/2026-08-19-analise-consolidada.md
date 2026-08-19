# Análise Consolidada (Plano 3/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir selecionar N documentos concluídos do mesmo cliente/competência e gerar uma análise consolidada — divergências numéricas calculadas em código, a IA só interpreta — com PDF próprio.

**Architecture:** Nova entidade `AnaliseConsolidada` (N:N com `Documento`). Cálculo de divergência é uma função pura em `lib/analiseConsolidada/calcularMetricas.ts` (testada isoladamente); a IA (`lib/ia/consolidar.ts`) recebe esse resultado já pronto. `getModel()` sai de `lib/ia/analisar.ts` pra `lib/ia/modelo.ts` (DRY — `consolidar.ts` e o `evoluir.ts` do Plano 4 vão precisar dele também). Rotas e PDF seguem o mesmo padrão do módulo 7 (`gerarRelatorio.ts`/`RelatorioDocument.tsx`).

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL, Zod, `ai` (Vercel AI SDK), `@react-pdf/renderer`, Jest.

## Global Constraints

- Depende dos Planos 1 e 2 (`Cliente`, competência em `Documento`, `metricasChave` estruturado, `podeVerCliente`) já mergeados.
- **Nenhuma divergência/variação é calculada pela IA** — sempre em código puro, testado. A IA só recebe a tabela pronta e escreve interpretação.
- Sem testes automatizados pra rotas/páginas (mesma linha dos módulos 3-8); funções puras (`calcularMetricasComparadas`, `lib/ia/consolidar.ts`) ganham teste, mesmo padrão de `lib/storage.ts`/`lib/ia/analisar.ts`.
- Convenção de commit: `git commit -m "tipo: descrição"` em português, terminando com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Schema — `AnaliseConsolidada`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `AnaliseConsolidada` (ver campos abaixo); `Documento.analisesConsolidadas: AnaliseConsolidada[]`; `Cliente.analisesConsolidadas: AnaliseConsolidada[]`

- [ ] **Step 1: Editar o schema**

Adicionar em `Documento` (depois de `notificacoes`):

```prisma
  analisesConsolidadas AnaliseConsolidada[] @relation("DocumentosDaConsolidada")
```

Adicionar em `Cliente` (depois de `documentos`):

```prisma
  analisesConsolidadas AnaliseConsolidada[]
```

Adicionar ao final do arquivo:

```prisma
model AnaliseConsolidada {
  id                  String      @id @default(cuid())
  clienteId           String
  cliente             Cliente     @relation(fields: [clienteId], references: [id])
  competenciaAno      Int
  competenciaMes      Int
  documentos          Documento[] @relation("DocumentosDaConsolidada")
  selecaoAssinatura   String
  resumo              String      @db.Text
  pontosCriticos      Json
  pontosPositivos     Json
  metricasComparadas  Json
  recomendacoes       Json?
  promptVersion       String
  caminhoRelatorioPdf String?
  relatorioGeradoEm   DateTime?
  createdAt           DateTime    @default(now())

  @@unique([clienteId, competenciaAno, competenciaMes, selecaoAssinatura])
}
```

- [ ] **Step 2: Migration**

```bash
npx dotenv -e .env.development -- npx prisma migrate dev --name analise_consolidada
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: entidade AnaliseConsolidada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `buildRelatorioConsolidadoPath`

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/storage.test.ts`

**Interfaces:**
- Produces: `buildRelatorioConsolidadoPath(analiseConsolidadaId: string, data?: Date): string`

- [ ] **Step 1: Escrever o teste**

Em `src/lib/storage.test.ts`, adicionar (depois do `describe('getUploadPublicUrl', ...)`):

```ts
describe('buildRelatorioConsolidadoPath', () => {
  it('monta o caminho relativo com ano/mes/consolidadas/id/relatorio.pdf', () => {
    const data = new Date('2026-08-18T12:00:00Z')
    expect(buildRelatorioConsolidadoPath('cons123', data)).toBe('2026/08/consolidadas/cons123/relatorio.pdf')
  })
})
```

E ajustar o import no topo do arquivo pra incluir a nova função:

```ts
import { buildUploadPath, getUploadFullPath, getUploadPublicUrl, buildRelatorioConsolidadoPath } from './storage'
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- storage.test.ts`
Expected: FAIL — `buildRelatorioConsolidadoPath is not a function`

- [ ] **Step 3: Implementar**

Em `src/lib/storage.ts`, adicionar:

```ts
export function buildRelatorioConsolidadoPath(analiseConsolidadaId: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/consolidadas/${analiseConsolidadaId}/relatorio.pdf`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: buildRelatorioConsolidadoPath

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Extrair `getModel()` pra `lib/ia/modelo.ts`

**Files:**
- Create: `src/lib/ia/modelo.ts`
- Modify: `src/lib/ia/analisar.ts`

**Interfaces:**
- Produces: `getModel(): LanguageModel` (mesma assinatura/comportamento que já existia dentro de `analisar.ts`) — consumida por `analisar.ts`, `consolidar.ts` (Task 5) e pelo `evoluir.ts` do Plano 4.

- [ ] **Step 1: Criar `modelo.ts` com o conteúdo movido de `analisar.ts`**

```ts
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createGroq } from '@ai-sdk/groq'

export function getModel() {
  switch (process.env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.AI_API_KEY })(process.env.AI_MODEL!)
    case 'google':
      // Google AI Studio (aistudio.google.com/apikey) — tier gratuito, sem projeto GCP.
      return createGoogleGenerativeAI({ apiKey: process.env.AI_API_KEY })(process.env.AI_MODEL!)
    case 'vertex':
      // Sem apiKey: usa Application Default Credentials (gcloud auth application-default login).
      return createVertex({
        project: process.env.GOOGLE_VERTEX_PROJECT,
        location: process.env.GOOGLE_VERTEX_LOCATION,
      })(process.env.AI_MODEL!)
    case 'groq':
      // Groq (console.groq.com/keys) — tier gratuito sem cartão de crédito, "forever free".
      return createGroq({ apiKey: process.env.AI_API_KEY })(process.env.AI_MODEL!)
    default:
      throw new Error(`AI_PROVIDER "${process.env.AI_PROVIDER}" não suportado`)
  }
}
```

- [ ] **Step 2: Atualizar `analisar.ts`**

Remover de `src/lib/ia/analisar.ts` os imports `createAnthropic`, `createGoogleGenerativeAI`, `createVertex`, `createGroq` e a função `getModel` inteira; adicionar no topo:

```ts
import { getModel } from './modelo'
```

O restante do arquivo (`schema`, `montarPrompt`, `analisarDocumento`) não muda.

- [ ] **Step 3: Rodar os testes existentes**

Run: `npm test -- analisar.test.ts`
Expected: PASS sem nenhuma mudança no arquivo de teste — os mocks de `@ai-sdk/*` continuam interceptando os módulos pelo caminho, independente de quem os importa.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ia/modelo.ts src/lib/ia/analisar.ts
git commit -m "refactor: extrai getModel() pra lib/ia/modelo.ts (reuso por consolidar/evoluir)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `calcularMetricasComparadas` (cálculo determinístico)

**Files:**
- Create: `src/lib/analiseConsolidada/calcularMetricas.ts`
- Test: `src/lib/analiseConsolidada/calcularMetricas.test.ts`

**Interfaces:**
- Produces:
```ts
export interface MetricaDocumento {
  documentoId: string
  nomeArquivo: string
  label: string
  valorNumerico: number | null
  unidade: string | null
  valorExibicao: string
}

export interface MetricaComparada {
  label: string
  valores: Array<{ documentoId: string; nomeArquivo: string; valorNumerico: number | null; valorExibicao: string }>
  divergencia: {
    minimo: number
    maximo: number
    diferencaAbsoluta: number
    diferencaPercentual: number | null
  } | null
}

export function calcularMetricasComparadas(metricas: MetricaDocumento[]): MetricaComparada[]
```
Usado pela rota de geração (Task 6).

- [ ] **Step 1: Escrever o teste**

```ts
/**
 * @jest-environment node
 */
import { calcularMetricasComparadas } from './calcularMetricas'

describe('calcularMetricasComparadas', () => {
  it('agrupa por label (case-insensitive) e calcula divergência quando há 2+ valores numéricos', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'azure.pdf', label: 'Storage', valorNumerico: 11200, unidade: 'BRL', valorExibicao: 'R$ 11.200,00' },
      { documentoId: 'd2', nomeArquivo: 'interno.xlsx', label: 'storage', valorNumerico: 10900, unidade: 'BRL', valorExibicao: 'R$ 10.900,00' },
    ])

    expect(resultado).toEqual([
      {
        label: 'Storage',
        valores: [
          { documentoId: 'd1', nomeArquivo: 'azure.pdf', valorNumerico: 11200, valorExibicao: 'R$ 11.200,00' },
          { documentoId: 'd2', nomeArquivo: 'interno.xlsx', valorNumerico: 10900, valorExibicao: 'R$ 10.900,00' },
        ],
        divergencia: {
          minimo: 10900,
          maximo: 11200,
          diferencaAbsoluta: 300,
          diferencaPercentual: 300 / 10900,
        },
      },
    ])
  })

  it('não calcula divergência quando só há um valor pro label', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Licenças', valorNumerico: 5, unidade: null, valorExibicao: '5' },
    ])
    expect(resultado[0].divergencia).toBeNull()
  })

  it('não calcula divergência quando os valores não são numéricos', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Status', valorNumerico: null, unidade: null, valorExibicao: 'Ativo' },
      { documentoId: 'd2', nomeArquivo: 'b.pdf', label: 'Status', valorNumerico: null, unidade: null, valorExibicao: 'Ativo' },
    ])
    expect(resultado[0].divergencia).toBeNull()
  })

  it('trata diferencaPercentual como null quando o mínimo é zero (evita divisão por zero)', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Créditos usados', valorNumerico: 0, unidade: null, valorExibicao: '0' },
      { documentoId: 'd2', nomeArquivo: 'b.pdf', label: 'Créditos usados', valorNumerico: 50, unidade: null, valorExibicao: '50' },
    ])
    expect(resultado[0].divergencia).toEqual({
      minimo: 0,
      maximo: 50,
      diferencaAbsoluta: 50,
      diferencaPercentual: null,
    })
  })

  it('mantém labels diferentes em grupos separados, na ordem de primeira aparição', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Storage', valorNumerico: 100, unidade: null, valorExibicao: '100' },
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Licenças', valorNumerico: 5, unidade: null, valorExibicao: '5' },
    ])
    expect(resultado.map((m) => m.label)).toEqual(['Storage', 'Licenças'])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- calcularMetricas.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```ts
export interface MetricaDocumento {
  documentoId: string
  nomeArquivo: string
  label: string
  valorNumerico: number | null
  unidade: string | null
  valorExibicao: string
}

export interface MetricaComparada {
  label: string
  valores: Array<{ documentoId: string; nomeArquivo: string; valorNumerico: number | null; valorExibicao: string }>
  divergencia: {
    minimo: number
    maximo: number
    diferencaAbsoluta: number
    diferencaPercentual: number | null
  } | null
}

function normalizarLabel(label: string): string {
  return label.trim().toLowerCase()
}

export function calcularMetricasComparadas(metricas: MetricaDocumento[]): MetricaComparada[] {
  const grupos = new Map<string, { labelOriginal: string; valores: MetricaComparada['valores'] }>()

  for (const metrica of metricas) {
    const chave = normalizarLabel(metrica.label)
    const grupo = grupos.get(chave) ?? { labelOriginal: metrica.label, valores: [] }
    grupo.valores.push({
      documentoId: metrica.documentoId,
      nomeArquivo: metrica.nomeArquivo,
      valorNumerico: metrica.valorNumerico,
      valorExibicao: metrica.valorExibicao,
    })
    grupos.set(chave, grupo)
  }

  return [...grupos.values()].map((grupo) => {
    const numericos = grupo.valores.map((v) => v.valorNumerico).filter((v): v is number => v !== null)

    let divergencia: MetricaComparada['divergencia'] = null
    if (numericos.length >= 2) {
      const minimo = Math.min(...numericos)
      const maximo = Math.max(...numericos)
      const diferencaAbsoluta = maximo - minimo
      divergencia = {
        minimo,
        maximo,
        diferencaAbsoluta,
        diferencaPercentual: minimo !== 0 ? diferencaAbsoluta / Math.abs(minimo) : null,
      }
    }

    return { label: grupo.labelOriginal, valores: grupo.valores, divergencia }
  })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- calcularMetricas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/analiseConsolidada/calcularMetricas.ts src/lib/analiseConsolidada/calcularMetricas.test.ts
git commit -m "feat: calcularMetricasComparadas — divergência entre documentos, em código

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `lib/ia/consolidar.ts`

**Files:**
- Create: `src/lib/ia/consolidar.ts`
- Test: `src/lib/ia/consolidar.test.ts`

**Interfaces:**
- Consumes: `getModel()` (Task 3), `MetricaComparada` (Task 4)
- Produces: `analisarConsolidado(resumos: Array<{ nomeArquivo: string; resumo: string }>, metricasComparadas: MetricaComparada[], promptVersion: string): Promise<{ resumo, pontosCriticos, pontosPositivos, recomendacoes, promptVersion }>`

- [ ] **Step 1: Escrever o teste**

```ts
/**
 * @jest-environment node
 */
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}))
const modeloFactoryMock = jest.fn(() => 'modelo-mock')
jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: jest.fn(() => modeloFactoryMock),
}))
jest.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: jest.fn() }))
jest.mock('@ai-sdk/google-vertex', () => ({ createVertex: jest.fn() }))
jest.mock('@ai-sdk/groq', () => ({ createGroq: jest.fn() }))

import { generateObject } from 'ai'
import { analisarConsolidado } from './consolidar'

describe('analisarConsolidado', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AI_PROVIDER = 'anthropic'
    process.env.AI_API_KEY = 'chave-fake'
    process.env.AI_MODEL = 'modelo-fake'
  })

  it('chama generateObject com o prompt contendo os resumos e as métricas já calculadas', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({
      object: {
        resumo: 'resumo consolidado',
        pontosCriticos: [{ texto: 'divergência entre docs', severidade: 'alto' }],
        pontosPositivos: [],
        recomendacoes: ['confirmar valor com o fornecedor'],
      },
    })

    const resumos = [{ nomeArquivo: 'azure.pdf', resumo: 'relatório da azure' }]
    const metricas = [
      {
        label: 'Storage',
        valores: [
          { documentoId: 'd1', nomeArquivo: 'azure.pdf', valorNumerico: 11200, valorExibicao: 'R$ 11.200,00' },
          { documentoId: 'd2', nomeArquivo: 'interno.xlsx', valorNumerico: 10900, valorExibicao: 'R$ 10.900,00' },
        ],
        divergencia: { minimo: 10900, maximo: 11200, diferencaAbsoluta: 300, diferencaPercentual: 300 / 10900 },
      },
    ]

    const resultado = await analisarConsolidado(resumos, metricas, 'v1')

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-mock',
        prompt: expect.stringContaining('R$ 11.200,00'),
      })
    )
    expect(resultado).toEqual({
      resumo: 'resumo consolidado',
      pontosCriticos: [{ texto: 'divergência entre docs', severidade: 'alto' }],
      pontosPositivos: [],
      recomendacoes: ['confirmar valor com o fornecedor'],
      promptVersion: 'v1',
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- consolidar.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```ts
import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './modelo'
import type { MetricaComparada } from '@/lib/analiseConsolidada/calcularMetricas'

const schema = z.object({
  resumo: z.string(),
  pontosCriticos: z.array(
    z.object({ texto: z.string(), severidade: z.enum(['alto', 'medio', 'baixo']) })
  ),
  pontosPositivos: z.array(z.object({ texto: z.string() })),
  recomendacoes: z.array(z.string()).nullable(),
})

interface ResumoDocumento {
  nomeArquivo: string
  resumo: string
}

function montarPrompt(resumos: ResumoDocumento[], metricasComparadas: MetricaComparada[]): string {
  const listaResumos = resumos
    .map((r, i) => `Documento ${i + 1} — ${r.nomeArquivo}:\n${r.resumo}`)
    .join('\n\n')

  const listaMetricas = metricasComparadas
    .map((m) => {
      const valores = m.valores.map((v) => `${v.nomeArquivo}: ${v.valorExibicao}`).join(' | ')
      const divergencia = m.divergencia
        ? ` (divergência: ${m.divergencia.diferencaAbsoluta} absoluto${
            m.divergencia.diferencaPercentual !== null
              ? `, ${(m.divergencia.diferencaPercentual * 100).toFixed(1)}%`
              : ''
          })`
        : ''
      return `- ${m.label}: ${valores}${divergencia}`
    })
    .join('\n')

  return [
    'Você é um analista sênior de faturamento revisando um CONJUNTO de documentos do',
    'mesmo cliente e mesma competência (mês) que precisam ser consolidados num só',
    'relatório.',
    '',
    'IMPORTANTE: as métricas abaixo já foram extraídas e comparadas matematicamente',
    'em código — os números e as divergências já estão calculados. Você NUNCA deve',
    'recalcular, estimar ou arredondar de forma diferente do que está escrito. Sua',
    'tarefa é só interpretar esses números prontos e escrever a análise.',
    '',
    'Resumos individuais de cada documento selecionado:',
    listaResumos,
    '',
    'Métricas já comparadas entre os documentos (label: valor de cada documento,',
    'com a divergência entre eles quando há mais de um valor numérico):',
    listaMetricas || '(nenhuma métrica numérica em comum entre os documentos)',
    '',
    'Produza:',
    '1. RESUMO: um parágrafo consolidando o que esse conjunto de documentos mostra',
    '   no geral pra esse cliente/competência.',
    '2. PONTOS CRÍTICOS: problemas, riscos ou divergências relevantes — cite as',
    '   divergências de métrica fornecidas acima quando forem significativas.',
    '3. PONTOS POSITIVOS: o que está consistente/bem entre os documentos.',
    '4. RECOMENDAÇÕES: uma ação prática por ponto crítico relevante.',
  ].join('\n')
}

export async function analisarConsolidado(
  resumos: ResumoDocumento[],
  metricasComparadas: MetricaComparada[],
  promptVersion: string
) {
  const { object } = await generateObject({
    model: getModel(),
    schema,
    prompt: montarPrompt(resumos, metricasComparadas),
  })
  return { ...object, promptVersion }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- consolidar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ia/consolidar.ts src/lib/ia/consolidar.test.ts
git commit -m "feat: lib/ia/consolidar — IA interpreta métricas já calculadas, nunca recalcula

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Rota `GET`/`POST /api/clientes/[clienteId]/competencias/[competencia]/analise-consolidada`

**Files:**
- Create: `src/app/api/clientes/[clienteId]/competencias/[competencia]/analise-consolidada/route.ts`

**Interfaces:**
- Consumes: `parseCompetencia` (Plano 2), `podeVerCliente` (Plano 1), `calcularMetricasComparadas` (Task 4), `analisarConsolidado` (Task 5), `PROMPT_VERSION_ATUAL` de `@/lib/ia/analisar`
- Produces: `GET` → `AnaliseConsolidada[]` (com `documentos`); `POST { documentoIds: string[] }` → `AnaliseConsolidada` (`201`)

- [ ] **Step 1: Implementar a rota**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { parseCompetencia } from '@/lib/competencia'
import { calcularMetricasComparadas, type MetricaDocumento } from '@/lib/analiseConsolidada/calcularMetricas'
import { analisarConsolidado } from '@/lib/ia/consolidar'
import { PROMPT_VERSION_ATUAL } from '@/lib/ia/analisar'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string; competencia: string }> }
) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { clienteId, competencia } = await params
  const parsed = parseCompetencia(competencia)
  if (!parsed) {
    return NextResponse.json({ error: 'competência inválida (esperado AAAA-MM)' }, { status: 400 })
  }

  const podeVer = await podeVerCliente(usuario, clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const analises = await prisma.analiseConsolidada.findMany({
    where: { clienteId, competenciaAno: parsed.ano, competenciaMes: parsed.mes },
    orderBy: { createdAt: 'desc' },
    include: { documentos: { select: { id: true, nomeArquivo: true } } },
  })
  return NextResponse.json(analises)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string; competencia: string }> }
) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { clienteId, competencia } = await params
  const parsed = parseCompetencia(competencia)
  if (!parsed) {
    return NextResponse.json({ error: 'competência inválida (esperado AAAA-MM)' }, { status: 400 })
  }

  const podeVer = await podeVerCliente(usuario, clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const documentoIds: unknown = body?.documentoIds
  if (
    !Array.isArray(documentoIds) ||
    documentoIds.length === 0 ||
    !documentoIds.every((id) => typeof id === 'string')
  ) {
    return NextResponse.json(
      { error: '"documentoIds" (array de ids, não-vazio) é obrigatório' },
      { status: 400 }
    )
  }

  const documentos = await prisma.documento.findMany({
    where: {
      id: { in: documentoIds },
      clienteId,
      competenciaAno: parsed.ano,
      competenciaMes: parsed.mes,
      status: 'concluido',
    },
    include: { analise: true },
  })

  if (documentos.length !== documentoIds.length) {
    return NextResponse.json(
      {
        error:
          'algum documento selecionado não existe, não pertence a esse cliente/competência, ou ainda não tem análise concluída',
      },
      { status: 400 }
    )
  }

  const metricasPorDocumento: MetricaDocumento[] = documentos.flatMap((doc) => {
    const metricas =
      (doc.analise?.metricasChave as
        | Array<{ label: string; valorNumerico: number | null; unidade: string | null; valorExibicao: string }>
        | null) ?? []
    return metricas.map((m) => ({
      documentoId: doc.id,
      nomeArquivo: doc.nomeArquivo,
      label: m.label,
      valorNumerico: m.valorNumerico,
      unidade: m.unidade,
      valorExibicao: m.valorExibicao,
    }))
  })

  const metricasComparadas = calcularMetricasComparadas(metricasPorDocumento)

  const resumos = documentos.map((doc) => ({
    nomeArquivo: doc.nomeArquivo,
    resumo: doc.analise!.resumo,
  }))

  const analiseGerada = await analisarConsolidado(resumos, metricasComparadas, PROMPT_VERSION_ATUAL)
  const selecaoAssinatura = [...documentoIds].sort().join(',')

  const analiseConsolidada = await prisma.analiseConsolidada.upsert({
    where: {
      clienteId_competenciaAno_competenciaMes_selecaoAssinatura: {
        clienteId,
        competenciaAno: parsed.ano,
        competenciaMes: parsed.mes,
        selecaoAssinatura,
      },
    },
    create: {
      clienteId,
      competenciaAno: parsed.ano,
      competenciaMes: parsed.mes,
      selecaoAssinatura,
      resumo: analiseGerada.resumo,
      pontosCriticos: analiseGerada.pontosCriticos,
      pontosPositivos: analiseGerada.pontosPositivos,
      metricasComparadas,
      recomendacoes: analiseGerada.recomendacoes ?? undefined,
      promptVersion: analiseGerada.promptVersion,
      documentos: { connect: documentoIds.map((id) => ({ id })) },
    },
    update: {
      resumo: analiseGerada.resumo,
      pontosCriticos: analiseGerada.pontosCriticos,
      pontosPositivos: analiseGerada.pontosPositivos,
      metricasComparadas,
      recomendacoes: analiseGerada.recomendacoes ?? undefined,
      promptVersion: analiseGerada.promptVersion,
      caminhoRelatorioPdf: null,
      relatorioGeradoEm: null,
      documentos: { set: documentoIds.map((id) => ({ id })) },
    },
    include: { documentos: { select: { id: true, nomeArquivo: true } } },
  })

  return NextResponse.json(analiseConsolidada, { status: 201 })
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/clientes/[clienteId]/competencias/[competencia]/analise-consolidada"
git commit -m "feat: rota de geração/listagem de análise consolidada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `GET /api/analises-consolidadas/[id]`

**Files:**
- Create: `src/app/api/analises-consolidadas/[id]/route.ts`

- [ ] **Step 1: Implementar**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const analise = await prisma.analiseConsolidada.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true } },
      documentos: { select: { id: true, nomeArquivo: true } },
    },
  })
  if (!analise) {
    return NextResponse.json({ error: 'análise consolidada não encontrada' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, analise.clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  return NextResponse.json(analise)
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/analises-consolidadas/[id]/route.ts"
git commit -m "feat: GET /api/analises-consolidadas/[id]

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: PDF da análise consolidada

**Files:**
- Create: `src/lib/pdf/ConsolidadoDocument.tsx`
- Create: `src/lib/pdf/gerarRelatorioConsolidado.ts`
- Create: `src/app/api/analises-consolidadas/[id]/relatorio/route.ts`

**Interfaces:**
- Consumes: `buildRelatorioConsolidadoPath` (Task 2), `podeVerCliente` (Plano 1)
- Produces: `GET /api/analises-consolidadas/[id]/relatorio` → PDF (`application/pdf`)

- [ ] **Step 1: `ConsolidadoDocument.tsx`**

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AnaliseConsolidada, Cliente, Documento } from '@prisma/client'

const AZUL_MARINHO = '#002A4A'
const LARANJA = '#F5691E'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#1a1a1a' },
  capa: { marginBottom: 24, borderBottom: `2px solid ${AZUL_MARINHO}`, paddingBottom: 16 },
  tituloApp: { fontSize: 20, color: AZUL_MARINHO, fontWeight: 700, marginBottom: 4 },
  nomeCliente: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  meta: { fontSize: 10, color: '#555' },
  secao: { marginBottom: 16 },
  tituloSecao: { fontSize: 13, color: AZUL_MARINHO, fontWeight: 700, marginBottom: 6 },
  item: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  badge: { fontSize: 8, color: '#fff', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, marginRight: 6 },
  badgeAlto: { backgroundColor: '#c0392b' },
  badgeMedio: { backgroundColor: LARANJA },
  badgeBaixo: { backgroundColor: '#7f8c8d' },
  badgePositivo: { backgroundColor: '#27ae60' },
  tabelaLinha: { flexDirection: 'row', borderBottom: '1px solid #ddd', paddingVertical: 4 },
  tabelaLabel: { width: '30%', fontWeight: 700 },
  tabelaValores: { width: '50%' },
  tabelaDivergencia: { width: '20%', fontSize: 9, color: '#c0392b' },
  bullet: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  bulletMarca: { color: LARANJA, marginRight: 6, fontWeight: 700 },
  rodape: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
})

const BADGE_SEVERIDADE: Record<string, typeof styles.badgeAlto> = {
  alto: styles.badgeAlto,
  medio: styles.badgeMedio,
  baixo: styles.badgeBaixo,
}

interface Props {
  cliente: Pick<Cliente, 'nome'>
  documentos: Array<Pick<Documento, 'nomeArquivo'>>
  analise: AnaliseConsolidada
}

export function ConsolidadoDocument({ cliente, documentos, analise }: Props) {
  const pontosCriticos = analise.pontosCriticos as Array<{ texto: string; severidade: string }>
  const pontosPositivos = analise.pontosPositivos as Array<{ texto: string }>
  const recomendacoes = (analise.recomendacoes as string[] | null) ?? []
  const metricasComparadas = analise.metricasComparadas as Array<{
    label: string
    valores: Array<{ nomeArquivo: string; valorExibicao: string }>
    divergencia: { diferencaPercentual: number | null } | null
  }>

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.capa}>
          <Text style={styles.tituloApp}>VerAI — Análise consolidada</Text>
          <Text style={styles.nomeCliente}>
            {cliente.nome} — {String(analise.competenciaMes).padStart(2, '0')}/{analise.competenciaAno}
          </Text>
          <Text style={styles.meta}>{documentos.length} documento(s) consolidado(s)</Text>
          <Text style={styles.meta}>{documentos.map((d) => d.nomeArquivo).join(', ')}</Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Resumo executivo</Text>
          <Text>{analise.resumo}</Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Pontos críticos</Text>
          {pontosCriticos.map((ponto, i) => (
            <View key={i} style={styles.item}>
              <Text style={[styles.badge, BADGE_SEVERIDADE[ponto.severidade] ?? styles.badgeBaixo]}>
                {ponto.severidade}
              </Text>
              <Text>{ponto.texto}</Text>
            </View>
          ))}
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Pontos positivos</Text>
          {pontosPositivos.map((ponto, i) => (
            <View key={i} style={styles.item}>
              <Text style={[styles.badge, styles.badgePositivo]}>✓</Text>
              <Text>{ponto.texto}</Text>
            </View>
          ))}
        </View>

        {metricasComparadas.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Métricas comparadas entre documentos</Text>
            {metricasComparadas.map((metrica, i) => (
              <View key={i} style={styles.tabelaLinha}>
                <Text style={styles.tabelaLabel}>{metrica.label}</Text>
                <Text style={styles.tabelaValores}>
                  {metrica.valores.map((v) => `${v.nomeArquivo}: ${v.valorExibicao}`).join('  |  ')}
                </Text>
                <Text style={styles.tabelaDivergencia}>
                  {metrica.divergencia?.diferencaPercentual != null
                    ? `⚠ ${(metrica.divergencia.diferencaPercentual * 100).toFixed(1)}%`
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {recomendacoes.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Recomendações</Text>
            {recomendacoes.map((recomendacao, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletMarca}>•</Text>
                <Text>{recomendacao}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.rodape}>Gerado automaticamente pelo VerAI</Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: `gerarRelatorioConsolidado.ts`**

```ts
import { renderToBuffer } from '@react-pdf/renderer'
import type { AnaliseConsolidada, Cliente, Documento } from '@prisma/client'
import { ConsolidadoDocument } from './ConsolidadoDocument'

export async function gerarRelatorioConsolidadoPdf(
  cliente: Pick<Cliente, 'nome'>,
  documentos: Array<Pick<Documento, 'nomeArquivo'>>,
  analise: AnaliseConsolidada
): Promise<Buffer> {
  return renderToBuffer(ConsolidadoDocument({ cliente, documentos, analise }))
}
```

- [ ] **Step 3: rota de download**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import type { AnaliseConsolidada } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { buildRelatorioConsolidadoPath, getUploadFullPath } from '@/lib/storage'
import { gerarRelatorioConsolidadoPdf } from '@/lib/pdf/gerarRelatorioConsolidado'

async function obterBuffer(
  cliente: { nome: string },
  documentos: Array<{ nomeArquivo: string }>,
  analise: AnaliseConsolidada
): Promise<Buffer> {
  if (analise.caminhoRelatorioPdf) {
    try {
      return await readFile(getUploadFullPath(analise.caminhoRelatorioPdf))
    } catch {
      // cache inválido — regenera abaixo
    }
  }

  const buffer = await gerarRelatorioConsolidadoPdf(cliente, documentos, analise)
  const caminhoRelativo = buildRelatorioConsolidadoPath(analise.id)
  const caminhoCompleto = getUploadFullPath(caminhoRelativo)
  await mkdir(dirname(caminhoCompleto), { recursive: true })
  await writeFile(caminhoCompleto, buffer)
  await prisma.analiseConsolidada.update({
    where: { id: analise.id },
    data: { caminhoRelatorioPdf: caminhoRelativo, relatorioGeradoEm: new Date() },
  })

  return buffer
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const analise = await prisma.analiseConsolidada.findUnique({
    where: { id },
    include: {
      cliente: { select: { nome: true } },
      documentos: { select: { nomeArquivo: true } },
    },
  })
  if (!analise) {
    return NextResponse.json({ error: 'análise consolidada não encontrada' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, analise.clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const buffer = await obterBuffer(analise.cliente, analise.documentos, analise)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="consolidado-${analise.cliente.nome}-${analise.competenciaAno}-${analise.competenciaMes}.pdf"`,
    },
  })
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/ConsolidadoDocument.tsx src/lib/pdf/gerarRelatorioConsolidado.ts "src/app/api/analises-consolidadas/[id]/relatorio"
git commit -m "feat: PDF da análise consolidada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: UI — selecionar documentos e gerar consolidada em `/clientes/[id]/[competencia]`

**Files:**
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/clientes/[clienteId]/competencias/[competencia]/analise-consolidada` (Task 6), `GET /api/analises-consolidadas/[id]/relatorio` (Task 8)

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
'use client'

import { use, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { nomeCompetencia, parseCompetencia } from '@/lib/competencia'

interface Documento {
  id: string
  nomeArquivo: string
  tipo: string
  status: string
  createdAt: string
  uploadedBy: { nome: string }
  analise: { id: string } | null
}

interface Cliente {
  id: string
  nome: string
}

interface MetricaComparada {
  label: string
  valores: Array<{ documentoId: string; nomeArquivo: string; valorExibicao: string }>
  divergencia: { diferencaPercentual: number | null } | null
}

interface AnaliseConsolidada {
  id: string
  resumo: string
  metricasComparadas: MetricaComparada[]
  createdAt: string
  documentos: Array<{ id: string; nomeArquivo: string }>
}

const STATUS_BADGE: Record<string, string> = {
  concluido: 'bg-green-100 text-green-800',
  processando: 'bg-gray-100 text-gray-800',
  erro: 'bg-red-100 text-red-800',
}

export default function ClienteCompetenciaPage({
  params,
}: {
  params: Promise<{ id: string; competencia: string }>
}) {
  const { id, competencia } = use(params)
  const parsed = parseCompetencia(competencia)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [analisesConsolidadas, setAnalisesConsolidadas] = useState<AnaliseConsolidada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erroUpload, setErroUpload] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [gerandoConsolidada, setGerandoConsolidada] = useState(false)
  const [erroConsolidada, setErroConsolidada] = useState<string | null>(null)

  async function carregar() {
    if (!parsed) return
    setCarregando(true)
    const [clienteResponse, documentosResponse, consolidadasResponse] = await Promise.all([
      fetch(`/api/clientes/${id}`),
      fetch(`/api/documentos?clienteId=${id}&competenciaAno=${parsed.ano}&competenciaMes=${parsed.mes}`),
      fetch(`/api/clientes/${id}/competencias/${competencia}/analise-consolidada`),
    ])
    if (clienteResponse.ok) setCliente(await clienteResponse.json())
    if (documentosResponse.ok) setDocumentos(await documentosResponse.json())
    if (consolidadasResponse.ok) setAnalisesConsolidadas(await consolidadasResponse.json())
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, competencia])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed) return
    setErroUpload(null)
    const form = event.currentTarget
    const input = form.elements.namedItem('arquivo') as HTMLInputElement
    const arquivo = input.files?.[0]
    if (!arquivo) return

    setEnviando(true)
    const formData = new FormData()
    formData.set('arquivo', arquivo)
    formData.set('clienteId', id)
    formData.set('competenciaAno', String(parsed.ano))
    formData.set('competenciaMes', String(parsed.mes))

    const response = await fetch('/api/documentos', { method: 'POST', body: formData })
    setEnviando(false)

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErroUpload(body?.error ?? 'Falha ao enviar o documento.')
      return
    }
    form.reset()
    carregar()
  }

  function toggleSelecionado(docId: string) {
    setSelecionados((atual) => (atual.includes(docId) ? atual.filter((x) => x !== docId) : [...atual, docId]))
  }

  async function handleGerarConsolidada() {
    setErroConsolidada(null)
    setGerandoConsolidada(true)
    const response = await fetch(`/api/clientes/${id}/competencias/${competencia}/analise-consolidada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentoIds: selecionados }),
    })
    setGerandoConsolidada(false)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErroConsolidada(body?.error ?? 'Falha ao gerar a análise consolidada.')
      return
    }
    setSelecionados([])
    carregar()
  }

  if (!parsed) {
    return (
      <main className="p-8">
        <p className="text-sm text-red-600">Competência inválida na URL (esperado AAAA-MM).</p>
      </main>
    )
  }

  return (
    <main className="space-y-6 p-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/clientes/${id}`} className="hover:underline">
            {cliente?.nome ?? '...'}
          </Link>
        </p>
        <h1 className="text-xl font-semibold">{nomeCompetencia(parsed.ano, parsed.mes)}</h1>
      </div>

      <form onSubmit={handleUpload} className="flex items-center gap-3">
        <input type="file" name="arquivo" accept=".xlsx,.csv,.pdf" required className="text-sm" />
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Enviar documento'}
        </button>
        {erroUpload && <span className="text-sm text-red-600">{erroUpload}</span>}
      </form>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento neste mês ainda.</p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2"></th>
                <th>Arquivo</th>
                <th>Tipo</th>
                <th>Enviado por</th>
                <th>Quando</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((doc) => (
                <tr key={doc.id} className="border-b">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      disabled={doc.status !== 'concluido'}
                      checked={selecionados.includes(doc.id)}
                      onChange={() => toggleSelecionado(doc.id)}
                    />
                  </td>
                  <td>{doc.nomeArquivo}</td>
                  <td>{doc.tipo}</td>
                  <td>{doc.uploadedBy.nome}</td>
                  <td>{new Date(doc.createdAt).toLocaleString('pt-BR')}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[doc.status] ?? ''}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="space-x-3">
                    <Link href={`/documentos/${doc.id}`} className="text-blue-600 hover:underline">
                      Ver análise
                    </Link>
                    <a href={`/api/documentos/${doc.id}/original`} className="text-blue-600 hover:underline">
                      Baixar original
                    </a>
                    {doc.status === 'concluido' && (
                      <a href={`/api/documentos/${doc.id}/relatorio`} className="text-blue-600 hover:underline">
                        Baixar relatório
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGerarConsolidada}
              disabled={selecionados.length === 0 || gerandoConsolidada}
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {gerandoConsolidada
                ? 'Gerando...'
                : `Gerar análise consolidada (${selecionados.length} selecionado(s))`}
            </button>
            {erroConsolidada && <span className="text-sm text-red-600">{erroConsolidada}</span>}
          </div>
        </>
      )}

      {analisesConsolidadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">Análises consolidadas geradas</h2>
          {analisesConsolidadas.map((analise) => (
            <div key={analise.id} className="space-y-2 rounded border p-4 text-sm">
              <p className="text-xs text-muted-foreground">
                {analise.documentos.map((d) => d.nomeArquivo).join(', ')} —{' '}
                {new Date(analise.createdAt).toLocaleString('pt-BR')}
              </p>
              <p>{analise.resumo}</p>
              {analise.metricasComparadas.some((m) => m.divergencia) && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-red-700">
                  {analise.metricasComparadas
                    .filter((m) => m.divergencia)
                    .map((m) => (
                      <li key={m.label}>
                        Divergência em &quot;{m.label}&quot;:{' '}
                        {m.valores.map((v) => `${v.nomeArquivo} = ${v.valorExibicao}`).join(' vs. ')}
                      </li>
                    ))}
                </ul>
              )}
              <a
                href={`/api/analises-consolidadas/${analise.id}/relatorio`}
                className="text-blue-600 hover:underline"
              >
                Baixar relatório consolidado
              </a>
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/clientes/[id]/[competencia]/page.tsx"
git commit -m "feat: seleção de documentos e análise consolidada em /clientes/[id]/[competencia]

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verificação final do plano

- [ ] `npm test` — passa (incluindo `calcularMetricas.test.ts`, `consolidar.test.ts`, `analisar.test.ts`, `storage.test.ts`)
- [ ] `npm run build` — build limpo
- [ ] Manual: subir 2 documentos de teste no mesmo cliente/competência com uma métrica de mesmo nome e valores diferentes (ex: "Storage" com valores distintos), selecionar os dois, clicar "Gerar análise consolidada", confirmar que a divergência aparece na UI e no PDF baixado
- [ ] Manual: gerar de novo com a mesma seleção → mesma `AnaliseConsolidada` é atualizada (upsert), não duplica; gerar com uma seleção diferente → cria um novo registro
