# Navegação e UX do relatório consolidado — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a navegação/UX da aba de relatório consolidado (breadcrumb, vocabulário, fluxo de geração, hierarquia visual, ajuda) e alinhar botões/badges/tabelas/títulos a um padrão visual "tecnológico premium" (raio modesto, zero sombra decorativa, peso médio) em todo o app.

**Architecture:** Mudanças em componentes React client-side existentes (`src/app/clientes/**`) e em tokens visuais compartilhados (`src/lib/ui.ts`, `src/components/ui/badge.tsx`, `src/app/globals.css`). Nenhuma rota nova, nenhuma mudança de schema/API — só apresentação e reorganização de UI já existente.

**Tech Stack:** Next.js 15 (App Router, client components), React 19, TypeScript, Tailwind CSS v4 (tokens custom em `globals.css`), Jest + Testing Library (`jsdom`).

## Global Constraints

- Terminologia visível ao usuário usa sempre "Relatório", nunca "Análise" (a palavra "análise" fica restrita a jargão técnico interno — nomes de variável, tipos, comentários). Exceção: "Análise da IA" / "Ver análise" no documento individual (`documentos/[id]/page.tsx`) não muda — é um conceito diferente, fora de escopo.
- Não mexe na sidebar (`src/components/nav-bar.tsx`) nem na paleta de cor navy/laranja nem na fonte (Geist).
- Não introduz roteamento por aba — as abas continuam sendo estado local via `useState`.
- Commits não incluem `Co-Authored-By` nem qualquer menção a Claude — o repositório é público.
- Raio de borda de botão/input passa de `rounded-lg` para `rounded-xl`; nunca `rounded-full` em botão (só em badge/chip).
- Botões e badges perdem sombra decorativa (`shadow-xs`) e peso `font-semibold` → `font-medium`.

---

### Task 1: Breadcrumb com "Análise de Documentos"

**Files:**
- Modify: `src/app/clientes/[id]/page.tsx:168-174`
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx:332-343`
- Create: `src/app/clientes/[id]/page.test.tsx`
- Create: `src/app/clientes/[id]/[competencia]/page.test.tsx`

**Interfaces:**
- Consumes: nada novo — só adiciona um `<span>` estático ao `<nav>` de breadcrumb já existente em cada página.
- Produces: nenhuma interface nova; os testes criados aqui (`page.test.tsx` em ambos os diretórios) são estendidos pelas Tasks 2, 4 e 5.

- [ ] **Step 1: Escrever o teste que falha para `clientes/[id]/page.tsx`**

Crie `src/app/clientes/[id]/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import ClienteDetalhePage from './page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

export function mockFetch() {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const u = String(url)
    if (u === '/api/clientes/cliente-1') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'cliente-1', nome: 'Prefeitura X' }),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/documentos?clienteId=cliente-1') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as unknown as Promise<Response>
    }
    if (u === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'u1', role: 'usuario' }),
      }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null) }) as unknown as Promise<Response>
  }) as jest.Mock
}

// A página usa `use(params)`, que pode suspender no primeiro render — envolve num
// Suspense boundary local pra teste ficar determinístico independente do timing
// de resolução da Promise.
export function renderPagina() {
  return render(
    <Suspense fallback={null}>
      <ClienteDetalhePage params={Promise.resolve({ id: 'cliente-1' })} />
    </Suspense>
  )
}

describe('ClienteDetalhePage', () => {
  beforeEach(() => {
    mockFetch()
  })

  it('mostra "Análise de Documentos" como raiz do breadcrumb, antes de Clientes', async () => {
    renderPagina()
    await screen.findByRole('heading', { name: 'Prefeitura X' })

    expect(screen.getByText('Análise de Documentos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
  })
})
```

`mockFetch` e `renderPagina` são exportados porque a Task 4 adiciona um novo teste a
este mesmo arquivo e reusa esses helpers.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/app/clientes/[id]/page.test.tsx`
Expected: FAIL — `Unable to find an element with the text: Análise de Documentos`

- [ ] **Step 3: Implementar o breadcrumb em `clientes/[id]/page.tsx`**

Em `src/app/clientes/[id]/page.tsx`, o bloco atual (linhas 168-174) é:

```tsx
          <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
            <Link href="/clientes" className="hover:text-navy hover:underline">
              Clientes
            </Link>
            <ChevronRight className="size-3" strokeWidth={2.5} />
            <span className="font-semibold text-navy">{cliente.nome}</span>
          </nav>
```

Substitua por:

```tsx
          <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
            <span>Análise de Documentos</span>
            <ChevronRight className="size-3" strokeWidth={2.5} />
            <Link href="/clientes" className="hover:text-navy hover:underline">
              Clientes
            </Link>
            <ChevronRight className="size-3" strokeWidth={2.5} />
            <span className="font-semibold text-navy">{cliente.nome}</span>
          </nav>
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/app/clientes/[id]/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Escrever o teste que falha para `clientes/[id]/[competencia]/page.tsx`**

Crie `src/app/clientes/[id]/[competencia]/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import ClienteCompetenciaPage from './page'

type MockOverrides = {
  documentos?: Array<Record<string, unknown>>
  analisesConsolidadas?: Array<Record<string, unknown>>
  analiseEvolucao?: Record<string, unknown> | null
}

export function mockFetchCompetencia(overrides: MockOverrides = {}) {
  const documentos = overrides.documentos ?? []
  const analisesConsolidadas = overrides.analisesConsolidadas ?? []
  const analiseEvolucao = overrides.analiseEvolucao ?? null

  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const u = String(url)
    if (u === '/api/clientes/cliente-1') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'cliente-1', nome: 'Prefeitura X' }),
      }) as unknown as Promise<Response>
    }
    if (u.startsWith('/api/documentos?clienteId=cliente-1')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(documentos) }) as unknown as Promise<Response>
    }
    if (u === '/api/clientes/cliente-1/competencias/2026-08/analise-consolidada') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(analisesConsolidadas),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/clientes/cliente-1/competencias/2026-08/analise-evolucao') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(analiseEvolucao) }) as unknown as Promise<Response>
    }
    if (u === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'u1', role: 'usuario' }),
      }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null) }) as unknown as Promise<Response>
  }) as jest.Mock
}

