# Reajuste por IPC-Fipe — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** área "Reajuste IPC-Fipe" no menu lateral: tabela do IPC-Fipe no banco (Banco Central, SGS 193), correção de planilha/PDF/DOCX por um período editável, resultado e original guardados no R2 com histórico.

**Architecture:** regra pura em `src/lib/reajuste/` (série do BCB, cálculo, leitura de valores, geração do XLSX) com testes; rotas finas em `src/app/api/reajuste/`; três telas client-side em `src/app/reajuste/`. Duas tabelas novas (`IndiceIpcFipe`, `ReajusteExecucao`), migração escrita à mão. Envio do arquivo reaproveita o PUT pré-assinado da "Nova conversão".

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6/Postgres, Tailwind 4, Jest + Testing Library, exceljs, decimal.js, unpdf/mammoth (via `extrairPaginas`), Cloudflare R2 (`src/lib/r2.ts`).

**Spec:** `docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md`.

## Global Constraints

- Mês sempre como texto `AAAA-MM` entre camadas; no banco, `DATE` do dia 1.
- Fonte: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.193/dados?formato=json`, com `User-Agent` (sem ele o BCB devolve HTML de bloqueio).
- Conta de dinheiro com `decimal.js`, nunca `number`. Fator exibido com 6 casas, acumulado com 2; valor corrigido = `original × fator` arredondado a 2 casas (`ROUND_HALF_UP`) só no fim.
- Mês já gravado com valor diferente **nunca** é sobrescrito — vira divergência.
- Período com mês sem índice não calcula.
- Valor digitado/lido passa por `normalizarDecimal` (`src/lib/relatorios-clientes/numero.ts`) — nada de parser novo.
- PDF/DOCX nunca é reescrito: resultado é XLSX de comparação.
- Arquivos no R2 (nunca Vercel Blob): original em `reajustes/<id>/original.<ext>`, resultado em `reajustes/<id>/resultado.xlsx`; o temporário `tmp-uploads/…` é apagado depois de copiado.
- Só tabelas novas (o agendador usa o cliente Prisma da pasta contra produção).
- Migração escrita à mão. **Nunca** `prisma migrate dev`/`migrate diff` com o banco de dev como shadow. Aplicar no dev: `npx dotenv -e .env.development -- npx prisma migrate deploy` e `npx prisma generate`.
- Não rodar `next build` com o dev server de pé (quebra o `.next` do dev).
- Commits sem `Co-Authored-By` de IA; na main, com índice próprio (`GIT_INDEX_FILE` + `commit-tree` + `update-ref`) porque outras sessões commitam ao mesmo tempo. Nos passos abaixo, "Commit" = esse procedimento com os arquivos listados.
- Textos de tela em pt-BR, no padrão das páginas existentes (`<h1>` `text-navy`, classes de `src/lib/ui.ts`).

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/reajuste/meses.ts` | `AAAA-MM`: somar meses, listar período, nome do mês, conversão Date ↔ texto |
| `src/lib/reajuste/serie-bcb.ts` | buscar e validar a série 193 do BCB |
| `src/lib/reajuste/indice.ts` | sincronizar a série com `IndiceIpcFipe` sem sobrescrever |
| `src/lib/reajuste/calculo.ts` | período sugerido, fator, acumulado, corrigir valor (puro, roda no navegador também) |
| `src/lib/reajuste/leitura.ts` | candidatos: colunas da planilha e valores em moeda no texto |
| `src/lib/reajuste/resultado.ts` | gerar o XLSX (planilha corrigida ou comparação) + aba "Reajuste IPC-Fipe" |
| `src/lib/reajuste/tipos.ts` | tipos compartilhados tela ↔ API |
| `src/app/api/reajuste/indice/route.ts` | GET lista do índice; POST "Atualizar agora" |
| `src/app/api/reajuste/indice/cron/route.ts` | cron diário |
| `src/app/api/reajuste/envio/route.ts` | reexporta o PUT pré-assinado da Nova conversão |
| `src/app/api/reajuste/leitura/route.ts` | lê o temporário e devolve candidatos |
| `src/app/api/reajuste/route.ts` | GET histórico; POST gerar |
| `src/app/api/reajuste/[id]/arquivo/[qual]/route.ts` | download original/resultado |
| `src/app/reajuste/page.tsx` (+ componentes) | tela Corrigir |
| `src/app/reajuste/indice/page.tsx` | Tabela do índice |
| `src/app/reajuste/historico/page.tsx` | Histórico |
| `src/components/nav-bar.tsx` | grupo "Reajuste IPC-Fipe" |

---

### Task 1: Meses e série do Banco Central

**Files:**
- Create: `src/lib/reajuste/meses.ts`, `src/lib/reajuste/meses.test.ts`
- Create: `src/lib/reajuste/serie-bcb.ts`, `src/lib/reajuste/serie-bcb.test.ts`
- Modify: `package.json` (dependência direta `decimal.js`)

**Interfaces:**
- Produces: `somarMeses(mes: string, n: number): string`, `mesesEntre(inicial: string, final: string): string[]` (inclusive; vazio se inicial > final), `nomeDoMes(mes: string): string` (`"ago/2026"`), `mesParaData(mes: string): Date` (UTC dia 1), `dataParaMes(d: Date): string`, `mesDeHoje(agora?: Date): string` (fuso America/Sao_Paulo).
- Produces: `SERIE_IPC_FIPE = 193`, `URL_SERIE_IPC_FIPE`, `interface MesDoIndice { mes: string; variacao: string }`, `class FonteIndiceIndisponivel extends Error`, `lerRespostaDaSerie(corpo: unknown): MesDoIndice[]`, `buscarSerieIpcFipe(fetcher?: typeof fetch): Promise<MesDoIndice[]>`.

- [ ] **Step 1: Dependência direta**

Run: `npm install decimal.js@^10.6.0` (já está em `node_modules` via Prisma; isto só a declara).

- [ ] **Step 2: Testes que falham — `meses.test.ts`**

```ts
import { dataParaMes, mesDeHoje, mesParaData, mesesEntre, nomeDoMes, somarMeses } from './meses'

describe('meses AAAA-MM', () => {
  it('soma e subtrai atravessando o ano', () => {
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
    expect(somarMeses('2025-09', 11)).toBe('2026-08')
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
  })
  it('lista o período inclusive e vazio quando invertido', () => {
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(mesesEntre('2026-02', '2026-02')).toEqual(['2026-02'])
    expect(mesesEntre('2026-03', '2026-02')).toEqual([])
  })
  it('nome curto em pt-BR', () => {
    expect(nomeDoMes('2026-08')).toBe('ago/2026')
    expect(nomeDoMes('2025-12')).toBe('dez/2025')
  })
  it('converte de e para Date UTC do dia 1', () => {
    expect(mesParaData('2026-08').toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(dataParaMes(new Date('2026-08-01T00:00:00Z'))).toBe('2026-08')
  })
  it('mês de hoje no fuso de São Paulo', () => {
    // 01/10 01:00 UTC ainda é 30/09 em São Paulo
    expect(mesDeHoje(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09')
    expect(mesDeHoje(new Date('2026-10-01T12:00:00Z'))).toBe('2026-10')
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/lib/reajuste/meses.test.ts`
Expected: FAIL — `Cannot find module './meses'`.

- [ ] **Step 4: Implementar `meses.ts`**

```ts
// Mês de referência do IPC-Fipe como texto `AAAA-MM` — o formato que viaja entre banco, API e tela
// (spec docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md).

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function partes(mes: string): [number, number] {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  if (!m) throw new Error(`mês inválido: ${mes}`)
  return [Number(m[1]), Number(m[2])]
}

const formatar = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`

export function somarMeses(mes: string, n: number): string {
  const [ano, m] = partes(mes)
  const total = ano * 12 + (m - 1) + n
  return formatar(Math.floor(total / 12), (total % 12) + 1)
}

export function mesesEntre(inicial: string, final: string): string[] {
  const lista: string[] = []
  for (let atual = inicial; atual <= final; atual = somarMeses(atual, 1)) lista.push(atual)
  return lista
}

export function nomeDoMes(mes: string): string {
  const [ano, m] = partes(mes)
  return `${NOMES[m - 1]}/${ano}`
}

export const mesParaData = (mes: string) => {
  const [ano, m] = partes(mes)
  return new Date(Date.UTC(ano, m - 1, 1))
}

export const dataParaMes = (d: Date) => formatar(d.getUTCFullYear(), d.getUTCMonth() + 1)

export function mesDeHoje(agora: Date = new Date()): string {
  const [ano, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })
    .format(agora)
    .split('-')
  return `${ano}-${mes}`
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest src/lib/reajuste/meses.test.ts` → PASS.

- [ ] **Step 6: Testes que falham — `serie-bcb.test.ts`**

```ts
/** @jest-environment node */
import { FonteIndiceIndisponivel, URL_SERIE_IPC_FIPE, buscarSerieIpcFipe, lerRespostaDaSerie } from './serie-bcb'

describe('lerRespostaDaSerie', () => {
  it('converte data dd/mm/aaaa e mantém a variação como texto', () => {
    expect(
      lerRespostaDaSerie([
        { data: '01/07/2026', valor: '-0.03' },
        { data: '01/08/2026', valor: '0.01' },
      ])
    ).toEqual([
      { mes: '2026-07', variacao: '-0.03' },
      { mes: '2026-08', variacao: '0.01' },
    ])
  })
  it('recusa o que não é a série', () => {
    expect(() => lerRespostaDaSerie({ erro: 'x' })).toThrow(FonteIndiceIndisponivel)
    expect(() => lerRespostaDaSerie([])).toThrow(FonteIndiceIndisponivel)
    expect(() => lerRespostaDaSerie([{ data: '2026-08-01', valor: '0.1' }])).toThrow(FonteIndiceIndisponivel)
    expect(() => lerRespostaDaSerie([{ data: '01/08/2026', valor: 'abc' }])).toThrow(FonteIndiceIndisponivel)
  })
})

describe('buscarSerieIpcFipe', () => {
  const resposta = (corpo: string, tipo: string, status = 200) =>
    Promise.resolve(new Response(corpo, { status, headers: { 'content-type': tipo } }))

  it('chama a série 193 com User-Agent', async () => {
    const fetcher = jest.fn(() => resposta('[{"data":"01/08/2026","valor":"0.01"}]', 'application/json; charset=utf-8'))
    await expect(buscarSerieIpcFipe(fetcher as unknown as typeof fetch)).resolves.toEqual([{ mes: '2026-08', variacao: '0.01' }])
    expect(URL_SERIE_IPC_FIPE).toContain('bcdata.sgs.193')
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(URL_SERIE_IPC_FIPE)
    expect((init.headers as Record<string, string>)['User-Agent']).toBeTruthy()
  })
  it('HTML de bloqueio e erro HTTP viram FonteIndiceIndisponivel', async () => {
    await expect(buscarSerieIpcFipe((() => resposta('<html>', 'text/html')) as unknown as typeof fetch)).rejects.toThrow(
      FonteIndiceIndisponivel
    )
    await expect(buscarSerieIpcFipe((() => resposta('', 'text/plain', 502)) as unknown as typeof fetch)).rejects.toThrow(
      'Banco Central respondeu 502'
    )
  })
})
```

- [ ] **Step 7: Rodar e ver falhar** — `npx jest src/lib/reajuste/serie-bcb.test.ts` → FAIL (módulo não existe).

- [ ] **Step 8: Implementar `serie-bcb.ts`**

```ts
// Série 193 do SGS do Banco Central = IPC-Fipe, variação % mensal (confirmada em 30/09/2026 contra a
// Fipe, spec §1.1). Pública, sem chave; sem User-Agent o BCB devolve uma página HTML de bloqueio.

export const SERIE_IPC_FIPE = 193
export const URL_SERIE_IPC_FIPE = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SERIE_IPC_FIPE}/dados?formato=json`

export interface MesDoIndice {
  mes: string
  variacao: string
}

export class FonteIndiceIndisponivel extends Error {}

export function lerRespostaDaSerie(corpo: unknown): MesDoIndice[] {
  if (!Array.isArray(corpo) || corpo.length === 0) throw new FonteIndiceIndisponivel('resposta do Banco Central sem a série')
  return corpo.map((item) => {
    const data = typeof item?.data === 'string' ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(item.data) : null
    const valor = typeof item?.valor === 'string' ? item.valor.trim() : ''
    if (!data || !/^-?\d+(\.\d+)?$/.test(valor)) {
      throw new FonteIndiceIndisponivel(`linha fora do formato na série do Banco Central: ${JSON.stringify(item)}`)
    }
    return { mes: `${data[3]}-${data[2]}`, variacao: valor }
  })
}

export async function buscarSerieIpcFipe(fetcher: typeof fetch = fetch): Promise<MesDoIndice[]> {
  const resposta = await fetcher(URL_SERIE_IPC_FIPE, {
    headers: { 'User-Agent': 'VerAI/1.0 (PRODAM-SP)', Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!resposta.ok) throw new FonteIndiceIndisponivel(`Banco Central respondeu ${resposta.status}`)
  if (!(resposta.headers.get('content-type') ?? '').includes('json')) {
    throw new FonteIndiceIndisponivel('Banco Central devolveu uma página em vez da série (bloqueio ou manutenção)')
  }
  return lerRespostaDaSerie(await resposta.json())
}
```

- [ ] **Step 9: Rodar e ver passar** — `npx jest src/lib/reajuste` → PASS.

