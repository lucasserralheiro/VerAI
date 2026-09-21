# PLANO 056 — Implementação de "O rodapé que ganhou link no logo e nos ícones sociais"

| | |
|---|---|
| **Especificação** | [ESPEC 056](../specs/056-o-logo-do-rodape-que-virou-link-para-o-portal.md) v1.1 |
| **Versão** | 1.0 — 2026-09-14 |
| **Backlog** | [TASKS 056](../tasks/056-tasks-o-logo-do-rodape-que-virou-link-para-o-portal.md) — numeração `T-28nn`, continuando de `T-2823`, a última em uso (PLANO 050) |
| **Estado inicial** | Branch `feature/evolucao`. E2E do frontend: **127 testes em 16 arquivos** (`pnpm exec playwright test --list`), nenhum cobre `Rodape.tsx` hoje |
| **Colisão conhecida** | A árvore carrega `frontend/package.json`/`frontend/pnpm-lock.yaml` modificados e as specs/plano/tasks da ESPEC 055, todos não commitados. Este plano **não toca nenhum desses arquivos** — soma-se a eles sem sobrepor |

---

## 1. O que este plano tem de diferente

> **É puro frontend, sem nenhuma camada de backend tocada.** Não há "portão de domínio" — o
> critério de correção é visual e de acessibilidade: os três elementos abrem o destino certo, em
> nova aba, e continuam alcançáveis e identificáveis por teclado (a mesma disciplina que a ESPEC 008
> já impôs ao resto da interface, reaproveitada aqui de graça via `R-ACE-04`).

> **A suíte e2e completa exige o backend no ar** (`playwright.config.ts` — `baseURL
> http://localhost:3000`, a maioria dos specs fala com `127.0.0.1:8000`). O teste novo desta entrega
> não depende de API — é só DOM estático —, então roda isolado sem backend; só o portão de "suíte
> completa sem regressão" (P2) exige o backend de pé.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base** | Fim da F0 | `git status` confere com o descrito acima; `pnpm dev` sobe sem erro; baseline e2e registrada (127/16) | Régua de outra árvore não serve |
| **P1 — Os três links, no navegador** | Fim da F1 | Clique no logo, no ícone do Instagram e no do LinkedIn abre cada URL certa em nova aba; `Tab` alcança os três em sequência com contorno visível; `/prodamsp` permanece fora de qualquer `<a>` | Reverter e revisar `D-01`–`D-08` da ESPEC |
| **P2 — Teste automatizado, sem regressão** | Fim da F2 | `rodape.spec.ts` verde; suíte completa (127 + novos) sem falha nova, com backend no ar | Reverter |
| **P3 — Fechamento** | Fim da F3 | `pnpm lint`/`pnpm build` limpos; ESPEC 006 e 056 atualizadas; `README`/`CHANGELOG`; commit único; `git diff --stat` restrito ao previsto | Não entregar |

---

## 3. Fases

### F0 — Preparação `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2824 | Confirmar `git status --short` (só o já descrito acima); `pnpm dev --port 3000` sobe limpo; `pnpm exec playwright test --list` → 127 testes em 16 arquivos, número registrado | **P0** |

**Tamanho:** PP — cinco minutos.

---

### F1 — Os três links em `Rodape.tsx` `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2825 | `<Image src="/prodam-branca.svg" .../>` passa a ficar dentro de `<a href="https://portal.prodam.sp.gov.br/" target="_blank" rel="noopener noreferrer" aria-label="Prodam — abrir o portal institucional em nova aba">` | `R-ROD-12`, `R-ROD-15`, `R-ROD-16` |
| T-2826 | `<Instagram .../>` passa a ficar dentro de `<a href="https://www.instagram.com/prodamsp/" target="_blank" rel="noopener noreferrer" aria-label="Instagram da Prodam — abre em nova aba">` | `R-ROD-13`, `R-ROD-15`, `R-ROD-16` |
| T-2827 | `<LinkedIn .../>` passa a ficar dentro de `<a href="https://br.linkedin.com/company/prodamsp" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn da Prodam — abre em nova aba">` | `R-ROD-14`, `R-ROD-15`, `R-ROD-16` |
| T-2828 | Afordância visual sutil de hover/focus nos três (ex.: `transition-opacity hover:opacity-80`), sem sublinhado, sem alterar o texto `/prodamsp` | `D-05` |
| T-2829 | **[portão]** Checagem manual no navegador: cada clique abre a URL certa em nova aba; `Tab` a partir do link social mais próximo alcança logo/Instagram/LinkedIn em sequência, cada um com `outline` visível; `/prodamsp` continua sem `href` | **P1** |

**Tamanho:** PP — vinte minutos.

---

### F2 — Teste e2e novo `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2830 | Criar `frontend/e2e/rodape.spec.ts`: os três `<a>` com `href`/`target`/`rel` corretos; nome acessível de cada um não vazio e distinto entre si; `/prodamsp` sem `href`; percurso de `Tab` alcança os três, com contorno computado > 0 (mesma técnica de `a11y-teclado.spec.ts`) | `R-ROD-12` a `R-ROD-17` |
| T-2831 | **[portão]** `pnpm exec playwright test e2e/rodape.spec.ts` verde; suíte completa com backend no ar (`127.0.0.1:8000`) — 127 + os novos, sem falha nova fora de `rodape.spec.ts` | **P2** |

**Tamanho:** PP — vinte minutos, mais o tempo da suíte completa.

---

### F3 — Fechamento `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2832 | `pnpm lint` e `pnpm build` limpos | — |
| T-2833 | `docs/specs/006-rodape-institucional.md`: nota de revisão em D-06 e no §10 ponto 1, apontando para a ESPEC 056 — sem reabrir o resto do documento | — |
| T-2834 | Status da ESPEC 056 (Proposta → Implementada); linha "Incremento 056" em `README.md`; entrada em `docs/CHANGELOG.md` | — |
| T-2835 | `git diff --stat`: restrito a `frontend/src/app/components/Rodape.tsx`, `frontend/e2e/rodape.spec.ts`, `docs/specs/006-...md`, `docs/specs/056-...md`, `docs/plans/056-...md`, `docs/tasks/056-...md`, `README.md`, `docs/CHANGELOG.md` — nada em `frontend/package.json`/`pnpm-lock.yaml` (ESPEC 055, separada), nada em `Barra.tsx`, nada em `backend/` | — |
| T-2836 | **[portão]** Commit único de fechamento, com a régua de `T-2835` conferida | **P3** |

**Tamanho:** PP — quinze minutos.

---

## 4. O que este plano não faz

- **Não toca `frontend/package.json`/`frontend/pnpm-lock.yaml`** — pertence à ESPEC 055, entrega separada, já em andamento na mesma árvore.
- **Não altera `Barra.tsx`** (logo "Confere" do cabeçalho) — marca diferente, fora do pedido.
- **Não torna `/prodamsp` um link** — `D-08` da ESPEC 056, decisão deliberada.
- **Não commita nada fora do commit único de `T-2836`.**

---

## 5. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Preparação | PP |
| F1 | Os três links + afordância visual | PP |
| F2 | Teste e2e novo | PP |
| F3 | Fechamento | PP |

**Estimativa: menos de uma hora**, mais o tempo da suíte e2e completa com backend no ar (~alguns minutos).