export function renderPagina() {
  return render(
    <Suspense fallback={null}>
      <ClienteCompetenciaPage params={Promise.resolve({ id: 'cliente-1', competencia: '2026-08' })} />
    </Suspense>
  )
}

describe('ClienteCompetenciaPage', () => {
  it('mostra "Análise de Documentos" como raiz do breadcrumb, antes de Clientes e do cliente', async () => {
    mockFetchCompetencia()
    renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    expect(screen.getByText('Análise de Documentos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Prefeitura X' })).toHaveAttribute('href', '/clientes/cliente-1')
  })
})
```

`mockFetchCompetencia` e `renderPagina` são exportados deste arquivo porque as Tasks 2, 4 e 5 adicionam novos testes ao mesmo arquivo e reusam esses helpers.

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `npm test -- "src/app/clientes/[id]/[competencia]/page.test.tsx"`
Expected: FAIL — `Unable to find an element with the text: Análise de Documentos`

- [ ] **Step 7: Implementar o breadcrumb em `clientes/[id]/[competencia]/page.tsx`**

O bloco atual (linhas 332-343) é:

```tsx
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <Link href="/clientes" className="hover:text-navy hover:underline">
            Clientes
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href={`/clientes/${id}`} className="hover:text-navy hover:underline">
            {cliente?.nome ?? '...'}
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy capitalize">{nomeCompetencia(parsed.ano, parsed.mes)}</span>
        </nav>
```

Substitua por:

```tsx
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Análise de Documentos</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href="/clientes" className="hover:text-navy hover:underline">
            Clientes
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href={`/clientes/${id}`} className="hover:text-navy hover:underline">
            {cliente?.nome ?? '...'}
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy capitalize">{nomeCompetencia(parsed.ano, parsed.mes)}</span>
        </nav>
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npm test -- "src/app/clientes/[id]/[competencia]/page.test.tsx"`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add "src/app/clientes/[id]/page.tsx" "src/app/clientes/[id]/page.test.tsx" "src/app/clientes/[id]/[competencia]/page.tsx" "src/app/clientes/[id]/[competencia]/page.test.tsx"
git commit -m "feat: breadcrumb comeca com Analise de Documentos"
```

---

### Task 2: Vocabulário único "Relatório"

