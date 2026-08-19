# Análise de Evolução Mês a Mês (Plano 4/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comparar automaticamente a competência atual de um cliente com a competência anterior mais recente que tem documentos concluídos — soma de métricas e delta sempre em código, IA só interpreta.

**Architecture:** Nova entidade `AnaliseEvolucao` (1 por cliente/competência atual, upsert). `lib/analiseEvolucao/calcularEvolucao.ts` é função pura: agrega `valorNumerico` por label dentro de cada competência e calcula delta/status entre as duas agregações — testada isoladamente, sem IO. `lib/ia/evoluir.ts` segue o mesmo padrão de `lib/ia/consolidar.ts` (Plano 3): recebe a tabela já calculada, nunca recalcula. PDF e rota seguem o padrão do módulo 7 / Plano 3.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL, Zod, `ai` (Vercel AI SDK), `@react-pdf/renderer`, Jest.

## Global Constraints

- Depende dos Planos 1-3 (`Cliente`, competência, `metricasChave` estruturado, `lib/ia/modelo.ts`, `lib/competencia.ts`) já mergeados.
- **Nenhuma variação é calculada pela IA** — sempre em código puro, testado.
- Sem testes automatizados pra rotas/páginas (mesma linha dos módulos 3-8); funções puras (`calcularEvolucao`, `lib/ia/evoluir.ts`) ganham teste.
- Convenção de commit: `git commit -m "tipo: descrição"` em português, terminando com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Schema — `AnaliseEvolucao`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `AnaliseEvolucao`; `Cliente.analisesEvolucao: AnaliseEvolucao[]`

- [ ] **Step 1: Editar o schema**

Adicionar em `Cliente` (depois de `analisesConsolidadas`):

```prisma
  analisesEvolucao AnaliseEvolucao[]
```

Adicionar ao final do arquivo:

```prisma
model AnaliseEvolucao {
  id                     String    @id @default(cuid())
  clienteId              String
  cliente                Cliente   @relation(fields: [clienteId], references: [id])
  competenciaAtualAno    Int
  competenciaAtualMes    Int
  competenciaAnteriorAno Int
  competenciaAnteriorMes Int
  metricasComparadas     Json
  resumo                 String    @db.Text
  pontosAtencao          Json
  melhorias              Json
  promptVersion          String
  caminhoRelatorioPdf    String?
  relatorioGeradoEm      DateTime?
  createdAt              DateTime  @default(now())

  @@unique([clienteId, competenciaAtualAno, competenciaAtualMes])
}
```

- [ ] **Step 2: Migration**

```bash
npx dotenv -e .env.development -- npx prisma migrate dev --name analise_evolucao
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: entidade AnaliseEvolucao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `buildRelatorioEvolucaoPath`

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/storage.test.ts`

**Interfaces:**
- Produces: `buildRelatorioEvolucaoPath(analiseEvolucaoId: string, data?: Date): string`

- [ ] **Step 1: Escrever o teste**

Em `src/lib/storage.test.ts`, adicionar:

```ts
describe('buildRelatorioEvolucaoPath', () => {
  it('monta o caminho relativo com ano/mes/evolucoes/id/relatorio.pdf', () => {
    const data = new Date('2026-08-18T12:00:00Z')
    expect(buildRelatorioEvolucaoPath('evo123', data)).toBe('2026/08/evolucoes/evo123/relatorio.pdf')
  })
})
```

E ajustar o import:

```ts
import {
  buildUploadPath,
  getUploadFullPath,
  getUploadPublicUrl,
  buildRelatorioConsolidadoPath,
  buildRelatorioEvolucaoPath,
} from './storage'
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- storage.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

Em `src/lib/storage.ts`:

```ts
export function buildRelatorioEvolucaoPath(analiseEvolucaoId: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/evolucoes/${analiseEvolucaoId}/relatorio.pdf`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: buildRelatorioEvolucaoPath

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `calcularEvolucao` (cálculo determinístico)

**Files:**
- Create: `src/lib/analiseEvolucao/calcularEvolucao.ts`
- Test: `src/lib/analiseEvolucao/calcularEvolucao.test.ts`

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

export interface MetricaEvoluida {
  label: string
  valorAtual: number | null
  valorAnterior: number | null
  deltaAbsoluto: number | null
  deltaPercentual: number | null
  status: 'novo' | 'removido' | 'estavel' | 'alta' | 'baixa'
}

export function calcularEvolucao(
  metricasAtual: MetricaDocumento[],
  metricasAnterior: MetricaDocumento[]
): MetricaEvoluida[]
```
Usado pela rota de geração (Task 5). Reaproveita o formato `MetricaDocumento` do Plano 3 (mesmo shape, mas é sua própria cópia local — sem acoplar os dois módulos).

- [ ] **Step 1: Escrever o teste**

```ts
/**
 * @jest-environment node
 */
import { calcularEvolucao } from './calcularEvolucao'

function metrica(label: string, valorNumerico: number | null, documentoId = 'd1') {
  return { documentoId, nomeArquivo: `${documentoId}.pdf`, label, valorNumerico, unidade: null, valorExibicao: String(valorNumerico) }
}

describe('calcularEvolucao', () => {
  it('marca "alta" quando a variação passa de +5%', () => {
    const resultado = calcularEvolucao([metrica('Storage', 11200)], [metrica('Storage', 10000)])
    expect(resultado).toEqual([
      {
        label: 'Storage',
        valorAtual: 11200,
        valorAnterior: 10000,
        deltaAbsoluto: 1200,
        deltaPercentual: 0.12,
        status: 'alta',
      },
    ])
  })

  it('marca "baixa" quando a variação passa de -5%', () => {
    const resultado = calcularEvolucao([metrica('Storage', 8000)], [metrica('Storage', 10000)])
    expect(resultado[0].status).toBe('baixa')
    expect(resultado[0].deltaPercentual).toBeCloseTo(-0.2)
  })

  it('marca "estavel" dentro de +/-5%', () => {
    const resultado = calcularEvolucao([metrica('Storage', 10300)], [metrica('Storage', 10000)])
    expect(resultado[0].status).toBe('estavel')
  })

  it('marca "novo" quando o label só existe na competência atual', () => {
    const resultado = calcularEvolucao([metrica('Backup', 500)], [])
    expect(resultado).toEqual([
      { label: 'Backup', valorAtual: 500, valorAnterior: null, deltaAbsoluto: null, deltaPercentual: null, status: 'novo' },
    ])
  })

  it('marca "removido" quando o label só existe na competência anterior', () => {
    const resultado = calcularEvolucao([], [metrica('Backup', 500)])
    expect(resultado).toEqual([
      { label: 'Backup', valorAtual: null, valorAnterior: 500, deltaAbsoluto: null, deltaPercentual: null, status: 'removido' },
    ])
  })

  it('soma múltiplos documentos com o mesmo label (case-insensitive) dentro da mesma competência', () => {
    const resultado = calcularEvolucao(
      [metrica('storage', 100, 'd1'), metrica('Storage', 50, 'd2')],
      [metrica('Storage', 90, 'd3')]
    )
    expect(resultado[0].valorAtual).toBe(150)
    expect(resultado[0].valorAnterior).toBe(90)
  })

  it('deltaPercentual é null quando o valor anterior é zero, mas o status ainda reflete o delta absoluto', () => {
    const resultado = calcularEvolucao([metrica('Créditos', 50)], [metrica('Créditos', 0)])
    expect(resultado[0].deltaPercentual).toBeNull()
    expect(resultado[0].deltaAbsoluto).toBe(50)
    expect(resultado[0].status).toBe('alta')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- calcularEvolucao.test.ts`
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

export interface MetricaEvoluida {
  label: string
  valorAtual: number | null
  valorAnterior: number | null
  deltaAbsoluto: number | null
  deltaPercentual: number | null
  status: 'novo' | 'removido' | 'estavel' | 'alta' | 'baixa'
}

const LIMIAR_VARIACAO_SIGNIFICATIVA = 0.05 // 5%

function somarPorLabel(metricas: MetricaDocumento[]): Map<string, { total: number | null; labelOriginal: string }> {
  const somas = new Map<string, { total: number | null; labelOriginal: string }>()
  for (const m of metricas) {
    const chave = m.label.trim().toLowerCase()
    const atual = somas.get(chave)
    if (m.valorNumerico === null) {
      if (!atual) somas.set(chave, { total: null, labelOriginal: m.label })
      continue
    }
    somas.set(chave, {
      total: atual?.total == null ? m.valorNumerico : atual.total + m.valorNumerico,
      labelOriginal: atual?.labelOriginal ?? m.label,
    })
  }
  return somas
}

export function calcularEvolucao(
  metricasAtual: MetricaDocumento[],
  metricasAnterior: MetricaDocumento[]
): MetricaEvoluida[] {
  const somasAtual = somarPorLabel(metricasAtual)
  const somasAnterior = somarPorLabel(metricasAnterior)
  const chaves = new Set([...somasAtual.keys(), ...somasAnterior.keys()])

  return [...chaves].map((chave) => {
    const grupoAtual = somasAtual.get(chave)
    const grupoAnterior = somasAnterior.get(chave)
    const label = grupoAtual?.labelOriginal ?? grupoAnterior?.labelOriginal ?? chave

    if (!grupoAtual) {
      return { label, valorAtual: null, valorAnterior: grupoAnterior!.total, deltaAbsoluto: null, deltaPercentual: null, status: 'removido' as const }
    }
    if (!grupoAnterior) {
      return { label, valorAtual: grupoAtual.total, valorAnterior: null, deltaAbsoluto: null, deltaPercentual: null, status: 'novo' as const }
    }
    if (grupoAtual.total === null || grupoAnterior.total === null) {
      return { label, valorAtual: grupoAtual.total, valorAnterior: grupoAnterior.total, deltaAbsoluto: null, deltaPercentual: null, status: 'estavel' as const }
    }

    const deltaAbsoluto = grupoAtual.total - grupoAnterior.total
    const deltaPercentual = grupoAnterior.total !== 0 ? deltaAbsoluto / Math.abs(grupoAnterior.total) : null

    let status: MetricaEvoluida['status'] = 'estavel'
    if (deltaPercentual !== null) {
      if (deltaPercentual > LIMIAR_VARIACAO_SIGNIFICATIVA) status = 'alta'
      else if (deltaPercentual < -LIMIAR_VARIACAO_SIGNIFICATIVA) status = 'baixa'
    } else if (deltaAbsoluto !== 0) {
      status = deltaAbsoluto > 0 ? 'alta' : 'baixa'
    }

    return { label, valorAtual: grupoAtual.total, valorAnterior: grupoAnterior.total, deltaAbsoluto, deltaPercentual, status }
  })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- calcularEvolucao.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/analiseEvolucao/calcularEvolucao.ts src/lib/analiseEvolucao/calcularEvolucao.test.ts
git commit -m "feat: calcularEvolucao — delta mês a mês, em código

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `lib/ia/evoluir.ts`

**Files:**
- Create: `src/lib/ia/evoluir.ts`
- Test: `src/lib/ia/evoluir.test.ts`

**Interfaces:**
- Consumes: `getModel()` (Plano 3), `MetricaEvoluida` (Task 3)
- Produces: `analisarEvolucao(metricas: MetricaEvoluida[], competenciaAtual: string, competenciaAnterior: string, promptVersion: string): Promise<{ resumo, pontosAtencao, melhorias, promptVersion }>`

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
import { analisarEvolucao } from './evoluir'

describe('analisarEvolucao', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AI_PROVIDER = 'anthropic'
    process.env.AI_API_KEY = 'chave-fake'
    process.env.AI_MODEL = 'modelo-fake'
  })

  it('chama generateObject com o prompt contendo as métricas já calculadas', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({
      object: {
        resumo: 'resumo da evolução',
        pontosAtencao: [{ texto: 'Storage subiu 31,8%' }],
        melhorias: [],
      },
    })

    const metricas = [
      { label: 'Storage', valorAtual: 11200, valorAnterior: 8500, deltaAbsoluto: 2700, deltaPercentual: 0.318, status: 'alta' as const },
    ]

    const resultado = await analisarEvolucao(metricas, '2026-08', '2026-07', 'v1')

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-mock',
        prompt: expect.stringContaining('31.8%'),
      })
    )
    expect(resultado).toEqual({
      resumo: 'resumo da evolução',
      pontosAtencao: [{ texto: 'Storage subiu 31,8%' }],
      melhorias: [],
      promptVersion: 'v1',
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- evoluir.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```ts
import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './modelo'
import type { MetricaEvoluida } from '@/lib/analiseEvolucao/calcularEvolucao'

const schema = z.object({
  resumo: z.string(),
  pontosAtencao: z.array(z.object({ texto: z.string() })),
  melhorias: z.array(z.object({ texto: z.string() })),
})

function montarPrompt(
  metricas: MetricaEvoluida[],
  competenciaAtual: string,
  competenciaAnterior: string
): string {
  const linhas = metricas
    .map((m) => {
      const delta =
        m.deltaPercentual !== null
          ? `${(m.deltaPercentual * 100).toFixed(1)}%`
          : m.deltaAbsoluto !== null
            ? `${m.deltaAbsoluto} (absoluto)`
            : '—'
      return `- ${m.label}: ${competenciaAnterior}=${m.valorAnterior ?? '—'} → ${competenciaAtual}=${m.valorAtual ?? '—'} (variação: ${delta}, status: ${m.status})`
    })
    .join('\n')

  return [
    'Você é um analista sênior de faturamento comparando duas competências (meses)',
    `consecutivas do mesmo cliente: ${competenciaAnterior} (anterior) vs. ${competenciaAtual} (atual).`,
    '',
    'IMPORTANTE: os valores e variações abaixo já foram somados e calculados em',
    'código a partir dos documentos reais de cada mês — você NUNCA deve recalcular,',
    'estimar ou arredondar de forma diferente do que está escrito. Sua tarefa é só',
    'interpretar esses números prontos.',
    '',
    'Métricas comparadas (rótulo: valor anterior → valor atual, variação, status',
    '"novo"/"removido"/"estavel"/"alta"/"baixa"):',
    linhas || '(nenhuma métrica em comum entre as duas competências)',
    '',
    'Produza:',
    '1. RESUMO: um parágrafo sobre a evolução geral do cliente entre os dois meses.',
    '2. PONTOS DE ATENÇÃO: as altas (status "alta") ou métricas novas relevantes —',
    '   cite o número real da variação.',
    '3. MELHORIAS: as baixas (status "baixa") ou reduções relevantes.',
  ].join('\n')
}

export async function analisarEvolucao(
  metricas: MetricaEvoluida[],
  competenciaAtual: string,
  competenciaAnterior: string,
  promptVersion: string
) {
  const { object } = await generateObject({
    model: getModel(),
    schema,
    prompt: montarPrompt(metricas, competenciaAtual, competenciaAnterior),
  })
  return { ...object, promptVersion }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- evoluir.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ia/evoluir.ts src/lib/ia/evoluir.test.ts
git commit -m "feat: lib/ia/evoluir — IA interpreta variação já calculada, nunca recalcula

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Rota `GET`/`POST /api/clientes/[clienteId]/competencias/[competencia]/analise-evolucao`

**Files:**
- Create: `src/app/api/clientes/[clienteId]/competencias/[competencia]/analise-evolucao/route.ts`

**Interfaces:**
- Consumes: `parseCompetencia`/`formatarCompetencia` (Plano 2), `podeVerCliente` (Plano 1), `calcularEvolucao` (Task 3), `analisarEvolucao` (Task 4), `PROMPT_VERSION_ATUAL`
- Produces: `GET` → `AnaliseEvolucao | null`; `POST` (sem body) → `AnaliseEvolucao` (`201`) ou `400` se não houver competência anterior com dado

- [ ] **Step 1: Implementar a rota**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { parseCompetencia, formatarCompetencia } from '@/lib/competencia'
import { calcularEvolucao, type MetricaDocumento } from '@/lib/analiseEvolucao/calcularEvolucao'
import { analisarEvolucao } from '@/lib/ia/evoluir'
import { PROMPT_VERSION_ATUAL } from '@/lib/ia/analisar'

async function metricasDaCompetencia(clienteId: string, ano: number, mes: number): Promise<MetricaDocumento[]> {
  const documentos = await prisma.documento.findMany({
    where: { clienteId, competenciaAno: ano, competenciaMes: mes, status: 'concluido' },
    include: { analise: true },
  })
  return documentos.flatMap((doc) => {
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
}

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

  const analise = await prisma.analiseEvolucao.findUnique({
    where: {
      clienteId_competenciaAtualAno_competenciaAtualMes: {
        clienteId,
        competenciaAtualAno: parsed.ano,
        competenciaAtualMes: parsed.mes,
      },
    },
  })

  return NextResponse.json(analise)
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

  const competenciaAnterior = await prisma.documento.findFirst({
    where: {
      clienteId,
      status: 'concluido',
      OR: [
        { competenciaAno: { lt: parsed.ano } },
        { competenciaAno: parsed.ano, competenciaMes: { lt: parsed.mes } },
      ],
    },
    orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
    select: { competenciaAno: true, competenciaMes: true },
  })

  if (!competenciaAnterior) {
    return NextResponse.json(
      { error: 'nenhuma competência anterior com documentos concluídos encontrada para esse cliente' },
      { status: 400 }
    )
  }

  const [metricasAtual, metricasAnterior] = await Promise.all([
    metricasDaCompetencia(clienteId, parsed.ano, parsed.mes),
    metricasDaCompetencia(clienteId, competenciaAnterior.competenciaAno, competenciaAnterior.competenciaMes),
  ])

  const metricasComparadas = calcularEvolucao(metricasAtual, metricasAnterior)

  const analiseGerada = await analisarEvolucao(
    metricasComparadas,
    formatarCompetencia(parsed.ano, parsed.mes),
    formatarCompetencia(competenciaAnterior.competenciaAno, competenciaAnterior.competenciaMes),
    PROMPT_VERSION_ATUAL
  )

  const analiseEvolucao = await prisma.analiseEvolucao.upsert({
    where: {
      clienteId_competenciaAtualAno_competenciaAtualMes: {
        clienteId,
        competenciaAtualAno: parsed.ano,
        competenciaAtualMes: parsed.mes,
      },
    },
    create: {
      clienteId,
      competenciaAtualAno: parsed.ano,
      competenciaAtualMes: parsed.mes,
      competenciaAnteriorAno: competenciaAnterior.competenciaAno,
      competenciaAnteriorMes: competenciaAnterior.competenciaMes,
      metricasComparadas,
      resumo: analiseGerada.resumo,
      pontosAtencao: analiseGerada.pontosAtencao,
      melhorias: analiseGerada.melhorias,
      promptVersion: analiseGerada.promptVersion,
    },
    update: {
      competenciaAnteriorAno: competenciaAnterior.competenciaAno,
      competenciaAnteriorMes: competenciaAnterior.competenciaMes,
      metricasComparadas,
      resumo: analiseGerada.resumo,
      pontosAtencao: analiseGerada.pontosAtencao,
      melhorias: analiseGerada.melhorias,
      promptVersion: analiseGerada.promptVersion,
      caminhoRelatorioPdf: null,
      relatorioGeradoEm: null,
    },
  })

  return NextResponse.json(analiseEvolucao, { status: 201 })
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/clientes/[clienteId]/competencias/[competencia]/analise-evolucao"
git commit -m "feat: rota de geração/consulta de análise de evolução

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: PDF da análise de evolução

**Files:**
- Create: `src/lib/pdf/EvolucaoDocument.tsx`
- Create: `src/lib/pdf/gerarRelatorioEvolucao.ts`
- Create: `src/app/api/analises-evolucao/[id]/relatorio/route.ts`

**Interfaces:**
- Consumes: `buildRelatorioEvolucaoPath` (Task 2), `podeVerCliente` (Plano 1)
- Produces: `GET /api/analises-evolucao/[id]/relatorio` → PDF

- [ ] **Step 1: `EvolucaoDocument.tsx`**

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AnaliseEvolucao, Cliente } from '@prisma/client'

const AZUL_MARINHO = '#002A4A'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#1a1a1a' },
  capa: { marginBottom: 24, borderBottom: `2px solid ${AZUL_MARINHO}`, paddingBottom: 16 },
  tituloApp: { fontSize: 20, color: AZUL_MARINHO, fontWeight: 700, marginBottom: 4 },
  nomeCliente: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  meta: { fontSize: 10, color: '#555' },
  secao: { marginBottom: 16 },
  tituloSecao: { fontSize: 13, color: AZUL_MARINHO, fontWeight: 700, marginBottom: 6 },
  tabelaCabecalho: { flexDirection: 'row', borderBottom: '2px solid #333', paddingVertical: 4, fontWeight: 700 },
  tabelaLinha: { flexDirection: 'row', borderBottom: '1px solid #ddd', paddingVertical: 4 },
  colLabel: { width: '34%' },
  colValor: { width: '18%' },
  colVariacao: { width: '16%' },
  colStatus: { width: '14%' },
  bullet: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  bulletMarcaAtencao: { color: '#c0392b', marginRight: 6, fontWeight: 700 },
  bulletMarcaMelhoria: { color: '#27ae60', marginRight: 6, fontWeight: 700 },
  rodape: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
})

const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo',
  removido: 'Removido',
  estavel: 'Estável',
  alta: 'Alta',
  baixa: 'Baixa',
}

interface Props {
  cliente: Pick<Cliente, 'nome'>
  analise: AnaliseEvolucao
}

export function EvolucaoDocument({ cliente, analise }: Props) {
  const pontosAtencao = analise.pontosAtencao as Array<{ texto: string }>
  const melhorias = analise.melhorias as Array<{ texto: string }>
  const metricas = analise.metricasComparadas as Array<{
    label: string
    valorAtual: number | null
    valorAnterior: number | null
    deltaPercentual: number | null
    status: string
  }>

  const competenciaAtual = `${String(analise.competenciaAtualMes).padStart(2, '0')}/${analise.competenciaAtualAno}`
  const competenciaAnterior = `${String(analise.competenciaAnteriorMes).padStart(2, '0')}/${analise.competenciaAnteriorAno}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.capa}>
          <Text style={styles.tituloApp}>VerAI — Evolução mês a mês</Text>
          <Text style={styles.nomeCliente}>{cliente.nome}</Text>
          <Text style={styles.meta}>
            {competenciaAnterior} → {competenciaAtual}
          </Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Resumo</Text>
          <Text>{analise.resumo}</Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Métricas comparadas</Text>
          <View style={styles.tabelaCabecalho}>
            <Text style={styles.colLabel}>Métrica</Text>
            <Text style={styles.colValor}>{competenciaAnterior}</Text>
            <Text style={styles.colValor}>{competenciaAtual}</Text>
            <Text style={styles.colVariacao}>Variação</Text>
            <Text style={styles.colStatus}>Status</Text>
          </View>
          {metricas.map((m, i) => (
            <View key={i} style={styles.tabelaLinha}>
              <Text style={styles.colLabel}>{m.label}</Text>
              <Text style={styles.colValor}>{m.valorAnterior ?? '—'}</Text>
              <Text style={styles.colValor}>{m.valorAtual ?? '—'}</Text>
              <Text style={styles.colVariacao}>
                {m.deltaPercentual != null ? `${(m.deltaPercentual * 100).toFixed(1)}%` : '—'}
              </Text>
              <Text style={styles.colStatus}>{STATUS_LABEL[m.status] ?? m.status}</Text>
            </View>
          ))}
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Pontos de atenção</Text>
          {pontosAtencao.map((p, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletMarcaAtencao}>▲</Text>
              <Text>{p.texto}</Text>
            </View>
          ))}
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Melhorias</Text>
          {melhorias.map((p, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletMarcaMelhoria}>▼</Text>
              <Text>{p.texto}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.rodape}>Gerado automaticamente pelo VerAI</Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: `gerarRelatorioEvolucao.ts`**

```ts
import { renderToBuffer } from '@react-pdf/renderer'
import type { AnaliseEvolucao, Cliente } from '@prisma/client'
import { EvolucaoDocument } from './EvolucaoDocument'

export async function gerarRelatorioEvolucaoPdf(
  cliente: Pick<Cliente, 'nome'>,
  analise: AnaliseEvolucao
): Promise<Buffer> {
  return renderToBuffer(EvolucaoDocument({ cliente, analise }))
}
```

- [ ] **Step 3: rota de download**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import type { AnaliseEvolucao } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { buildRelatorioEvolucaoPath, getUploadFullPath } from '@/lib/storage'
import { gerarRelatorioEvolucaoPdf } from '@/lib/pdf/gerarRelatorioEvolucao'

async function obterBuffer(cliente: { nome: string }, analise: AnaliseEvolucao): Promise<Buffer> {
  if (analise.caminhoRelatorioPdf) {
    try {
      return await readFile(getUploadFullPath(analise.caminhoRelatorioPdf))
    } catch {
      // cache inválido — regenera abaixo
    }
  }

  const buffer = await gerarRelatorioEvolucaoPdf(cliente, analise)
  const caminhoRelativo = buildRelatorioEvolucaoPath(analise.id)
  const caminhoCompleto = getUploadFullPath(caminhoRelativo)
  await mkdir(dirname(caminhoCompleto), { recursive: true })
  await writeFile(caminhoCompleto, buffer)
  await prisma.analiseEvolucao.update({
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
  const analise = await prisma.analiseEvolucao.findUnique({
    where: { id },
    include: { cliente: { select: { nome: true } } },
  })
  if (!analise) {
    return NextResponse.json({ error: 'análise de evolução não encontrada' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, analise.clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const buffer = await obterBuffer(analise.cliente, analise)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="evolucao-${analise.cliente.nome}-${analise.competenciaAtualAno}-${analise.competenciaAtualMes}.pdf"`,
    },
  })
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/EvolucaoDocument.tsx src/lib/pdf/gerarRelatorioEvolucao.ts "src/app/api/analises-evolucao/[id]/relatorio"
git commit -m "feat: PDF da análise de evolução

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: UI — "Comparar com mês anterior" em `/clientes/[id]/[competencia]`

**Files:**
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/clientes/[clienteId]/competencias/[competencia]/analise-evolucao` (Task 5), `GET /api/analises-evolucao/[id]/relatorio` (Task 6)

- [ ] **Step 1: Adicionar as interfaces novas**

Depois da declaração de `interface AnaliseConsolidada { ... }` (a que o Plano 3 deixou no arquivo), adicionar:

```ts
interface MetricaEvoluida {
  label: string
  valorAtual: number | null
  valorAnterior: number | null
  deltaAbsoluto: number | null
  deltaPercentual: number | null
  status: 'novo' | 'removido' | 'estavel' | 'alta' | 'baixa'
}

interface AnaliseEvolucao {
  id: string
  competenciaAnteriorAno: number
  competenciaAnteriorMes: number
  metricasComparadas: MetricaEvoluida[]
  resumo: string
  pontosAtencao: Array<{ texto: string }>
  melhorias: Array<{ texto: string }>
  createdAt: string
}

const STATUS_EVOLUCAO_LABEL: Record<MetricaEvoluida['status'], string> = {
  novo: 'Novo',
  removido: 'Removido',
  estavel: 'Estável',
  alta: 'Alta',
  baixa: 'Baixa',
}
```

- [ ] **Step 2: Adicionar o state novo**

Depois da linha `const [erroConsolidada, setErroConsolidada] = useState<string | null>(null)`, adicionar:

```ts
  const [analiseEvolucao, setAnaliseEvolucao] = useState<AnaliseEvolucao | null>(null)
  const [gerandoEvolucao, setGerandoEvolucao] = useState(false)
  const [erroEvolucao, setErroEvolucao] = useState<string | null>(null)
```

- [ ] **Step 3: Buscar a evolução em `carregar()`**

Trocar:

```ts
    const [clienteResponse, documentosResponse, consolidadasResponse] = await Promise.all([
      fetch(`/api/clientes/${id}`),
      fetch(`/api/documentos?clienteId=${id}&competenciaAno=${parsed.ano}&competenciaMes=${parsed.mes}`),
      fetch(`/api/clientes/${id}/competencias/${competencia}/analise-consolidada`),
    ])
    if (clienteResponse.ok) setCliente(await clienteResponse.json())
    if (documentosResponse.ok) setDocumentos(await documentosResponse.json())
    if (consolidadasResponse.ok) setAnalisesConsolidadas(await consolidadasResponse.json())
    setCarregando(false)
```

por:

```ts
    const [clienteResponse, documentosResponse, consolidadasResponse, evolucaoResponse] = await Promise.all([
      fetch(`/api/clientes/${id}`),
      fetch(`/api/documentos?clienteId=${id}&competenciaAno=${parsed.ano}&competenciaMes=${parsed.mes}`),
      fetch(`/api/clientes/${id}/competencias/${competencia}/analise-consolidada`),
      fetch(`/api/clientes/${id}/competencias/${competencia}/analise-evolucao`),
    ])
    if (clienteResponse.ok) setCliente(await clienteResponse.json())
    if (documentosResponse.ok) setDocumentos(await documentosResponse.json())
    if (consolidadasResponse.ok) setAnalisesConsolidadas(await consolidadasResponse.json())
    if (evolucaoResponse.ok) setAnaliseEvolucao(await evolucaoResponse.json())
    setCarregando(false)
```

- [ ] **Step 4: Adicionar o handler**

Depois da função `handleGerarConsolidada`, adicionar:

```ts
  async function handleGerarEvolucao() {
    setErroEvolucao(null)
    setGerandoEvolucao(true)
    const response = await fetch(`/api/clientes/${id}/competencias/${competencia}/analise-evolucao`, {
      method: 'POST',
    })
    setGerandoEvolucao(false)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErroEvolucao(body?.error ?? 'Falha ao gerar a comparação com o mês anterior.')
      return
    }
    carregar()
  }
```

- [ ] **Step 5: Adicionar a seção na JSX**

Logo antes do `</main>` final (depois do bloco `{analisesConsolidadas.length > 0 && ( ... )}`), adicionar:

```tsx
      <section className="space-y-3">
        <h2 className="font-medium">Evolução vs. mês anterior</h2>
        {!analiseEvolucao ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleGerarEvolucao}
              disabled={gerandoEvolucao}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {gerandoEvolucao ? 'Comparando...' : 'Comparar com mês anterior'}
            </button>
            {erroEvolucao && <span className="text-sm text-red-600">{erroEvolucao}</span>}
          </div>
        ) : (
          <div className="space-y-2 rounded border p-4 text-sm">
            <p className="text-xs text-muted-foreground">
              Comparado com {String(analiseEvolucao.competenciaAnteriorMes).padStart(2, '0')}/
              {analiseEvolucao.competenciaAnteriorAno} — gerado em{' '}
              {new Date(analiseEvolucao.createdAt).toLocaleString('pt-BR')}
            </p>
            <p>{analiseEvolucao.resumo}</p>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="py-1">Métrica</th>
                  <th>Anterior</th>
                  <th>Atual</th>
                  <th>Variação</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {analiseEvolucao.metricasComparadas.map((m) => (
                  <tr key={m.label} className="border-b">
                    <td className="py-1">{m.label}</td>
                    <td>{m.valorAnterior ?? '—'}</td>
                    <td>{m.valorAtual ?? '—'}</td>
                    <td>{m.deltaPercentual != null ? `${(m.deltaPercentual * 100).toFixed(1)}%` : '—'}</td>
                    <td>{STATUS_EVOLUCAO_LABEL[m.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {analiseEvolucao.pontosAtencao.length > 0 && (
              <div>
                <p className="font-medium">Pontos de atenção</p>
                <ul className="list-disc space-y-1 pl-5 text-red-700">
                  {analiseEvolucao.pontosAtencao.map((p, i) => (
                    <li key={i}>{p.texto}</li>
                  ))}
                </ul>
              </div>
            )}

            {analiseEvolucao.melhorias.length > 0 && (
              <div>
                <p className="font-medium">Melhorias</p>
                <ul className="list-disc space-y-1 pl-5 text-green-700">
                  {analiseEvolucao.melhorias.map((p, i) => (
                    <li key={i}>{p.texto}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3">
              <a
                href={`/api/analises-evolucao/${analiseEvolucao.id}/relatorio`}
                className="text-blue-600 hover:underline"
              >
                Baixar relatório de evolução
              </a>
              <button
                onClick={handleGerarEvolucao}
                disabled={gerandoEvolucao}
                className="text-blue-600 hover:underline disabled:opacity-50"
              >
                {gerandoEvolucao ? 'Atualizando...' : 'Atualizar comparação'}
              </button>
              {erroEvolucao && <span className="text-sm text-red-600">{erroEvolucao}</span>}
            </div>
          </div>
        )}
      </section>
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add "src/app/clientes/[id]/[competencia]/page.tsx"
git commit -m "feat: comparação com mês anterior em /clientes/[id]/[competencia]

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verificação final do plano

- [ ] `npm test` — passa (incluindo `calcularEvolucao.test.ts`, `evoluir.test.ts`)
- [ ] `npm run build` — build limpo
- [ ] Manual: cliente com documentos concluídos em Jul/2026 e Ago/2026, com uma métrica de mesmo nome e valores diferentes entre os meses — abrir Ago/2026, clicar "Comparar com mês anterior", conferir que a variação % bate com a conta manual e aparece em "Pontos de atenção" ou "Melhorias" conforme o sinal
- [ ] Manual: cliente sem competência anterior com dado → botão retorna erro claro, sem gerar nada
- [ ] Manual: baixar o relatório de evolução em PDF e conferir a tabela de métricas
