# TASKS 048 — Backlog de "O Next.js que ficou vinte e um patches atrás"

| | |
|---|---|
| **Especificação** | [ESPEC 048](../specs/048-o-next-que-ficou-vinte-e-um-patches-atras.md) v1.1 |
| **Plano** | [PLANO 048](../plans/048-plano-o-next-que-ficou-vinte-e-um-patches-atras.md) v1.0 |
| **Versão** | 1.0 — 2026-09-09 |
| **Total** | 17 tarefas · 4 portões · 4 insumos herdados da ESPEC |
| **Status** | **Em aberto** — 2026-09-09. Nenhuma fase executada ainda |

> **Dois commits, não um.** A correção de `T-543` (achado durante a medição da linha de base) e o
> bump do Next são mudanças de motivo diferente — cada uma no seu commit, `T-2712` antes de `T-2726`.
> Misturar os dois no mesmo commit tornaria impossível reverter um sem o outro.

---

## 1. Convenções

**Identificadores** `T-27nn`, continuando de `T-2710`, a última em uso (ESPEC 047).

**Definição de pronto:** `pnpm lint` e `tsc --noEmit` limpos; `pnpm build` completa; suíte E2E
(`pnpm exec playwright test`) **127/127**. Backend não entra na definição de pronto desta entrega —
nenhum arquivo de `backend/` é tocado, e o `python -m pytest` completo já foi medido nesta sessão
(1.607 passed) sem relação com este bump.

**Convenção de commit** `<tipo>(T-27nn): descrição`. `fix(...)` tanto para o commit do `T-543`
(`E1`, é correção de teste desatualizado) quanto para o do bump (`E4`, é correção de dependência
vulnerável, não *feature*).

### 1.1 A regra que atravessa este backlog

**O bump não muda comportamento de aplicação — muda só a versão de duas dependências.** Qualquer
diferença fora de `frontend/package.json`, `frontend/pnpm-lock.yaml` e os documentos do fechamento
(`docs/specs/048-...md`, `docs/CHANGELOG.md`, `README.md`) é sinal de que algo saiu do escopo
aprovado pela ESPEC 048 (`D-01`/`D-02`/`D-03`).

*O sinal no diff:* qualquer mudança em `.tsx`/`.ts` de `frontend/src/`, ou em qualquer arquivo de
`backend/`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Preparação | T-2711 | — | F0 |
| **E1** A linha de base, isolada | T-2712, T-2713 | **P0** | F1 |
| **E2** O bump | T-2714 … T-2718 | **P1** | F2 |
| **E3** Regressão e auditoria | T-2719 … T-2722 | **P2** | F3 |
| **E4** Fechamento | T-2723 … T-2727 | **P3** | F4 |

### 2.1 A régua da entrega — o que muda

| Muda | Não muda |
|---|---|
| `next` e `eslint-config-next`: `15.5.4` → `15.5.25` | Node (`node:20-alpine`), React 18, `Dockerfile`, `next.config.mjs` |
| `frontend/e2e/a11y-estrutura.spec.ts` (`T-543`, já corrigido — commit isolado, `E1`) | Todo o resto do frontend — nenhum componente, nenhuma outra *spec* de teste |
| Status da ESPEC 048, `docs/CHANGELOG.md`, `README.md` | Todo `backend/` — nenhuma linha |
| `frontend/pnpm-lock.yaml` (regenerado) | `postcss@8.4.31` (pino interno do `next`), `sharp`/`nanoid`/`js-yaml` |

---

## 3. Épico E0 — Preparação

#### T-2711 — Confirmar o estado da árvore
**Tamanho:** PP

`git status --short` → só `frontend/e2e/a11y-estrutura.spec.ts` modificado e
`docs/specs/048-o-next-que-ficou-vinte-e-um-patches-atras.md` não rastreado. `frontend/package.json`
ainda em `15.5.4`. A suíte E2E não roda de novo aqui — já medida em 127/127 (ESPEC 048 §12); esta
tarefa só confirma que nada mudou desde então.