- [ ] **Step 10: Commit** — `package.json`, `package-lock.json`, `src/lib/reajuste/meses*.ts`, `src/lib/reajuste/serie-bcb*.ts`. Mensagem: `feat(reajuste): meses AAAA-MM e leitura da série IPC-Fipe do Banco Central`.

---

### Task 2: Cálculo do reajuste

**Files:**
- Create: `src/lib/reajuste/calculo.ts`, `src/lib/reajuste/calculo.test.ts`

**Interfaces:**
- Consumes: `mesesEntre`, `somarMeses` (Task 1).
- Produces:
  - `periodoSugerido(ultimoPublicado: string): { inicial: string; final: string }` — 12 meses terminando no último publicado.
  - `type Calculo = { ok: true; meses: Array<{ mes: string; variacao: string }>; fator: string; acumuladoPct: string } | { ok: false; faltando: string[] } | { ok: false; erro: string }` — `fator` com 6 casas, `acumuladoPct` com 2.
  - `calcularPeriodo(inicial: string, final: string, indice: Map<string, string>): Calculo` — `indice` é mês → variação.
  - `fatorCompleto(meses: Array<{ variacao: string }>): Decimal` — sem arredondar.
  - `corrigirValor(original: string, fator: Decimal): string` — 2 casas, `ROUND_HALF_UP`.

- [ ] **Step 1: Testes que falham**

```ts
import Decimal from 'decimal.js'
import { calcularPeriodo, corrigirValor, fatorCompleto, periodoSugerido } from './calculo'

// Valores reais publicados pela Fipe (conferidos em 30/09/2026)
const REAIS: Array<[string, string]> = [
  ['2025-08', '0.04'], ['2025-09', '0.65'], ['2025-10', '0.27'], ['2025-11', '0.20'], ['2025-12', '0.32'],
  ['2026-01', '0.21'], ['2026-02', '0.25'], ['2026-03', '0.59'], ['2026-04', '0.40'], ['2026-05', '0.45'],
  ['2026-06', '0.18'], ['2026-07', '-0.03'], ['2026-08', '0.01'],
]
const indice = new Map(REAIS)

describe('periodoSugerido', () => {
  it('12 meses terminando no último publicado, atravessando o ano', () => {
    expect(periodoSugerido('2026-08')).toEqual({ inicial: '2025-09', final: '2026-08' })
    expect(periodoSugerido('2026-01')).toEqual({ inicial: '2025-02', final: '2026-01' })
  })
})

describe('calcularPeriodo', () => {
  it('acumulado real set/2025–ago/2026 = 3,55 %', () => {
    const r = calcularPeriodo('2025-09', '2026-08', indice)
    expect(r).toMatchObject({ ok: true, fator: '1.035543', acumuladoPct: '3.55' })
    if (r.ok) expect(r.meses).toHaveLength(12)
  })
  it('um mês só, inclusive negativo', () => {
    expect(calcularPeriodo('2026-07', '2026-07', indice)).toMatchObject({ ok: true, fator: '0.999700', acumuladoPct: '-0.03' })
  })
  it('mês sem índice não calcula e diz qual falta', () => {
    expect(calcularPeriodo('2026-07', '2026-09', indice)).toEqual({ ok: false, faltando: ['2026-09'] })
  })
  it('período invertido é erro', () => {
    expect(calcularPeriodo('2026-08', '2026-07', indice)).toEqual({ ok: false, erro: 'o mês inicial é depois do final' })
  })
})

describe('corrigirValor', () => {
  it('usa o fator completo e arredonda só no fim, meio para cima', () => {
    const fator = fatorCompleto(REAIS.slice(1).map(([, variacao]) => ({ variacao })))
    expect(corrigirValor('10000', fator)).toBe('10355.43')
    expect(corrigirValor('0.5', new Decimal('1.01'))).toBe('0.51') // 0.505 → 0.51
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/reajuste/calculo.test.ts` → FAIL.

- [ ] **Step 3: Implementar `calculo.ts`**

```ts
// Fator do IPC-Fipe acumulado num período escolhido pelo usuário (spec §1.4). Puro: roda na tela
// (prévia na hora) e na rota (que recalcula e não confia no navegador).
import Decimal from 'decimal.js'
import { mesesEntre, somarMeses } from './meses'

export type Calculo =
  | { ok: true; meses: Array<{ mes: string; variacao: string }>; fator: string; acumuladoPct: string }
  | { ok: false; faltando: string[] }
  | { ok: false; erro: string }

export function periodoSugerido(ultimoPublicado: string) {
  return { inicial: somarMeses(ultimoPublicado, -11), final: ultimoPublicado }
}

export function fatorCompleto(meses: Array<{ variacao: string }>): Decimal {
  return meses.reduce((fator, m) => fator.times(new Decimal(m.variacao).dividedBy(100).plus(1)), new Decimal(1))
}

export function calcularPeriodo(inicial: string, final: string, indice: Map<string, string>): Calculo {
  if (inicial > final) return { ok: false, erro: 'o mês inicial é depois do final' }
  const lista = mesesEntre(inicial, final)
  const faltando = lista.filter((mes) => !indice.has(mes))
  if (faltando.length > 0) return { ok: false, faltando }
  const meses = lista.map((mes) => ({ mes, variacao: indice.get(mes)! }))
  const fator = fatorCompleto(meses)
  return {
    ok: true,
    meses,
    fator: fator.toFixed(6, Decimal.ROUND_HALF_UP),
    acumuladoPct: fator.minus(1).times(100).toFixed(2, Decimal.ROUND_HALF_UP),
  }
}

export function corrigirValor(original: string, fator: Decimal): string {
  return new Decimal(original).times(fator).toFixed(2, Decimal.ROUND_HALF_UP)
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/reajuste/calculo.test.ts` → PASS. (Se `fator` de jul/2026 sair `0.999700`, ok: `toFixed(6)` preserva zeros.)

- [ ] **Step 5: Commit** — `src/lib/reajuste/calculo*.ts`. Mensagem: `feat(reajuste): cálculo do IPC-Fipe acumulado por período`.

---

### Task 3: Tabela `IndiceIpcFipe`, sincronização e rotas do índice

**Files:**
- Modify: `prisma/schema.prisma` (model novo no fim)
- Create: `prisma/migrations/20260930100000_indice_ipc_fipe/migration.sql`
- Create: `src/lib/reajuste/indice.ts`, `src/lib/reajuste/indice.test.ts`
- Create: `src/app/api/reajuste/indice/route.ts`, `route.test.ts`
- Create: `src/app/api/reajuste/indice/cron/route.ts`, `route.test.ts`
- Modify: `src/middleware.ts:5` (cron público), `vercel.json` (segundo cron)

**Interfaces:**
- Consumes: `buscarSerieIpcFipe`, `MesDoIndice`, `FonteIndiceIndisponivel`, `URL_SERIE_IPC_FIPE`, `mesParaData`, `dataParaMes`.
- Produces:
  - `compararComGravados(fonte: MesDoIndice[], gravados: Map<string, string>): { novos: MesDoIndice[]; confirmados: string[]; divergentes: Divergencia[] }`
  - `interface Divergencia { mes: string; gravado: string; fonte: string }`
  - `sincronizarIpcFipe(deps?: { buscar?: () => Promise<MesDoIndice[]>; agora?: Date }): Promise<{ novos: number; confirmados: number; divergentes: Divergencia[] }>`
  - `lerIndiceGravado(): Promise<{ meses: Array<{ mes: string; variacao: string }>; atualizadoEm: string | null }>` (meses em ordem crescente)
  - `GET /api/reajuste/indice` → `{ meses, atualizadoEm }`; `POST /api/reajuste/indice` → resultado da sincronização (502 com `{ error }` se a fonte falhar).

- [ ] **Step 1: Model e migração**

No fim de `prisma/schema.prisma`:

```prisma
// IPC-Fipe mensal (Banco Central, SGS 193) — spec 2026-09-30-reajuste-ipc-fipe-design §1.2.
// Mês já gravado nunca é sobrescrito pela sincronização: valor diferente vira divergência.
model IndiceIpcFipe {
  mes       DateTime @id @db.Date
  variacao  Decimal  @db.Decimal(9, 4)
  fonte     String
  buscadoEm DateTime
}
```

`prisma/migrations/20260930100000_indice_ipc_fipe/migration.sql`:

```sql
-- IPC-Fipe mensal (spec 2026-09-30-reajuste-ipc-fipe-design §1.2). Só tabela nova.
CREATE TABLE "IndiceIpcFipe" (
    "mes" DATE NOT NULL,
    "variacao" DECIMAL(9,4) NOT NULL,
    "fonte" TEXT NOT NULL,
    "buscadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IndiceIpcFipe_pkey" PRIMARY KEY ("mes")
);
```

Run: `npx prisma validate`, depois `npx dotenv -e .env.development -- npx prisma migrate deploy` e `npx prisma generate`.
Expected: migração `20260930100000_indice_ipc_fipe` aplicada.

- [ ] **Step 2: Testes que falham — `indice.test.ts`**

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: { indiceIpcFipe: { findMany: jest.fn(), createMany: jest.fn(), updateMany: jest.fn(), aggregate: jest.fn() } },
}))
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { compararComGravados, lerIndiceGravado, sincronizarIpcFipe } from './indice'

const db = prisma.indiceIpcFipe as unknown as Record<string, jest.Mock>

describe('compararComGravados', () => {
  it('separa novos, confirmados (mesmo valor com outra escrita) e divergentes', () => {
    const r = compararComGravados(
      [
        { mes: '2026-06', variacao: '0.18' },
        { mes: '2026-07', variacao: '-0.03' },
        { mes: '2026-08', variacao: '0.01' },
      ],
      new Map([
        ['2026-06', '0.1800'],
        ['2026-07', '-0.0400'],
      ])
    )
    expect(r.novos).toEqual([{ mes: '2026-08', variacao: '0.01' }])
    expect(r.confirmados).toEqual(['2026-06'])
    expect(r.divergentes).toEqual([{ mes: '2026-07', gravado: '-0.04', fonte: '-0.03' }])
  })
})

describe('sincronizarIpcFipe', () => {
  beforeEach(() => jest.clearAllMocks())

  it('grava só os novos, renova buscadoEm dos confirmados e não toca nos divergentes', async () => {
    db.findMany.mockResolvedValue([
      { mes: new Date('2026-06-01T00:00:00Z'), variacao: new Prisma.Decimal('0.18') },
      { mes: new Date('2026-07-01T00:00:00Z'), variacao: new Prisma.Decimal('-0.04') },
    ])
    const agora = new Date('2026-09-30T12:00:00Z')
    const r = await sincronizarIpcFipe({
      agora,
      buscar: async () => [
        { mes: '2026-06', variacao: '0.18' },
        { mes: '2026-07', variacao: '-0.03' },
        { mes: '2026-08', variacao: '0.01' },
      ],
    })
    expect(r).toEqual({ novos: 1, confirmados: 1, divergentes: [{ mes: '2026-07', gravado: '-0.04', fonte: '-0.03' }] })
    expect(db.createMany).toHaveBeenCalledWith({
      data: [{ mes: new Date('2026-08-01T00:00:00Z'), variacao: '0.01', fonte: expect.stringContaining('sgs.193'), buscadoEm: agora }],
      skipDuplicates: true,
    })
    expect(db.updateMany).toHaveBeenCalledWith({
      where: { mes: { in: [new Date('2026-06-01T00:00:00Z')] } },
      data: { buscadoEm: agora },
    })
  })

  it('falha da fonte sobe e nada é gravado', async () => {
    db.findMany.mockResolvedValue([])
    await expect(sincronizarIpcFipe({ buscar: async () => Promise.reject(new Error('502')) })).rejects.toThrow('502')
    expect(db.createMany).not.toHaveBeenCalled()
  })
})

describe('lerIndiceGravado', () => {
  it('devolve AAAA-MM com a variação sem zeros à direita e a última atualização', async () => {
    db.findMany.mockResolvedValue([{ mes: new Date('2026-08-01T00:00:00Z'), variacao: new Prisma.Decimal('0.0100') }])
    db.aggregate.mockResolvedValue({ _max: { buscadoEm: new Date('2026-09-30T12:00:00Z') } })
    await expect(lerIndiceGravado()).resolves.toEqual({
      meses: [{ mes: '2026-08', variacao: '0.01' }],
      atualizadoEm: '2026-09-30T12:00:00.000Z',
    })
  })
})
```

- [ ] **Step 3: Rodar e ver falhar** — `npx jest src/lib/reajuste/indice.test.ts` → FAIL.

- [ ] **Step 4: Implementar `indice.ts`**

```ts
// Sincroniza a série do Banco Central com a tabela IndiceIpcFipe (spec §1.3). Nunca sobrescreve em
// silêncio: mês gravado com valor diferente vira divergência pra decisão humana.
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { dataParaMes, mesParaData } from './meses'
import { URL_SERIE_IPC_FIPE, buscarSerieIpcFipe, type MesDoIndice } from './serie-bcb'

export interface Divergencia {
  mes: string
  gravado: string
  fonte: string
}

const limpo = (valor: string) => new Decimal(valor).toString()

export function compararComGravados(fonte: MesDoIndice[], gravados: Map<string, string>) {
  const novos: MesDoIndice[] = []
  const confirmados: string[] = []
  const divergentes: Divergencia[] = []
  for (const item of fonte) {
    const gravado = gravados.get(item.mes)
    if (gravado === undefined) novos.push(item)
    else if (new Decimal(gravado).eq(item.variacao)) confirmados.push(item.mes)
    else divergentes.push({ mes: item.mes, gravado: limpo(gravado), fonte: limpo(item.variacao) })
  }
  return { novos, confirmados, divergentes }
}

