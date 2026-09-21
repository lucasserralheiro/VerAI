# PLANO 048 — Implementação de "O Next.js que ficou vinte e um patches atrás"

| | |
|---|---|
| **Especificação** | [ESPEC 048](../specs/048-o-next-que-ficou-vinte-e-um-patches-atras.md) v1.1 |
| **Versão** | 1.0 — 2026-09-09 |
| **Backlog** | [TASKS 048](../tasks/048-tasks-o-next-que-ficou-vinte-e-um-patches-atras.md) — numeração continua de `T-2710`, a última em uso (ESPEC 047) |
| **Estado inicial** | Branch `feature/evolucao`, árvore com duas pendências não commitadas: a correção de `T-543` (`frontend/e2e/a11y-estrutura.spec.ts`, já feita — ESPEC 048 v1.1 §12) e o próprio `docs/specs/048-o-next-que-ficou-vinte-e-um-patches-atras.md` (novo, não rastreado). `frontend/package.json` ainda fixa `next`/`eslint-config-next` em `15.5.4`. Suíte E2E medida em 2026-09-09, já com a correção do `T-543` aplicada: **127 casos em 16 arquivos, 127/127**. Backend: **1.607 testes passed** (medido nesta sessão) — fora do escopo deste plano, nenhum arquivo de `backend/` é tocado |
| **Colisão conhecida** | **Nenhuma.** Este plano toca `frontend/package.json`, `frontend/pnpm-lock.yaml`, o status de `docs/specs/048-...md`, `docs/CHANGELOG.md` e `README.md`. O commit do `T-543` toca só `frontend/e2e/a11y-estrutura.spec.ts`, já editado e isolado do resto |
| **Instrumento existente** | A compatibilidade já foi medida, não só argumentada: ESPEC 048 §2.1 confere `node`/`react`/`eslint`/`typescript` contra os `peerDependencies` de `next@15.5.25` e `eslint-config-next@15.5.25` — todos dentro da faixa aceita, sem mudança de `Dockerfile`. E a linha de base da suíte E2E (§8/`R-DEP-05`) já está fechada em 127/127 |

---

## 1. O que este plano tem de diferente

> **Não há "escrever teste antes" no sentido clássico.** Este plano não introduz comportamento novo de aplicação — troca a versão de duas dependências. O portão que substitui o TDD é comparar a suíte E2E já existente (127 casos) antes e depois do bump, via `R-DEP-05` — a régua já existe, só precisa ser aplicada duas vezes.

> **A correção do `T-543` não é tarefa deste plano.** É trabalho já pronto, achado durante a medição da linha de base desta mesma ESPEC, mas de causa alheia a ela (ESPEC 031, não Next.js). Este plano só precisa commitá-la **isolada**, antes do bump — misturar os dois motivos no mesmo commit tornaria o histórico difícil de auditar depois.

> **A publicação em Azure fica fora deste plano.** `az acr build`/`az containerapp update` (README §"Hospedagem") afeta o ambiente de produção — é ação que exige confirmação explícita, fora do escopo de um backlog de implementação local. Este plano termina no commit local, validado.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base fechada** | Fim da F1 | `T-543` commitado isolado; `git status --short` limpo em `frontend/e2e/` | Não seguir para F2 até os dois commits (fix do teste e bump) ficarem separáveis |
| **P1 — Bump aplicado, ambiente compila** | Fim da F2 | `package.json` atualizado; `pnpm install` sem pedir aprovação de script de build novo; `pnpm lint` e `tsc --noEmit` limpos; `pnpm build` completa | Reverter F2, investigar antes de repetir |
| **P2 — Regressão e segurança confirmadas** | Fim da F3 | Suíte E2E **127/127** pós-bump, comparada caso a caso com a linha de base; `pnpm audit` sem as vulnerabilidades do §2.2 da ESPEC | Não prosseguir para F4; qualquer caso novo de falha bloqueia até explicado (`R-DEP-05`) |
| **P3 — Fechamento** | Fim da F4 | `docker build` local ok; ESPEC 048 com status atualizado; `CHANGELOG`/`README` atualizados; `git diff --stat` só nos arquivos previstos | Não fechar a entrega; publicação em Azure não é decisão deste plano |

---

## 3. Fases

### F0 — Preparação

| # | Tarefa | Ref. |
|---|---|---|
| T-2711 | Confirmar o estado da árvore: `git status --short` → só `frontend/e2e/a11y-estrutura.spec.ts` modificado e `docs/specs/048-...md` não rastreado; `frontend/package.json` ainda em `15.5.4`. A suíte E2E não roda de novo aqui — já medida em 127/127 (ESPEC 048 §12); a verificação é só confirmar que nada mudou desde então | — |

**Verificação:** preparação. **Tamanho:** PP — cinco minutos.

---

### F1 — A linha de base, isolada `[portão P0]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2712 | Commit isolado: `git add frontend/e2e/a11y-estrutura.spec.ts`; commit com mensagem própria, sem menção ao Next — é correção independente, achada durante a medição da linha de base desta ESPEC, mas de causa alheia a ela | — |
| T-2713 | **[portão]** `git status --short` → limpo em `frontend/e2e/`. O único pendente que resta é `docs/specs/048-...md`, que fica para o commit de fechamento (`T-2726`) | **P0** |