**Pronto quando:** os estados conferem com o que a ESPEC/o PLANO presumem.

---

## 4. Épico E1 — A linha de base, isolada `[portão P0]`

#### T-2712 — Commit isolado do `T-543`
**Tamanho:** PP

`git add frontend/e2e/a11y-estrutura.spec.ts`; commit com mensagem própria, sem menção ao Next — é
correção independente, achada durante a medição da linha de base desta ESPEC, mas de causa alheia a
ela (ESPEC 031, não Next.js).

**Pronto quando:** commit criado, só esse arquivo dentro dele (`git show --stat`).

---

#### T-2713 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

`git status --short` → limpo em `frontend/e2e/`. O único pendente que resta é
`docs/specs/048-...md`, que fica para o commit de fechamento (`T-2726`).

**Pronto quando:** a árvore está pronta para o bump entrar sozinho no próximo commit.

---

## 5. Épico E2 — O bump `[portão P1]`

#### T-2714 — `package.json`
**Tamanho:** PP · **Ref:** `R-DEP-01`

`"next": "15.5.4"` → `"15.5.25"` (linha 13); `"eslint-config-next": "15.5.4"` → `"15.5.25"`
(linha 26). Nenhuma outra linha muda.

**Pronto quando:** as duas versões atualizadas, sem `^`/`~`.

---

#### T-2715 — `pnpm install`
**Tamanho:** PP · **Ref:** `R-DEP-02`

Regenera `frontend/pnpm-lock.yaml`. Conferir que não pede aprovação de script de build nativo novo
(`pnpm-workspace.yaml` `onlyBuiltDependencies` não muda — `next`/`eslint-config-next` não trazem
binário).

**Pronto quando:** instala sem *prompt*, lockfile atualizado.

---

#### T-2716 — Lint e tipos
**Tamanho:** PP · **Ref:** `R-DEP-03`

`pnpm lint` e `pnpm exec tsc --noEmit`.

**Pronto quando:** os dois limpos, sem erro novo.

---

#### T-2717 — Build
**Tamanho:** PP · **Ref:** `R-DEP-03`

`pnpm build`. Completa e gera a saída `standalone` (`.next/standalone`).

**Pronto quando:** o build termina sem erro.

---

#### T-2718 — O portão `[portão]`
**Tamanho:** PP · **Portão P1**

T-2714–T-2717 no estado esperado, ao mesmo tempo.

**Pronto quando:** os quatro limpos.

---

## 6. Épico E3 — Regressão e auditoria `[portão P2]`

#### T-2719 — Suíte E2E pós-bump
**Tamanho:** M — ~20 minutos (`workers: 1`, sequencial) · **Ref:** `R-DEP-05`

Backend no ar em `http://127.0.0.1:8000` (sem mudança — o mesmo já usado na linha de base).
`pnpm exec playwright test` — suíte completa, 127 casos, agora com `next@15.5.25`.

**Pronto quando:** a suíte termina e produz o relatório completo (127 resultados, não uma execução
parcial).

---

#### T-2720 — Comparação caso a caso
**Tamanho:** PP · **Ref:** `R-DEP-05`

Resultado de T-2719 contra a linha de base registrada na ESPEC 048 §12 (127/127). Qualquer caso que
passava e passou a falhar bloqueia — mesmo que pareça não relacionado ao Next.

**Pronto quando:** 127/127 de novo, ou a divergência está explicada e resolvida antes de prosseguir.

---

#### T-2721 — `pnpm audit`
**Tamanho:** PP · **Ref:** `R-DEP-04`

Confirma que as 3 críticas e as ~13 altas de `next` listadas na ESPEC 048 §2.2 não aparecem mais.

**Pronto quando:** a lista de achados de `next` fecha zero para os itens do §2.2 —
`postcss`/`sharp`/`nanoid`/`js-yaml` seguem aparecendo, fora do escopo (`D-03`).

---

#### T-2722 — O portão `[portão]`
**Tamanho:** PP · **Portão P2**

T-2719–T-2721 no estado esperado.

**Pronto quando:** regressão zero e vulnerabilidades do `next` fechadas ao mesmo tempo.