export async function sincronizarIpcFipe(deps: { buscar?: () => Promise<MesDoIndice[]>; agora?: Date } = {}) {
  const buscar = deps.buscar ?? (() => buscarSerieIpcFipe())
  const agora = deps.agora ?? new Date()
  const fonte = await buscar()
  const linhas = await prisma.indiceIpcFipe.findMany({ select: { mes: true, variacao: true } })
  const gravados = new Map(linhas.map((l) => [dataParaMes(l.mes), l.variacao.toString()]))
  const { novos, confirmados, divergentes } = compararComGravados(fonte, gravados)

  if (novos.length > 0) {
    await prisma.indiceIpcFipe.createMany({
      data: novos.map((n) => ({ mes: mesParaData(n.mes), variacao: n.variacao, fonte: URL_SERIE_IPC_FIPE, buscadoEm: agora })),
      skipDuplicates: true,
    })
  }
  if (confirmados.length > 0) {
    await prisma.indiceIpcFipe.updateMany({ where: { mes: { in: confirmados.map(mesParaData) } }, data: { buscadoEm: agora } })
  }
  return { novos: novos.length, confirmados: confirmados.length, divergentes }
}

export async function lerIndiceGravado() {
  const [linhas, maximo] = await Promise.all([
    prisma.indiceIpcFipe.findMany({ orderBy: { mes: 'asc' }, select: { mes: true, variacao: true } }),
    prisma.indiceIpcFipe.aggregate({ _max: { buscadoEm: true } }),
  ])
  return {
    meses: linhas.map((l) => ({ mes: dataParaMes(l.mes), variacao: limpo(l.variacao.toString()) })),
    atualizadoEm: maximo._max.buscadoEm?.toISOString() ?? null,
  }
}
```

- [ ] **Step 5: Rodar e ver passar** — `npx jest src/lib/reajuste/indice.test.ts` → PASS.

- [ ] **Step 6: Testes que falham — rotas**

`src/app/api/reajuste/indice/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/reajuste/indice', () => ({ lerIndiceGravado: jest.fn(), sincronizarIpcFipe: jest.fn() }))
import { getAuthUser } from '@/lib/auth'
import { lerIndiceGravado, sincronizarIpcFipe } from '@/lib/reajuste/indice'
import { FonteIndiceIndisponivel } from '@/lib/reajuste/serie-bcb'
import { GET, POST } from './route'

const req = (method = 'GET') => new NextRequest('http://localhost/api/reajuste/indice', { method })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })
})

it('401 sem login', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(req())).status).toBe(401)
  expect((await POST(req('POST'))).status).toBe(401)
})

it('GET devolve os meses gravados', async () => {
  ;(lerIndiceGravado as jest.Mock).mockResolvedValue({ meses: [{ mes: '2026-08', variacao: '0.01' }], atualizadoEm: null })
  const r = await GET(req())
  expect(await r.json()).toEqual({ meses: [{ mes: '2026-08', variacao: '0.01' }], atualizadoEm: null })
})

it('POST sincroniza; fonte fora vira 502 com a mensagem', async () => {
  ;(sincronizarIpcFipe as jest.Mock).mockResolvedValue({ novos: 2, confirmados: 10, divergentes: [] })
  expect(await (await POST(req('POST'))).json()).toEqual({ novos: 2, confirmados: 10, divergentes: [] })
  ;(sincronizarIpcFipe as jest.Mock).mockRejectedValue(new FonteIndiceIndisponivel('Banco Central respondeu 502'))
  const r = await POST(req('POST'))
  expect(r.status).toBe(502)
  expect(await r.json()).toEqual({ error: 'Banco Central respondeu 502' })
})
```

`src/app/api/reajuste/indice/cron/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/reajuste/indice', () => ({ sincronizarIpcFipe: jest.fn() }))
import { sincronizarIpcFipe } from '@/lib/reajuste/indice'
import { GET } from './route'

const req = (auth?: string) =>
  new NextRequest('http://localhost/api/reajuste/indice/cron', { headers: auth ? { authorization: auth } : {} })

beforeEach(() => {
  jest.clearAllMocks()
  process.env.CRON_SECRET = 'segredo'
  ;(sincronizarIpcFipe as jest.Mock).mockResolvedValue({ novos: 0, confirmados: 13, divergentes: [] })
})

it('401 sem o segredo certo ou sem CRON_SECRET', async () => {
  expect((await GET(req('Bearer errado'))).status).toBe(401)
  delete process.env.CRON_SECRET
  expect((await GET(req('Bearer undefined'))).status).toBe(401)
})

it('sincroniza com o segredo certo', async () => {
  const r = await GET(req('Bearer segredo'))
  expect(r.status).toBe(200)
  expect(sincronizarIpcFipe).toHaveBeenCalled()
})
```

- [ ] **Step 7: Rodar e ver falhar** — `npx jest src/app/api/reajuste` → FAIL.

- [ ] **Step 8: Implementar as rotas**

`src/app/api/reajuste/indice/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { lerIndiceGravado, sincronizarIpcFipe } from '@/lib/reajuste/indice'
import { FonteIndiceIndisponivel } from '@/lib/reajuste/serie-bcb'

/** Tabela do IPC-Fipe guardada no VerAI (GET) e o botão "Atualizar agora" (POST). */
export async function GET(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  return NextResponse.json(await lerIndiceGravado())
}

export async function POST(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  try {
    return NextResponse.json(await sincronizarIpcFipe())
  } catch (erro) {
    if (erro instanceof FonteIndiceIndisponivel) return NextResponse.json({ error: erro.message }, { status: 502 })
    throw erro
  }
}
```

`src/app/api/reajuste/indice/cron/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { sincronizarIpcFipe } from '@/lib/reajuste/indice'

export const maxDuration = 60

/** Cron da Vercel (vercel.json), `Authorization: Bearer $CRON_SECRET`. Público no middleware — o
 *  segredo é a única porta. Erro da fonte sai no log da Vercel (spec §4). */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  const resultado = await sincronizarIpcFipe()
  if (resultado.divergentes.length > 0) console.warn('[reajuste] IPC-Fipe divergente', resultado.divergentes)
  return NextResponse.json(resultado)
}
```

`src/middleware.ts` linha 5:

```ts
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/assistente/indexar/cron', '/api/reajuste/indice/cron']
```

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/assistente/indexar/cron", "schedule": "0 9 * * *" },
    { "path": "/api/reajuste/indice/cron", "schedule": "0 13 * * *" }
  ]
}
```

- [ ] **Step 9: Rodar e ver passar** — `npx jest src/app/api/reajuste src/lib/reajuste src/middleware` → PASS.

- [ ] **Step 10: Carga real no dev** — com o dev server de pé (`preview_start`), logado, `POST /api/reajuste/indice` pelo navegador (javascript_tool: `await fetch('/api/reajuste/indice',{method:'POST'}).then(r=>r.json())`).
Expected: `novos` ≈ 1.000 (série desde 1939), `divergentes: []`. Repetir: `novos: 0`.

- [ ] **Step 11: Commit** — schema, migração, `src/lib/reajuste/indice*`, rotas `indice` e `indice/cron`, `src/middleware.ts`, `vercel.json`. Mensagem: `feat(reajuste): tabela IndiceIpcFipe sincronizada com o Banco Central`.

---

### Task 4: Leitura dos valores (planilha e texto)

**Files:**
- Create: `src/lib/reajuste/tipos.ts`
- Create: `src/lib/reajuste/leitura.ts`, `src/lib/reajuste/leitura.test.ts`

**Interfaces:**
- Consumes: `normalizarDecimal` (`src/lib/relatorios-clientes/numero.ts`), `extrairPaginas`, `semCamadaDeTexto` (`src/lib/assistente/indexacao/extrair.ts`).
- Produces (em `tipos.ts`):

```ts
export type TipoArquivoReajuste = 'xlsx' | 'csv' | 'pdf' | 'docx'

export interface ColunaCandidata {
  aba: string
  coluna: number // 1-based (exceljs)
  cabecalho: string
  linhaCabecalho: number
  exemplos: string[] // até 3, já normalizados ("1500.00")
  quantidade: number // células com valor
  sugerida: boolean
}

export interface ValorNoTexto {
  indice: number
  pagina: number | null
  original: string // normalizado ("1500.00")
  bruto: string // como no texto ("R$ 1.500,00")
  antes: string // ~60 caracteres
  depois: string
}

export type Leitura =
  | { tipo: 'planilha'; colunas: ColunaCandidata[] }
  | { tipo: 'texto'; valores: ValorNoTexto[] }

export class ArquivoIlegivel extends Error {}
```

- Produces (em `leitura.ts`): `abrirPlanilha(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<ExcelJS.Workbook>`, `valorDaCelula(valor: ExcelJS.CellValue): string | null`, `colunasCandidatas(wb: ExcelJS.Workbook): ColunaCandidata[]`, `valoresNoTexto(paginas: Array<{ pagina: number | null; texto: string }>): ValorNoTexto[]`, `lerArquivo(buffer: Buffer, tipo: TipoArquivoReajuste): Promise<Leitura>`.

- [ ] **Step 1: Testes que falham**

```ts
/** @jest-environment node */
import ExcelJS from 'exceljs'
import { ArquivoIlegivel } from './tipos'
import { abrirPlanilha, colunasCandidatas, lerArquivo, valorDaCelula, valoresNoTexto } from './leitura'

describe('valorDaCelula', () => {
  it('número, texto em moeda e resultado de fórmula', () => {
    expect(valorDaCelula(1500)).toBe('1500')
    expect(valorDaCelula('R$ 1.500,00')).toBe('1500.00')
    expect(valorDaCelula({ formula: 'A1*2', result: 30 } as ExcelJS.CellValue)).toBe('30')
  })
  it('texto que não é valor, ambíguo, vazio e data ficam de fora', () => {
    expect(valorDaCelula('Serviço de hospedagem')).toBeNull()
    expect(valorDaCelula('1.500')).toBeNull()
    expect(valorDaCelula(null)).toBeNull()
    expect(valorDaCelula(new Date())).toBeNull()
  })
})

describe('colunasCandidatas', () => {
  it('acha colunas com valor, sugere as com nome de valor', () => {
    const wb = new ExcelJS.Workbook()
    const aba = wb.addWorksheet('Itens')
    aba.addRow(['Item', 'Quantidade', 'Valor unitário', 'Total'])
    aba.addRow(['Hospedagem', 2, 'R$ 1.500,00', 3000])
    aba.addRow(['Suporte', 1, '800,50', 800.5])
    const colunas = colunasCandidatas(wb)
    expect(colunas.map((c) => [c.cabecalho, c.coluna, c.sugerida, c.quantidade])).toEqual([
      ['Quantidade', 2, false, 2],
      ['Valor unitário', 3, true, 2],
      ['Total', 4, true, 2],
    ])
    expect(colunas[1].exemplos).toEqual(['1500.00', '800.50'])
    expect(colunas[1].linhaCabecalho).toBe(1)
  })
})

describe('valoresNoTexto', () => {
  it('só valor com centavos; processo, ano e quantidade ficam de fora', () => {
    const valores = valoresNoTexto([
      { pagina: 1, texto: 'Processo 7010.2024/0001234-5, ano 2026, 12 meses. Valor mensal de R$ 1.500,00 e total de 18.000,00.' },
      { pagina: 2, texto: 'Taxa: R$\n250,5 e item 1234,56' },
    ])
    expect(valores.map((v) => [v.pagina, v.bruto, v.original])).toEqual([
      [1, 'R$ 1.500,00', '1500.00'],
      [1, '18.000,00', '18000.00'],
      [2, '1234,56', '1234.56'],
    ])
    expect(valores[0].antes).toContain('Valor mensal de')
    expect(valores.map((v) => v.indice)).toEqual([0, 1, 2])
  })
})

describe('lerArquivo', () => {
  it('CSV com ponto e vírgula', async () => {
    const csv = Buffer.from('Item;Valor\nA;1.500,00\nB;200,00\n', 'utf8')
    const leitura = await lerArquivo(csv, 'csv')
    expect(leitura).toEqual({ tipo: 'planilha', colunas: [expect.objectContaining({ cabecalho: 'Valor', quantidade: 2 })] })
  })
  it('planilha que não abre vira ArquivoIlegivel', async () => {
    await expect(abrirPlanilha(Buffer.from('não é xlsx'), 'xlsx')).rejects.toThrow(ArquivoIlegivel)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/reajuste/leitura.test.ts` → FAIL.

- [ ] **Step 3: Implementar `tipos.ts`** (conteúdo do bloco **Produces** acima, literal).

- [ ] **Step 4: Implementar `leitura.ts`**