**Verificação:** P0. **Tamanho:** PP — cinco minutos.

---

### F2 — O bump `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2714 | `frontend/package.json`: `"next": "15.5.4"` → `"15.5.25"` (linha 13); `"eslint-config-next": "15.5.4"` → `"15.5.25"` (linha 26) | `R-DEP-01` |
| T-2715 | `pnpm install` — regenera `pnpm-lock.yaml`; conferir que não pede aprovação de script de build nativo novo (`pnpm-workspace.yaml` `onlyBuiltDependencies` não muda) | `R-DEP-02` |
| T-2716 | `pnpm lint` e `pnpm exec tsc --noEmit` | `R-DEP-03` |
| T-2717 | `pnpm build` — completa, gera a saída `standalone` | `R-DEP-03` |
| T-2718 | **[portão]** T-2714–T-2717 no estado esperado | **P1** |

**Verificação:** P1. **Tamanho:** PP — quinze minutos.

---

### F3 — Regressão e auditoria `[portão P2]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2719 | Backend no ar em `http://127.0.0.1:8000` (sem mudança — mesmo usado na linha de base); `pnpm exec playwright test` — suíte completa, 127 casos, agora com `next@15.5.25` | `R-DEP-05` |
| T-2720 | Comparar caso a caso com a linha de base registrada na ESPEC 048 §12 (127/127). Qualquer caso que passava e passou a falhar bloqueia — mesmo que pareça não relacionado ao Next | `R-DEP-05` |
| T-2721 | `pnpm audit` — confirmar que as 3 críticas e as ~13 altas de `next` listadas na ESPEC 048 §2.2 não aparecem mais | `R-DEP-04` |
| T-2722 | **[portão]** T-2719–T-2721 no estado esperado | **P2** |

**Verificação:** P2. **Tamanho:** M — ~20 minutos (a suíte roda com `workers: 1`, sequencial).

---

### F4 — Fechamento `[portão P3]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2723 | `docker build -f frontend/Dockerfile -t confere-frontend:local frontend/` — local, sem publicar. Confere que builda com o `pnpm-lock.yaml` novo, sem mudança no `Dockerfile` | — |
| T-2724 | ESPEC 048: Status Proposta → Implementada, com os números medidos em T-2718/T-2722/T-2723 | — |
| T-2725 | `docs/CHANGELOG.md` — entrada nova; linha "Incremento 048" em `README.md`, no molde das demais | — |
| T-2726 | Commit do bump: `frontend/package.json`, `frontend/pnpm-lock.yaml`, `docs/specs/048-...md`, `docs/CHANGELOG.md`, `README.md` — commit próprio, separado do `T-2712` | `R-DEP-01`, `R-DEP-02` |
| T-2727 | **[portão]** `git diff --stat` dos dois commits desta entrega (`T-2712` e `T-2726`) contra o `HEAD` anterior: só os arquivos previstos — nada em `backend/`, nada em `frontend/src/` | **P3** |

**Verificação:** P3. **Tamanho:** PP — vinte minutos, mais o tempo do `docker build`.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4
       P0     P1     P2     P3
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~1h, mais ~20 min da suíte E2E rodando uma vez (pós-bump) |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Commit do `T-543` e do bump ficarem misturados, dificultando auditar depois qual mudança causou o quê | F1 antes de F2 — dois commits distintos (`T-2712`, `T-2726`) |
| `pnpm install` pedir aprovação de script de build nativo novo | `T-2715` confere isso explicitamente; se pedir, não aprovar às cegas — decisão separada, fora deste plano |
| Regressão real aparecer em algum dos 127 casos pós-bump | `T-2720`/`R-DEP-05` — investigar antes de prosseguir, nunca pular o portão P2 |
| `pnpm audit` continuar mostrando algum achado de `next` do §2.2 | Comparar contra a lista fechada da ESPEC — achado que resta é achado novo, não se ignora |
| Alguém publicar em Azure achando que faz parte deste plano | Fora do escopo — este plano termina em `T-2727`; publicação é decisão separada do usuário |

---

## 6. O que este plano não faz

- **Não publica em Azure** (`az acr build`/`az containerapp update`) — decisão do usuário, fora deste plano.
- **Não mexe em `postcss`/`sharp`/`nanoid`/`js-yaml`** — ESPEC 048 `D-03`.
- **Não migra para Next 16 nem React 19** — ESPEC 048 `D-01`/`D-02`.
- **Não resolve a pendência de autenticação/rede da hospedagem** — README, tratada em separado.
- **Não commita nada fora dos dois commits explícitos** (`T-2712`, `T-2726`) — cada commit é uma tarefa do backlog, não uma ação implícita.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Confirmação da linha de base | PP |
| F1 | Commit isolado do `T-543` | PP |
| F2 | Bump, instalação, lint, tipos, build | PP |
| F3 | Suíte E2E pós-bump e auditoria | M |
| F4 | Build local, documentos, commit de fechamento | PP |

**Total: ~1h**, mais o tempo de espera da suíte E2E (~20 min, sequencial). Entrega pequena — sem medição de corpus, sem mudança de código de aplicação.
