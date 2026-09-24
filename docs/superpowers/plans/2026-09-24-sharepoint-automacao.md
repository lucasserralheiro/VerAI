# SharePoint sempre em dia — automação da sincronização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sincronização do SharePoint roda sozinha do PC do Lucas a cada 30 min e o VerAI mostra, para todos, se ela está em dia — com painel para o admin e e-mail quando parar.

**Architecture:** O script `scripts/sincronizar-sharepoint.ts` passa a registrar cada execução na tabela `ExecucaoSharepoint` (produção). Uma regra pura (`estadoDaSincronizacao`, horas úteis) transforma esses registros em nível verde/amarelo/vermelho, usada pelo selo da aba Documentos, pelo painel `/admin/sharepoint` e por um cron diário que avisa por e-mail. O Agendador do Windows é instalado por um `.ps1` versionado, sem administrador.

**Tech Stack:** Next.js 15 App Router, Prisma 6/Postgres, Jest + Testing Library, PowerShell 5.1 (ScheduledTasks), Resend (`src/lib/email.ts`).

## Global Constraints

- Spec manda: `docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md`. Onde plano e spec divergirem, pare e pergunte.
- Roda **sempre do PC do Lucas** (decisão do usuário, 24/09/2026). Nada de Graph API nem servidor lendo o SharePoint.
- Migração nova com carimbo **maior** que o último em `prisma/migrations` (hoje `20260924170000`). Conferir o SQL: se aparecer `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`, **remover a linha**.
- Registro de execução é **best-effort**: erro ao gravar o registro nunca derruba a sincronização.
- Horas úteis = seg–sex, 7h–20h, horário de Brasília (UTC−3 fixo). Limites: atrasada > 2 h úteis, parada > 8 h úteis; `andamento` há mais de 2 h = interrompida; `com-erro` = as **duas** execuções concluídas mais recentes falharam.
- Outras sessões commitam na `main`: `git add` só os arquivos da task, **nunca** `git add -A` / `git commit -a`.
- Produção, Vercel e Agendador do Windows: **ok explícito do usuário antes de cada passo**.
- Testes: `npx jest <caminho>`. Tipos: `npx tsc --noEmit -p .` sem erro novo (base: `faturamentos/route.ts`, `contratos/[contratoId]/page.test.tsx` ×2, `assistente/ferramentas/comum.test.ts` ×2).
- Comentários, nomes e mensagens em português, no estilo dos arquivos vizinhos.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` + migração `…_execucao_sharepoint` | model `ExecucaoSharepoint` |
| `src/lib/arquivos/sharepoint/estado.ts` (+ teste) | puro: horas úteis, nível, rótulo do selo |
| `src/lib/arquivos/sharepoint/execucoes.ts` (+ teste) | situação/pendências/resumo de um resultado; gravar início, fim, falha; limpeza |
| `scripts/sincronizar-sharepoint.ts` | registra a execução, checa OneDrive, auditoria completa 1×/dia |
| `src/app/api/sharepoint/estado/route.ts` (+ teste) | nível para qualquer usuário logado |
| `src/components/sharepoint/selo-sincronizacao.tsx` (+ teste) | selo na aba Documentos |
| `src/app/api/admin/sharepoint/route.ts` (+ teste), `src/app/admin/sharepoint/page.tsx`, `src/components/nav-bar.tsx` | painel do admin |
| `src/app/api/sharepoint/verificar/cron/route.ts` (+ teste), `src/middleware.ts`, `vercel.json` | e-mail quando parar |
| `scripts/agendador-sharepoint.ps1`, `scripts/sincronizar-sharepoint.bat` | agendador sem janela, log girando |

---

### Task 1: Tabela `ExecucaoSharepoint`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<carimbo>_execucao_sharepoint/migration.sql`

**Interfaces:**
- Produces: `prisma.execucaoSharepoint` com os campos abaixo; `situacao` é `'andamento' | 'ok' | 'atencao' | 'erro'`.

- [ ] **Step 1: Model** — no fim do bloco do SharePoint em `prisma/schema.prisma` (perto de `model ArquivoSharepoint`):

```prisma
/// Uma execução de scripts/sincronizar-sharepoint.ts com --aplicar (spec 2026-09-24-sharepoint-automacao §5).
/// Log técnico: a própria sincronização apaga o que passa de 90 dias.
model ExecucaoSharepoint {
  id                String    @id @default(cuid())
  iniciadaEm        DateTime  @default(now())
  terminadaEm       DateTime?
  maquina           String
  situacao          String // andamento | ok | atencao | erro
  resumo            Json?
  pendencias        Json?
  achados           Json?
  auditoriaCompleta Boolean   @default(false)
  mensagem          String?

  @@index([iniciadaEm])
}
```