```ts
// Onde estão os valores a corrigir (spec §2.2 passo 3): colunas da planilha ou valores em moeda no
// texto de PDF/DOCX. Valor sempre pela regra única do projeto (`normalizarDecimal`).
import { Readable } from 'node:stream'
import ExcelJS from 'exceljs'
import { extrairPaginas, semCamadaDeTexto } from '@/lib/assistente/indexacao/extrair'
import { normalizarDecimal } from '@/lib/relatorios-clientes/numero'
import { ArquivoIlegivel, type ColunaCandidata, type Leitura, type TipoArquivoReajuste, type ValorNoTexto } from './tipos'

const NOME_DE_VALOR = /valor|pre[çc]o|total|custo|r\$/i
// Com centavos obrigatórios: `R$ 1.234,56`, `1.234,56`, `1234,56`. Sem centavos não entra (processo, ano, quantidade).
const MOEDA = /(?<![\d.,/-])(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?![\d,])/g
const CONTEXTO = 60

export async function abrirPlanilha(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  try {
    if (tipo === 'xlsx') {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer)
    } else {
      const texto = buffer.toString('utf8').replace(/^﻿/, '')
      const primeira = texto.split(/\r?\n/, 1)[0] ?? ''
      const delimiter = (primeira.match(/;/g) ?? []).length > (primeira.match(/,/g) ?? []).length ? ';' : ','
      // `map` devolvendo o texto cru: sem isso o exceljs converte "1.500,00" e datas por conta própria.
      await wb.csv.read(Readable.from([texto]), { parserOptions: { delimiter }, map: (v: string) => v })
    }
  } catch {
    throw new ArquivoIlegivel('não foi possível abrir a planilha — verifique se o arquivo é um .xlsx ou .csv')
  }
  return wb
}

export function valorDaCelula(valor: ExcelJS.CellValue): string | null {
  if (valor === null || valor === undefined || valor instanceof Date) return null
  if (typeof valor === 'number') return Number.isFinite(valor) && valor >= 0 ? String(valor) : null
  if (typeof valor === 'string') {
    if (!/\d/.test(valor)) return null
    const r = normalizarDecimal(valor)
    return 'valor' in r ? r.valor : null
  }
  if (typeof valor === 'object' && 'result' in valor) return valorDaCelula((valor as { result?: ExcelJS.CellValue }).result ?? null)
  return null
}

const textoDaCelula = (valor: ExcelJS.CellValue) =>
  typeof valor === 'string' ? valor.trim() : typeof valor === 'object' && valor && 'richText' in valor
    ? valor.richText.map((t) => t.text).join('').trim()
    : ''

export function colunasCandidatas(wb: ExcelJS.Workbook): ColunaCandidata[] {
  const colunas: ColunaCandidata[] = []
  wb.eachSheet((aba) => {
    // Cabeçalho = primeira linha com pelo menos 2 textos não numéricos.
    let linhaCabecalho = 0
    aba.eachRow((linha, numero) => {
      if (linhaCabecalho) return
      const textos = (linha.values as ExcelJS.CellValue[]).filter((v) => textoDaCelula(v) && valorDaCelula(v) === null)
      if (textos.length >= 2) linhaCabecalho = numero
    })
    if (!linhaCabecalho) return
    const cabecalhos = aba.getRow(linhaCabecalho)
    for (let coluna = 1; coluna <= aba.columnCount; coluna++) {
      const valores: string[] = []
      for (let linha = linhaCabecalho + 1; linha <= aba.rowCount; linha++) {
        const v = valorDaCelula(aba.getRow(linha).getCell(coluna).value)
        if (v !== null) valores.push(v)
      }
      if (valores.length === 0) continue
      const cabecalho = textoDaCelula(cabecalhos.getCell(coluna).value) || `Coluna ${coluna}`
      colunas.push({
        aba: aba.name,
        coluna,
        cabecalho,
        linhaCabecalho,
        exemplos: valores.slice(0, 3),
        quantidade: valores.length,
        sugerida: NOME_DE_VALOR.test(cabecalho),
      })
    }
  })
  return colunas
}

export function valoresNoTexto(paginas: Array<{ pagina: number | null; texto: string }>): ValorNoTexto[] {
  const valores: ValorNoTexto[] = []
  for (const { pagina, texto } of paginas) {
    for (const achado of texto.matchAll(MOEDA)) {
      const bruto = achado[0].replace(/\s+/g, ' ')
      const r = normalizarDecimal(achado[0])
      if (!('valor' in r)) continue
      const inicio = achado.index ?? 0
      valores.push({
        indice: valores.length,
        pagina,
        original: r.valor,
        bruto,
        antes: texto.slice(Math.max(0, inicio - CONTEXTO), inicio).replace(/\s+/g, ' ').trimStart(),
        depois: texto.slice(inicio + achado[0].length, inicio + achado[0].length + CONTEXTO).replace(/\s+/g, ' ').trimEnd(),
      })
    }
  }
  return valores
}

export async function lerArquivo(buffer: Buffer, tipo: TipoArquivoReajuste): Promise<Leitura> {
  if (tipo === 'xlsx' || tipo === 'csv') return { tipo: 'planilha', colunas: colunasCandidatas(await abrirPlanilha(buffer, tipo)) }
  const paginas = await extrairPaginas(buffer, tipo).catch(() => {
    throw new ArquivoIlegivel(`não foi possível ler o ${tipo.toUpperCase()}`)
  })
  if (tipo === 'pdf' && semCamadaDeTexto(paginas)) throw new ArquivoIlegivel('PDF escaneado, sem texto — não há valores para ler')
  return { tipo: 'texto', valores: valoresNoTexto(paginas) }
}
```

Nota ao implementador: no teste `'R$\n250,5'` não casa (1 casa decimal) — é o comportamento desejado. `'1234,56'` casa. Se o `csv.read` do exceljs não aceitar `map`, trocar por converter cada célula de volta para texto; o teste de CSV é o árbitro.

- [ ] **Step 5: Rodar e ver passar** — `npx jest src/lib/reajuste/leitura.test.ts` → PASS.

- [ ] **Step 6: Commit** — `src/lib/reajuste/tipos.ts`, `src/lib/reajuste/leitura*`. Mensagem: `feat(reajuste): leitura dos valores de planilha, PDF e DOCX`.

---

### Task 5: Geração do resultado (XLSX)

**Files:**
- Create: `src/lib/reajuste/resultado.ts`, `src/lib/reajuste/resultado.test.ts`

**Interfaces:**
- Consumes: `abrirPlanilha`, `valorDaCelula`, `valoresNoTexto`-shape `ValorNoTexto`, `corrigirValor`, `fatorCompleto`, `nomeDoMes`, `Calculo` (ok).
- Produces:
  - `interface Resumo { meses: Array<{ mes: string; variacao: string }>; fator: string; acumuladoPct: string; usuario: string; geradoEm: Date; arquivo: string }`
  - `planilhaCorrigida(wb: ExcelJS.Workbook, colunas: Array<{ aba: string; coluna: number; linhaCabecalho: number }>, resumo: Resumo): Promise<{ buffer: Buffer; quantidade: number }>`
  - `planilhaDeComparacao(valores: ValorNoTexto[], resumo: Resumo): Promise<{ buffer: Buffer; quantidade: number }>`
  - `ABA_RESUMO = 'Reajuste IPC-Fipe'`

- [ ] **Step 1: Testes que falham**

```ts
/** @jest-environment node */
import ExcelJS from 'exceljs'
import { ABA_RESUMO, planilhaCorrigida, planilhaDeComparacao, type Resumo } from './resultado'

const resumo: Resumo = {
  meses: [{ mes: '2026-07', variacao: '-0.03' }, { mes: '2026-08', variacao: '0.01' }],
  fator: '0.999800',
  acumuladoPct: '-0.02',
  usuario: 'Fulano',
  geradoEm: new Date('2026-09-30T12:00:00Z'),
  arquivo: 'itens.xlsx',
}

async function reabrir(buffer: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  return wb
}

describe('planilhaCorrigida', () => {
  it('põe a coluna corrigida depois da última usada, sem mover fórmula, e a aba de resumo', async () => {
    const wb = new ExcelJS.Workbook()
    const aba = wb.addWorksheet('Itens')
    aba.addRow(['Item', 'Valor', 'Obs'])
    aba.addRow(['A', 1000, 'x'])
    aba.addRow(['B', 'sem valor', 'y'])
    aba.getCell('D4').value = { formula: 'B2*2', result: 2000 } as ExcelJS.CellFormulaValue

    const { buffer, quantidade } = await planilhaCorrigida(wb, [{ aba: 'Itens', coluna: 2, linhaCabecalho: 1 }], resumo)
    const saida = await reabrir(buffer)
    const itens = saida.getWorksheet('Itens')!
    expect(quantidade).toBe(1)
    expect(itens.getCell('E1').value).toBe('Valor corrigido')
    expect(itens.getCell('E2').value).toBe(999.8)
    expect(itens.getCell('E3').value).toBeNull()
    expect((itens.getCell('D4').value as ExcelJS.CellFormulaValue).formula).toBe('B2*2')
    const r = saida.getWorksheet(ABA_RESUMO)!
    expect(r).toBeDefined()
    const texto = JSON.stringify(r.getSheetValues())
    expect(texto).toContain('jul/2026')
    expect(texto).toContain('0.999800')
  })
})

// set/2025–ago/2026, reais (fator 1,035543)
const DOZE = [
  ['2025-09', '0.65'], ['2025-10', '0.27'], ['2025-11', '0.20'], ['2025-12', '0.32'], ['2026-01', '0.21'], ['2026-02', '0.25'],
  ['2026-03', '0.59'], ['2026-04', '0.40'], ['2026-05', '0.45'], ['2026-06', '0.18'], ['2026-07', '-0.03'], ['2026-08', '0.01'],
].map(([mes, variacao]) => ({ mes, variacao }))

describe('planilhaDeComparacao', () => {
  it('uma linha por valor marcado com original, corrigido e diferença', async () => {
    const { buffer, quantidade } = await planilhaDeComparacao(
      [{ indice: 0, pagina: 3, original: '1500.00', bruto: 'R$ 1.500,00', antes: 'mensal de', depois: 'por mês' }],
      { ...resumo, fator: '1.035543', acumuladoPct: '3.55', meses: DOZE }
    )
    const aba = (await reabrir(buffer)).getWorksheet('Valores')!
    expect(quantidade).toBe(1)
    expect(aba.getRow(1).values).toEqual([, 'Página', 'Trecho', 'Valor original', 'Valor corrigido', 'Diferença'])
    expect(aba.getRow(2).values).toEqual([, 3, 'mensal de [R$ 1.500,00] por mês', 1500, 1553.31, 53.31])
  })
})
```

Nota: o corrigido sempre vem de `fatorCompleto(resumo.meses)`; `resumo.fator` só é exibido na aba de resumo.

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/reajuste/resultado.test.ts` → FAIL.

- [ ] **Step 3: Implementar `resultado.ts`**

```ts
// Resultado do reajuste (spec §2.3): planilha com colunas "corrigido" depois da última usada (nada
// muda de lugar, fórmula existente não quebra) ou planilha de comparação pra PDF/DOCX. Sempre com a
// aba "Reajuste IPC-Fipe" provando o cálculo.
import Decimal from 'decimal.js'
import ExcelJS from 'exceljs'
import { corrigirValor, fatorCompleto } from './calculo'
import { valorDaCelula } from './leitura'
import { nomeDoMes } from './meses'
import type { ValorNoTexto } from './tipos'

export const ABA_RESUMO = 'Reajuste IPC-Fipe'
const MOEDA_BR = '#,##0.00'

export interface Resumo {
  meses: Array<{ mes: string; variacao: string }>
  fator: string
  acumuladoPct: string
  usuario: string
  geradoEm: Date
  arquivo: string
}

function abaDeResumo(wb: ExcelJS.Workbook, resumo: Resumo) {
  const existente = wb.getWorksheet(ABA_RESUMO)
  if (existente) wb.removeWorksheet(existente.id)
  const aba = wb.addWorksheet(ABA_RESUMO)
  aba.addRow(['Índice', 'IPC-Fipe (Banco Central, série 193)'])
  aba.addRow(['Arquivo', resumo.arquivo])
  aba.addRow(['Período', `${nomeDoMes(resumo.meses[0].mes)} a ${nomeDoMes(resumo.meses.at(-1)!.mes)}`])
  aba.addRow(['Acumulado (%)', resumo.acumuladoPct])
  aba.addRow(['Fator', resumo.fator])
  aba.addRow(['Gerado por', resumo.usuario])
  aba.addRow(['Gerado em', resumo.geradoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })])
  aba.addRow([])
  aba.addRow(['Mês', 'Variação (%)'])
  for (const m of resumo.meses) aba.addRow([nomeDoMes(m.mes), m.variacao])
  aba.getColumn(1).width = 16
  aba.getColumn(2).width = 40
}

const paraBuffer = async (wb: ExcelJS.Workbook) => Buffer.from(await wb.xlsx.writeBuffer())

export async function planilhaCorrigida(
  wb: ExcelJS.Workbook,
  colunas: Array<{ aba: string; coluna: number; linhaCabecalho: number }>,
  resumo: Resumo
) {
  const fator = fatorCompleto(resumo.meses)
  let quantidade = 0
  const porAba = new Map<string, typeof colunas>()
  for (const c of colunas) porAba.set(c.aba, [...(porAba.get(c.aba) ?? []), c])
  for (const [nome, lista] of porAba) {
    const aba = wb.getWorksheet(nome)
    if (!aba) continue
    let destino = aba.columnCount
    for (const c of lista) {
      destino += 1
      const titulo = String(aba.getRow(c.linhaCabecalho).getCell(c.coluna).text || `Coluna ${c.coluna}`)
      aba.getRow(c.linhaCabecalho).getCell(destino).value = `${titulo} corrigido`
      for (let linha = c.linhaCabecalho + 1; linha <= aba.rowCount; linha++) {
        const original = valorDaCelula(aba.getRow(linha).getCell(c.coluna).value)
        if (original === null) continue
        const celula = aba.getRow(linha).getCell(destino)
        celula.value = Number(corrigirValor(original, fator))
        celula.numFmt = MOEDA_BR
        quantidade++
      }
    }
  }
  abaDeResumo(wb, resumo)
  return { buffer: await paraBuffer(wb), quantidade }
}

