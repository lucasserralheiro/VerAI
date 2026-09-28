# TC/TA abre a mesma janela da PC/PA — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O ícone TC/TA da aba Contratos abre a mesma janela do ícone PC/PA (lista de todos os termos do
contrato, Abrir PDF, Converter/Abrir em Markdown) em vez de abrir direto o PDF do termo mais recente.

**Design:** `docs/superpowers/specs/2026-09-28-tcta-janela-do-contrato-design.md`

**Architecture:** Uma janela só (`DocumentosDoContrato`) parametrizada por `coluna: 'proposta' | 'termo'`,
e um filtro só (`documentosDoContrato`) com a regra da PC/PA espelhada para TC/TA.

**Tech Stack:** React 19 client component, Jest + Testing Library.

## Global Constraints

- Nada novo nas janelas: só Abrir PDF e Converter/Abrir em Markdown (decisão do usuário, 28/09).
- `urlBlob` nunca vai pro navegador — PDF sempre por `/api/arquivos/[id]?modo=inline`.
- Commit: `propostas-do-contrato.tsx`, `derivados.ts` e `aba-contratos.tsx` já têm trabalho anterior sem
  commit (conversão de arquivo do cliente) — não commitar sem combinar com o usuário.

---

### Task 1: filtro `documentosDoContrato`

**Status:** ✅ Concluída em 28/09/2026 (commit pendente — arquivos com trabalho anterior sem commit).

**Files:**
- Modify: `src/app/clientes/[id]/abas/documentos/derivados.ts` (`propostasDoContrato`)
- Test: `src/app/clientes/[id]/abas/documentos/derivados.test.ts` (describe `propostasDoContrato`)

**Interfaces:**
- Produces: `export type ColunaDoContrato = 'proposta' | 'termo'` e
  `documentosDoContrato<T extends Pick<ArquivoRepositorio, 'categoria' | 'usos'>>(arquivos: T[], contratoId: string, coluna: ColunaDoContrato): T[]`
  (substitui `propostasDoContrato`).

- [x] **Step 1: teste falhando** — trocar o describe por:

```ts
describe('documentosDoContrato', () => {
  const arquivo = (id: string, categoria: string, usos: UsoArquivo[]) => ({ id, categoria, usos }) as never
  const naColunaProposta = arquivo('a1', 'OUTRO', [{ ...uso(k1, null), tipo: 'historico-contrato', coluna: 'proposta' }])
  const paPelaCategoria = arquivo('a2', 'PROPOSTA_ADITIVO', [{ ...uso(k1, null), tipo: 'sharepoint' }])
  const naColunaTermo = arquivo('a3', 'OUTRO', [{ ...uso(k1, null), tipo: 'historico-contrato', coluna: 'termo' }])
  const taPelaCategoria = arquivo('a4', 'TERMO_ADITIVO', [{ ...uso(k1, null), tipo: 'sharepoint' }])
  const outroContrato = arquivo('a5', 'TERMO_CONTRATO', [{ ...uso(k2, null), tipo: 'sharepoint' }])
  const todos = [naColunaProposta, paPelaCategoria, naColunaTermo, taPelaCategoria, outroContrato]
  const ids = (lista: { id: string }[]) => lista.map((a) => a.id)

  it('PC/PA deste contrato: coluna proposta do histórico ou categoria de proposta ligada a ele', () => {
    expect(ids(documentosDoContrato(todos, 'k1', 'proposta'))).toEqual(['a1', 'a2'])
  })

  it('TC/TA deste contrato: coluna termo do histórico ou categoria de termo ligada a ele', () => {
    expect(ids(documentosDoContrato(todos, 'k1', 'termo'))).toEqual(['a3', 'a4'])
  })
})
```

- [x] **Step 2:** `npx jest "src/app/clientes/\[id\]/abas/documentos/derivados.test.ts"` → FAIL (`documentosDoContrato` não existe)
- [x] **Step 3: implementação**

