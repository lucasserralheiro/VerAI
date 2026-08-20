# Redesign visual sóbrio (remove clichês de IA generation) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover os clichês visuais de "gerado por IA" (gradiente, glow colorido, blur/dot-grid decorativo, ícone-watermark, ícone-avatar por item de lista, micro-animação de scale/lift) e reestruturar navbar/marca pra deixar claro que VerAI é o guarda-chuva de mais de uma ferramenta, não só o módulo de análise de documentos.

**Architecture:** É uma passada de estilo, sem lógica de negócio nova. A maior parte do efeito vem de 3 arquivos-fonte compartilhados (tokens em `globals.css`, botões em `ui.ts`/`button.tsx`, badge em `badge.tsx`) — Tailwind v4 lê as variáveis `--radius-*` e `--shadow-*` desse `@theme inline`, então baixar `--radius`/simplificar `--shadow-*` já encolhe automaticamente todo `rounded-2xl`/`shadow-md`/etc. usado nas páginas, sem precisar editar cada ocorrência. O resto do trabalho é remoção pontual de markup decorativo (watermark, ícone-avatar, blob/dot-grid) por página.

**Tech Stack:** Next.js (App Router) + React + TypeScript + Tailwind CSS v4 + lucide-react + Jest/RTL.

## Global Constraints

- Não editar os PDFs gerados (`RelatorioDocument`, `ConsolidadoDocument`, `EvolucaoDocument`) — fora de escopo (spec, seção "Fora de escopo").
- Não mudar paleta de cor — navy/laranja Prodam permanece; só onde/quanto cada cor aparece (spec, princípios).
- Não adicionar `scale`/`brightness`/`translate-y` decorativo em hover/active de botão ou card (spec, princípio "Sem micro-interação decorativa").
- Sem gradiente e sem sombra com glow colorido em nenhum componente (spec, princípio "Flat, não glossy").
- Ícone só onde esclarece uma ação ambígua (baixar, excluir, ver, expandir/recolher) — nunca como elemento gráfico grande (spec, princípio "Ícone funcional, não decorativo").
- Esta é uma passada 100% visual/CSS — não há comportamento novo pra testar com testes unitários novos. Verificação por tarefa: `npm run lint`, os testes existentes que tocam o arquivo (`nav-bar.test.tsx`, `login/page.test.tsx`) continuam passando, e checagem visual manual ao final (spec, seção "Testes / verificação").
- Toda mudança de `rounded-2xl`/`rounded-xl`/`shadow-sm`/`shadow-md`/`shadow-lg`/`shadow-xl` já vem em cascata da Task 1 (tokens) — **não** reescrever essas classes literalmente nas páginas a menos que a tarefa diga explicitamente pra fazer isso.

---

## Task 1: Tokens de design (globals.css)

**Files:**
- Modify: `src/app/globals.css:71` (radius), `src/app/globals.css:121-127` (sombras), `src/app/globals.css:211-224` (`.card-interactive`, `.bg-dot-grid`, `.icon-watermark`)

**Interfaces:**
- Produces: escala `--radius`/`--radius-sm`…`--radius-4xl` e `--shadow-2xs`…`--shadow-xl` mais discretas, usadas por toda utility class `rounded-*`/`shadow-*` do app (Tailwind v4 lê essas variáveis do `@theme inline` do próprio arquivo). Remove as classes utilitárias `.bg-dot-grid` e `.icon-watermark` — nenhuma outra task deve reintroduzi-las.

- [ ] **Step 1: Reduzir a base do radius**

Em `src/app/globals.css`, dentro do bloco `:root`:

```css
  --navy: #002a4a;
```
(linha de contexto — não mexer)

Troque:
```css
  --radius: 0.85rem;
```
por:
```css
  --radius: 0.4rem;
```

- [ ] **Step 2: Simplificar a escala de sombra pra uma camada só**

Ainda em `:root`, troque o bloco:

```css
  /* Sombras suaves com tinta navy — dão profundidade sem pesar */
  --shadow-2xs: 0 1px 1px rgba(0, 20, 40, 0.03);
  --shadow-xs: 0 1px 2px rgba(0, 20, 40, 0.05);
  --shadow-sm: 0 1px 2px rgba(0, 20, 40, 0.04), 0 2px 6px -2px rgba(0, 20, 40, 0.06);
  --shadow-md: 0 4px 10px -4px rgba(0, 42, 74, 0.10), 0 8px 20px -6px rgba(0, 42, 74, 0.08);
  --shadow-lg: 0 8px 16px -6px rgba(0, 42, 74, 0.12), 0 20px 40px -12px rgba(0, 42, 74, 0.14);
  --shadow-xl: 0 16px 24px -8px rgba(0, 42, 74, 0.16), 0 28px 56px -16px rgba(0, 42, 74, 0.18);
```

por:

```css
  /* Sombra única e discreta — só onde há elevação real (modal, dropdown, sticky bar) */
  --shadow-2xs: 0 1px 1px rgba(0, 20, 40, 0.04);
  --shadow-xs: 0 1px 2px rgba(0, 20, 40, 0.06);
  --shadow-sm: 0 1px 3px rgba(0, 20, 40, 0.08);
  --shadow-md: 0 2px 6px rgba(0, 20, 40, 0.10);
  --shadow-lg: 0 4px 10px rgba(0, 20, 40, 0.12);
  --shadow-xl: 0 8px 16px rgba(0, 20, 40, 0.14);
```

- [ ] **Step 3: Remover a textura dot-grid e o watermark de ícone; tirar o lift do card interativo**

No `@layer utilities`, troque:

```css
  .card-interactive {
    @apply transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-orange/25 hover:shadow-md;
  }

  /* Textura de grade pontilhada — usada em heros/paineis navy */
  .bg-dot-grid {
    background-image: radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  /* Marca d'água decorativa de ícone em cartões de métrica — defina o size-* no uso */
  .icon-watermark {
    @apply pointer-events-none absolute -top-3 -right-3 text-white/[0.07];
  }

  /* Skeleton de carregamento com brilho suave */
```

por:

```css
  .card-interactive {
    @apply transition-all duration-200 ease-out hover:border-orange/25 hover:shadow-md;
  }

  /* Skeleton de carregamento com brilho suave */
```

- [ ] **Step 4: Rodar lint**

Run: `npm run lint`
Expected: sem erros (arquivo CSS não é alvo do eslint, mas garante que nada mais quebrou).