export async function planilhaDeComparacao(valores: ValorNoTexto[], resumo: Resumo) {
  const fator = fatorCompleto(resumo.meses)
  const wb = new ExcelJS.Workbook()
  const aba = wb.addWorksheet('Valores')
  aba.addRow(['Página', 'Trecho', 'Valor original', 'Valor corrigido', 'Diferença'])
  for (const v of valores) {
    const corrigido = corrigirValor(v.original, fator)
    aba.addRow([
      v.pagina ?? '',
      `${v.antes} [${v.bruto}] ${v.depois}`.trim(),
      Number(v.original),
      Number(corrigido),
      Number(new Decimal(corrigido).minus(v.original).toFixed(2)),
    ])
  }
  for (const c of [3, 4, 5]) aba.getColumn(c).numFmt = MOEDA_BR
  aba.getColumn(2).width = 80
  abaDeResumo(wb, resumo)
  return { buffer: await paraBuffer(wb), quantidade: valores.length }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/reajuste/resultado.test.ts` → PASS.

- [ ] **Step 5: Commit** — `src/lib/reajuste/resultado*`. Mensagem: `feat(reajuste): planilha corrigida e planilha de comparação`.

---

### Task 6: Histórico no banco e rotas de leitura, geração e download

**Files:**
- Modify: `prisma/schema.prisma` (model `ReajusteExecucao` + relação em `Usuario`)
- Create: `prisma/migrations/20260930110000_reajuste_execucao/migration.sql`
- Create: `src/lib/reajuste/arquivos.ts` (chaves e leitura do temporário)
- Create: `src/app/api/reajuste/envio/route.ts`
- Create: `src/app/api/reajuste/leitura/route.ts`, `route.test.ts`
- Create: `src/app/api/reajuste/route.ts`, `route.test.ts`
- Create: `src/app/api/reajuste/[id]/arquivo/[qual]/route.ts`, `route.test.ts`

**Interfaces:**
- Consumes: `ehEnderecoDeEnvio`, `TIPOS_DE_ENVIO`, `extensaoDeEnvio` (`src/lib/propostas/envio.ts`); `getR2`, `putR2`, `deleteR2` (`src/lib/r2.ts`); `lerArquivo`, `abrirPlanilha`, `valoresNoTexto`, `extrairPaginas`; `calcularPeriodo`; `lerIndiceGravado`; `planilhaCorrigida`, `planilhaDeComparacao`.
- Produces:
  - `POST /api/reajuste/envio` — idêntico a `/api/propostas-comerciais/envio` (reexport).
  - `POST /api/reajuste/leitura` body `{ endereco: string }` → `Leitura` (400 endereço inválido; 422 `{ error }` para `ArquivoIlegivel`).
  - `POST /api/reajuste` body `{ endereco, nomeArquivo, inicial, final, colunas?: Array<{aba, coluna, linhaCabecalho}>, valores?: number[] /* índices de ValorNoTexto */ }` → `{ id }` (400 período/seleção; 422 arquivo ilegível).
  - `GET /api/reajuste` → `Array<{ id, nomeArquivo, tipoArquivo, mesInicial, mesFinal, acumuladoPct, fator, quantidadeValores, usuario, createdAt }>`.
  - `GET /api/reajuste/[id]/arquivo/original|resultado` → o arquivo, com `Content-Disposition`.
  - `arquivos.ts`: `chaveDoTemporario(endereco: string): string`, `lerDoR2(chave: string): Promise<Buffer>`, `chaveDoOriginal(id: string, ext: string)`, `chaveDoResultado(id: string)`, `CONTENT_TYPE_XLSX`.

- [ ] **Step 1: Model e migração**

`prisma/schema.prisma` (model `Usuario`: acrescentar `reajustes ReajusteExecucao[]`; no fim do arquivo):

```prisma
// Histórico do reajuste por IPC-Fipe (spec 2026-09-30-reajuste-ipc-fipe-design §3). `meses` guarda os
// meses e variações usados — prova do cálculo mesmo se a tabela do índice mudar depois.
model ReajusteExecucao {
  id                String   @id @default(cuid())
  usuarioId         String
  usuario           Usuario  @relation(fields: [usuarioId], references: [id])
  nomeArquivo       String
  tipoArquivo       String
  chaveOriginal     String
  chaveResultado    String
  mesInicial        DateTime @db.Date
  mesFinal          DateTime @db.Date
  fator             Decimal  @db.Decimal(12, 8)
  acumuladoPct      Decimal  @db.Decimal(9, 2)
  meses             Json
  quantidadeValores Int
  createdAt         DateTime @default(now())

  @@index([createdAt])
}
```

`prisma/migrations/20260930110000_reajuste_execucao/migration.sql`:

```sql
-- Histórico do reajuste por IPC-Fipe (spec 2026-09-30-reajuste-ipc-fipe-design §3). Só tabela nova.
CREATE TABLE "ReajusteExecucao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tipoArquivo" TEXT NOT NULL,
    "chaveOriginal" TEXT NOT NULL,
    "chaveResultado" TEXT NOT NULL,
    "mesInicial" DATE NOT NULL,
    "mesFinal" DATE NOT NULL,
    "fator" DECIMAL(12,8) NOT NULL,
    "acumuladoPct" DECIMAL(9,2) NOT NULL,
    "meses" JSONB NOT NULL,
    "quantidadeValores" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReajusteExecucao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReajusteExecucao_createdAt_idx" ON "ReajusteExecucao"("createdAt");
ALTER TABLE "ReajusteExecucao" ADD CONSTRAINT "ReajusteExecucao_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Run: `npx prisma validate`; `npx dotenv -e .env.development -- npx prisma migrate deploy`; `npx prisma generate`.

- [ ] **Step 2: `arquivos.ts` e reexport do envio**

`src/lib/reajuste/arquivos.ts`:

```ts
// Onde o reajuste guarda arquivos no R2 (spec §3) e como lê o temporário da "Nova conversão".
import { getR2 } from '@/lib/r2'

export const CONTENT_TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const chaveDoTemporario = (endereco: string) => endereco.slice('r2:'.length)
export const chaveDoOriginal = (id: string, ext: string) => `reajustes/${id}/original.${ext}`
export const chaveDoResultado = (id: string) => `reajustes/${id}/resultado.xlsx`

export async function lerDoR2(chave: string): Promise<Buffer> {
  const resposta = await getR2(chave)
  if (!resposta.ok) throw new Error(`R2 respondeu ${resposta.status} para ${chave}`)
  return Buffer.from(await resposta.arrayBuffer())
}
```

`src/app/api/reajuste/envio/route.ts`:

```ts
// Mesmo PUT pré-assinado da "Nova conversão" (tipos pdf/xlsx/csv/docx, 50 MB, 15 min, tmp-uploads/):
// o reajuste aceita exatamente os mesmos arquivos.
export { POST } from '@/app/api/propostas-comerciais/envio/route'
```

- [ ] **Step 3: Testes que falham — rotas** (`@/lib/auth`, `@/lib/prisma`, `@/lib/r2`, `@/lib/reajuste/indice` mockados; `@/lib/reajuste/leitura` e `resultado` reais onde possível)

`src/app/api/reajuste/leitura/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/r2', () => ({ ...jest.requireActual('@/lib/r2'), getR2: jest.fn() }))
import { getAuthUser } from '@/lib/auth'
import { getR2 } from '@/lib/r2'
import { POST } from './route'

const UUID = '0b8f4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b'
const req = (corpo: unknown) =>
  new NextRequest('http://localhost/api/reajuste/leitura', { method: 'POST', body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'Fulano', role: 'uploader' })
})

it('401 sem login e 400 com endereço fora do temporário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValueOnce(null)
  expect((await POST(req({ endereco: `r2:tmp-uploads/${UUID}.csv` }))).status).toBe(401)
  expect((await POST(req({ endereco: 'r2:propostas-comerciais/x/original.pdf' }))).status).toBe(400)
})

it('lê o CSV do temporário e devolve as colunas', async () => {
  ;(getR2 as jest.Mock).mockResolvedValue(new Response('Item;Valor\nA;1.500,00\n'))
  const r = await POST(req({ endereco: `r2:tmp-uploads/${UUID}.csv` }))
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual({ tipo: 'planilha', colunas: [expect.objectContaining({ cabecalho: 'Valor' })] })
})

it('arquivo ilegível vira 422 com a mensagem', async () => {
  ;(getR2 as jest.Mock).mockResolvedValue(new Response('lixo'))
  const r = await POST(req({ endereco: `r2:tmp-uploads/${UUID}.xlsx` }))
  expect(r.status).toBe(422)
  expect((await r.json()).error).toMatch(/não foi possível abrir a planilha/)
})
```

`src/app/api/reajuste/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/r2', () => ({ ...jest.requireActual('@/lib/r2'), getR2: jest.fn(), putR2: jest.fn(), deleteR2: jest.fn() }))
jest.mock('@/lib/reajuste/indice', () => ({ lerIndiceGravado: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { reajusteExecucao: { create: jest.fn(), findMany: jest.fn() } } }))
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteR2, getR2, putR2 } from '@/lib/r2'
import { lerIndiceGravado } from '@/lib/reajuste/indice'
import { GET, POST } from './route'

const UUID = '0b8f4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b'
const ENDERECO = `r2:tmp-uploads/${UUID}.csv`
const req = (corpo: unknown) => new NextRequest('http://localhost/api/reajuste', { method: 'POST', body: JSON.stringify(corpo) })
// 'Sheet1' é o nome que o exceljs dá à aba de CSV — conferir com o que a leitura (Task 4) devolve e ajustar.
const base = { endereco: ENDERECO, nomeArquivo: 'itens.csv', inicial: '2026-07', final: '2026-08', colunas: [{ aba: 'Sheet1', coluna: 2, linhaCabecalho: 1 }] }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'Fulano', role: 'uploader' })
  ;(lerIndiceGravado as jest.Mock).mockResolvedValue({
    meses: [{ mes: '2026-07', variacao: '-0.03' }, { mes: '2026-08', variacao: '0.01' }],
    atualizadoEm: null,
  })
  ;(getR2 as jest.Mock).mockResolvedValue(new Response('Item;Valor\nA;1.000,00\n'))
  ;(prisma.reajusteExecucao.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve(data))
})

it('401 sem login', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await POST(req(base))).status).toBe(401)
  expect((await GET(new NextRequest('http://localhost/api/reajuste'))).status).toBe(401)
})

it('400 com mês faltando no índice, período inválido ou nada marcado', async () => {
  expect((await POST(req({ ...base, final: '2026-09' }))).status).toBe(400)
  expect((await POST(req({ ...base, inicial: 'julho' }))).status).toBe(400)
  expect((await POST(req({ ...base, colunas: [] }))).status).toBe(400)
})

it('gera, grava original e resultado no R2, apaga o temporário e registra o histórico', async () => {
  const r = await POST(req(base))
  expect(r.status).toBe(200)
  const { id } = await r.json()
  expect(putR2).toHaveBeenCalledWith(`reajustes/${id}/original.csv`, expect.any(Buffer), 'text/csv')
  expect(putR2).toHaveBeenCalledWith(`reajustes/${id}/resultado.xlsx`, expect.any(Buffer), expect.stringContaining('spreadsheetml'))
  expect(deleteR2).toHaveBeenCalledWith(`tmp-uploads/${UUID}.csv`)
  expect(prisma.reajusteExecucao.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      id,
      usuarioId: 'u1',
      nomeArquivo: 'itens.csv',
      tipoArquivo: 'csv',
      fator: '0.99979997',
      acumuladoPct: '-0.02',
      quantidadeValores: 1,
      meses: [{ mes: '2026-07', variacao: '-0.03' }, { mes: '2026-08', variacao: '0.01' }],
    }),
  })
})
```

`src/app/api/reajuste/[id]/arquivo/[qual]/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/r2', () => ({ ...jest.requireActual('@/lib/r2'), getR2: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { reajusteExecucao: { findUnique: jest.fn() } } }))
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getR2 } from '@/lib/r2'
import { GET } from './route'

const chamar = (qual: string) =>
  GET(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: 'r1', qual }) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })
  ;(prisma.reajusteExecucao.findUnique as jest.Mock).mockResolvedValue({
    id: 'r1', nomeArquivo: 'Itens 2026.csv', tipoArquivo: 'csv',
    chaveOriginal: 'reajustes/r1/original.csv', chaveResultado: 'reajustes/r1/resultado.xlsx',
  })
  ;(getR2 as jest.Mock).mockResolvedValue(new Response('conteudo'))
})

it('401, 404 para qual inválido ou execução inexistente', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValueOnce(null)
  expect((await chamar('resultado')).status).toBe(401)
  expect((await chamar('outro')).status).toBe(404)
  ;(prisma.reajusteExecucao.findUnique as jest.Mock).mockResolvedValueOnce(null)
  expect((await chamar('resultado')).status).toBe(404)
})

it('entrega o resultado com nome derivado do original', async () => {
  const r = await chamar('resultado')
  expect(getR2).toHaveBeenCalledWith('reajustes/r1/resultado.xlsx')
  expect(r.headers.get('content-disposition')).toContain("filename*=UTF-8''Itens%202026%20-%20reajustado.xlsx")
})
```

- [ ] **Step 4: Rodar e ver falhar** — `npx jest src/app/api/reajuste` → FAIL.

- [ ] **Step 5: Implementar `leitura/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { ehEnderecoDeEnvio } from '@/lib/propostas/envio'
import { chaveDoTemporario, lerDoR2 } from '@/lib/reajuste/arquivos'
import { lerArquivo } from '@/lib/reajuste/leitura'
import { ArquivoIlegivel, type TipoArquivoReajuste } from '@/lib/reajuste/tipos'

export const maxDuration = 60

/** Onde estão os valores do arquivo recém-enviado (spec §2.2 passo 3). Só lê o temporário do envio. */
export async function POST(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const corpo = (await request.json().catch(() => null)) as { endereco?: unknown } | null
  const endereco = typeof corpo?.endereco === 'string' ? corpo.endereco : ''
  if (!ehEnderecoDeEnvio(endereco)) return NextResponse.json({ error: 'arquivo inválido' }, { status: 400 })
  const tipo = endereco.split('.').pop() as TipoArquivoReajuste
  try {
    return NextResponse.json(await lerArquivo(await lerDoR2(chaveDoTemporario(endereco)), tipo))
  } catch (erro) {
    if (erro instanceof ArquivoIlegivel) return NextResponse.json({ error: erro.message }, { status: 422 })
    throw erro
  }
}
```

- [ ] **Step 6: Implementar `route.ts` (GET histórico, POST gerar)**

```ts
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIPOS_DE_ENVIO, ehEnderecoDeEnvio } from '@/lib/propostas/envio'
import { deleteR2, putR2 } from '@/lib/r2'
import { extrairPaginas } from '@/lib/assistente/indexacao/extrair'
import { CONTENT_TYPE_XLSX, chaveDoOriginal, chaveDoResultado, chaveDoTemporario, lerDoR2 } from '@/lib/reajuste/arquivos'
import { calcularPeriodo, fatorCompleto } from '@/lib/reajuste/calculo'
import { lerIndiceGravado } from '@/lib/reajuste/indice'
import { abrirPlanilha, valoresNoTexto } from '@/lib/reajuste/leitura'
import { dataParaMes, mesParaData } from '@/lib/reajuste/meses'
import { planilhaCorrigida, planilhaDeComparacao } from '@/lib/reajuste/resultado'
import { ArquivoIlegivel, type TipoArquivoReajuste } from '@/lib/reajuste/tipos'

export const maxDuration = 120

const MES = /^\d{4}-(0[1-9]|1[0-2])$/

interface Pedido {
  endereco?: unknown
  nomeArquivo?: unknown
  inicial?: unknown
  final?: unknown
  colunas?: Array<{ aba: string; coluna: number; linhaCabecalho: number }>
  valores?: number[]
}

/** Histórico: todo mundo vê tudo, como no ConfereAI (spec §2.4). */
export async function GET(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const linhas = await prisma.reajusteExecucao.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { usuario: { select: { nome: true } } },
  })
  return NextResponse.json(
    linhas.map((l) => ({
      id: l.id,
      nomeArquivo: l.nomeArquivo,
      tipoArquivo: l.tipoArquivo,
      mesInicial: dataParaMes(l.mesInicial),
      mesFinal: dataParaMes(l.mesFinal),
      acumuladoPct: l.acumuladoPct.toString(),
      fator: l.fator.toFixed(6),
      quantidadeValores: l.quantidadeValores,
      usuario: l.usuario.nome,
      createdAt: l.createdAt.toISOString(),
    }))
  )
}

/** Gera o reajuste: recalcula tudo aqui (não confia no navegador), grava original e resultado no R2
 *  e o registro no histórico. Nada parcial no histórico se algo falhar antes do `create`. */
export async function POST(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const p = ((await request.json().catch(() => null)) ?? {}) as Pedido
  const endereco = typeof p.endereco === 'string' ? p.endereco : ''
  const nomeArquivo = typeof p.nomeArquivo === 'string' && p.nomeArquivo.trim() ? p.nomeArquivo.trim() : 'arquivo'
  if (!ehEnderecoDeEnvio(endereco)) return NextResponse.json({ error: 'arquivo inválido' }, { status: 400 })
  if (typeof p.inicial !== 'string' || typeof p.final !== 'string' || !MES.test(p.inicial) || !MES.test(p.final)) {
    return NextResponse.json({ error: 'período inválido' }, { status: 400 })
  }
  const tipo = endereco.split('.').pop() as TipoArquivoReajuste
  const ehPlanilha = tipo === 'xlsx' || tipo === 'csv'
  const colunas = Array.isArray(p.colunas) ? p.colunas : []
  const indices = new Set(Array.isArray(p.valores) ? p.valores.filter(Number.isInteger) : [])
  if ((ehPlanilha && colunas.length === 0) || (!ehPlanilha && indices.size === 0)) {
    return NextResponse.json({ error: 'marque ao menos um valor para corrigir' }, { status: 400 })
  }

  const indice = await lerIndiceGravado()
  const calculo = calcularPeriodo(p.inicial, p.final, new Map(indice.meses.map((m) => [m.mes, m.variacao])))
  if (!calculo.ok) {
    const error = 'faltando' in calculo ? `índice ainda não publicado: ${calculo.faltando.join(', ')}` : calculo.erro
    return NextResponse.json({ error }, { status: 400 })
  }

  const temporario = chaveDoTemporario(endereco)
  const original = await lerDoR2(temporario)
  const resumo = { meses: calculo.meses, fator: calculo.fator, acumuladoPct: calculo.acumuladoPct, usuario: usuario.nome, geradoEm: new Date(), arquivo: nomeArquivo }
  let resultado: { buffer: Buffer; quantidade: number }
  try {
    if (ehPlanilha) {
      resultado = await planilhaCorrigida(await abrirPlanilha(original, tipo), colunas, resumo)
    } else {
      const valores = valoresNoTexto(await extrairPaginas(original, tipo)).filter((v) => indices.has(v.indice))
      resultado = await planilhaDeComparacao(valores, resumo)
    }
  } catch (erro) {
    if (erro instanceof ArquivoIlegivel) return NextResponse.json({ error: erro.message }, { status: 422 })
    throw erro
  }

  const id = randomUUID()
  await putR2(chaveDoOriginal(id, tipo), original, TIPOS_DE_ENVIO[tipo])
  await putR2(chaveDoResultado(id), resultado.buffer, CONTENT_TYPE_XLSX)
  await prisma.reajusteExecucao.create({
    data: {
      id,
      usuarioId: usuario.id,
      nomeArquivo,
      tipoArquivo: tipo,
      chaveOriginal: chaveDoOriginal(id, tipo),
      chaveResultado: chaveDoResultado(id),
      mesInicial: mesParaData(p.inicial),
      mesFinal: mesParaData(p.final),
      fator: fatorCompleto(calculo.meses).toFixed(8, Decimal.ROUND_HALF_UP),
      acumuladoPct: calculo.acumuladoPct,
      meses: calculo.meses,
      quantidadeValores: resultado.quantidade,
    },
  })
  await deleteR2(temporario).catch(() => {}) // temporário que sobra não quebra nada; o original já está guardado
  return NextResponse.json({ id })
}
```

Imports extras no topo desta rota: `import Decimal from 'decimal.js'` e `fatorCompleto` junto de `calcularPeriodo`. O `fator` gravado é o completo com 8 casas (`0.9997 × 1.0001 = 0.99979997`); a tela exibe 6.

- [ ] **Step 7: Implementar `[id]/arquivo/[qual]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIPOS_DE_ENVIO } from '@/lib/propostas/envio'
import { getR2 } from '@/lib/r2'
import { CONTENT_TYPE_XLSX } from '@/lib/reajuste/arquivos'

/** Download do original ou do resultado de um reajuste do histórico. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; qual: string }> }) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const { id, qual } = await params
  if (qual !== 'original' && qual !== 'resultado') return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const execucao = await prisma.reajusteExecucao.findUnique({ where: { id } })
  if (!execucao) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const base = execucao.nomeArquivo.replace(/\.[^.]+$/, '')
  const [chave, nome, tipo] =
    qual === 'original'
      ? [execucao.chaveOriginal, execucao.nomeArquivo, TIPOS_DE_ENVIO[execucao.tipoArquivo as keyof typeof TIPOS_DE_ENVIO]]
      : [execucao.chaveResultado, `${base} - reajustado.xlsx`, CONTENT_TYPE_XLSX]
  const arquivo = await getR2(chave)
  if (!arquivo.ok) return NextResponse.json({ error: 'arquivo não encontrado no armazenamento' }, { status: 404 })
  return new NextResponse(arquivo.body, {
    headers: { 'Content-Type': tipo, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}` },
  })
}
```

- [ ] **Step 8: Rodar e ver passar** — `npx jest src/app/api/reajuste src/lib/reajuste` → PASS.

- [ ] **Step 9: Commit** — schema, migração `20260930110000_reajuste_execucao`, `src/lib/reajuste/arquivos.ts`, rotas `envio`, `leitura`, `route.ts`, `[id]/arquivo/[qual]`. Mensagem: `feat(reajuste): gerar reajuste com histórico no R2`.

---

### Task 7: Menu lateral e tela "Tabela do índice"

**Files:**
- Modify: `src/components/nav-bar.tsx` (constantes de link, estado aberto, `alternarReajuste`, `useEffect` de reabrir, `<GrupoMenu>` depois do ConfereAI; ícones `TrendingUp`, `Table2` no import de `lucide-react`)
- Modify: `src/components/nav-bar.test.tsx`
- Create: `src/app/reajuste/indice/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/reajuste/indice`; `nomeDoMes`, `somarMeses`, `calcularPeriodo`.

- [ ] **Step 1: Testes que falham — menu** (acrescentar em `nav-bar.test.tsx`)

```tsx
  it('"Reajuste IPC-Fipe" é um grupo depois do ConfereAI, com Histórico e Tabela do índice', () => {
    render(<NavBar />)
    const links = screen.getAllByRole('link')
    const reajuste = screen.getByRole('link', { name: 'Reajuste IPC-Fipe' })
    expect(reajuste).toHaveAttribute('href', '/reajuste')
    expect(links.indexOf(screen.getByRole('link', { name: 'ConfereAI' }))).toBeLessThan(links.indexOf(reajuste))
    expect(hrefsDoHistorico()).toContain('/reajuste/historico')
    expect(screen.getByRole('link', { name: 'Tabela do índice' })).toHaveAttribute('href', '/reajuste/indice')
  })
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/components/nav-bar.test.tsx` → FAIL.

- [ ] **Step 3: Implementar no `nav-bar.tsx`**, seguindo exatamente o desenho do ConfereAI:

```tsx
// Reajuste por IPC-Fipe (spec docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md): grupo
// próprio depois do ConfereAI — o cabeçalho abre a correção, os sub-itens o histórico e o índice.
const REAJUSTE_LINK = { href: '/reajuste', label: 'Reajuste IPC-Fipe', icon: TrendingUp }
const REAJUSTE_SUBLINKS = [
  { href: '/reajuste/historico', label: 'Histórico', icon: History },
  { href: '/reajuste/indice', label: 'Tabela do índice', icon: Table2 },
]
```

Dentro do componente: `const [reajusteAberto, setReajusteAberto] = useState(true)`;

```tsx
  useEffect(() => {
    if (REAJUSTE_SUBLINKS.some((link) => link.href === pathname)) {
      setReajusteAberto(true)
    }
  }, [pathname])