---

## 7. Épico E4 — Fechamento `[portão P3]`

#### T-2723 — Build de produção local
**Tamanho:** PP

`docker build -f frontend/Dockerfile -t confere-frontend:local frontend/` — local, sem publicar.
Confere que builda com o `pnpm-lock.yaml` novo, sem mudança no `Dockerfile`.

**Pronto quando:** a imagem builda sem erro.

---

#### T-2724 — Status da ESPEC
**Tamanho:** PP

ESPEC 048: Status Proposta → Implementada, com os números medidos em T-2718/T-2722/T-2723.

**Pronto quando:** o cabeçalho reflete o resultado real, não uma previsão.

---

#### T-2725 — Documentos
**Tamanho:** PP

`docs/CHANGELOG.md` — entrada nova. Linha "Incremento 048" em `README.md`, no molde das demais.

**Pronto quando:** os dois documentos refletem o estado final.

---

#### T-2726 — Commit do bump
**Tamanho:** PP · **Ref:** `R-DEP-01`, `R-DEP-02`

`git add frontend/package.json frontend/pnpm-lock.yaml docs/specs/048-...md docs/CHANGELOG.md
README.md`; commit próprio, separado do `T-2712`.

**Pronto quando:** commit criado, sem nada do `T-2712` misturado — esse já foi commitado antes.

---

#### T-2727 — Nenhuma âncora fora do previsto `[portão]`
**Tamanho:** PP · **Portão P3**

`git diff --stat` dos dois commits desta entrega (`T-2712` e `T-2726`) contra o `HEAD` anterior: só
os arquivos previstos — nada em `backend/`, nada em `frontend/src/`.

**Pronto quando:** o *diff* bate com essa lista.

---

## 8. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-DEP-01` (versão exata sincronizada) | T-2714, T-2726, T-2727 |
| `R-DEP-02` (lockfile commitado, build usa `--frozen-lockfile`) | T-2715, T-2726, T-2727 |
| `R-DEP-03` (lint/tipos/build limpos) | T-2716, T-2717, T-2718 |
| `R-DEP-04` (audit sem os achados do `next`) | T-2721, T-2722 |
| `R-DEP-05` (E2E antes/depois, sem regressão) | T-2719, T-2720, T-2722 |

---

## 9. O que este backlog não faz

- **Não publica em Azure** (`az acr build`/`az containerapp update`) — decisão do usuário, fora deste
  backlog.
- **Não mexe em `postcss`/`sharp`/`nanoid`/`js-yaml`** — `D-03` da ESPEC.
- **Não migra para Next 16 nem React 19** — `D-01`/`D-02` da ESPEC.
- **Não resolve a pendência de autenticação/rede da hospedagem** — README, tratada em separado.
- **Não commita nada fora dos dois commits explícitos** (`T-2712`, `T-2726`).

---

## 10. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3 ──► E4
       P0     P1     P2     P3

E0  confirmação da linha de base       (sem commit)
E1  correção da linha de base          fix(T-543): ...                       [T-2712]
E2  o bump                             (sem commit — fecha em E4)
E3  regressão e auditoria              (sem commit — só validação)
E4  fechamento                         fix(T-2714…2725): next 15.5.25        [T-2726]
```

---

## 11. Insumos em aberto (herdados da ESPEC)

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Vale sobrescrever `postcss` via `pnpm.overrides`, fechando o achado que este bump não resolve? | Não — `postcss` roda em tempo de build, risco real baixo |
| `I-02` | A pendência de autenticação/rede na hospedagem eleva a severidade prática das RCEs enquanto não for resolvida | Não bloqueia; é a razão para não adiar esta entrega |
| `I-03` | Vale estender o `pre-commit` para auditar também `frontend/pnpm-lock.yaml`? | Não — gap de processo distinto, decisão própria |
| `I-04` | Vale rodar `pnpm exec playwright test` com regularidade, não só quando uma *spec* de dependência força a medição? | Não bloqueia — já corrigido; achado de processo para decisão à parte |
