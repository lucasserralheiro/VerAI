# "Documentos do SharePoint atualizados em …" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lista de clientes e a aba Documentos mostram quando os documentos vieram do SharePoint pela última vez ("Documentos do SharePoint atualizados em 28/09/2026 10:30"), em laranja quando passou de 2 h.

**Architecture:** No fim de cada passada completa (spec §3), `scripts/sincronizar-sharepoint.ts` grava uma linha em `AtualizacaoSharepoint` via `registrarAtualizacao()` (guarda pela migração, nunca lança). `GET /api/sharepoint/atualizacao` devolve a mais recente; o componente `<AtualizacaoSharepoint />` monta o texto com `textoDaAtualizacao()` e entra nas duas telas.

**Tech Stack:** Prisma 6/Postgres, Next.js 15 route handler, React 19, Jest + Testing Library, lucide-react.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-sharepoint-atualizado-em-design.md`. Divergiu, pare e pergunte.
- Migração escrita à mão; **nunca** `prisma migrate diff`/`migrate dev` com o banco de dev como shadow. Aplicar no dev com `npx dotenv -e .env.development -- npx prisma migrate deploy`.
- Produção (migração + deploy) só com ok do usuário, passo a passo.
- Outras sessões deixaram alterações não commitadas em `prisma/schema.prisma`, `src/app/clientes/lista-clientes.tsx` e `aba-documentos.test.tsx`: commitar **só os nossos trechos** (índice montado a partir do `HEAD` + nossa mudança, `git update-index --cacheinfo`); nunca `git add -A`/`commit -a`.
- Hora sempre no fuso `America/Sao_Paulo`, formato `dd/MM/aaaa HH:mm`.
- Comentários e textos em português, no estilo dos arquivos vizinhos.

---

### Task 1: Registro da passada no banco

**Files:**
- Modify: `prisma/schema.prisma` (model novo depois de `ArquivoSharepoint`)
- Create: `prisma/migrations/20260928120000_atualizacao_sharepoint/migration.sql`
- Create: `src/lib/arquivos/sharepoint/atualizacao.ts`
- Test: `src/lib/arquivos/sharepoint/atualizacao.test.ts`
- Modify: `scripts/sincronizar-sharepoint.ts` (depois da auditoria, antes do índice)

**Interfaces:**
- Produces: `motivoIncompleta(r, { aplicar, clientes? }): string | null`; `registrarAtualizacao(prisma, r, { aplicar, clientes?, iniciadaEm }, deps?): Promise<string>`; `MIGRACAO_DA_ATUALIZACAO`; `prisma.atualizacaoSharepoint` com `iniciadaEm: Date`.

- [ ] **Step 1: Model e migração**

```prisma
model AtualizacaoSharepoint {
  id          String   @id @default(cuid())
  iniciadaEm  DateTime
  concluidaEm DateTime @default(now())
  arquivos    Int

  @@index([iniciadaEm])
}
```

```sql
CREATE TABLE "AtualizacaoSharepoint" (
    "id" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivos" INTEGER NOT NULL,
    CONSTRAINT "AtualizacaoSharepoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AtualizacaoSharepoint_iniciadaEm_idx" ON "AtualizacaoSharepoint"("iniciadaEm");
```

Run: `npx prisma validate`, depois `npx dotenv -e .env.development -- npx prisma migrate deploy` e `npx prisma generate`.

- [ ] **Step 2: Teste falhando** — `atualizacao.test.ts`: `motivoIncompleta` devolve `null` para passada completa e o motivo para: só listagem, `clientes` preenchido, conferência `null`, divergência, remoção suspensa, falha de arquivo. `registrarAtualizacao` grava `{ iniciadaEm, arquivos: soma de noSharepoint }`; não grava quando incompleta; pula sem a migração; erro do banco vira texto (não lança).

- [ ] **Step 3: Rodar e ver falhar** — `npx jest src/lib/arquivos/sharepoint/atualizacao.test.ts` → FAIL (módulo não existe).

- [ ] **Step 4: Implementar `atualizacao.ts`**

```ts
export const MIGRACAO_DA_ATUALIZACAO = '20260928120000_atualizacao_sharepoint'

export function motivoIncompleta(r: Passada, opcoes: { aplicar: boolean; clientes?: string[] }): string | null {
  if (!opcoes.aplicar) return 'só listagem'
  if (opcoes.clientes?.length) return 'só parte dos clientes'
  if (!r.conferencia) return 'sem conferência'
  if (r.conferencia.some((l) => l.faltando.length > 0)) return 'conferência com divergência'
  if (r.remocaoSuspensa) return 'remoção suspensa'
  if (r.falhas.length > 0) return `${r.falhas.length} arquivo(s) com falha`
  return null
}

export async function registrarAtualizacao(prisma, r, opcoes, deps = { bancoPronto: () => migracaoAplicada(prisma, MIGRACAO_DA_ATUALIZACAO) }) {
  const motivo = motivoIncompleta(r, opcoes)
  if (motivo) return `data das telas: não atualizada — ${motivo}`
  try {
    if (!(await deps.bancoPronto())) return `data das telas: pulada — migração ${MIGRACAO_DA_ATUALIZACAO} não aplicada neste banco`
    const arquivos = r.conferencia!.reduce((s, l) => s + l.noSharepoint, 0)
    await prisma.atualizacaoSharepoint.create({ data: { iniciadaEm: opcoes.iniciadaEm, arquivos } })
    return `data das telas: atualizada (${opcoes.iniciadaEm.toLocaleString('pt-BR')})`
  } catch (erro) {
    return `data das telas: falhou — ${mensagem} (a próxima rodada tenta de novo)`
  }
}
```

- [ ] **Step 5: Rodar e ver passar**; ligar no script:

```ts
// Data que as telas mostram (spec 2026-09-28-sharepoint-atualizado-em). Não muda o código de saída.
console.log(`\n${await registrarAtualizacao(prisma, r, { aplicar, clientes, iniciadaEm: new Date(inicio) })}`)
```

- [ ] **Step 6: Commit** — `feat(sharepoint): grava a passada completa para as telas mostrarem a data`.

### Task 2: API e linha na tela

**Files:**
- Create: `src/app/api/sharepoint/atualizacao/route.ts` + `route.test.ts`
- Create: `src/lib/arquivos/sharepoint/atualizacao-texto.ts` + `.test.ts`
- Create: `src/components/sharepoint/atualizacao-sharepoint.tsx` + `.test.tsx`
- Modify: `src/app/clientes/lista-clientes.tsx` (+ teste), `src/app/clientes/[id]/abas/aba-documentos.tsx` (+ teste)

**Interfaces:**
- Consumes: `prisma.atualizacaoSharepoint` (Task 1).
- Produces: `GET /api/sharepoint/atualizacao` → `{ atualizadoEm: string | null }`; `textoDaAtualizacao(iso | null, agora): { texto, atrasada }`; `<AtualizacaoSharepoint className? />`.

- [ ] **Step 1: Testes falhando**
  - rota: 401 sem usuário; `{ atualizadoEm: iso }` da mais recente (`orderBy: { iniciadaEm: 'desc' }`); `null` sem linha.
  - texto: `2026-09-28T13:30:00Z` → "Documentos do SharePoint atualizados em 28/09/2026 10:30"; 2 h exatas não atrasa; 2 h e 1 min → "… — atualização atrasada"; `null` → "Ainda não sincronizado com o SharePoint" (atrasada); meia-noite sai "00:05", não "24:05".
  - componente: recente em cinza; atrasada em laranja (`text-orange-dark`); API com erro → nada.
  - telas: a linha aparece embaixo do título da lista e do resumo da aba.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** (rota com `getAuthUser` + `findFirst`; texto com `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hourCycle: 'h23', … }).formatToParts`; componente busca uma vez no `useEffect`, some se a resposta não trouxer `atualizadoEm`).
- [ ] **Step 4: Rodar e ver passar** — as suítes novas + `lista-clientes.test.tsx` + `aba-documentos.test.tsx`; `npx tsc --noEmit`.
- [ ] **Step 5: Conferir no localhost** — lista e aba Documentos, com o banco de dev.
- [ ] **Step 6: Commit** — `feat(sharepoint): "documentos atualizados em" na lista de clientes e na aba Documentos`.

### Task 3: Documentação

- [ ] CLAUDE.md, seção "Sincronização com o SharePoint": o selo existe (28/09), onde grava, o que conta como passada completa, guarda da migração.
- [ ] Memória `sharepoint-lugar-certo`: decisão de 24/09 revista.
- [ ] **Produção (com o usuário):** `prisma migrate deploy` no Neon + deploy. Até lá o agendador loga "pulada — migração … não aplicada" e o site não mostra a linha.