```

```tsx
  function alternarReajuste() {
    if (!expandida) {
      setExpandida(true)
      localStorage.setItem(NAV_EXPANDIDA_KEY, 'true')
      setReajusteAberto(true)
      return
    }
    setReajusteAberto((aberto) => !aberto)
  }
```

E logo depois do `<GrupoMenu link={CONFERE_LINK} … />`:

```tsx
          <GrupoMenu
            link={REAJUSTE_LINK}
            sublinks={REAJUSTE_SUBLINKS}
            aberto={reajusteAberto}
            onToggle={alternarReajuste}
            pathname={pathname}
            expandida={expandida}
          />
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/components/nav-bar.test.tsx` → PASS (todos, inclusive os antigos).

- [ ] **Step 5: Teste que falha — Tabela do índice** (`src/app/reajuste/indice/page.test.tsx`)

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TabelaDoIndicePage from './page'

const MESES = [
  ['2025-08', '0.04'], ['2025-09', '0.65'], ['2025-10', '0.27'], ['2025-11', '0.2'], ['2025-12', '0.32'],
  ['2026-01', '0.21'], ['2026-02', '0.25'], ['2026-03', '0.59'], ['2026-04', '0.4'], ['2026-05', '0.45'],
  ['2026-06', '0.18'], ['2026-07', '-0.03'], ['2026-08', '0.01'],
].map(([mes, variacao]) => ({ mes, variacao }))

beforeEach(() => {
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ novos: 1, confirmados: 12, divergentes: [{ mes: '2026-07', gravado: '-0.04', fonte: '-0.03' }] }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ meses: MESES, atualizadoEm: '2026-09-30T12:00:00.000Z' }) })
  }) as unknown as typeof fetch
})

it('mostra o mais recente em cima com o acumulado de 12 meses', async () => {
  render(<TabelaDoIndicePage />)
  const linhas = await screen.findAllByRole('row')
  expect(linhas[1]).toHaveTextContent('ago/2026')
  expect(linhas[1]).toHaveTextContent('0,01')
  expect(linhas[1]).toHaveTextContent('3,55') // acumulado set/2025–ago/2026
  expect(linhas.at(-1)).toHaveTextContent('—') // ago/2025 não tem 12 meses anteriores
})

it('"Atualizar agora" mostra o resultado e as divergências', async () => {
  render(<TabelaDoIndicePage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Atualizar agora' }))
  await waitFor(() => expect(screen.getByText(/1 mês novo/)).toBeInTheDocument())
  expect(screen.getByText(/jul\/2026/)).toBeInTheDocument()
})
```