- [ ] **Step 2: Migração** — `npx dotenv -e .env.development -- npx prisma migrate dev --create-only --name execucao_sharepoint`; renomeie a pasta para um carimbo maior que o último em `prisma/migrations`; confira que o SQL só tem `CREATE TABLE "ExecucaoSharepoint"` + o índice (remova `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"` se aparecer); aplique com `npx dotenv -e .env.development -- npx prisma migrate dev`.
Expected: `Your database is now in sync with your schema.` (se o `prisma generate` der EPERM, pare o servidor de dev e rode `npx prisma generate`).

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/*_execucao_sharepoint
git commit -m "feat(sharepoint): tabela de execuções da sincronização"
```

---

### Task 2: Regra única do "em dia" (pura)

**Files:**
- Create: `src/lib/arquivos/sharepoint/estado.ts`
- Test: `src/lib/arquivos/sharepoint/estado.test.ts`

**Interfaces:**
- Produces:
  - `type SituacaoExecucao = 'andamento' | 'ok' | 'atencao' | 'erro'`
  - `interface ExecucaoResumida { iniciadaEm: Date; terminadaEm: Date | null; situacao: SituacaoExecucao; mensagem: string | null }`
  - `type NivelSincronizacao = 'em-dia' | 'atencao' | 'atrasada' | 'parada' | 'com-erro' | 'nunca'`
  - `interface EstadoSincronizacao { nivel: NivelSincronizacao; ultimaOkEm: Date | null; motivo: string | null }`
  - `horasUteisEntre(de: Date, ate: Date): number`
  - `estadoDaSincronizacao(execucoes: ExecucaoResumida[], agora: Date): EstadoSincronizacao`
  - `rotuloDoEstado(estado: EstadoSincronizacao, agora: Date): string`

- [ ] **Step 1: Teste falhando**

```ts
import { estadoDaSincronizacao, horasUteisEntre, rotuloDoEstado, type ExecucaoResumida } from './estado'

// Horários em Brasília (UTC−3): 2026-09-24 é quinta-feira.
const br = (iso: string) => new Date(`${iso}-03:00`)
const exec = (fim: string, situacao: ExecucaoResumida['situacao'] = 'ok', mensagem: string | null = null): ExecucaoResumida => ({
  iniciadaEm: br(fim), terminadaEm: situacao === 'andamento' ? null : br(fim), situacao, mensagem,
})

describe('horasUteisEntre', () => {
  it('conta só seg–sex das 7h às 20h', () => {
    expect(horasUteisEntre(br('2026-09-24T10:00:00'), br('2026-09-24T12:30:00'))).toBe(2.5)
    expect(horasUteisEntre(br('2026-09-24T19:00:00'), br('2026-09-25T08:00:00'))).toBe(2) // 1 h quinta + 1 h sexta
    expect(horasUteisEntre(br('2026-09-25T18:00:00'), br('2026-09-28T07:30:00'))).toBe(2.5) // fim de semana não conta
    expect(horasUteisEntre(br('2026-09-24T12:00:00'), br('2026-09-24T10:00:00'))).toBe(0)
  })
})

describe('estadoDaSincronizacao', () => {
  const agora = br('2026-09-24T15:00:00')

  it('nenhuma execução → nunca', () => {
    expect(estadoDaSincronizacao([], agora).nivel).toBe('nunca')
  })

  it('OK há 30 min → em dia; com atenção → atenção', () => {
    expect(estadoDaSincronizacao([exec('2026-09-24T14:30:00')], agora)).toEqual({ nivel: 'em-dia', ultimaOkEm: br('2026-09-24T14:30:00'), motivo: null })
    expect(estadoDaSincronizacao([exec('2026-09-24T14:30:00', 'atencao')], agora).nivel).toBe('atencao')
  })

  it('PC desligado à noite e no fim de semana não alarma; um dia útil sem rodar é parada', () => {
    expect(estadoDaSincronizacao([exec('2026-09-25T19:30:00')], br('2026-09-28T07:40:00')).nivel).toBe('em-dia')
    expect(estadoDaSincronizacao([exec('2026-09-24T11:00:00')], agora).nivel).toBe('atrasada')
    expect(estadoDaSincronizacao([exec('2026-09-23T15:00:00')], agora).nivel).toBe('parada')
  })

  it('uma falha isolada não alarma; duas seguidas → com erro, com a mensagem', () => {
    const umaFalha = [exec('2026-09-24T14:30:00', 'erro', 'R2 502'), exec('2026-09-24T14:00:00')]
    expect(estadoDaSincronizacao(umaFalha, agora).nivel).toBe('em-dia')
    const duas = [exec('2026-09-24T14:30:00', 'erro', 'senha do banco'), exec('2026-09-24T14:00:00', 'erro', 'x'), exec('2026-09-24T13:30:00')]
    expect(estadoDaSincronizacao(duas, agora)).toEqual({ nivel: 'com-erro', ultimaOkEm: br('2026-09-24T13:30:00'), motivo: 'senha do banco' })
  })

  it('"andamento" há mais de 2 h conta como falha; em andamento recente é ignorada', () => {
    const presa = [exec('2026-09-24T12:00:00', 'andamento'), exec('2026-09-24T11:30:00', 'erro', 'x'), exec('2026-09-24T14:50:00')]
    expect(estadoDaSincronizacao(presa, agora).nivel).toBe('em-dia') // a mais recente concluída (14:50) é OK
    const rodando = [exec('2026-09-24T14:55:00', 'andamento'), exec('2026-09-24T14:30:00')]
    expect(estadoDaSincronizacao(rodando, agora).nivel).toBe('em-dia')
  })
})

it('rotuloDoEstado fala a língua de quem lê', () => {
  const agora = br('2026-09-24T15:00:00')
  expect(rotuloDoEstado({ nivel: 'em-dia', ultimaOkEm: br('2026-09-24T14:48:00'), motivo: null }, agora)).toBe('SharePoint atualizado há 12 min')
  expect(rotuloDoEstado({ nivel: 'atencao', ultimaOkEm: br('2026-09-24T12:00:00'), motivo: null }, agora)).toBe('SharePoint atualizado há 3 h · com pendências')
  expect(rotuloDoEstado({ nivel: 'parada', ultimaOkEm: br('2026-09-23T18:05:00'), motivo: null }, agora)).toBe('SharePoint sem atualizar desde 23/09 18:05')
  expect(rotuloDoEstado({ nivel: 'com-erro', ultimaOkEm: null, motivo: 'senha do banco' }, agora)).toBe('Sincronização do SharePoint com erro: senha do banco')
  expect(rotuloDoEstado({ nivel: 'nunca', ultimaOkEm: null, motivo: null }, agora)).toBe('SharePoint ainda não sincronizado')
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/arquivos/sharepoint/estado.test.ts` → `Cannot find module './estado'`.

- [ ] **Step 3: Implementação**

```ts
// Quando a sincronização do SharePoint está "em dia" — UMA regra, usada pelo selo da aba Documentos,
// pelo painel do admin e pelo aviso por e-mail (spec docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md §6.1).
// Conta horas ÚTEIS: o PC do Lucas desligado à noite e no fim de semana não é alarme.

export type SituacaoExecucao = 'andamento' | 'ok' | 'atencao' | 'erro'

export interface ExecucaoResumida {
  iniciadaEm: Date
  terminadaEm: Date | null
  situacao: SituacaoExecucao
  mensagem: string | null
}

export type NivelSincronizacao = 'em-dia' | 'atencao' | 'atrasada' | 'parada' | 'com-erro' | 'nunca'

export interface EstadoSincronizacao {
  nivel: NivelSincronizacao
  ultimaOkEm: Date | null
  motivo: string | null
}

const HORA = 3_600_000
const DIA = 24 * HORA
/** Brasília, sem horário de verão desde 2019 — o servidor da Vercel roda em UTC. */
const FUSO = -3 * HORA
const INICIO_EXPEDIENTE = 7
const FIM_EXPEDIENTE = 20
export const LIMITE_ATRASADA_HORAS = 2
export const LIMITE_PARADA_HORAS = 8
const INTERROMPIDA_APOS = 2 * HORA

/** Horas de seg–sex, 7h–20h (Brasília) entre dois instantes. Feriado conta como dia útil. */
export function horasUteisEntre(de: Date, ate: Date): number {
  const a = de.getTime() + FUSO
  const b = ate.getTime() + FUSO
  if (b <= a) return 0
  let total = 0
  for (let dia = Math.floor(a / DIA) * DIA; dia < b; dia += DIA) {
    const semana = new Date(dia).getUTCDay()
    if (semana === 0 || semana === 6) continue
    const inicio = Math.max(a, dia + INICIO_EXPEDIENTE * HORA)
    const fim = Math.min(b, dia + FIM_EXPEDIENTE * HORA)
    if (fim > inicio) total += fim - inicio
  }
  return total / HORA
}

export function estadoDaSincronizacao(execucoes: ExecucaoResumida[], agora: Date): EstadoSincronizacao {
  // "andamento" antigo = o PC desligou no meio: vira falha. "andamento" recente ainda não conta.
  const concluidas = [...execucoes]
    .sort((x, y) => y.iniciadaEm.getTime() - x.iniciadaEm.getTime())
    .map((e) =>
      e.situacao === 'andamento' && agora.getTime() - e.iniciadaEm.getTime() > INTERROMPIDA_APOS
        ? { ...e, situacao: 'erro' as const, mensagem: e.mensagem ?? 'interrompida (sem fim registrado)' }
        : e
    )
    .filter((e) => e.situacao !== 'andamento')
  if (concluidas.length === 0) return { nivel: 'nunca', ultimaOkEm: null, motivo: null }

  const ultimaOk = concluidas.find((e) => e.situacao === 'ok' || e.situacao === 'atencao') ?? null
  const ultimaOkEm = ultimaOk ? (ultimaOk.terminadaEm ?? ultimaOk.iniciadaEm) : null
  // Uma falha isolada (502 do R2) se resolve na próxima meia hora; duas seguidas é problema de verdade.
  if (concluidas[0].situacao === 'erro' && (concluidas[1]?.situacao === 'erro' || !ultimaOk)) {
    return { nivel: 'com-erro', ultimaOkEm, motivo: concluidas[0].mensagem }
  }
  const horas = horasUteisEntre(ultimaOkEm!, agora)
  if (horas > LIMITE_PARADA_HORAS) return { nivel: 'parada', ultimaOkEm, motivo: null }
  if (horas > LIMITE_ATRASADA_HORAS) return { nivel: 'atrasada', ultimaOkEm, motivo: null }
  if (ultimaOk!.situacao === 'atencao') return { nivel: 'atencao', ultimaOkEm, motivo: ultimaOk!.mensagem }
  return { nivel: 'em-dia', ultimaOkEm, motivo: null }
}