**Files:**
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx:207-211` (array `TABS`)
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx:280` (mensagem de erro)
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx:886-891` (link de download da evolução)
- Modify: `src/app/clientes/[id]/[competencia]/page.test.tsx` (adiciona testes)

**Interfaces:**
- Consumes: `mockFetchCompetencia` e `renderPagina` de Task 1 (mesmo arquivo de teste).
- Produces: nada consumido por tasks futuras — os textos ficam fixos daqui em diante.

- [ ] **Step 1: Escrever os testes que falham**

Adicione ao final do `describe('ClienteCompetenciaPage', ...)` em
`src/app/clientes/[id]/[competencia]/page.test.tsx`:

```tsx
  it('usa o vocabulário "Relatório" nas abas em vez de "Análise"', async () => {
    mockFetchCompetencia({
      documentos: [
        {
          id: 'doc-1',
          nomeArquivo: 'a.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-01T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-1' },
        },
      ],
      analiseEvolucao: {
        id: 'ev-1',
        competenciaAnteriorAno: 2026,
        competenciaAnteriorMes: 7,
        metricasComparadas: [],
        resumo: 'Resumo',
        pontosAtencao: [],
        melhorias: [],
        createdAt: '2026-08-05T00:00:00Z',
      },
    })
    renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    expect(screen.getByRole('button', { name: /Relatório consolidado/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Relatório de evolução' })).toBeInTheDocument()
    expect(screen.queryByText('Análise consolidada')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Relatório de evolução' }))
    expect(await screen.findByRole('link', { name: /Baixar PDF/ })).toHaveAttribute(
      'href',
      '/api/analises-evolucao/ev-1/relatorio'
    )
  })
```

No topo do arquivo, troque o import de `@testing-library/react` para incluir `fireEvent`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- "src/app/clientes/[id]/[competencia]/page.test.tsx"`
Expected: FAIL — não encontra botão com nome `Relatório consolidado`/`Relatório de evolução`

- [ ] **Step 3: Renomear o array `TABS`**

Linhas 207-211 hoje:

```tsx
  const TABS: Array<{ key: Aba; label: string; icon: typeof FileStack; count?: number }> = [
    { key: 'documentos', label: 'Documentos', icon: FileStack, count: documentos.length },
    { key: 'consolidada', label: 'Análise consolidada', icon: Layers, count: analisesConsolidadas.length },
    { key: 'evolucao', label: 'Evolução', icon: GitCompare },
  ]
```

Trocar os dois `label`:

```tsx
  const TABS: Array<{ key: Aba; label: string; icon: typeof FileStack; count?: number }> = [
    { key: 'documentos', label: 'Documentos', icon: FileStack, count: documentos.length },
    { key: 'consolidada', label: 'Relatório consolidado', icon: Layers, count: analisesConsolidadas.length },
    { key: 'evolucao', label: 'Relatório de evolução', icon: GitCompare },
  ]
```

- [ ] **Step 4: Atualizar a mensagem de erro de geração**

Linha 280 hoje:

```tsx
      setErroConsolidada(body?.error ?? 'Falha ao gerar a análise consolidada.')
```

Trocar para:

```tsx
      setErroConsolidada(body?.error ?? 'Falha ao gerar o relatório consolidado.')
```

- [ ] **Step 5: Atualizar o link de download da evolução**

Bloco atual (por volta da linha 886-891):

```tsx
                    <a
                      href={`/api/analises-evolucao/${analiseEvolucao.id}/relatorio`}
                      className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline"
                    >
                      <FileDown className="size-3.5" strokeWidth={2.25} />
                      Baixar relatório de evolução
                    </a>
```

Trocar o texto do link:

```tsx
                    <a
                      href={`/api/analises-evolucao/${analiseEvolucao.id}/relatorio`}
                      className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline"
                    >
                      <FileDown className="size-3.5" strokeWidth={2.25} />
                      Baixar PDF
                    </a>
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test -- "src/app/clientes/[id]/[competencia]/page.test.tsx"`
Expected: PASS (todos os testes do arquivo, incluindo o de Task 1)

- [ ] **Step 7: Commit**

```bash
git add "src/app/clientes/[id]/[competencia]/page.tsx" "src/app/clientes/[id]/[competencia]/page.test.tsx"
git commit -m "feat: unifica vocabulario para Relatorio nas abas de consolidado e evolucao"
```

---

### Task 3: Tokens de botão, input e badge

**Files:**
- Modify: `src/lib/ui.ts`
- Modify: `src/components/ui/badge.tsx`
- Create: `src/lib/ui.test.ts`
- Create: `src/components/ui/badge.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `BTN_PRIMARY`, `BTN_OUTLINE`, `BTN_OUTLINE_SM`, `INPUT_BASE` (strings de classe, mesmos nomes exportados, valores mudam) e `badgeVariants` (mesma assinatura, valores de classe mudam) — todo o app que já importa esses símbolos herda o novo visual automaticamente, sem mudança de código nos consumidores.

- [ ] **Step 1: Escrever o teste que falha para `src/lib/ui.ts`**

Crie `src/lib/ui.test.ts`:

```ts
import { BTN_PRIMARY, BTN_OUTLINE, BTN_OUTLINE_SM, INPUT_BASE } from './ui'

describe('tokens de botão e input', () => {
  it('BTN_PRIMARY usa raio modesto, peso médio e nenhuma sombra', () => {
    expect(BTN_PRIMARY).toContain('rounded-xl')
    expect(BTN_PRIMARY).toContain('font-medium')
    expect(BTN_PRIMARY).not.toContain('font-semibold')
    expect(BTN_PRIMARY).not.toContain('shadow-xs')
  })

  it('BTN_OUTLINE usa raio modesto e nenhuma sombra', () => {
    expect(BTN_OUTLINE).toContain('rounded-xl')
    expect(BTN_OUTLINE).not.toContain('shadow-xs')
  })

  it('BTN_OUTLINE_SM usa raio modesto e nenhuma sombra', () => {
    expect(BTN_OUTLINE_SM).toContain('rounded-xl')
    expect(BTN_OUTLINE_SM).not.toContain('shadow-xs')
  })

  it('INPUT_BASE usa o mesmo raio modesto dos botões', () => {
    expect(INPUT_BASE).toContain('rounded-xl')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/lib/ui.test.ts`
Expected: FAIL — os tokens ainda usam `rounded-lg`/`font-semibold`/`shadow-xs`

- [ ] **Step 3: Editar `src/lib/ui.ts`**

Conteúdo atual:

```ts
export const BTN_PRIMARY =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors duration-150 hover:bg-orange-dark disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none'

export const BTN_OUTLINE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-3.5 py-2 text-sm font-medium text-navy shadow-xs transition-colors duration-150 hover:border-navy/35 hover:bg-navy/[0.04] disabled:pointer-events-none disabled:opacity-50'

export const BTN_OUTLINE_SM =
  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-navy/15 bg-white px-2.5 py-1 text-xs font-medium text-navy shadow-xs transition-colors duration-150 hover:border-navy/35 hover:bg-navy/[0.04]'
```

Substitua por:

```ts
export const BTN_PRIMARY =
  'inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-orange px-3.5 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-orange-dark disabled:pointer-events-none disabled:opacity-50'

export const BTN_OUTLINE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-navy/15 bg-white px-3.5 py-1.5 text-sm font-medium text-navy transition-colors duration-150 hover:border-navy/35 hover:bg-navy/[0.04] disabled:pointer-events-none disabled:opacity-50'

export const BTN_OUTLINE_SM =
  'inline-flex shrink-0 items-center gap-1 rounded-xl border border-navy/15 bg-white px-2.5 py-1 text-xs font-medium text-navy transition-colors duration-150 hover:border-navy/35 hover:bg-navy/[0.04]'
```

E mais abaixo no mesmo arquivo, `INPUT_BASE` atual:

```ts
export const INPUT_BASE =
  'rounded-lg border border-border-grey bg-white px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-all duration-150 focus:border-orange focus:ring-4 focus:ring-orange/12'
```

Substitua por:

```ts
export const INPUT_BASE =
  'rounded-xl border border-border-grey bg-white px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-all duration-150 focus:border-orange focus:ring-4 focus:ring-orange/12'
```

(`LINK_NAVY` e `LINK_DANGER` não mudam — não são botões preenchidos, já são só texto com sublinhado.)

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/lib/ui.test.ts`
Expected: PASS

- [ ] **Step 5: Escrever o teste que falha para `Badge`**

Crie `src/components/ui/badge.test.tsx`:

```tsx
import { badgeVariants } from './badge'

describe('badgeVariants', () => {
  it('usa formato pill e peso médio', () => {
    const classes = badgeVariants({ variant: 'neutral' })
    expect(classes).toContain('rounded-full')
    expect(classes).toContain('font-medium')
    expect(classes).not.toContain('font-semibold')
    expect(classes).not.toContain('rounded-md')
  })
})
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `npm test -- src/components/ui/badge.test.tsx`
Expected: FAIL — ainda usa `rounded-md`/`font-semibold`

- [ ] **Step 7: Editar `src/components/ui/badge.tsx`**

Linha 6 atual:

```ts
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
```

Substitua por:

```ts
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npm test -- src/components/ui/badge.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/ui.ts src/lib/ui.test.ts src/components/ui/badge.tsx src/components/ui/badge.test.tsx
git commit -m "style: botao/input com raio modesto sem sombra, badge vira pill"
```

---

### Task 4: Tokens de tabela e títulos de página

**Files:**
- Modify: `src/app/globals.css:232-234` (regra `.table-institucional th`)
- Modify: `src/app/clientes/page.tsx:27`
- Modify: `src/app/clientes/[id]/page.tsx:175`
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx:346`
- Create: `src/app/clientes/page.test.tsx`
- Modify: `src/app/clientes/[id]/page.test.tsx` (adiciona teste)
- Modify: `src/app/clientes/[id]/[competencia]/page.test.tsx` (adiciona teste)

**Interfaces:**
- Consumes: `mockFetch`/`mockFetchCompetencia`/`renderPagina` das Tasks 1 e 2 (mesmos arquivos de teste).
- Produces: nada consumido adiante.

- [ ] **Step 1: Escrever o teste que falha para `clientes/page.tsx`**

Crie `src/app/clientes/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import ClientesPage from './page'

describe('ClientesPage', () => {
  it('usa font-semibold no título (não font-bold)', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    ) as unknown as jest.Mock

    render(<ClientesPage />)
    const heading = await screen.findByRole('heading', { name: 'Clientes' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })
})
```

- [ ] **Step 2: Adicionar os testes que falham para as outras duas páginas**

Em `src/app/clientes/[id]/page.test.tsx`, dentro do `describe('ClienteDetalhePage', ...)`:

```tsx
  it('usa font-semibold no título (não font-bold)', async () => {
    renderPagina()
    const heading = await screen.findByRole('heading', { name: 'Prefeitura X' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })
```

Em `src/app/clientes/[id]/[competencia]/page.test.tsx`, dentro do `describe('ClienteCompetenciaPage', ...)`:

```tsx
  it('usa font-semibold no título (não font-bold)', async () => {
    mockFetchCompetencia()
    renderPagina()
    const heading = await screen.findByRole('heading', { name: 'Agosto/2026' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })
```

- [ ] **Step 3: Rodar os três arquivos de teste e confirmar que falham**

Run: `npm test -- src/app/clientes/page.test.tsx "src/app/clientes/[id]/page.test.tsx" "src/app/clientes/[id]/[competencia]/page.test.tsx"`
Expected: FAIL nos três novos testes — os títulos ainda têm `font-bold`

- [ ] **Step 4: Editar os três títulos H1**

`src/app/clientes/page.tsx:27`, de:

```tsx
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-navy">Clientes</h1>
```

para:

```tsx
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Clientes</h1>
```

`src/app/clientes/[id]/page.tsx:175`, de:

```tsx
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-navy">{cliente.nome}</h1>
```

para:

```tsx
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">{cliente.nome}</h1>
```

`src/app/clientes/[id]/[competencia]/page.tsx:346`, de:

```tsx
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-navy capitalize">
```

para:

```tsx
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy capitalize">
```

- [ ] **Step 5: Rodar os três arquivos de teste e confirmar que passam**

Run: `npm test -- src/app/clientes/page.test.tsx "src/app/clientes/[id]/page.test.tsx" "src/app/clientes/[id]/[competencia]/page.test.tsx"`
Expected: PASS

- [ ] **Step 6: Editar o cabeçalho da tabela em `globals.css`**

Regra atual (por volta da linha 232):

```css
  .table-institucional th {
    @apply px-3.5 py-3 text-xs font-semibold tracking-wide text-white/90 uppercase first:rounded-tl-xl last:rounded-tr-xl;
  }
```

Substitua por (remove `tracking-wide` e `uppercase`; mantém `font-semibold` — cabeçalho continua se diferenciando das linhas de dado só por peso, sem gritar em caixa alta):

```css
  .table-institucional th {
    @apply px-3.5 py-3 text-xs font-semibold text-white/90 first:rounded-tl-xl last:rounded-tr-xl;
  }
```

Não há infraestrutura de teste de CSS neste projeto (nenhum arquivo `*.css` é processado pelo Jest/jsdom) — verificar essa mudança rodando `npm run build` (Step 7) e conferindo visualmente o cabeçalho de qualquer tabela (ex: lista de documentos) depois.

- [ ] **Step 7: Rodar o build pra garantir que o CSS continua válido**

Run: `npm run build`
Expected: build conclui sem erro

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/app/clientes/page.tsx "src/app/clientes/[id]/page.tsx" "src/app/clientes/[id]/[competencia]/page.tsx" src/app/clientes/page.test.tsx "src/app/clientes/[id]/page.test.tsx" "src/app/clientes/[id]/[competencia]/page.test.tsx"
git commit -m "style: titulos de pagina em font-semibold, cabecalho de tabela sem uppercase"
```

---

### Task 5: Aba Relatório Consolidado — seletor migra pra dentro da aba, hierarquia e ajuda

Esta é a task que resolve o problema original relatado: fluxo de geração desconectado,
falta de veredito em destaque, falta de ajuda visível.

**Files:**
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx`
- Modify: `src/app/clientes/[id]/[competencia]/page.test.tsx` (adiciona testes)

**Interfaces:**
- Consumes: `mockFetchCompetencia` e `renderPagina` de Task 1; `fireEvent` já importado em Task 2. Estado e handlers já existentes no componente (`documentos`, `selecionados`, `toggleSelecionado`, `handleGerarConsolidada`, `gerandoConsolidada`, `erroConsolidada`, `analisesConsolidadas`, `analiseAtual`, `analisesAnteriores`, `divergenciasAtuais`) — nenhum muda de assinatura, só de lugar na árvore JSX.
- Produces: novo estado local `seletorConsolidadaAberto: boolean` (não é usado fora deste arquivo).

- [ ] **Step 1: Escrever os testes que falham**

Adicione ao final do `describe('ClienteCompetenciaPage', ...)` em
`src/app/clientes/[id]/[competencia]/page.test.tsx`:

```tsx
  it('aba Documentos não mostra mais seleção nem barra de gerar relatório', async () => {
    mockFetchCompetencia({
      documentos: [
        {
          id: 'doc-1',
          nomeArquivo: 'a.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-01T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-1' },
        },
        {
          id: 'doc-2',
          nomeArquivo: 'b.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-02T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-2' },
        },
      ],
    })
    renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gerar relatório consolidado/ })).not.toBeInTheDocument()
  })

  it('aba Relatório Consolidado mostra o seletor de documentos quando não há relatório gerado', async () => {
    mockFetchCompetencia({
      documentos: [
        {
          id: 'doc-1',
          nomeArquivo: 'a.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-01T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-1' },
        },
        {
          id: 'doc-2',
          nomeArquivo: 'b.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-02T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-2' },
        },
      ],
    })
    renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    fireEvent.click(screen.getByRole('button', { name: /Relatório consolidado/ }))

    expect(await screen.findByText('Marque os documentos que devem bater entre si')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Gerar relatório consolidado/ })).toBeInTheDocument()
  })

  it('aba Relatório Consolidado mostra o veredito e permite reabrir o seletor quando já existe relatório', async () => {
    mockFetchCompetencia({
      documentos: [
        {
          id: 'doc-1',
          nomeArquivo: 'a.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-01T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-1' },
        },
      ],
      analisesConsolidadas: [
        {
          id: 'ac-1',
          resumo: 'Os valores batem entre os documentos.',
          metricasComparadas: [
            {
              label: 'Total',
              valores: [{ documentoId: 'doc-1', nomeArquivo: 'a.xlsx', valorExibicao: 'R$ 100' }],
              divergencia: { diferencaPercentual: 0.1 },
            },
          ],
          createdAt: '2026-08-10T00:00:00Z',
          documentos: [{ id: 'doc-1', nomeArquivo: 'a.xlsx' }],
        },
      ],
    })
    renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    fireEvent.click(screen.getByRole('button', { name: /Relatório consolidado/ }))

    expect(await screen.findByText('1 divergência encontrada')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/Baseado em:/))
    expect(await screen.findByRole('checkbox')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- "src/app/clientes/[id]/[competencia]/page.test.tsx"`
Expected: FAIL nos três novos testes (checkbox ainda existe na aba Documentos, "Marque os documentos..." não existe, "1 divergência encontrada" não existe)

- [ ] **Step 3: Adicionar o estado `seletorConsolidadaAberto`**

Junto aos outros `useState` do componente (perto de `historicoAberto`), adicione:

```tsx
  const [seletorConsolidadaAberto, setSeletorConsolidadaAberto] = useState(false)
```

- [ ] **Step 4: Ajustar `handleGerarConsolidada` pra recolher o seletor após gerar**

Função atual:

```tsx
  async function handleGerarConsolidada() {
    if (selecionados.length < 2) return
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
      setErroConsolidada(body?.error ?? 'Falha ao gerar o relatório consolidado.')
      return
    }
    selecaoManualRef.current = false
    setSelecionados([])
    setAba('consolidada')
    carregar()
  }
```

Adicione `setSeletorConsolidadaAberto(false)` logo antes de `carregar()`:

```tsx
  async function handleGerarConsolidada() {
    if (selecionados.length < 2) return
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
      setErroConsolidada(body?.error ?? 'Falha ao gerar o relatório consolidado.')
      return
    }
    selecaoManualRef.current = false
    setSelecionados([])
    setAba('consolidada')
    setSeletorConsolidadaAberto(false)
    carregar()
  }
```

- [ ] **Step 5: Simplificar a aba Documentos — remover coluna de seleção**

Dentro do bloco `{aba === 'documentos' && (...)}`, a tabela de documentos hoje tem uma
coluna de checkbox. O `<thead>` atual:

```tsx
                      <thead>
                        <tr>
                          <th></th>
                          <th>Arquivo</th>
                          <th>Tipo</th>
                          <th>Enviado por</th>
                          <th>Quando</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
```

Remova o `<th></th>` vazio:

```tsx
                      <thead>
                        <tr>
                          <th>Arquivo</th>
                          <th>Tipo</th>
                          <th>Enviado por</th>
                          <th>Quando</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
```

No `<tbody>`, cada `<tr>` tem uma `<td>` de checkbox logo no início:

```tsx
                          <tr key={doc.id}>
                            <td>
                              <input
                                type="checkbox"
                                disabled={doc.status !== 'concluido'}
                                checked={selecionados.includes(doc.id)}
                                onChange={() => toggleSelecionado(doc.id)}
                                className="size-4 accent-orange"
                              />
                            </td>
                            <td className="font-medium text-navy">{doc.nomeArquivo}</td>
```

Remova essa `<td>` de checkbox:

```tsx
                          <tr key={doc.id}>
                            <td className="font-medium text-navy">{doc.nomeArquivo}</td>
```

- [ ] **Step 6: Remover o parágrafo de dica e a barra fixa de seleção da aba Documentos**

Remova o parágrafo (logo antes da tabela):

```tsx
              {documentos.filter((d) => d.status === 'concluido').length >= 2 && (
                <p className="flex items-center gap-1.5 text-xs text-mid-grey">
                  <Layers className="size-3.5 shrink-0 text-mid-grey/70" strokeWidth={2.25} />
                  Todos os documentos concluídos vêm marcados pra comparação — desmarque os que não devem entrar na análise consolidada.
                </p>
              )}
```

Troque o `className` do container da tabela — hoje ele reserva espaço pra barra fixa:

```tsx
                <div className={cn('card-flush', selecionados.length > 0 && 'pb-16')}>
```

vira:

```tsx
                <div className="card-flush">
```

E remova o bloco inteiro da barra fixa de geração, que hoje fica logo depois do
`</div>` de fechamento da tabela e antes do fechamento da aba Documentos:

```tsx
              {selecionados.length > 0 && (
                <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-navy/10 bg-white/95 p-3 pl-4 shadow-xl backdrop-blur-sm">
                  {selecionados.length === 1 ? (
                    <span className="text-sm text-mid-grey">
                      1 documento selecionado — marque pelo menos mais 1 pra comparar valores entre eles.
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-navy">
                      {selecionados.length} documentos selecionados pra comparar
                    </span>
                  )}
                  <button
                    onClick={handleGerarConsolidada}
                    disabled={gerandoConsolidada || selecionados.length < 2}
                    title={selecionados.length < 2 ? 'Selecione pelo menos 2 documentos' : undefined}
                    className={cn(BTN_PRIMARY, 'ml-auto')}
                  >
                    {gerandoConsolidada ? (
                      <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                    ) : (
                      <Layers className="size-3.5" strokeWidth={2.25} />
                    )}
                    {gerandoConsolidada ? 'Gerando...' : 'Gerar relatório consolidado'}
                  </button>
                  <button onClick={() => setSelecionados([])} className="text-sm font-medium text-mid-grey hover:text-navy">
                    Limpar
                  </button>
                  {erroConsolidada && (
                    <span className="flex w-full items-center gap-1 text-sm text-red-crit">
                      <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
                      {erroConsolidada}
                    </span>
                  )}
                </div>
              )}
```

(Esse bloco some daqui e reaparece, adaptado, dentro da aba Relatório Consolidado no
próximo step.)

- [ ] **Step 7: Reescrever o conteúdo da aba `consolidada`**

Todo o bloco `{aba === 'consolidada' && (...)}` (que hoje cobre o estado vazio, o
card "Análise mais recente" e o histórico) é substituído por:

```tsx
          {aba === 'consolidada' && (
            <div className="space-y-3">
              <p className="text-sm text-mid-grey">
                Compara números que deveriam bater entre documentos diferentes do mesmo mês — pra achar
                divergência antes de fechar a competência.
              </p>

              {(analisesConsolidadas.length === 0 || seletorConsolidadaAberto) && (
                <Card className="space-y-3">
                  <p className="text-sm font-medium text-navy">Marque os documentos que devem bater entre si</p>

                  {documentos.filter((d) => d.status === 'concluido').length < 2 ? (
                    <p className="text-sm text-mid-grey">
                      Precisa de pelo menos 2 documentos concluídos no mesmo mês pra comparar. Envie mais
                      documentos na aba Documentos.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {documentos
                        .filter((d) => d.status === 'concluido')
                        .map((doc) => (
                          <li key={doc.id}>
                            <label className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-light-grey/60">
                              <input
                                type="checkbox"
                                checked={selecionados.includes(doc.id)}
                                onChange={() => toggleSelecionado(doc.id)}
                                className="size-4 accent-orange"
                              />
                              <span className="truncate text-navy">{doc.nomeArquivo}</span>
                            </label>
                          </li>
                        ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleGerarConsolidada}
                      disabled={gerandoConsolidada || selecionados.length < 2}
                      title={selecionados.length < 2 ? 'Selecione pelo menos 2 documentos' : undefined}
                      className={BTN_PRIMARY}
                    >
                      {gerandoConsolidada ? (
                        <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                      ) : (
                        <Layers className="size-3.5" strokeWidth={2.25} />
                      )}
                      {gerandoConsolidada ? 'Gerando...' : 'Gerar relatório consolidado'}
                    </button>
                    {analisesConsolidadas.length > 0 && (
                      <button
                        onClick={() => setSeletorConsolidadaAberto(false)}
                        className="text-sm font-medium text-mid-grey hover:text-navy"
                      >
                        Cancelar
                      </button>
                    )}
                    {erroConsolidada && (
                      <span className="flex w-full items-center gap-1 text-sm text-red-crit">
                        <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
                        {erroConsolidada}
                      </span>
                    )}
                  </div>
                </Card>
              )}

              {analiseAtual && !seletorConsolidadaAberto && (
                <>
                  <Card className="space-y-3 border-l-[3px] border-l-orange text-sm">
                    {divergenciasAtuais.length > 0 ? (
                      <Stat tone="critical">
                        <AlertTriangle className="size-3.5" strokeWidth={2.5} />
                        {divergenciasAtuais.length} divergência{divergenciasAtuais.length === 1 ? '' : 's'} encontrada
                        {divergenciasAtuais.length === 1 ? '' : 's'}
                      </Stat>
                    ) : (
                      <Stat tone="success">
                        <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
                        Sem divergências
                      </Stat>
                    )}

                    <div className="flex items-start gap-2 rounded-lg bg-navy/[0.03] p-3">
                      <Sparkles className="size-4 shrink-0 translate-y-0.5 text-orange" strokeWidth={1.75} />
                      <p className="text-foreground">{analiseAtual.resumo}</p>
                    </div>

                    <div className="overflow-hidden overflow-x-auto rounded-lg border border-border-grey">
                      <table className="table-institucional">
                        <thead>
                          <tr>
                            <th>Métrica</th>
                            {analiseAtual.documentos.map((d) => (
                              <th key={d.id} className="truncate normal-case" title={d.nomeArquivo}>
                                {d.nomeArquivo}
                              </th>
                            ))}
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analiseAtual.metricasComparadas.map((m) => (
                            <tr key={m.label}>
                              <td className="font-medium text-navy">{m.label}</td>
                              {analiseAtual.documentos.map((d) => {
                                const valor = m.valores.find((v) => v.documentoId === d.id)
                                return (
                                  <td key={d.id} className="text-mid-grey">
                                    {valor?.valorExibicao ?? '—'}
                                  </td>
                                )
                              })}
                              <td>
                                {m.divergencia ? (
                                  <Badge variant="critical">
                                    Divergência
                                    {m.divergencia.diferencaPercentual != null
                                      ? ` (${(m.divergencia.diferencaPercentual * 100).toFixed(1)}%)`
                                      : ''}
                                  </Badge>
                                ) : (
                                  <Badge variant="success">OK</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-grey pt-3 text-xs text-mid-grey">
                      <button
                        onClick={() => setSeletorConsolidadaAberto(true)}
                        className="text-left font-medium text-mid-grey hover:text-navy"
                      >
                        Baseado em: {analiseAtual.documentos.map((d) => d.nomeArquivo).join(', ')} · Gerar novo
                        relatório
                      </button>
                      <div className="flex shrink-0 items-center gap-3">
                        <span>{new Date(analiseAtual.createdAt).toLocaleString('pt-BR')}</span>
                        <a
                          href={`/api/analises-consolidadas/${analiseAtual.id}/relatorio`}
                          className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline"
                        >
                          <FileDown className="size-3.5" strokeWidth={2.25} />
                          Baixar PDF
                        </a>
                      </div>
                    </div>
                  </Card>

                  {analisesAnteriores.length > 0 && (
                    <div>
                      <button
                        onClick={() => setHistoricoAberto((v) => !v)}
                        className="flex items-center gap-1.5 text-sm font-medium text-mid-grey hover:text-navy"
                      >
                        <History className="size-3.5" strokeWidth={2.25} />
                        {historicoAberto ? 'Ocultar' : 'Ver'} histórico ({analisesAnteriores.length} anterior
                        {analisesAnteriores.length === 1 ? '' : 'es'})
                        <ChevronRight
                          className={cn('size-3.5 transition-transform', historicoAberto && 'rotate-90')}
                          strokeWidth={2.25}
                        />
                      </button>

                      {historicoAberto && (
                        <ul className="mt-2 space-y-2">
                          {analisesAnteriores.map((analise) => {
                            const divergenciasAnalise = analise.metricasComparadas.filter((m) => m.divergencia)
                            return (
                              <li key={analise.id} className="card flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-mid-grey">{new Date(analise.createdAt).toLocaleString('pt-BR')}</p>
                                    {divergenciasAnalise.length > 0 ? (
                                      <Badge variant="critical">
                                        {divergenciasAnalise.length} divergência{divergenciasAnalise.length === 1 ? '' : 's'}
                                      </Badge>
                                    ) : (
                                      <Badge variant="success">OK</Badge>
                                    )}
                                  </div>
                                  <p className="mt-1 truncate text-foreground">{analise.resumo}</p>
                                </div>
                                <a
                                  href={`/api/analises-consolidadas/${analise.id}/relatorio`}
                                  className="flex shrink-0 items-center gap-1.5 font-medium text-navy hover:underline"
                                >
                                  <FileDown className="size-3.5" strokeWidth={2.25} />
                                  PDF
                                </a>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
```

Note que `analiseAtual` já é `analisesConsolidadas[0] ?? null` (calculado antes do
`return`, sem mudança) — o `!` não é mais necessário porque agora o card só
renderiza dentro do `{analiseAtual && ...}`, então dentro desse bloco o TypeScript já
sabe que não é `null` (troque todo `analiseAtual!` por `analiseAtual` nos trechos
copiados acima — já está assim nos blocos de código deste step).

- [ ] **Step 8: Remover o rótulo uppercase das abas, mantendo negrito só na ativa**

O botão de cada aba hoje é:

```tsx
                  className={cn(
                    'group relative flex shrink-0 items-center gap-2 py-3 text-[0.8rem] font-semibold whitespace-nowrap tracking-wide uppercase transition-colors',
                    ativa ? 'text-navy' : 'text-mid-grey hover:text-navy'
                  )}
```

Troque por (remove `tracking-wide uppercase`, peso `font-semibold` só quando ativa):

```tsx
                  className={cn(
                    'group relative flex shrink-0 items-center gap-2 py-3 text-[0.8rem] whitespace-nowrap transition-colors',
                    ativa ? 'font-semibold text-navy' : 'font-medium text-mid-grey hover:text-navy'
                  )}
```

- [ ] **Step 9: Rodar todos os testes do arquivo e confirmar que passam**

Run: `npm test -- "src/app/clientes/[id]/[competencia]/page.test.tsx"`
Expected: PASS em todos os testes do arquivo (Task 1, 2, 4 e 5)

- [ ] **Step 10: Rodar a suíte inteira pra garantir que nada mais quebrou**

Run: `npm test`
Expected: PASS em todos os arquivos de teste do projeto

- [ ] **Step 11: Commit**

```bash
git add "src/app/clientes/[id]/[competencia]/page.tsx" "src/app/clientes/[id]/[competencia]/page.test.tsx"
git commit -m "feat: seletor de documentos migra para a aba Relatorio Consolidado com veredito em destaque"
```

---

### Task 6: Verificação final

**Files:** nenhum (só validação).

**Interfaces:** nenhuma.

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes passam, incluindo os novos criados nas Tasks 1-5

- [ ] **Step 2: Rodar o lint**

Run: `npm run lint`
Expected: sem erros

- [ ] **Step 3: Rodar o build de produção**

Run: `npm run build`
Expected: build conclui sem erro (confirma que o CSS editado na Task 4 continua válido)

- [ ] **Step 4: Verificação visual manual**

Rodar `npm run dev`, logar, e conferir manualmente em `/clientes/[id]/[competencia]`:

- Breadcrumb começa com "Análise de Documentos" (Task 1)
- Abas dizem "Relatório consolidado" e "Relatório de evolução", sem uppercase (Tasks 2, 5)
- Aba Documentos não tem mais checkbox nem barra fixa (Task 5)
- Aba Relatório Consolidado abre com o seletor quando não há relatório, e com o
  veredito de divergência em destaque quando já existe um (Task 5)
- Botões parecem mais leves (raio ~8px, sem sombra, peso médio) e badges são pill
  (Task 3)
- Cabeçalho de tabela não está mais em uppercase (Task 4)

Não há checkbox de "passou"/"falhou" automatizado pra este step — é confirmação
visual do humano que está rodando o plano.

- [ ] **Step 5: Nenhum commit neste passo — Task 6 é só verificação sobre os commits já feitos nas Tasks 1-5.**