- [ ] **Step 6: Rodar e ver falhar** — `npx jest src/app/reajuste/indice` → FAIL.

- [ ] **Step 7: Implementar `src/app/reajuste/indice/page.tsx`**

```tsx
'use client'

// Tabela do IPC-Fipe guardada no VerAI (spec 2026-09-30-reajuste-ipc-fipe-design §2.5).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { BTN_OUTLINE } from '@/lib/ui'
import { calcularPeriodo } from '@/lib/reajuste/calculo'
import { nomeDoMes, somarMeses } from '@/lib/reajuste/meses'

interface Indice {
  meses: Array<{ mes: string; variacao: string }>
  atualizadoEm: string | null
}
interface Sincronizacao {
  novos: number
  confirmados: number
  divergentes: Array<{ mes: string; gravado: string; fonte: string }>
}

const pct = (valor: string) => Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function TabelaDoIndicePage() {
  const [indice, setIndice] = useState<Indice | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [sincronizacao, setSincronizacao] = useState<Sincronizacao | null>(null)

  const carregar = useCallback(() => {
    fetch('/api/reajuste/indice')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setIndice)
      .catch(() => setErro('Não foi possível carregar o índice.'))
  }, [])
  useEffect(carregar, [carregar])

  async function atualizar() {
    setAtualizando(true)
    setErro(null)
    const r = await fetch('/api/reajuste/indice', { method: 'POST' })
    const corpo = await r.json().catch(() => null)
    setAtualizando(false)
    if (!r.ok) return setErro(corpo?.error ?? 'Falha ao atualizar.')
    setSincronizacao(corpo)
    carregar()
  }

  const linhas = useMemo(() => {
    if (!indice) return []
    const mapa = new Map(indice.meses.map((m) => [m.mes, m.variacao]))
    return [...indice.meses].reverse().map((m) => {
      const doze = calcularPeriodo(somarMeses(m.mes, -11), m.mes, mapa)
      return { ...m, acumulado12: doze.ok ? doze.acumuladoPct : null }
    })
  }, [indice])

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Reajuste IPC-Fipe</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Tabela do índice</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Tabela do índice</h1>
            <p className="text-sm text-mid-grey">
              IPC-Fipe mensal, do Banco Central (série 193).
              {indice?.atualizadoEm && ` Atualizado em ${new Date(indice.atualizadoEm).toLocaleString('pt-BR')}.`}
            </p>
          </div>
          <button type="button" className={BTN_OUTLINE} onClick={atualizar} disabled={atualizando}>
            <RefreshCw className={atualizando ? 'size-4 animate-spin' : 'size-4'} /> Atualizar agora
          </button>
        </div>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {sincronizacao && (
        <div className="rounded-md bg-slate-50 px-4 py-3 text-sm text-navy">
          {sincronizacao.novos === 1 ? '1 mês novo' : `${sincronizacao.novos} meses novos`}, {sincronizacao.confirmados} confirmados.
          {sincronizacao.divergentes.map((d) => (
            <p key={d.mes} className="mt-1 text-orange-dark">
              {nomeDoMes(d.mes)}: gravado {pct(d.gravado)} %, Banco Central agora diz {pct(d.fonte)} % — mantido o gravado; confira.
            </p>
          ))}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-mid-grey">
            <th className="py-2">Mês</th>
            <th className="py-2 text-right">Variação (%)</th>
            <th className="py-2 text-right">Acumulado 12 meses (%)</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.mes} className="border-b last:border-0">
              <td className="py-1.5 text-navy">{nomeDoMes(l.mes)}</td>
              <td className="py-1.5 text-right tabular-nums">{pct(l.variacao)}</td>
              <td className="py-1.5 text-right tabular-nums">{l.acumulado12 === null ? '—' : pct(l.acumulado12)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
```

Nota: se `text-orange-dark`/`text-mid-grey` não existirem como utilitários, use as mesmas classes que `src/app/tabela-de-precos/page.tsx` usa para aviso e texto secundário.

- [ ] **Step 8: Rodar e ver passar** — `npx jest src/app/reajuste/indice src/components/nav-bar.test.tsx` → PASS.

- [ ] **Step 9: Commit** — `nav-bar.tsx`, `nav-bar.test.tsx`, `src/app/reajuste/indice/*`. Mensagem: `feat(reajuste): grupo no menu e tabela do índice`.

---

### Task 8: Tela "Corrigir" (`/reajuste`)

**Files:**
- Create: `src/app/reajuste/page.tsx` (orquestra os passos)
- Create: `src/app/reajuste/periodo.tsx` (seletor de período + tabela dos meses)
- Create: `src/app/reajuste/selecao.tsx` (colunas da planilha ou valores do texto)
- Create: `src/app/reajuste/page.test.tsx`

**Interfaces:**
- Consumes: `enviarParaR2(arquivo, '/api/reajuste/envio')`; `POST /api/reajuste/leitura`; `POST /api/reajuste`; `GET /api/reajuste/indice`; `periodoSugerido`, `calcularPeriodo`, `mesesEntre`, `nomeDoMes`, `mesDeHoje`, `somarMeses`; tipos `Leitura`, `ColunaCandidata`, `ValorNoTexto`.
- Produces: `Periodo({ indice, inicial, final, onMudar })`, `Selecao({ leitura, marcadas, onMudar })` com `marcadas: Set<string>` (chave `aba|coluna` para planilha, `String(indice)` para texto).

- [ ] **Step 1: Teste que falha**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
jest.mock('@/lib/envio-r2-navegador', () => ({ enviarParaR2: jest.fn().mockResolvedValue('r2:tmp-uploads/0b8f4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b.pdf') }))
import ReajustePage from './page'

const MESES = [
  ['2025-09', '0.65'], ['2025-10', '0.27'], ['2025-11', '0.2'], ['2025-12', '0.32'], ['2026-01', '0.21'], ['2026-02', '0.25'],
  ['2026-03', '0.59'], ['2026-04', '0.4'], ['2026-05', '0.45'], ['2026-06', '0.18'], ['2026-07', '-0.03'], ['2026-08', '0.01'],
].map(([mes, variacao]) => ({ mes, variacao }))

const chamadas: Array<[string, unknown]> = []
beforeEach(() => {
  chamadas.length = 0
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push([String(url), init?.body ? JSON.parse(String(init.body)) : null])
    if (url === '/api/reajuste/indice') return Promise.resolve({ ok: true, json: () => Promise.resolve({ meses: MESES, atualizadoEm: null }) })
    if (url === '/api/reajuste/leitura') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ tipo: 'texto', valores: [
        { indice: 0, pagina: 1, original: '10000.00', bruto: 'R$ 10.000,00', antes: 'valor mensal de', depois: 'por mês' },
        { indice: 1, pagina: 2, original: '50.00', bruto: '50,00', antes: 'multa de', depois: 'por dia' },
      ] }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'r1' }) })
  }) as unknown as typeof fetch
})

it('sugere os últimos 12 meses publicados com o acumulado', async () => {
  render(<ReajustePage />)
  expect(await screen.findByText(/3,55\s?%/)).toBeInTheDocument()
  expect(screen.getByText(/set\/2025 a ago\/2026/)).toBeInTheDocument()
})