- [ ] **Step 5: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes existentes continuam passando (nenhum depende de `.bg-dot-grid`/`.icon-watermark`/radius/sombra).

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "style: reduz radius e simplifica sombras, remove dot-grid e icon-watermark"
```

---

## Task 2: Botões sem gradiente/glow/scale (ui.ts + button.tsx)

**Files:**
- Modify: `src/lib/ui.ts:6-16` (`BTN_PRIMARY`, `BTN_OUTLINE`, `BTN_OUTLINE_SM`)
- Modify: `src/components/ui/button.tsx:11-14` (`buttonVariants` — variants `default` e `outline`)

**Interfaces:**
- Consumes: nenhuma (task independente de Task 1, mas roda depois por ordem lógica).
- Produces: `BTN_PRIMARY`, `BTN_OUTLINE`, `BTN_OUTLINE_SM` (strings de classe, mesmos nomes exportados) e `buttonVariants` (mesma API `cva`) sem gradiente/glow/scale — todo consumidor existente (dashboard, clientes, documentos, admin/*) continua funcionando sem mudança de import.

- [ ] **Step 1: Simplificar os botões em `src/lib/ui.ts`**

Troque:

```ts
export const BTN_PRIMARY =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-[#ff7a34] to-orange px-3.5 py-2 text-sm font-semibold text-white shadow-[0_1px_1px_rgba(0,0,0,0.08),0_6px_16px_-6px_rgba(245,105,30,0.55)] transition-all duration-150 hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_10px_22px_-8px_rgba(245,105,30,0.6)] hover:brightness-[1.03] active:scale-[0.98] active:brightness-95 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none'

export const BTN_OUTLINE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-3.5 py-2 text-sm font-medium text-navy shadow-xs transition-all duration-150 hover:border-navy/35 hover:bg-navy/[0.04] hover:shadow-sm active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

export const BTN_OUTLINE_SM =
  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-navy/15 bg-white px-2.5 py-1 text-xs font-medium text-navy shadow-xs transition-all duration-150 hover:border-navy/35 hover:bg-navy/[0.04] active:scale-[0.98]'
```

por:

```ts
export const BTN_PRIMARY =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors duration-150 hover:bg-orange-dark disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none'

export const BTN_OUTLINE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-3.5 py-2 text-sm font-medium text-navy shadow-xs transition-colors duration-150 hover:border-navy/35 hover:bg-navy/[0.04] disabled:pointer-events-none disabled:opacity-50'

export const BTN_OUTLINE_SM =
  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-navy/15 bg-white px-2.5 py-1 text-xs font-medium text-navy shadow-xs transition-colors duration-150 hover:border-navy/35 hover:bg-navy/[0.04]'
```

- [ ] **Step 2: Simplificar `buttonVariants` em `src/components/ui/button.tsx`**

Troque:

```ts
        default:
          "bg-gradient-to-b from-[#ff7a34] to-orange text-white shadow-[0_1px_1px_rgba(0,0,0,0.08),0_6px_16px_-6px_rgba(245,105,30,0.55)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_10px_22px_-8px_rgba(245,105,30,0.6)] hover:brightness-[1.03] active:scale-[0.98] active:brightness-95",
        outline:
          "border-navy/15 bg-white text-navy shadow-xs hover:border-navy/35 hover:bg-navy/[0.04] hover:shadow-sm active:scale-[0.98] aria-expanded:bg-navy/5 dark:border-white/30 dark:bg-transparent dark:text-white dark:hover:bg-white/10",
```

por:

```ts
        default:
          "bg-orange text-white shadow-xs hover:bg-orange-dark",
        outline:
          "border-navy/15 bg-white text-navy shadow-xs hover:border-navy/35 hover:bg-navy/[0.04] aria-expanded:bg-navy/5 dark:border-white/30 dark:bg-transparent dark:text-white dark:hover:bg-white/10",
```

(`secondary`, `ghost`, `destructive`, `link` não mudam — já não têm gradiente/glow/scale.)

- [ ] **Step 3: Rodar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes continuam passando (nenhum consumidor de `BTN_PRIMARY`/`BTN_OUTLINE`/`buttonVariants` é testado por classe CSS).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui.ts src/components/ui/button.tsx
git commit -m "style: botao primario e outline sem gradiente, glow e scale no hover/active"
```

---

## Task 3: Badge sem sombra glossy

**Files:**
- Modify: `src/components/ui/badge.tsx:6,15-16`

**Interfaces:**
- Produces: `Badge`/`badgeVariants` (mesma API — mesmas `variant`s: `neutral`, `low`, `alert`, `critical`, `success`, `outline`, `navy-soft`), só sem a sombra com highlight interno.

- [ ] **Step 1: Remover a sombra "glossy" da base e o `shadow-none` agora redundante nas variantes**

Troque:

```ts
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.06)]",
  {
    variants: {
      variant: {
        neutral: "bg-grey-badge text-white",
        low: "bg-black-badge text-white",
        alert: "bg-orange text-white",
        critical: "bg-red-crit text-white",
        success: "bg-green-ok text-white",
        outline: "border border-border-grey text-mid-grey bg-white shadow-none",
        "navy-soft": "bg-navy/10 text-navy shadow-none",
      },
    },
```

por:

```ts
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-grey-badge text-white",
        low: "bg-black-badge text-white",
        alert: "bg-orange text-white",
        critical: "bg-red-crit text-white",
        success: "bg-green-ok text-white",
        outline: "border border-border-grey text-mid-grey bg-white",
        "navy-soft": "bg-navy/10 text-navy",
      },
    },
```

- [ ] **Step 2: Rodar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes continuam passando.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "style: badge sem sombra glossy interna"
```

---

## Task 4: Marca neutra e navbar agrupada por ferramenta

**Files:**
- Modify: `src/components/nav-bar.tsx`
- Test: `src/components/nav-bar.test.tsx` (já existe — só precisa continuar passando, nenhuma mudança nele)

**Interfaces:**
- Produces: a marca no topo da navbar vira um monograma flat "V" (`bg-orange`, sem gradiente/sombra/scale) + wordmark "VerAI"; os links `TOP_LINKS` passam a ter um rótulo de seção "Análise de Documentos" acima deles quando a barra está expandida — mesmo padrão de agrupamento que a seção "Configuração" já usa. Os `href`/`aria-label`/texto de cada link **não mudam** (o teste existente consulta por `role: 'link', name: ...` e continua funcionando).

- [ ] **Step 1: Remover o import de `FileSearch` (não usado mais)**

Troque:

```tsx
import {
  FileSearch,
  FileText,
  Users,
  Bell,
  UserCog,
  Building2,
  BellRing,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
} from 'lucide-react'
```

por:

```tsx
import {
  FileText,
  Users,
  Bell,
  UserCog,
  Building2,
  BellRing,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
} from 'lucide-react'
```

- [ ] **Step 2: Trocar a marca por um monograma flat + rótulo de seção acima de `TOP_LINKS`**

Troque:

```tsx
      <Link
        href="/clientes"
        className="group flex shrink-0 items-center gap-2 overflow-hidden px-3.5 py-4"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-[#ff7a34] to-orange text-white shadow-[0_2px_8px_-2px_rgba(245,105,30,0.6)] transition-transform group-hover:scale-105">
          <FileSearch className="size-4.5" strokeWidth={2.25} />
        </span>
        {expandida && (
          <span className="whitespace-nowrap text-base font-semibold tracking-tight text-white">
            Ver<span className="text-orange">AI</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 px-2.5 py-1">
        {TOP_LINKS.map((link) => {
```

por:

```tsx
      <Link
        href="/clientes"
        className="flex shrink-0 items-center gap-2 overflow-hidden px-3.5 py-4"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-orange text-sm font-bold text-white">
          V
        </span>
        {expandida && (
          <span className="whitespace-nowrap text-base font-semibold tracking-tight text-white">
            Ver<span className="text-orange">AI</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 px-2.5 py-1">
        {expandida && (
          <span className="px-2.5 pt-1 pb-1 text-[0.65rem] font-semibold tracking-wide text-white/35 uppercase">
            Análise de Documentos
          </span>
        )}
        {TOP_LINKS.map((link) => {
```

- [ ] **Step 3: Rodar o teste da navbar**

Run: `npm test -- nav-bar.test`
Expected: PASS — os 8 casos existentes continuam passando (nenhum verifica a marca ou o novo rótulo, só links/botões por nome).

- [ ] **Step 4: Rodar lint**

Run: `npm run lint`
Expected: sem erros (confirma que `FileSearch` não ficou como import não usado).

- [ ] **Step 5: Commit**

```bash
git add src/components/nav-bar.tsx
git commit -m "style: marca vira monograma flat e navbar agrupa links sob Analise de Documentos"
```

---

## Task 5: Login sem hero decorativo (dot-grid/glow/blob)

**Files:**
- Modify: `src/app/login/page.tsx`
- Test: `src/app/login/page.test.tsx` (já existe — continua passando, nenhuma mudança nele)

**Interfaces:**
- Produces: mesma página/props/comportamento de login; só remove os `<div>` decorativos do painel navy e troca as duas ocorrências do ícone `FileSearch` (desktop + mobile) pelo mesmo monograma "V" flat usado na navbar (Task 4), pra marca ficar consistente.

- [ ] **Step 1: Remover o import de `FileSearch`**

Troque:

```tsx
import { FileSearch, Mail, Lock, AlertCircle } from 'lucide-react'
```

por:

```tsx
import { Mail, Lock, AlertCircle } from 'lucide-react'
```

- [ ] **Step 2: Remover dot-grid, glow radial e blob desfocado do painel; trocar a marca desktop**

Troque:

```tsx
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy via-navy to-navy-2 p-12 text-white lg:flex">
        <div className="bg-dot-grid absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,105,30,0.22),transparent_55%)]" />
        <div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-orange/10 blur-3xl" />
        <div className="relative flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-orange">
            <FileSearch className="size-5" strokeWidth={2.25} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Ver<span className="text-orange">AI</span>
          </span>
        </div>

        <div className="relative space-y-5">
```

por:

```tsx
      <section className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-orange text-base font-bold text-white">
            V
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Ver<span className="text-orange">AI</span>
          </span>
        </div>

        <div className="space-y-5">
```

- [ ] **Step 3: Tirar o `relative` que só existia por causa do blob/glow, no rodapé do painel**

Troque:

```tsx
        <p className="relative text-xs text-light-blue/70">
          © {new Date().getFullYear()} Prodam — VerAI
        </p>
```

por:

```tsx
        <p className="text-xs text-light-blue/70">
          © {new Date().getFullYear()} Prodam — VerAI
        </p>
```

- [ ] **Step 4: Trocar a marca mobile (duplicata que aparece em telas pequenas)**

Troque:

```tsx
              <span className="flex size-9 items-center justify-center rounded-lg bg-orange text-white">
                <FileSearch className="size-5" strokeWidth={2.25} />
              </span>
```

por:

```tsx
              <span className="flex size-9 items-center justify-center rounded-md bg-orange text-base font-bold text-white">
                V
              </span>
```

- [ ] **Step 5: Rodar o teste de login**

Run: `npm test -- "login/page.test"`
Expected: PASS — os 3 casos existentes continuam passando (nenhum depende do ícone/decoração removidos).

- [ ] **Step 6: Rodar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "style: login sem dot-grid/glow/blob decorativo, marca vira monograma flat"
```

---

## Task 6: Dashboard sem ícone-watermark nos cards de métrica

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: mesmos 4 cards de métrica (`Total no filtro`, `Concluídos`, `Processando`, `Com erro`), só sem o ícone gigante translúcido no canto.

- [ ] **Step 1: Remover os imports de ícone que só serviam pro watermark**

Troque:

```tsx
import {
  Search,
  Eye,
  Download,
  FileDown,
  Inbox,
  ArrowRight,
  FileStack,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
} from 'lucide-react'
```

por:

```tsx
import {
  Search,
  Eye,
  Download,
  FileDown,
  Inbox,
  ArrowRight,
  Trash2,
} from 'lucide-react'
```

- [ ] **Step 2: Tirar `icon` do array `stats`**

Troque:

```tsx
  const stats = [
    { label: 'Total no filtro', value: totalDocs, icon: FileStack },
    { label: 'Concluídos', value: totalConcluidos, icon: CheckCircle2 },
    { label: 'Processando', value: totalProcessando, icon: Clock },
    { label: 'Com erro', value: totalErros, icon: AlertCircle },
  ]
```

por:

```tsx
  const stats = [
    { label: 'Total no filtro', value: totalDocs },
    { label: 'Concluídos', value: totalConcluidos },
    { label: 'Processando', value: totalProcessando },
    { label: 'Com erro', value: totalErros },
  ]
```

- [ ] **Step 3: Remover o ícone-watermark do card**

Troque:

```tsx
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl bg-navy-2 p-4 shadow-md">
            <Icon className="icon-watermark size-20" strokeWidth={1.5} />
            <p className="text-[0.7rem] font-semibold tracking-wide text-white/70 uppercase">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-orange">{value}</p>
          </div>
        ))}
      </div>
```

por:

```tsx
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-2xl bg-navy-2 p-4 shadow-md">
            <p className="text-[0.7rem] font-semibold tracking-wide text-white/70 uppercase">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-orange">{value}</p>
          </div>
        ))}
      </div>
```

- [ ] **Step 4: Rodar lint**

Run: `npm run lint`
Expected: sem erros (confirma que os 4 ícones removidos não ficaram como import morto).

- [ ] **Step 5: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes continuam passando.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "style: dashboard sem icone-watermark nos cards de metrica"
```

---

## Task 7: Documento detalhe sem ícone-watermark nas métricas-chave

**Files:**
- Modify: `src/app/documentos/[id]/page.tsx:227-239`

**Interfaces:**
- Produces: mesma grade de "Métricas-chave" (label + valor), sem o ícone `Gauge` gigante translúcido. `Gauge` continua importado (ainda usado como ícone de seção em `<Section icon={Gauge} title="Resumo">` e `title="Métricas-chave"`).

- [ ] **Step 1: Remover o ícone-watermark do card de métrica**

Troque:

```tsx
            {analise.metricasChave.map((metrica, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl bg-navy-2 p-3.5 shadow-sm">
                <Gauge className="icon-watermark size-14" strokeWidth={1.5} />
                <p className="text-[0.68rem] font-semibold tracking-wide text-white/70 uppercase">{metrica.label}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-orange">{metrica.valorExibicao}</p>
              </div>
            ))}
```

por:

```tsx
            {analise.metricasChave.map((metrica, i) => (
              <div key={i} className="rounded-xl bg-navy-2 p-3.5 shadow-sm">
                <p className="text-[0.68rem] font-semibold tracking-wide text-white/70 uppercase">{metrica.label}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-orange">{metrica.valorExibicao}</p>
              </div>
            ))}
```

- [ ] **Step 2: Rodar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes continuam passando.

- [ ] **Step 4: Commit**

```bash
git add "src/app/documentos/[id]/page.tsx"
git commit -m "style: documento detalhe sem icone-watermark nas metricas-chave"
```

---

## Task 8: Lista de clientes sem ícone-avatar por item

**Files:**
- Modify: `src/app/clientes/page.tsx`

**Interfaces:**
- Produces: mesma grade de cards de cliente (link pro cliente), só sem a caixa de ícone `Building2` — o nome do cliente vira o elemento principal da linha, com o `ChevronRight` de afordância mantido.

- [ ] **Step 1: Remover o import de `Building2` (não usado mais)**

Troque:

```tsx
import { Building2, ChevronRight, Loader2, Inbox } from 'lucide-react'
```

por:

```tsx
import { ChevronRight, Loader2, Inbox } from 'lucide-react'
```

- [ ] **Step 2: Remover a caixa de ícone da linha de cliente**

Troque:

```tsx
              <Link
                href={`/clientes/${cliente.id}`}
                className="card card-interactive group flex items-center gap-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy group-hover:bg-orange-light group-hover:text-orange">
                  <Building2 className="size-5" strokeWidth={2} />
                </span>
                <span className="flex-1 text-sm font-semibold text-navy">{cliente.nome}</span>
                <ChevronRight className="size-4 text-mid-grey transition-transform group-hover:translate-x-0.5 group-hover:text-orange" strokeWidth={2.25} />
              </Link>
```

por:

```tsx
              <Link
                href={`/clientes/${cliente.id}`}
                className="card card-interactive group flex items-center gap-3"
              >
                <span className="flex-1 text-sm font-semibold text-navy">{cliente.nome}</span>
                <ChevronRight className="size-4 text-mid-grey transition-transform group-hover:translate-x-0.5 group-hover:text-orange" strokeWidth={2.25} />
              </Link>
```

- [ ] **Step 3: Rodar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes continuam passando.

- [ ] **Step 5: Commit**

```bash
git add src/app/clientes/page.tsx
git commit -m "style: lista de clientes sem icone-avatar por item"
```

---

## Task 9: Cliente detalhe sem ícone-avatar nas competências

**Files:**
- Modify: `src/app/clientes/[id]/page.tsx`

**Interfaces:**
- Produces: mesma lista de competências (nome do mês + badge "Mês atual" + contagem + chevron de expandir), sem a caixa de ícone `FileStack`.

- [ ] **Step 1: Remover o import de `FileStack` (não usado mais neste arquivo)**

Troque:

```tsx
import {
  Plus,
  ChevronRight,
  FileStack,
  Loader2,
  AlertCircle,
  Eye,
  Download,
  Trash2,
  ArrowUpRight,
  Inbox,
  X,
} from 'lucide-react'
```

por:

```tsx
import {
  Plus,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  Download,
  Trash2,
  ArrowUpRight,
  Inbox,
  X,
} from 'lucide-react'
```

- [ ] **Step 2: Remover a caixa de ícone da linha de competência**

Troque:

```tsx
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex size-9 items-center justify-center rounded-lg bg-navy/5 text-navy transition-colors',
                        expandida && 'bg-orange-light text-orange'
                      )}
                    >
                      <FileStack className="size-4.5" strokeWidth={2} />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-navy capitalize">{nomeCompetencia(c.ano, c.mes)}</span>
                      {ehAtual && <Badge variant="navy-soft">Mês atual</Badge>}
                    </span>
                  </span>
```

por:

```tsx
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-navy capitalize">{nomeCompetencia(c.ano, c.mes)}</span>
                    {ehAtual && <Badge variant="navy-soft">Mês atual</Badge>}
                  </span>
```

- [ ] **Step 3: Rodar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes continuam passando.

- [ ] **Step 5: Commit**

```bash
git add "src/app/clientes/[id]/page.tsx"
git commit -m "style: cliente detalhe sem icone-avatar nas linhas de competencia"
```

---

## Task 10: Modal de processamento sem Sparkles/ping decorativo

**Files:**
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx:317-337`

**Interfaces:**
- Produces: o mesmo modal "Analisando documento com IA" (mostrado durante o upload), com um único spinner (`Loader2`) no lugar do círculo com `Sparkles` + anel `animate-ping` + chip "Processando..." duplicado — a informação de "está processando" já fica clara com o spinner + o texto abaixo. `Sparkles` continua importado (ainda usado na aba "Análise consolidada", linha 726).

- [ ] **Step 1: Simplificar o indicador de processamento do modal**

Troque:

```tsx
      {enviando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-xl">
            <span className="relative flex size-14 items-center justify-center rounded-full bg-orange-light text-orange">
              <span className="absolute inset-0 animate-ping rounded-full bg-orange/25" />
              <Sparkles className="relative size-6" strokeWidth={1.75} />
            </span>
            <div className="space-y-1.5">
              <p className="text-base font-semibold text-navy">Analisando documento com IA</p>
              <p className="text-sm text-mid-grey">
                Estamos lendo e validando os dados de <span className="font-medium text-navy">{arquivo?.name}</span>. Isso pode levar
                alguns segundos — não feche esta página.
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
              Processando...
            </span>
          </div>
        </div>
      )}
```

por:

```tsx
      {enviando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-xl">
            <Loader2 className="size-8 animate-spin text-orange" strokeWidth={2} />
            <div className="space-y-1.5">
              <p className="text-base font-semibold text-navy">Analisando documento com IA</p>
              <p className="text-sm text-mid-grey">
                Estamos lendo e validando os dados de <span className="font-medium text-navy">{arquivo?.name}</span>. Isso pode levar
                alguns segundos — não feche esta página.
              </p>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Rodar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes continuam passando.

- [ ] **Step 4: Commit**

```bash
git add "src/app/clientes/[id]/[competencia]/page.tsx"
git commit -m "style: modal de processamento troca sparkles/ping por spinner unico"
```

---

## Task 11: Notificações sem ícone-avatar por item

**Files:**
- Modify: `src/app/notificacoes/page.tsx`

**Interfaces:**
- Produces: mesma lista de notificações (nome do documento + data + ação "Marcar como lida"), sem a caixa de ícone `FileText`. O estado lida/não-lida continua visível pela cor de fundo/borda da linha (já existente) e ganha um indicador extra: um pontinho laranja ao lado do texto quando não lida.

- [ ] **Step 1: Remover o import de `FileText` (não usado mais)**

Troque:

```tsx
import { Bell, CheckCheck, Inbox, Loader2, FileText } from 'lucide-react'
```

por:

```tsx
import { Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react'
```

- [ ] **Step 2: Remover a caixa de ícone da linha e adicionar o pontinho de não-lida**

Troque:

```tsx
              <Link
                href={`/documentos/${notificacao.documentoId}`}
                className="flex items-center gap-2.5 hover:underline"
              >
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${notificacao.lida ? 'bg-light-grey text-mid-grey' : 'bg-orange text-white'}`}>
                  <FileText className="size-4" strokeWidth={2.25} />
                </span>
                <span>
                  <span className="font-medium text-navy">{notificacao.documento.nomeArquivo}</span>
                  <span className="block text-xs text-mid-grey">
                    {new Date(notificacao.createdAt).toLocaleString('pt-BR')}
                  </span>
                </span>
              </Link>
```

por:

```tsx
              <Link
                href={`/documentos/${notificacao.documentoId}`}
                className="flex items-center gap-2.5 hover:underline"
              >
                {!notificacao.lida && <span className="size-1.5 shrink-0 rounded-full bg-orange" aria-hidden />}
                <span>
                  <span className="font-medium text-navy">{notificacao.documento.nomeArquivo}</span>
                  <span className="block text-xs text-mid-grey">
                    {new Date(notificacao.createdAt).toLocaleString('pt-BR')}
                  </span>
                </span>
              </Link>
```

- [ ] **Step 3: Rodar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes continuam passando.

- [ ] **Step 5: Commit**

```bash
git add src/app/notificacoes/page.tsx
git commit -m "style: notificacoes sem icone-avatar por item"
```

---

## Task 12: Verificação final

**Files:**
- Nenhum arquivo novo — só validação do resultado das Tasks 1–11.

**Interfaces:**
- Consumes: o estado final de todos os arquivos modificados nas tasks anteriores.

- [ ] **Step 1: Rodar lint completo**

Run: `npm run lint`
Expected: sem erros em todo o projeto.

- [ ] **Step 2: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes passam (`nav-bar.test.tsx`, `login/page.test.tsx`, e qualquer outro existente).

- [ ] **Step 3: Rodar o build de produção**

Run: `npm run build`
Expected: build conclui sem erro (garante que nenhum import morto ou classe quebrada passou pelo lint sem ser pego, e valida as páginas com `output: static`/prerender se houver).

- [ ] **Step 4: Checklist de revisão visual manual**

Suba o app (`npm run dev`) e confira visualmente, comparando com o estado antes da mudança:
- [ ] Login: painel navy sem textura/glow/blob; marca "V" flat igual nos dois breakpoints.
- [ ] Navbar: marca "V" flat sem gradiente; rótulo "Análise de Documentos" aparece acima de Clientes/Documentos/Notificações quando expandida; some quando recolhida.
- [ ] Dashboard (`/`): cards de métrica sem ícone gigante no canto.
- [ ] Clientes (`/clientes`): linhas sem caixa de ícone, só nome + chevron.
- [ ] Cliente → competências (`/clientes/[id]`): linhas de competência sem caixa de ícone.
- [ ] Cliente → mês (`/clientes/[id]/[competencia]`): upload de arquivo mostra spinner único (sem sparkles/ping) durante o processamento.
- [ ] Documento (`/documentos/[id]`): métricas-chave sem ícone de fundo.
- [ ] Notificações (`/notificacoes`): linhas sem caixa de ícone; não lidas mostram o pontinho laranja.
- [ ] Botões primário/outline em qualquer tela: preenchimento sólido, sem gradiente, sem "pulo" ao clicar.
- [ ] Páginas admin (`/admin/usuarios`, `/admin/clientes`, `/admin/regras-notificacao`): cards/tabela/botões já vêm mais sóbrios automaticamente (herdam os tokens da Task 1 e os botões da Task 2) — conferir que nada quebrou visualmente.

Não é necessário commit nesta task — é só validação do que já foi commitado nas Tasks 1–11.