```ts
export type ColunaDoContrato = 'proposta' | 'termo'

const CATEGORIAS_DA_COLUNA: Record<ColunaDoContrato, string[]> = {
  proposta: ['PROPOSTA_COMERCIAL', 'PROPOSTA_ADITIVO'],
  termo: ['TERMO_CONTRATO', 'TERMO_ADITIVO'],
}

/** PC/PA ou TC/TA de um contrato: o arquivo ocupa aquela coluna do histórico do contrato, ou é da
 *  categoria da coluna e tem algum uso ligado ao contrato. */
export function documentosDoContrato<T extends Pick<ArquivoRepositorio, 'categoria' | 'usos'>>(
  arquivos: T[],
  contratoId: string,
  coluna: ColunaDoContrato
): T[] {
  const daCategoria = (a: T) => CATEGORIAS_DA_COLUNA[coluna].includes(a.categoria)
  return arquivos.filter((a) => a.usos.some((u) => u.contrato?.id === contratoId && (u.coluna === coluna || daCategoria(a))))
}
```

- [x] **Step 4:** rodar de novo → PASS

### Task 2: janela `DocumentosDoContrato` + ícone TC/TA

**Status:** ✅ Código e testes concluídos em 28/09/2026; conferido com dados reais do dev (COVISA: 2 PC/PA, 4 TC/TA; SP REGULA: 4 PC/PA, 7 TC/TA). Falta ver na tela (sem login de dev nesta sessão) e o commit.

**Files:**
- Rename: `src/app/clientes/[id]/contratos/propostas-do-contrato.tsx` → `documentos-do-contrato.tsx` (e o `.test.tsx`)
- Modify: `src/app/clientes/[id]/abas/aba-contratos.tsx` (estado `propostasDe`, `IconePdf`, células PC/PA e TC/TA)
- Test: `documentos-do-contrato.test.tsx`, `aba-contratos.test.tsx`

**Interfaces:**
- Consumes: `documentosDoContrato`, `ColunaDoContrato` (Task 1).
- Produces: `DocumentosDoContrato({ clienteId, contrato, coluna, aoFechar })`.

- [x] **Step 1: testes falhando** — no teste da janela, `abrir(coluna = 'proposta')` renderiza
  `<DocumentosDoContrato … coluna={coluna} />`, e mais dois casos:

```tsx
it('TC/TA: lista só os termos do contrato, com o título do TC/TA', async () => {
  abrir('termo')

  expect(await screen.findByText('TC-COVISA.pdf')).toBeInTheDocument()
  expect(screen.queryByText('PC-COVISA.pdf')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'TC/TA do TC 012/2020' })).toBeInTheDocument()
  expect(screen.getByText(/TC\/TA de Contrato/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Converter TC-COVISA.pdf em Markdown' })).toBeInTheDocument()
})

it('contrato sem TC/TA diz isso', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ arquivos: [PC] }) })
  abrir('termo')

  expect(await screen.findByText(/nenhum TC\/TA/i)).toBeInTheDocument()
})
```

  E na aba: contrato com `resumoHistorico.termo` mostra o botão `TC/TA do TC …` (não um link pro PDF), e
  o clique abre a janela `TC/TA do contrato`.

- [x] **Step 2:** rodar os dois testes → FAIL
- [x] **Step 3: implementação** — a janela troca `propostasDoContrato(…)` por
  `documentosDoContrato(…, coluna)`, e os textos saem de um mapa por coluna:

```ts
const TEXTOS: Record<ColunaDoContrato, { sigla: string; escolha: string; nenhum: string; procurando: string }> = {
  proposta: { sigla: 'PC/PA', escolha: 'Escolha a proposta para abrir ou converter em Markdown.', nenhum: 'Nenhuma PC/PA ligada a este contrato.', procurando: 'Procurando as propostas...' },
  termo: { sigla: 'TC/TA', escolha: 'Escolha o termo para abrir ou converter em Markdown.', nenhum: 'Nenhum TC/TA ligado a este contrato.', procurando: 'Procurando os termos...' },
}
```

  `detalheDaProposta` → `detalheDoDocumento(arquivo, contratoId, coluna)` (uso com `u.coluna === coluna`).
  Na aba, o estado vira `janela: { contrato: Contrato; coluna: ColunaDoContrato } | null`, as duas células
  usam um `BotaoDocumentos` (botão quando há anexo no resumo, senão o traço) e `IconePdf` sai.

- [x] **Step 4:** rodar os testes → PASS; `npx tsc --noEmit`; `npx eslint` nos arquivos tocados
- [ ] **Step 5:** conferir na tela (aba Contratos → ícone TC/TA)
- [x] **Step 6:** atualizar o CLAUDE.md (§ Repositório: "a janela 'PC/PA do contrato'" → "a janela PC/PA ou
  TC/TA do contrato") — commit combinado com o usuário
