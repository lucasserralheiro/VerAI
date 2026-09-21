# PLANO 055 — Implementação de "A sobrescrita que quase trocou de major"

| | |
|---|---|
| **Especificação** | [ESPEC 055](../specs/055-a-sobrescrita-que-quase-trocou-de-major.md) v1.0 |
| **Versão** | 1.0 — 2026-09-14 |
| **Backlog** | [TASKS 055](../tasks/055-tasks-a-sobrescrita-que-quase-trocou-de-major.md) — numeração continua de `T-2796`, a última em uso (TASKS 053) |
| **Estado inicial** | Branch `feature/evolucao`, árvore com a implementação já aplicada e não commitada: `frontend/package.json` (bump de `sharp` + `pnpm.overrides`) e `frontend/pnpm-lock.yaml` (regenerado) modificados; `docs/specs/055-a-sobrescrita-que-quase-trocou-de-major.md` novo, não rastreado. `pnpm lint`, `pnpm build` e `pnpm audit` (7 → 0) já foram rodados e registrados na ESPEC 055 §8 — este plano existe para confirmar essa reprodução de forma auditável e fechar a entrega |
| **Colisão conhecida** | **Nenhuma.** Este plano toca `frontend/package.json`, `frontend/pnpm-lock.yaml`, o status de `docs/specs/055-...md`, `docs/CHANGELOG.md` e `README.md` — mesmos arquivos de natureza que a ESPEC 048 já tocou, sem sobreposição com trabalho em curso |
| **Instrumento existente** | A validação já foi medida, não só argumentada: ESPEC 055 §8 registra `pnpm lint`, `pnpm build` e `pnpm audit` (7 → 0) limpos. Este plano roda os mesmos comandos de novo, como portão formal, antes de fechar |

---

## 1. O que este plano tem de diferente

> **A implementação já existe; este plano é a reprodução e o fechamento.** Diferente da ESPEC 048 (onde o PLANO precedia o código), aqui `frontend/package.json`/`pnpm-lock.yaml` já foram alterados numa sessão de análise anterior. F1 não é "aplicar a mudança" — é confirmar que ela se reproduz de forma limpa, como portão auditável, antes de qualquer commit.

> **Não há suíte E2E neste plano.** `D-07` da ESPEC 055 já justificou por quê: nenhum dos quatro pacotes (`postcss`, `nanoid`, `sharp`, `js-yaml`) roda no container de produção (`frontend/Dockerfile`, estágio `runner`, sem `node_modules`). O portão de regressão aqui é `pnpm build` limpo, não a suíte completa.

> **Um único commit de fechamento**, no molde do commit `50427ed` da ESPEC 048 — código, ESPEC, PLANO, TASKS, `CHANGELOG` e `README` juntos. Não há aqui o caso de dois motivos distintos (como o `T-543` alheio ao Next em 048); toda a mudança desta entrega tem a mesma causa.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Reprodução confirmada** | Fim da F1 | `pnpm install` sem *prompt* novo; `pnpm lint` e `pnpm build` limpos; `pnpm audit` sem nenhum dos 7 achados da ESPEC 055 §1 | Investigar a divergência antes de prosseguir — se a reprodução não bate com a ESPEC, a ESPEC está desatualizada ou o ambiente mudou |
| **P1 — Fechamento** | Fim da F2 | ESPEC 055 com status confirmado; `CHANGELOG`/`README` atualizados; commit único criado; `git diff --stat` só nos arquivos previstos | Não fechar a entrega |

---

## 3. Fases

### F0 — Preparação

| # | Tarefa | Ref. |
|---|---|---|
| T-2797 | Confirmar o estado da árvore: `git status --short` → só `frontend/package.json` e `frontend/pnpm-lock.yaml` modificados, `docs/specs/055-...md` não rastreado. Nenhum arquivo de `backend/` ou `frontend/src/` tocado | — |

**Verificação:** preparação. **Tamanho:** PP.

---

### F1 — Reprodução da validação `[portão P0]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2798 | `pnpm install` — confirma que a árvore resolve de forma determinística a partir do `package.json`/`pnpm-lock.yaml` já commitáveis, sem pedir aprovação de script de build novo | `R-DEP-06`, `R-DEP-07` |
| T-2799 | `pnpm lint` | `R-DEP-08` |
| T-2800 | `pnpm build` — completa, gera as 5 páginas estáticas | `R-DEP-08` |
| T-2801 | `pnpm audit` — confirma `No known vulnerabilities found`, nenhum dos 7 achados de `postcss`/`sharp`/`nanoid`/`js-yaml` | `R-DEP-08` |
| T-2802 | **[portão]** T-2798–T-2801 no estado esperado, batendo com ESPEC 055 §8 | **P0** |

**Verificação:** P0. **Tamanho:** PP — dez minutos.

---

### F2 — Fechamento `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2803 | `docs/CHANGELOG.md` — entrada nova, no molde das anteriores, citando o quase-incidente do `>=` sem teto de major (ESPEC 055 §2.5) | — |
| T-2804 | Linha "Incremento 055" em `README.md`, no molde das demais | — |
| T-2805 | Commit único: `frontend/package.json`, `frontend/pnpm-lock.yaml`, `docs/specs/055-...md`, `docs/plans/055-...md`, `docs/tasks/055-...md`, `docs/CHANGELOG.md`, `README.md` — mesmo molde do commit `50427ed` da ESPEC 048 | `R-DEP-07` |
| T-2806 | **[portão]** `git diff --stat` do commit contra o `HEAD` anterior: só os arquivos previstos — nada em `backend/`, nada em `frontend/src/` | **P1** |

**Verificação:** P1. **Tamanho:** PP — quinze minutos.

---

## 4. Sequência

```
F0 ──► F1 ──► F2
       P0     P1
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~30 minutos |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| A reprodução (F1) não bater com o que a ESPEC 055 §8 registrou (ambiente mudou desde a análise) | `T-2802`/portão P0 — investigar antes de prosseguir para o fechamento |
| Commit de fechamento incluir algo fora do previsto (ex.: `frontend/tsconfig.tsbuildinfo`, como aconteceu na ESPEC 048) | `T-2806`/portão P1 — `git diff --stat` explícito antes de considerar fechado; artefato de build gerado incidentalmente não é motivo de bloqueio, mas precisa ser reconhecido, não ignorado |
| Alguém interpretar isto como autorização para publicar em produção | Fora do escopo — este plano termina no commit local, mesma régua da ESPEC 048 §"O que este plano não faz" |

---

## 6. O que este plano não faz

- **Não publica em produção** — decisão do usuário, fora deste plano, mesma régua da ESPEC 048.
- **Não roda a suíte E2E** — `D-07` da ESPEC 055 já justifica a dispensa.
- **Não mexe em `next`/`eslint-config-next`** — já fixados pela ESPEC 048, fora do escopo desta.
- **Não resolve `I-03` (gate de auditoria no pre-commit)** — decisão de processo separada, herdada em aberto.
- **Não commita nada fora do commit único explícito (`T-2805`)**.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Confirmação do estado da árvore | PP |
| F1 | Reprodução da validação (install, lint, build, audit) | PP |
| F2 | Documentos e commit de fechamento | PP |

**Total: ~30 minutos.** Entrega pequena — a implementação já existe; este plano é reprodução e fechamento.