function dataHora(d: Date): string {
  const b = new Date(d.getTime() + FUSO)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${dois(b.getUTCDate())}/${dois(b.getUTCMonth() + 1)} ${dois(b.getUTCHours())}:${dois(b.getUTCMinutes())}`
}

function haQuanto(d: Date, agora: Date): string {
  const minutos = Math.max(0, Math.round((agora.getTime() - d.getTime()) / 60_000))
  return minutos < 60 ? `há ${minutos} min` : `há ${Math.floor(minutos / 60)} h`
}

export function rotuloDoEstado(estado: EstadoSincronizacao, agora: Date): string {
  switch (estado.nivel) {
    case 'nunca':
      return 'SharePoint ainda não sincronizado'
    case 'com-erro':
      return `Sincronização do SharePoint com erro: ${estado.motivo ?? 'sem mensagem'}`
    case 'em-dia':
      return `SharePoint atualizado ${haQuanto(estado.ultimaOkEm!, agora)}`
    case 'atencao':
      return `SharePoint atualizado ${haQuanto(estado.ultimaOkEm!, agora)} · com pendências`
    default:
      return `SharePoint sem atualizar desde ${dataHora(estado.ultimaOkEm!)}`
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/arquivos/sharepoint/estado.test.ts` → 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/arquivos/sharepoint/estado.ts src/lib/arquivos/sharepoint/estado.test.ts
git commit -m "feat(sharepoint): regra única de sincronização em dia (horas úteis)"
```

---

### Task 3: Registrar cada execução

**Files:**
- Create: `src/lib/arquivos/sharepoint/execucoes.ts`
- Test: `src/lib/arquivos/sharepoint/execucoes.test.ts`
- Modify: `scripts/sincronizar-sharepoint.ts`

**Interfaces:**
- Consumes: `ResultadoSincronizacao` (`src/lib/arquivos/sharepoint/sincronizar.ts`), `Achado` (`src/lib/importacao-sharepoint/auditoria.ts`), `auditarNoBanco(db, clienteIds)`.
- Produces:
  - `interface PendenciasExecucao { semCliente: Record<string, number>; falhas: Array<{ caminho: string; motivo: string }>; divergencias: Array<{ cliente: string; noSharepoint: number; noVerai: number; faltando: string[] }>; remocaoSuspensa: string | null; onedriveFora: boolean; semNomeOficial: string[] }`
  - `situacaoDaExecucao(r: ResultadoSincronizacao, onedriveRodando: boolean): 'ok' | 'atencao'`
  - `pendenciasDaExecucao(r, onedriveRodando): PendenciasExecucao`
  - `resumoDaExecucao(r): Record<string, number>`
  - `iniciarExecucao(db, maquina): Promise<string | null>`
  - `concluirExecucao(db, id, r, { onedriveRodando, auditoriaCompleta }): Promise<void>`
  - `falharExecucao(db, id, erro: unknown): Promise<void>`
  - `auditoriaCompletaFeitaHoje(db, agora): Promise<boolean>`
  - `limparExecucoesAntigas(db, agora): Promise<number>`

- [ ] **Step 1: Teste falhando**

```ts
import type { PrismaClient } from '@prisma/client'
import type { ResultadoSincronizacao } from './sincronizar'
import {
  auditoriaCompletaFeitaHoje, concluirExecucao, falharExecucao, iniciarExecucao, limparExecucoesAntigas,
  pendenciasDaExecucao, resumoDaExecucao, situacaoDaExecucao,
} from './execucoes'

/* eslint-disable @typescript-eslint/no-explicit-any */

const resultado = (r: Partial<ResultadoSincronizacao> = {}): ResultadoSincronizacao => ({
  listados: 1174, novos: 2, reaproveitados: 0, conteudoTrocado: 0, inalterados: 1172, ignorados: {}, semCliente: {},
  sumiramDaOrigem: 0, anexosSoltos: 0, removidos: 0, mantidosEmUso: [], falhas: [], remocaoSuspensa: null,
  clientes: { criados: [], renomeados: [], semNomeOficial: [] },
  contratos: { processados: 1, contratosCriados: 0, contratosCompletados: 0, linhasCriadas: 1, linhasCompletadas: 0, anexosLigados: 2, avisos: [] },
  conferencia: [{ cliente: 'SMIT', noSharepoint: 40, noVerai: 40, faltando: [] }], auditoria: [], ...r,
})

describe('situação e pendências', () => {
  it('tudo certo → ok', () => {
    expect(situacaoDaExecucao(resultado(), true)).toBe('ok')
  })

  it('divergência, remoção suspensa, falha de arquivo ou OneDrive fora → atenção', () => {
    expect(situacaoDaExecucao(resultado({ conferencia: [{ cliente: 'SMS', noSharepoint: 3, noVerai: 2, faltando: ['SMS/a.pdf'] }] }), true)).toBe('atencao')
    expect(situacaoDaExecucao(resultado({ remocaoSuspensa: 'listagem com 10 de 1174' }), true)).toBe('atencao')
    expect(situacaoDaExecucao(resultado({ falhas: [{ caminho: 'x', motivo: 'R2 502' }] }), true)).toBe('atencao')
    expect(situacaoDaExecucao(resultado(), false)).toBe('atencao')
  })

  it('pendências guardam só o que alguém precisa resolver (até 20 arquivos por cliente divergente)', () => {
    const faltando = Array.from({ length: 30 }, (_, i) => `SMS/${i}.pdf`)
    const p = pendenciasDaExecucao(resultado({ semCliente: { NOVA: 3 }, conferencia: [{ cliente: 'SMS', noSharepoint: 30, noVerai: 0, faltando }] }), false)
    expect(p.semCliente).toEqual({ NOVA: 3 })
    expect(p.divergencias[0].faltando).toHaveLength(20)
    expect(p.onedriveFora).toBe(true)
  })

  it('resumo são só contagens', () => {
    expect(resumoDaExecucao(resultado())).toMatchObject({ listados: 1174, novos: 2, removidos: 0, linhasCriadas: 1, anexosLigados: 2 })
  })
})

describe('gravação (best-effort)', () => {
  const banco = () => ({
    execucaoSharepoint: {
      create: jest.fn(async () => ({ id: 'e1' })), update: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn(async () => ({ count: 3 })),
    },
  }) as any

  it('inicia em andamento com o nome da máquina', async () => {
    const db = banco()
    expect(await iniciarExecucao(db as PrismaClient, 'PC-LUCAS')).toBe('e1')
    expect(db.execucaoSharepoint.create).toHaveBeenCalledWith({ data: { maquina: 'PC-LUCAS', situacao: 'andamento' }, select: { id: true } })
  })

  it('banco fora do ar ao registrar não derruba a sincronização', async () => {
    const db = banco()
    db.execucaoSharepoint.create.mockRejectedValue(new Error('conexão recusada'))
    expect(await iniciarExecucao(db as PrismaClient, 'PC')).toBeNull()
    db.execucaoSharepoint.update.mockRejectedValue(new Error('conexão recusada'))
    await expect(falharExecucao(db as PrismaClient, 'e1', new Error('x'))).resolves.toBeUndefined()
  })

  it('conclui com situação, contagens, pendências e achados', async () => {
    const db = banco()
    const achado = { tipo: 'ativo-sem-valor', cliente: 'SMS', contrato: 'TC 1/2025', detalhe: 'digitar' }
    await concluirExecucao(db as PrismaClient, 'e1', resultado({ auditoria: [achado as any] }), { onedriveRodando: true, auditoriaCompleta: true })
    expect(db.execucaoSharepoint.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: expect.objectContaining({ situacao: 'ok', auditoriaCompleta: true, achados: [achado], terminadaEm: expect.any(Date) }),
    })
  })

  it('falha guarda a mensagem do erro', async () => {
    const db = banco()
    await falharExecucao(db as PrismaClient, 'e1', new Error('senha do banco'))
    expect(db.execucaoSharepoint.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { situacao: 'erro', mensagem: 'senha do banco', terminadaEm: expect.any(Date) } })
  })

  it('auditoria completa: uma por dia (Brasília); limpeza apaga o que passa de 90 dias', async () => {
    const db = banco()
    db.execucaoSharepoint.findFirst.mockResolvedValue({ id: 'e0' })
    expect(await auditoriaCompletaFeitaHoje(db as PrismaClient, new Date('2026-09-24T10:00:00-03:00'))).toBe(true)
    expect(db.execucaoSharepoint.findFirst.mock.calls[0][0].where).toEqual({
      auditoriaCompleta: true, situacao: { in: ['ok', 'atencao'] }, iniciadaEm: { gte: new Date('2026-09-24T00:00:00-03:00') },
    })
    expect(await limparExecucoesAntigas(db as PrismaClient, new Date('2026-09-24T10:00:00Z'))).toBe(3)
    expect(db.execucaoSharepoint.deleteMany).toHaveBeenCalledWith({ where: { iniciadaEm: { lt: new Date('2026-06-26T10:00:00Z') } } })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/arquivos/sharepoint/execucoes.test.ts` → `Cannot find module './execucoes'`.

- [ ] **Step 3: Implementação**

```ts
import type { Prisma, PrismaClient } from '@prisma/client'
import type { ResultadoSincronizacao } from './sincronizar'

// Registro de cada execução da sincronização com --aplicar (spec 2026-09-24-sharepoint-automacao §5) —
// é o que deixa o VerAI saber, sem acesso ao PC, se o SharePoint está em dia. Tudo aqui é best-effort:
// erro ao gravar o registro sai no log e a sincronização segue.

export interface PendenciasExecucao {
  semCliente: Record<string, number>
  falhas: Array<{ caminho: string; motivo: string }>
  divergencias: Array<{ cliente: string; noSharepoint: number; noVerai: number; faltando: string[] }>
  remocaoSuspensa: string | null
  onedriveFora: boolean
  semNomeOficial: string[]
}

const MAX_FALTANDO_POR_CLIENTE = 20
const DIAS_GUARDADOS = 90
const FUSO = -3 * 3_600_000

export function pendenciasDaExecucao(r: ResultadoSincronizacao, onedriveRodando: boolean): PendenciasExecucao {
  return {
    semCliente: r.semCliente,
    falhas: r.falhas,
    divergencias: (r.conferencia ?? [])
      .filter((l) => l.faltando.length > 0)
      .map((l) => ({ ...l, faltando: l.faltando.slice(0, MAX_FALTANDO_POR_CLIENTE) })),
    remocaoSuspensa: r.remocaoSuspensa,
    onedriveFora: !onedriveRodando,
    semNomeOficial: r.clientes.semNomeOficial,
  }
}

export function situacaoDaExecucao(r: ResultadoSincronizacao, onedriveRodando: boolean): 'ok' | 'atencao' {
  const p = pendenciasDaExecucao(r, onedriveRodando)
  return p.divergencias.length > 0 || p.remocaoSuspensa || p.falhas.length > 0 || p.onedriveFora ? 'atencao' : 'ok'
}

export function resumoDaExecucao(r: ResultadoSincronizacao): Record<string, number> {
  const c = r.contratos
  return {
    listados: r.listados,
    novos: r.novos,
    conteudoTrocado: r.conteudoTrocado,
    sumiram: r.sumiramDaOrigem,
    removidos: r.removidos,
    contratosProcessados: c.processados,
    contratosCriados: c.contratosCriados,
    linhasCriadas: c.linhasCriadas,
    linhasCompletadas: c.linhasCompletadas,
    anexosLigados: c.anexosLigados,
  }
}

function avisar(etapa: string, erro: unknown) {
  console.error(`[execução SharePoint] não registrou ${etapa}: ${erro instanceof Error ? erro.message : erro}`)
}

export async function iniciarExecucao(db: PrismaClient, maquina: string): Promise<string | null> {
  try {
    const { id } = await db.execucaoSharepoint.create({ data: { maquina, situacao: 'andamento' }, select: { id: true } })
    return id
  } catch (erro) {
    avisar('o início', erro)
    return null
  }
}

export async function concluirExecucao(
  db: PrismaClient,
  id: string,
  r: ResultadoSincronizacao,
  opcoes: { onedriveRodando: boolean; auditoriaCompleta: boolean }
): Promise<void> {
  try {
    await db.execucaoSharepoint.update({
      where: { id },
      data: {
        terminadaEm: new Date(),
        situacao: situacaoDaExecucao(r, opcoes.onedriveRodando),
        resumo: resumoDaExecucao(r),
        pendencias: pendenciasDaExecucao(r, opcoes.onedriveRodando) as unknown as Prisma.InputJsonValue,
        achados: (r.auditoria ?? []) as unknown as Prisma.InputJsonValue,
        auditoriaCompleta: opcoes.auditoriaCompleta,
      },
    })
  } catch (erro) {
    avisar('o fim', erro)
  }
}

export async function falharExecucao(db: PrismaClient, id: string, erro: unknown): Promise<void> {
  try {
    await db.execucaoSharepoint.update({
      where: { id },
      data: { situacao: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro), terminadaEm: new Date() },
    })
  } catch (e) {
    avisar('a falha', e)
  }
}

/** Primeira execução do dia (Brasília) audita TODOS os clientes; as demais, só os tocados. */
export async function auditoriaCompletaFeitaHoje(db: PrismaClient, agora: Date): Promise<boolean> {
  const local = agora.getTime() + FUSO
  const meiaNoite = new Date(Math.floor(local / 86_400_000) * 86_400_000 - FUSO)
  const feita = await db.execucaoSharepoint.findFirst({
    where: { auditoriaCompleta: true, situacao: { in: ['ok', 'atencao'] }, iniciadaEm: { gte: meiaNoite } },
    select: { id: true },
  })
  return !!feita
}

export async function limparExecucoesAntigas(db: PrismaClient, agora: Date): Promise<number> {
  const limite = new Date(agora.getTime() - DIAS_GUARDADOS * 86_400_000)
  const { count } = await db.execucaoSharepoint.deleteMany({ where: { iniciadaEm: { lt: limite } } })
  return count
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/arquivos/sharepoint/execucoes.test.ts` → 9 passed.

- [ ] **Step 5: Ligar no script** — em `scripts/sincronizar-sharepoint.ts`:

Imports:
```ts
import { execFileSync } from 'node:child_process'
import { hostname } from 'node:os'
import {
  auditoriaCompletaFeitaHoje, concluirExecucao, falharExecucao, iniciarExecucao, limparExecucoesAntigas,
} from '../src/lib/arquivos/sharepoint/execucoes'
```
(junte `hostname` ao import existente de `node:os`: `import { hostname, tmpdir } from 'node:os'`.)

Função nova, antes de `main`:
```ts
/** OneDrive fechado = a pasta local para de acompanhar o SharePoint; a execução sai "com atenção". */
function onedriveRodando(): boolean {
  if (process.platform !== 'win32') return true
  try {
    return /OneDrive\.exe/i.test(execFileSync('tasklist', ['/fi', 'imagename eq OneDrive.exe', '/nh'], { encoding: 'utf8' }))
  } catch {
    return true // sem como saber: não inventa alarme
  }
}
```

Dentro de `main`, logo depois de `const destravar = travar()` e antes do `try` existente:
```ts
  const execucaoId = aplicar ? await iniciarExecucao(prisma, hostname()) : null
  const auditoriaCompleta = aplicar && !clientes && !(await auditoriaCompletaFeitaHoje(prisma, new Date()).catch(() => true))
```
Troque a opção `auditar` por:
```ts
      auditar: async (clienteIds) =>
        auditarNoBanco(prisma, auditoriaCompleta ? (await prisma.cliente.findMany({ select: { id: true } })).map((c) => c.id) : clienteIds),
```
Depois de gravar `logs/sharepoint-sincronizacao.json` (ainda dentro do `try`):
```ts
    if (execucaoId) {
      await concluirExecucao(prisma, execucaoId, r, { onedriveRodando: onedriveRodando(), auditoriaCompleta })
      await limparExecucoesAntigas(prisma, new Date()).catch(() => 0)
    }
```
E acrescente ao `try` um `catch` antes do `finally` existente:
```ts
  } catch (erro) {
    if (execucaoId) await falharExecucao(prisma, execucaoId, erro)
    throw erro
  } finally {
```

- [ ] **Step 6: Conferir em dev** — `npx dotenv -e .env.development -- npx tsx scripts/sincronizar-sharepoint.ts --aplicar --clientes=SMIT` → termina como antes; depois
`npx dotenv -e .env.development -- npx tsx -e "const {PrismaClient}=require('@prisma/client');new PrismaClient().execucaoSharepoint.findMany({orderBy:{iniciadaEm:'desc'},take:1}).then(x=>console.log(JSON.stringify(x,null,1)))"`
Expected: uma linha `situacao: "ok"`, `maquina` = nome do PC, `resumo.listados` > 0, `auditoriaCompleta: false` (tem `--clientes`). Sem `--clientes` a primeira do dia vem `auditoriaCompleta: true` com os achados de todos os clientes; anote o tempo total — se a auditoria completa passar de 60 s, registre no spec §5.

- [ ] **Step 7: Commit**

```bash
git add src/lib/arquivos/sharepoint/execucoes.ts src/lib/arquivos/sharepoint/execucoes.test.ts scripts/sincronizar-sharepoint.ts
git commit -m "feat(sharepoint): cada sincronização registra sua execução; auditoria completa uma vez por dia"
```

---

### Task 4: Selo na aba Documentos

**Files:**
- Create: `src/app/api/sharepoint/estado/route.ts`, `src/app/api/sharepoint/estado/route.test.ts`
- Create: `src/components/sharepoint/selo-sincronizacao.tsx`, `src/components/sharepoint/selo-sincronizacao.test.tsx`
- Modify: `src/app/clientes/[id]/abas/aba-documentos.tsx:56-58`

**Interfaces:**
- Consumes: `estadoDaSincronizacao`, `rotuloDoEstado`, `EstadoSincronizacao` (Task 2).
- Produces: `GET /api/sharepoint/estado` → `{ nivel, ultimaOkEm: string | null, motivo: string | null }`; `<SeloSincronizacao />`.

- [ ] **Step 1: Teste da rota (falhando)**

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { execucaoSharepoint: { findMany: jest.fn() } } }))

import { prisma } from '@/lib/prisma'
import { GET } from './route'

it('devolve o nível calculado das últimas execuções', async () => {
  const fim = new Date(Date.now() - 5 * 60_000)
  ;(prisma.execucaoSharepoint.findMany as jest.Mock).mockResolvedValue([{ iniciadaEm: fim, terminadaEm: fim, situacao: 'ok', mensagem: null }])
  const corpo = await (await GET()).json()
  expect(corpo).toEqual({ nivel: expect.any(String), ultimaOkEm: fim.toISOString(), motivo: null })
  expect(prisma.execucaoSharepoint.findMany).toHaveBeenCalledWith({
    orderBy: { iniciadaEm: 'desc' }, take: 20, select: { iniciadaEm: true, terminadaEm: true, situacao: true, mensagem: true },
  })
})
```
(O nível depende da hora em que o teste roda — horas úteis — por isso `expect.any(String)`; a regra em si está coberta na Task 2.)

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/api/sharepoint/estado` → módulo não encontrado.

- [ ] **Step 3: Rota**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { estadoDaSincronizacao, type ExecucaoResumida } from '@/lib/arquivos/sharepoint/estado'

/** Se a aba Documentos está em dia com o SharePoint — qualquer usuário logado (o middleware exige sessão). */
export async function GET() {
  const execucoes = await prisma.execucaoSharepoint.findMany({
    orderBy: { iniciadaEm: 'desc' },
    take: 20,
    select: { iniciadaEm: true, terminadaEm: true, situacao: true, mensagem: true },
  })
  return NextResponse.json(estadoDaSincronizacao(execucoes as ExecucaoResumida[], new Date()))
}
```

- [ ] **Step 4: Teste do selo (falhando)**

```tsx
import { render, screen } from '@testing-library/react'
import { SeloSincronizacao } from './selo-sincronizacao'

it('mostra o rótulo e a cor do nível', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ nivel: 'parada', ultimaOkEm: '2026-09-23T21:05:00.000Z', motivo: null }) })) as jest.Mock
  render(<SeloSincronizacao />)
  const selo = await screen.findByText('SharePoint sem atualizar desde 23/09 18:05')
  expect(selo.closest('[data-nivel]')).toHaveAttribute('data-nivel', 'parada')
})

it('sem resposta da rota não mostra nada', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as jest.Mock
  const { container } = render(<SeloSincronizacao />)
  await new Promise((r) => setTimeout(r, 0))
  expect(container).toBeEmptyDOMElement()
})
```

- [ ] **Step 5: Selo**

```tsx
'use client'

// Selo "SharePoint atualizado há X" — quem abre a aba Documentos sabe se pode confiar que está tudo lá
// (spec docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md §6.2).

import { useEffect, useState } from 'react'
import { rotuloDoEstado, type EstadoSincronizacao, type NivelSincronizacao } from '@/lib/arquivos/sharepoint/estado'

const COR: Record<NivelSincronizacao, string> = {
  'em-dia': 'bg-green-600',
  atencao: 'bg-amber-500',
  atrasada: 'bg-amber-500',
  parada: 'bg-red-600',
  'com-erro': 'bg-red-600',
  nunca: 'bg-mid-grey',
}

export function SeloSincronizacao() {
  const [estado, setEstado] = useState<EstadoSincronizacao | null>(null)

  useEffect(() => {
    fetch('/api/sharepoint/estado')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((e) => e && setEstado({ ...e, ultimaOkEm: e.ultimaOkEm ? new Date(e.ultimaOkEm) : null }))
      .catch(() => null)
  }, [])

  if (!estado) return null
  return (
    <span data-nivel={estado.nivel} className="inline-flex items-center gap-1.5 text-xs text-mid-grey">
      <span className={`size-2 rounded-full ${COR[estado.nivel]}`} aria-hidden />
      <span>{rotuloDoEstado(estado, new Date())}</span>
    </span>
  )
}
```

- [ ] **Step 6: Na aba Documentos** — em `aba-documentos.tsx`, importe `import { SeloSincronizacao } from '@/components/sharepoint/selo-sincronizacao'` e, logo depois do `<p>` com a contagem (linhas 56–58), acrescente `<SeloSincronizacao />`.

- [ ] **Step 7: Rodar e ver passar** — `npx jest src/app/api/sharepoint/estado src/components/sharepoint` → 3 passed. Na tela (dev): aba Documentos de SMIT mostra o selo verde depois da execução da Task 3.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/sharepoint/estado src/components/sharepoint "src/app/clientes/[id]/abas/aba-documentos.tsx"
git commit -m "feat(sharepoint): selo de sincronização em dia na aba Documentos"
```

---

### Task 5: Painel do administrador

**Files:**
- Create: `src/app/api/admin/sharepoint/route.ts`, `src/app/api/admin/sharepoint/route.test.ts`
- Create: `src/app/admin/sharepoint/page.tsx`
- Modify: `src/components/nav-bar.tsx:72-76` (`CONFIG_LINKS`)

**Interfaces:**
- Consumes: `estadoDaSincronizacao` (Task 2), `PendenciasExecucao` (Task 3), `ROTULO_ACHADO`, `Achado` (`src/lib/importacao-sharepoint/auditoria.ts`).
- Produces: `GET /api/admin/sharepoint` → `{ estado, execucoes: Array<{ id, iniciadaEm, terminadaEm, maquina, situacao, mensagem, resumo }>, pendencias: PendenciasExecucao | null, auditoria: { em: string, achados: Achado[] } | null }`.

- [ ] **Step 1: Teste da rota (falhando)**

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { execucaoSharepoint: { findMany: jest.fn(), findFirst: jest.fn() } } }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const req = () => new NextRequest('http://localhost/api/admin/sharepoint')
const fim = new Date('2026-09-24T17:30:00Z')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'admin' })
  ;(prisma.execucaoSharepoint.findMany as jest.Mock).mockResolvedValue([
    { id: 'e2', iniciadaEm: fim, terminadaEm: fim, maquina: 'PC', situacao: 'atencao', mensagem: null, resumo: { novos: 1 }, pendencias: { semCliente: { NOVA: 2 } } },
  ])
  ;(prisma.execucaoSharepoint.findFirst as jest.Mock).mockResolvedValue({ terminadaEm: fim, achados: [{ tipo: 'ativo-sem-valor', cliente: 'SMS', contrato: 'TC 1', detalhe: 'x' }] })
})

it('403 para quem não é admin', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', nome: 'B', email: 'b@x', role: 'responsavel' })
  expect((await GET(req())).status).toBe(403)
})

it('estado, execuções, pendências da última e a última auditoria completa', async () => {
  const corpo = await (await GET(req())).json()
  expect(corpo.execucoes).toHaveLength(1)
  expect(corpo.pendencias).toEqual({ semCliente: { NOVA: 2 } })
  expect(corpo.auditoria.achados).toHaveLength(1)
  expect(prisma.execucaoSharepoint.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { auditoriaCompleta: true, situacao: { in: ['ok', 'atencao'] } } }))
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/api/admin/sharepoint` → módulo não encontrado.

- [ ] **Step 3: Rota**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { estadoDaSincronizacao, type ExecucaoResumida } from '@/lib/arquivos/sharepoint/estado'

/** Painel da sincronização do SharePoint (spec 2026-09-24-sharepoint-automacao §6.3). */
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (usuario?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 })

  const execucoes = await prisma.execucaoSharepoint.findMany({
    orderBy: { iniciadaEm: 'desc' },
    take: 30,
    select: { id: true, iniciadaEm: true, terminadaEm: true, maquina: true, situacao: true, mensagem: true, resumo: true, pendencias: true },
  })
  const auditoria = await prisma.execucaoSharepoint.findFirst({
    where: { auditoriaCompleta: true, situacao: { in: ['ok', 'atencao'] } },
    orderBy: { iniciadaEm: 'desc' },
    select: { terminadaEm: true, achados: true },
  })
  const concluida = execucoes.find((e) => e.situacao !== 'andamento')
  return NextResponse.json({
    estado: estadoDaSincronizacao(execucoes as unknown as ExecucaoResumida[], new Date()),
    execucoes: execucoes.map(({ pendencias: _p, ...e }) => e),
    pendencias: concluida?.pendencias ?? null,
    auditoria: auditoria ? { em: auditoria.terminadaEm, achados: auditoria.achados ?? [] } : null,
  })
}
```

- [ ] **Step 4: Página** — `src/app/admin/sharepoint/page.tsx`, no padrão de `src/app/admin/clientes/page.tsx` (client component, `fetch` no `useEffect`):

```tsx
'use client'

// Painel da sincronização do SharePoint: está em dia? o que rodou? o que falta resolver?
// (spec docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md §6.3 e §8 — rotina semanal).

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { SeloSincronizacao } from '@/components/sharepoint/selo-sincronizacao'
import { ROTULO_ACHADO, type Achado, type TipoAchado } from '@/lib/importacao-sharepoint/auditoria'
import type { PendenciasExecucao } from '@/lib/arquivos/sharepoint/execucoes'

interface Execucao {
  id: string
  iniciadaEm: string
  terminadaEm: string | null
  maquina: string
  situacao: string
  mensagem: string | null
  resumo: Record<string, number> | null
}

interface Painel {
  execucoes: Execucao[]
  pendencias: PendenciasExecucao | null
  auditoria: { em: string; achados: Achado[] } | null
}

const SITUACAO: Record<string, string> = { andamento: 'rodando', ok: 'ok', atencao: 'com atenção', erro: 'erro' }
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const duracao = (e: Execucao) => (e.terminadaEm ? `${Math.round((+new Date(e.terminadaEm) - +new Date(e.iniciadaEm)) / 1000)} s` : '—')

export default function AdminSharepointPage() {
  const [painel, setPainel] = useState<Painel | null>(null)

  useEffect(() => {
    fetch('/api/admin/sharepoint').then(async (r) => r.ok && setPainel(await r.json()))
  }, [])

  const p = painel?.pendencias
  const achadosPorTipo = new Map<TipoAchado, Achado[]>()
  for (const a of painel?.auditoria?.achados ?? []) achadosPorTipo.set(a.tipo, [...(achadosPorTipo.get(a.tipo) ?? []), a])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-navy">
          <RefreshCw className="size-5" strokeWidth={2.25} /> Sincronização SharePoint
        </h1>
        <SeloSincronizacao />
      </div>

      {p && (
        <section className="space-y-1 text-sm">
          <h2 className="font-semibold text-navy">Pendências da última execução</h2>
          {p.onedriveFora && <p>OneDrive não estava rodando no PC — a pasta local pode estar velha.</p>}
          {p.remocaoSuspensa && <p>Remoção suspensa: {p.remocaoSuspensa}</p>}
          {Object.entries(p.semCliente).map(([pasta, n]) => (
            <p key={pasta}>Pasta sem cliente “{pasta}”: {n} arquivo(s) — mapear em scripts/sharepoint-clientes.json</p>
          ))}
          {p.semNomeOficial.length > 0 && <p>Cliente sem nome oficial: {p.semNomeOficial.join(', ')}</p>}
          {p.divergencias.map((d) => (
            <p key={d.cliente}>Divergência {d.cliente}: SharePoint {d.noSharepoint} · VerAI {d.noVerai}</p>
          ))}
          {p.falhas.map((f) => (
            <p key={f.caminho}>Falha {f.caminho}: {f.motivo}</p>
          ))}
        </section>
      )}

      {painel?.auditoria && (
        <section className="space-y-2 text-sm">
          <h2 className="font-semibold text-navy">Contas a revisar (auditoria de {hora(painel.auditoria.em)})</h2>
          {[...achadosPorTipo].map(([tipo, achados]) => (
            <details key={tipo}>
              <summary>{ROTULO_ACHADO[tipo]}: {achados.length}</summary>
              <ul className="ml-4 list-disc">
                {achados.map((a) => (
                  <li key={`${a.cliente}-${a.contrato}-${a.detalhe}`}>{a.cliente} {a.contrato} — {a.detalhe}</li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}

      <section className="text-sm">
        <h2 className="mb-2 font-semibold text-navy">Últimas execuções</h2>
        <table className="w-full text-left">
          <thead className="text-xs text-mid-grey">
            <tr><th>Início</th><th>Máquina</th><th>Situação</th><th>Duração</th><th>Novos</th><th>Removidos</th><th>Mensagem</th></tr>
          </thead>
          <tbody>
            {painel?.execucoes.map((e) => (
              <tr key={e.id} className="border-t border-light-grey">
                <td>{hora(e.iniciadaEm)}</td><td>{e.maquina}</td><td>{SITUACAO[e.situacao] ?? e.situacao}</td><td>{duracao(e)}</td>
                <td>{e.resumo?.novos ?? '—'}</td><td>{e.resumo?.removidos ?? '—'}</td><td>{e.mensagem ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
```
(Confira os nomes de token de cor em `src/app/globals.css` — `text-navy`, `text-mid-grey`, `border-light-grey` — e ajuste para os que existirem.)

- [ ] **Step 5: Menu** — em `src/components/nav-bar.tsx`, `CONFIG_LINKS` ganha `{ href: '/admin/sharepoint', label: 'Sincronização SharePoint', icon: RefreshCw }` (importe `RefreshCw` de `lucide-react`). Rode `npx jest src/components/nav-bar.test.tsx` — se algum teste contar os links de configuração, atualize a contagem.

- [ ] **Step 6: Rodar e ver passar** — `npx jest src/app/api/admin/sharepoint src/components/nav-bar.test.tsx`. Na tela (dev, como admin): `/admin/sharepoint` lista a execução da Task 3.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/sharepoint src/app/admin/sharepoint src/components/nav-bar.tsx src/components/nav-bar.test.tsx
git commit -m "feat(sharepoint): painel do admin com execuções, pendências e contas a revisar"
```

---

### Task 6: E-mail quando a sincronização parar

**Files:**
- Create: `src/app/api/sharepoint/verificar/cron/route.ts`, `src/app/api/sharepoint/verificar/cron/route.test.ts`
- Modify: `src/middleware.ts:5` (`PUBLIC_API_PREFIXES`), `vercel.json`

**Interfaces:**
- Consumes: `estadoDaSincronizacao`, `rotuloDoEstado` (Task 2), `enviarEmail(destinatario, assunto, corpo)` (`src/lib/email.ts`).
- Produces: `GET /api/sharepoint/verificar/cron` → `{ nivel, avisados: number }`.

- [ ] **Step 1: Teste falhando**

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({ prisma: { execucaoSharepoint: { findMany: jest.fn() }, usuario: { findMany: jest.fn() } } }))
jest.mock('@/lib/email', () => ({ enviarEmail: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { enviarEmail } from '@/lib/email'
import { GET } from './route'

const req = (auth?: string) => new NextRequest('http://localhost/api/sharepoint/verificar/cron', { headers: auth ? { authorization: auth } : {} })
const erro = (min: number) => ({ iniciadaEm: new Date(Date.now() - min * 60_000), terminadaEm: new Date(Date.now() - min * 60_000), situacao: 'erro', mensagem: 'senha do banco' })

beforeEach(() => {
  jest.clearAllMocks()
  process.env.CRON_SECRET = 's3'
  ;(prisma.usuario.findMany as jest.Mock).mockResolvedValue([{ email: 'admin@x' }])
})

it('401 sem o segredo do cron', async () => {
  expect((await GET(req())).status).toBe(401)
})

it('parada ou com erro → e-mail para cada admin', async () => {
  ;(prisma.execucaoSharepoint.findMany as jest.Mock).mockResolvedValue([erro(10), erro(40)])
  expect(await (await GET(req('Bearer s3'))).json()).toEqual({ nivel: 'com-erro', avisados: 1 })
  expect(enviarEmail).toHaveBeenCalledWith('admin@x', expect.stringContaining('SharePoint'), expect.stringContaining('senha do banco'))
  expect(prisma.usuario.findMany).toHaveBeenCalledWith({ where: { role: 'admin' }, select: { email: true } })
})

it('em dia → ninguém é avisado', async () => {
  const ok = new Date(Date.now() - 5 * 60_000)
  ;(prisma.execucaoSharepoint.findMany as jest.Mock).mockResolvedValue([{ iniciadaEm: ok, terminadaEm: ok, situacao: 'ok', mensagem: null }])
  expect((await (await GET(req('Bearer s3'))).json()).avisados).toBe(0)
  expect(enviarEmail).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/api/sharepoint/verificar` → módulo não encontrado.

- [ ] **Step 3: Rota**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarEmail } from '@/lib/email'
import { estadoDaSincronizacao, rotuloDoEstado, type ExecucaoResumida } from '@/lib/arquivos/sharepoint/estado'

/** Cron diário da Vercel (vercel.json) com `Authorization: Bearer $CRON_SECRET`: se a sincronização do
 *  SharePoint parou ou está falhando, avisa os admins por e-mail (spec 2026-09-24-sharepoint-automacao §6.4).
 *  Público no middleware — o segredo é a única porta. */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  const execucoes = await prisma.execucaoSharepoint.findMany({
    orderBy: { iniciadaEm: 'desc' },
    take: 20,
    select: { iniciadaEm: true, terminadaEm: true, situacao: true, mensagem: true },
  })
  const agora = new Date()
  const estado = estadoDaSincronizacao(execucoes as ExecucaoResumida[], agora)
  if (estado.nivel !== 'parada' && estado.nivel !== 'com-erro') return NextResponse.json({ nivel: estado.nivel, avisados: 0 })

  const admins = await prisma.usuario.findMany({ where: { role: 'admin' }, select: { email: true } })
  const painel = `${process.env.APP_URL ?? 'http://localhost:3000'}/admin/sharepoint`
  const corpo =
    `${rotuloDoEstado(estado, agora)}.\n\n` +
    'A aba Documentos e o histórico dos contratos podem estar desatualizados em relação ao SharePoint.\n' +
    'Confira no PC que roda a sincronização: ligado, logado, OneDrive aberto e sincronizando.\n\n' +
    `Painel: ${painel}`
  for (const { email } of admins) {
    try {
      await enviarEmail(email, 'VerAI — sincronização do SharePoint parada', corpo)
    } catch (erro) {
      console.error(`[sharepoint] falha ao avisar ${email}:`, erro)
    }
  }
  return NextResponse.json({ nivel: estado.nivel, avisados: admins.length })
}
```

- [ ] **Step 4: Middleware e cron** — em `src/middleware.ts`, `PUBLIC_API_PREFIXES` ganha `'/api/sharepoint/verificar/cron'`. Em `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/assistente/indexar/cron", "schedule": "0 9 * * *" },
    { "path": "/api/sharepoint/verificar/cron", "schedule": "0 11 * * 1-5" }
  ]
}
```
Antes do deploy, confira no painel da Vercel quantos crons o plano do projeto aceita; se só couber um, junte as duas chamadas numa rota só em vez de desligar o do assistente — **pergunte ao usuário**.

- [ ] **Step 5: Rodar e ver passar** — `npx jest src/app/api/sharepoint/verificar` → 3 passed. Se existir teste do middleware (`src/middleware.test.ts`), rode também.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/sharepoint/verificar src/middleware.ts vercel.json
git commit -m "feat(sharepoint): cron diário avisa os admins por e-mail quando a sincronização para"
```

---

### Task 7: Agendador do Windows e documentação

**Files:**
- Create: `scripts/agendador-sharepoint.ps1`
- Modify: `scripts/sincronizar-sharepoint.bat`
- Modify: `CLAUDE.md` (seção "Sincronização com o SharePoint"), `docs/superpowers/plans/2026-09-23-sharepoint-lugar-certo.md` (Task 14 Step 6), `docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md` (Status)

- [ ] **Step 1: Log girando no `.bat`** — antes da linha `echo. >> logs\sincronizar-sharepoint.log`:

```bat
REM Log acima de 5 MB vira .1.log (guarda só uma geração).
if exist logs\sincronizar-sharepoint.log for %%A in (logs\sincronizar-sharepoint.log) do if %%~zA GTR 5000000 move /y logs\sincronizar-sharepoint.log logs\sincronizar-sharepoint.1.log >nul
```

- [ ] **Step 2: `scripts/agendador-sharepoint.ps1`**

```powershell
<#
  Agendador do Windows para a sincronização do SharePoint (spec docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md §7).
  Tarefa do próprio usuário — não precisa de administrador. Roda só com o usuário logado (o OneDrive vive na sessão dele).

    powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Instalar
    powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Estado
    powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Remover
#>
param([switch]$Instalar, [switch]$Remover, [switch]$Estado)

$ErrorActionPreference = 'Stop'
$nome = 'VerAI - Sincronizar SharePoint'
$projeto = Split-Path $PSScriptRoot -Parent
$bat = Join-Path $PSScriptRoot 'sincronizar-sharepoint.bat'
$usuario = "$env:USERDOMAIN\$env:USERNAME"

if ($Instalar) {
  # conhost --headless: sem janela piscando a cada 30 min.
  $acao = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless cmd.exe /c `"$bat`"" -WorkingDirectory $projeto
  $aCada30 = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours(7) -RepetitionInterval (New-TimeSpan -Minutes 30)
  $config = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  $quem = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
  try {
    $logon = New-ScheduledTaskTrigger -AtLogOn -User $usuario
    Register-ScheduledTask -TaskName $nome -Action $acao -Trigger @($aCada30, $logon) -Settings $config -Principal $quem -Force | Out-Null
    Write-Output "Instalada: a cada 30 min e ao fazer logon."
  } catch {
    # Sem administrador o Windows pode recusar o gatilho de logon; "StartWhenAvailable" cobre o logon do mesmo jeito.
    Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $aCada30 -Settings $config -Principal $quem -Force | Out-Null
    Write-Output "Instalada: a cada 30 min (gatilho de logon recusado: $($_.Exception.Message))."
  }
}

if ($Remover) {
  Unregister-ScheduledTask -TaskName $nome -Confirm:$false
  Write-Output 'Removida.'
}

if ($Estado -or $Instalar) {
  $tarefa = Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
  if (-not $tarefa) { Write-Output 'Tarefa não instalada.'; exit 1 }
  $info = $tarefa | Get-ScheduledTaskInfo
  Write-Output "Situação: $($tarefa.State) · última: $($info.LastRunTime) (resultado $($info.LastTaskResult)) · próxima: $($info.NextRunTime)"
  $log = Join-Path $projeto 'logs\sincronizar-sharepoint.log'
  if (Test-Path $log) { Get-Content $log -Tail 5 }
}
```

- [ ] **Step 3: Conferir em dev (com ok do usuário — configuração persistente do Windows)** — troque temporariamente `ENV_FILE` do `.bat` para `.env.development`, rode `-Instalar`, confira `-Estado` (situação `Ready`, próxima em até 30 min), dispare `Start-ScheduledTask -TaskName 'VerAI - Sincronizar SharePoint'` e confirme: **nenhuma janela aparece**, o log ganha `TUDO NO VERAI`, e `/admin/sharepoint` mostra a execução nova. Se `conhost --headless` abrir janela ou não rodar, troque a ação por `cmd.exe /c "<bat>"` e registre no spec §7. Volte o `ENV_FILE` para `.env.production.local` e rode `-Remover` (a instalação de verdade é na produção, Step 5).

- [ ] **Step 4: Documentação**
  - `CLAUDE.md`, seção "Sincronização com o SharePoint": troque "Agendador de Tarefas, `scripts/sincronizar-sharepoint.bat`" por "Agendador do Windows instalado por `scripts/agendador-sharepoint.ps1` (a cada 30 min, do PC do Lucas — decisão do usuário)" e acrescente o item:
    `- **Nunca desatualizado em silêncio**: cada execução com --aplicar grava ExecucaoSharepoint; o nível (em dia / atrasada / parada / com erro) sai de UMA regra, estadoDaSincronizacao (src/lib/arquivos/sharepoint/estado.ts, horas úteis), usada pelo selo da aba Documentos, por /admin/sharepoint e pelo cron que avisa por e-mail. Spec docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md.`
  - Plano lugar-certo, Task 14 Step 6: substitua o `schtasks /create …` por `powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Instalar` e o `schtasks /query …` por `… -Estado`.
  - Spec de automação: Status → "implementado (aguardando produção)".

- [ ] **Step 5: Commit**

```bash
git add scripts/agendador-sharepoint.ps1 scripts/sincronizar-sharepoint.bat CLAUDE.md docs/superpowers/plans/2026-09-23-sharepoint-lugar-certo.md docs/superpowers/plans/2026-09-24-sharepoint-automacao.md docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md
git commit -m "feat(sharepoint): agendador do Windows versionado, sem janela e com log girando"
```

---

### Task 8: Produção (com o usuário, passo a passo)

Cada passo mexe em produção, na Vercel ou no Windows: **peça confirmação explícita antes de cada um**. Esta task substitui a ordem da Task 14 do plano lugar-certo (os comandos de lá continuam valendo).

- [ ] **Step 1:** Usuário: 4 variáveis `R2_*` na Vercel; `CRON_SECRET` já existe (cron do assistente) — confirmar; `RESEND_API_KEY`/`EMAIL_FROM` se quiser o e-mail; pasta da biblioteca com "Sempre manter neste dispositivo".
- [ ] **Step 2:** Deploy do código (este plano + lugar-certo) e `npx dotenv -e .env.production.local -- npx prisma migrate deploy` (Task 14 Steps 2–4 do lugar-certo, incluindo `migrar-sharepoint-lugar-certo.ts` listagem → `--aplicar`).
- [ ] **Step 3:** Primeira sincronização completa manual (Task 14 Step 5 do lugar-certo). Expected: `TUDO NO VERAI`; `/admin/sharepoint` com uma execução `ok` e `auditoriaCompleta`; selo verde na aba Documentos em produção.
- [ ] **Step 4:** `powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Instalar`. Depois de 30 min: `-Estado` com resultado `0` e segunda execução no painel.
- [ ] **Step 5:** Registrar: spec de automação → Status "em produção" com data; memória do projeto atualizada; commit só dos docs.