it('envia PDF, mostra os valores com o corrigido, desmarca um e gera com o período escolhido', async () => {
  render(<ReajustePage />)
  await screen.findByText(/3,55\s?%/)
  const arquivo = new File(['%PDF'], 'proposta.pdf', { type: 'application/pdf' })
  fireEvent.change(screen.getByLabelText('Arquivo'), { target: { files: [arquivo] } })
  expect(await screen.findByText('R$ 10.000,00')).toBeInTheDocument()
  expect(screen.getByText('10.355,43')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: /50,00/ }))
  fireEvent.change(screen.getByLabelText('Mês inicial'), { target: { value: '2026-07' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gerar planilha' }))
  await waitFor(() => expect(chamadas.some(([u]) => u === '/api/reajuste')).toBe(true))
  const [, corpo] = chamadas.find(([u]) => u === '/api/reajuste')!
  expect(corpo).toEqual({
    endereco: 'r2:tmp-uploads/0b8f4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b.pdf',
    nomeArquivo: 'proposta.pdf',
    inicial: '2026-07',
    final: '2026-08',
    valores: [0],
  })
  expect(await screen.findByRole('link', { name: /Baixar resultado/ })).toHaveAttribute('href', '/api/reajuste/r1/arquivo/resultado')
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/reajuste/page.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `periodo.tsx`**

```tsx
'use client'
// Período do reajuste (spec §2.2 passo 2): sugestão = últimos 12 publicados; o usuário muda os dois meses.
import Decimal from 'decimal.js'
import { calcularPeriodo } from '@/lib/reajuste/calculo'
import { nomeDoMes } from '@/lib/reajuste/meses'
import { INPUT_BASE } from '@/lib/ui'

const pct = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function Periodo(props: {
  indice: Map<string, string>
  meses: string[] // publicados, crescente — opções dos seletores
  inicial: string
  final: string
  onMudar: (inicial: string, final: string) => void
}) {
  const calculo = calcularPeriodo(props.inicial, props.final, props.indice)
  const opcoes = [...props.meses].reverse()
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold text-navy">2. Período</h2>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex flex-col gap-1">
          Mês inicial
          <select aria-label="Mês inicial" className={INPUT_BASE} value={props.inicial} onChange={(e) => props.onMudar(e.target.value, props.final)}>
            {opcoes.map((m) => <option key={m} value={m}>{nomeDoMes(m)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Mês final
          <select aria-label="Mês final" className={INPUT_BASE} value={props.final} onChange={(e) => props.onMudar(props.inicial, e.target.value)}>
            {opcoes.map((m) => <option key={m} value={m}>{nomeDoMes(m)}</option>)}
          </select>
        </label>
      </div>
      {calculo.ok ? (
        <>
          <p className="text-sm text-navy">
            {nomeDoMes(props.inicial)} a {nomeDoMes(props.final)} ({calculo.meses.length} {calculo.meses.length === 1 ? 'mês' : 'meses'}):
            {' '}<strong>{pct(calculo.acumuladoPct)} %</strong> — fator {new Decimal(calculo.fator).toFixed(6).replace('.', ',')}
          </p>
          <p className="text-xs text-mid-grey">
            {calculo.meses.map((m) => `${nomeDoMes(m.mes)} ${pct(m.variacao)}`).join(' · ')}
          </p>
        </>
      ) : (
        <p className="text-sm text-red-700">
          {'faltando' in calculo ? `Índice ainda não publicado: ${calculo.faltando.map(nomeDoMes).join(', ')}` : calculo.erro}
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Implementar `selecao.tsx`**

```tsx
'use client'
// Valores a corrigir (spec §2.2 passo 3): colunas da planilha ou valores achados no texto, com o corrigido ao lado.
import Decimal from 'decimal.js'
import { corrigirValor } from '@/lib/reajuste/calculo'
import type { Leitura } from '@/lib/reajuste/tipos'

const brl = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const chaveDaColuna = (aba: string, coluna: number) => `${aba}|${coluna}`

export function Selecao(props: { leitura: Leitura; fator: Decimal | null; marcadas: Set<string>; onMudar: (m: Set<string>) => void }) {
  const alternar = (chave: string) => {
    const nova = new Set(props.marcadas)
    if (nova.has(chave)) nova.delete(chave)
    else nova.add(chave)
    props.onMudar(nova)
  }
  const corrigido = (v: string) => (props.fator ? brl(corrigirValor(v, props.fator)) : '—')

  if (props.leitura.tipo === 'planilha') {
    if (props.leitura.colunas.length === 0) return <p className="text-sm text-mid-grey">Nenhuma coluna com valores nesta planilha.</p>
    return (
      <ul className="space-y-2 text-sm">
        {props.leitura.colunas.map((c) => {
          const chave = chaveDaColuna(c.aba, c.coluna)
          return (
            <li key={chave}>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={props.marcadas.has(chave)} onChange={() => alternar(chave)} />
                <span>
                  <strong className="text-navy">{c.cabecalho}</strong> <span className="text-mid-grey">({c.aba}, {c.quantidade} valores)</span>
                  <br />
                  <span className="text-xs text-mid-grey">
                    {c.exemplos.map((e) => `${brl(e)} → ${corrigido(e)}`).join(' · ')}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    )
  }

  if (props.leitura.valores.length === 0) return <p className="text-sm text-mid-grey">Nenhum valor em R$ com centavos foi achado no texto.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-mid-grey">
          <th className="w-8" />
          <th className="py-2">Pág.</th>
          <th className="py-2">Trecho</th>
          <th className="py-2 text-right">Original</th>
          <th className="py-2 text-right">Corrigido</th>
        </tr>
      </thead>
      <tbody>
        {props.leitura.valores.map((v) => (
          <tr key={v.indice} className="border-b last:border-0">
            <td>
              <input
                type="checkbox"
                aria-label={v.bruto}
                checked={props.marcadas.has(String(v.indice))}
                onChange={() => alternar(String(v.indice))}
              />
            </td>
            <td className="py-1.5 text-mid-grey">{v.pagina ?? '—'}</td>
            <td className="py-1.5 text-xs text-mid-grey">
              …{v.antes} <mark className="bg-orange/15 text-navy">{v.bruto}</mark> {v.depois}…
            </td>
            <td className="py-1.5 text-right tabular-nums">{brl(v.original)}</td>
            <td className="py-1.5 text-right tabular-nums font-semibold text-navy">{corrigido(v.original)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

Nota: o teste procura `'R$ 10.000,00'` como texto — o `<mark>` com `v.bruto` atende; e `'10.355,43'` na coluna Corrigido.

- [ ] **Step 5: Implementar `page.tsx`**

```tsx
'use client'

// Reajuste por IPC-Fipe (spec docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md §2.2):
// arquivo → período → valores → gerar. O servidor recalcula tudo; a tela só mostra a prévia.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Decimal from 'decimal.js'
import { Download, Loader2 } from 'lucide-react'
import { enviarParaR2 } from '@/lib/envio-r2-navegador'
import { calcularPeriodo, fatorCompleto, periodoSugerido } from '@/lib/reajuste/calculo'
import type { Leitura } from '@/lib/reajuste/tipos'
import { BTN_OUTLINE, BTN_PRIMARY, LINK_NAVY } from '@/lib/ui'
import { Periodo } from './periodo'
import { Selecao, chaveDaColuna } from './selecao'

type Etapa = { tipo: 'vazio' } | { tipo: 'lendo'; nome: string } | { tipo: 'pronto'; nome: string; endereco: string; leitura: Leitura }

export default function ReajustePage() {
  const [meses, setMeses] = useState<Array<{ mes: string; variacao: string }> | null>(null)
  const [inicial, setInicial] = useState('')
  const [final, setFinal] = useState('')
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'vazio' })
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [gerado, setGerado] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reajuste/indice')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((corpo: { meses: Array<{ mes: string; variacao: string }> }) => {
        setMeses(corpo.meses)
        const ultimo = corpo.meses.at(-1)?.mes
        if (ultimo) {
          const s = periodoSugerido(ultimo)
          setInicial(s.inicial)
          setFinal(s.final)
        }
      })
      .catch(() => setErro('Não foi possível carregar o IPC-Fipe.'))
  }, [])

  const indice = useMemo(() => new Map((meses ?? []).map((m) => [m.mes, m.variacao])), [meses])
  const calculo = inicial && final ? calcularPeriodo(inicial, final, indice) : null
  const fator = calculo?.ok ? fatorCompleto(calculo.meses) : null

  async function escolher(arquivo: File) {
    setErro(null)
    setGerado(null)
    setEtapa({ tipo: 'lendo', nome: arquivo.name })
    try {
      const endereco = await enviarParaR2(arquivo, '/api/reajuste/envio')
      const r = await fetch('/api/reajuste/leitura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endereco }) })
      const corpo = await r.json().catch(() => null)
      if (!r.ok) throw new Error(corpo?.error ?? 'Falha ao ler o arquivo.')
      const leitura = corpo as Leitura
      setMarcadas(
        new Set(
          leitura.tipo === 'planilha'
            ? leitura.colunas.filter((c) => c.sugerida).map((c) => chaveDaColuna(c.aba, c.coluna))
            : leitura.valores.map((v) => String(v.indice))
        )
      )
      setEtapa({ tipo: 'pronto', nome: arquivo.name, endereco, leitura })
    } catch (e) {
      setEtapa({ tipo: 'vazio' })
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o arquivo.')
    }
  }

  async function gerar() {
    if (etapa.tipo !== 'pronto') return
    setGerando(true)
    setErro(null)
    const selecao =
      etapa.leitura.tipo === 'planilha'
        ? { colunas: etapa.leitura.colunas.filter((c) => marcadas.has(chaveDaColuna(c.aba, c.coluna))).map(({ aba, coluna, linhaCabecalho }) => ({ aba, coluna, linhaCabecalho })) }
        : { valores: etapa.leitura.valores.filter((v) => marcadas.has(String(v.indice))).map((v) => v.indice) }
    const r = await fetch('/api/reajuste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endereco: etapa.endereco, nomeArquivo: etapa.nome, inicial, final, ...selecao }),
    })
    const corpo = await r.json().catch(() => null)
    setGerando(false)
    if (!r.ok) return setErro(corpo?.error ?? 'Falha ao gerar.')
    setGerado(corpo.id)
  }

  const podeGerar = etapa.tipo === 'pronto' && calculo?.ok && marcadas.size > 0 && !gerando

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 lg:px-8">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Reajuste IPC-Fipe</h1>
        <p className="text-sm text-mid-grey">Corrija os valores de uma planilha, PDF ou Word pelo IPC-Fipe acumulado.</p>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold text-navy">1. Arquivo</h2>
        <label className="flex flex-col gap-1 text-sm">
          Arquivo
          <input
            aria-label="Arquivo"
            type="file"
            accept=".xlsx,.csv,.pdf,.docx"
            onChange={(e) => e.target.files?.[0] && escolher(e.target.files[0])}
          />
        </label>
        {etapa.tipo === 'lendo' && (
          <p className="flex items-center gap-2 text-sm text-mid-grey"><Loader2 className="size-4 animate-spin" /> Lendo {etapa.nome}…</p>
        )}
        {etapa.tipo === 'pronto' && etapa.leitura.tipo === 'texto' && (
          <p className="text-xs text-mid-grey">PDF e Word não são reescritos: o resultado é uma planilha com cada valor original e corrigido.</p>
        )}
      </section>

      {meses && inicial && (
        <Periodo indice={indice} meses={meses.map((m) => m.mes)} inicial={inicial} final={final} onMudar={(i, f) => { setInicial(i); setFinal(f); setGerado(null) }} />
      )}

      {etapa.tipo === 'pronto' && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-semibold text-navy">3. Valores</h2>
          <Selecao leitura={etapa.leitura} fator={fator} marcadas={marcadas} onMudar={setMarcadas} />
          <div className="flex items-center gap-3">
            <button type="button" className={BTN_PRIMARY} disabled={!podeGerar} onClick={gerar}>
              {gerando ? 'Gerando…' : 'Gerar planilha'}
            </button>
            {gerado && (
              <>
                <a className={BTN_OUTLINE} href={`/api/reajuste/${gerado}/arquivo/resultado`}>
                  <Download className="size-4" /> Baixar resultado
                </a>
                <Link className={LINK_NAVY} href="/reajuste/historico">Ver no histórico</Link>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
```

Nota: `Decimal` importado em `page.tsx` só se for usado; remova o import se o lint reclamar.

- [ ] **Step 6: Rodar e ver passar** — `npx jest src/app/reajuste` → PASS.

- [ ] **Step 7: Commit** — `src/app/reajuste/page.tsx`, `periodo.tsx`, `selecao.tsx`, `page.test.tsx`. Mensagem: `feat(reajuste): tela de correção por IPC-Fipe`.

---

### Task 9: Histórico (`/reajuste/historico`)

**Files:**
- Create: `src/app/reajuste/historico/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `GET /api/reajuste` (shape da Task 6), `nomeDoMes`.

- [ ] **Step 1: Teste que falha**

```tsx
import { render, screen } from '@testing-library/react'
import HistoricoReajustePage from './page'

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r1', nomeArquivo: 'itens.xlsx', tipoArquivo: 'xlsx', mesInicial: '2025-09', mesFinal: '2026-08', acumuladoPct: '3.55', fator: '1.035543', quantidadeValores: 12, usuario: 'Fulano', createdAt: '2026-09-30T15:00:00.000Z' },
      ]),
    })
  ) as unknown as typeof fetch
})

it('lista cada reajuste com período, acumulado e os dois downloads', async () => {
  render(<HistoricoReajustePage />)
  expect(await screen.findByText('itens.xlsx')).toBeInTheDocument()
  expect(screen.getByText('set/2025 a ago/2026')).toBeInTheDocument()
  expect(screen.getByText('3,55 %')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Original' })).toHaveAttribute('href', '/api/reajuste/r1/arquivo/original')
  expect(screen.getByRole('link', { name: 'Resultado' })).toHaveAttribute('href', '/api/reajuste/r1/arquivo/resultado')
})

it('lista vazia avisa', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
  render(<HistoricoReajustePage />)
  expect(await screen.findByText(/Nenhum reajuste ainda/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/reajuste/historico` → FAIL.

- [ ] **Step 3: Implementar**

```tsx
'use client'

// Histórico do reajuste por IPC-Fipe (spec §2.4): todo mundo vê tudo, como no ConfereAI.
import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { nomeDoMes } from '@/lib/reajuste/meses'
import { LINK_NAVY } from '@/lib/ui'

interface Execucao {
  id: string
  nomeArquivo: string
  tipoArquivo: string
  mesInicial: string
  mesFinal: string
  acumuladoPct: string
  fator: string
  quantidadeValores: number
  usuario: string
  createdAt: string
}

const pct = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function HistoricoReajustePage() {
  const [lista, setLista] = useState<Execucao[] | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetch('/api/reajuste')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(setLista)
      .catch(() => setErro(true))
  }, [])

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Reajuste IPC-Fipe</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Histórico</span>
        </nav>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Histórico de reajustes</h1>
      </div>
      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível carregar o histórico.</p>}
      {lista?.length === 0 && <p className="text-sm text-mid-grey">Nenhum reajuste ainda.</p>}
      {lista && lista.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-mid-grey">
              <th className="py-2">Quando</th>
              <th className="py-2">Quem</th>
              <th className="py-2">Arquivo</th>
              <th className="py-2">Período</th>
              <th className="py-2 text-right">Acumulado</th>
              <th className="py-2 text-right">Valores</th>
              <th className="py-2">Baixar</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="py-1.5">{new Date(e.createdAt).toLocaleString('pt-BR')}</td>
                <td className="py-1.5">{e.usuario}</td>
                <td className="py-1.5 text-navy">{e.nomeArquivo}</td>
                <td className="py-1.5">{`${nomeDoMes(e.mesInicial)} a ${nomeDoMes(e.mesFinal)}`}</td>
                <td className="py-1.5 text-right tabular-nums">{`${pct(e.acumuladoPct)} %`}</td>
                <td className="py-1.5 text-right tabular-nums">{e.quantidadeValores}</td>
                <td className="space-x-3 py-1.5">
                  <a className={LINK_NAVY} href={`/api/reajuste/${e.id}/arquivo/original`}>Original</a>
                  <a className={LINK_NAVY} href={`/api/reajuste/${e.id}/arquivo/resultado`}>Resultado</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/app/reajuste` → PASS.

- [ ] **Step 5: Commit** — `src/app/reajuste/historico/*`. Mensagem: `feat(reajuste): histórico de reajustes`.

---

### Task 10: Verificação no dev, documentação

**Files:**
- Modify: `CLAUDE.md` (seção nova curta "Reajuste por IPC-Fipe")
- Modify: `docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md` (envio reaproveita a rota da Nova conversão; status "implementado no dev")

- [ ] **Step 1: Suite, tipos e lint**

Run: `npx jest src/lib/reajuste src/app/reajuste src/app/api/reajuste src/components/nav-bar.test.tsx`, `npx tsc --noEmit`, `npx eslint src/lib/reajuste src/app/reajuste src/app/api/reajuste src/components/nav-bar.tsx`.
Expected: tudo verde, sem erro de tipo novo.

- [ ] **Step 2: No navegador (dev)** — `preview_start` do dev, logado:
  1. Menu mostra "Reajuste IPC-Fipe" depois do ConfereAI, com Histórico e Tabela do índice.
  2. Tabela do índice: "Atualizar agora" → ago/2026 com 0,01 e acumulado 3,55.
  3. `/reajuste`: sugestão set/2025 a ago/2026, 3,55 %. Enviar uma planilha real de `arquivos-teste-conversao/` (ou uma de itens de contrato) → colunas sugeridas → Gerar → baixar e abrir o XLSX: colunas "corrigido" no fim, aba "Reajuste IPC-Fipe", fórmulas intactas.
  4. Enviar um PDF de proposta real → valores com trecho → desmarcar um → Gerar → planilha de comparação.
  5. Histórico lista os dois com os downloads funcionando.
  6. Mudar o mês final para set/2026 (não publicado) → aviso e Gerar desabilitado.
  Screenshot de cada tela para o usuário.

- [ ] **Step 3: CLAUDE.md** — acrescentar depois da seção do Confere:

```markdown
## Reajuste por IPC-Fipe

Grupo próprio no menu (`/reajuste`, `/reajuste/historico`, `/reajuste/indice`). Índice: série **193** do
SGS do Banco Central (pública, pede `User-Agent`), guardada em `IndiceIpcFipe` por cron diário
(`/api/reajuste/indice/cron`) e botão "Atualizar agora"; mês gravado nunca é sobrescrito (vira
divergência). Período editável (sugestão: últimos 12 publicados); conta em `decimal.js`, arredonda só o
valor final. Planilha volta com colunas "corrigido" depois da última usada; PDF/DOCX nunca é reescrito
— volta planilha de comparação. Original e resultado no R2 (`reajustes/<id>/`), histórico em
`ReajusteExecucao`. Regras em `src/lib/reajuste/`. Spec
`docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md`.
```

- [ ] **Step 4: Atualizar o spec** — §2.2 passo 1: "rota `POST /api/reajuste/envio` reexporta a da Nova conversão"; status no topo: "implementado no dev (data)".

- [ ] **Step 5: Commit** — `CLAUDE.md`, spec. Mensagem: `docs(reajuste): CLAUDE.md e andamento`.

- [ ] **Step 6: Produção (fora deste plano, com ok do usuário)** — subir as migrações `20260930100000_indice_ipc_fipe` e `20260930110000_reajuste_execucao`, deploy, `POST /api/reajuste/indice` uma vez em produção (confirma o acesso da Vercel ao Banco Central) e conferir que o cron aparece no painel da Vercel.
