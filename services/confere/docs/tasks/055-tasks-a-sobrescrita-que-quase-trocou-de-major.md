# TASKS 055 — Backlog de "A sobrescrita que quase trocou de major"

| | |
|---|---|
| **Especificação** | [ESPEC 055](../specs/055-a-sobrescrita-que-quase-trocou-de-major.md) v1.0 |
| **Plano** | [PLANO 055](../plans/055-plano-a-sobrescrita-que-quase-trocou-de-major.md) v1.0 |
| **Versão** | 1.0 — 2026-09-14 |
| **Total** | 10 tarefas · 2 portões |
| **Status** | **Em aberto** — 2026-09-14. Implementação já aplicada (`frontend/package.json`/`pnpm-lock.yaml`); nenhuma fase deste backlog executada ainda |

> **A implementação já existe.** `frontend/package.json` e `frontend/pnpm-lock.yaml` já foram
> alterados numa análise anterior à escrita deste backlog. As tarefas de F1 não aplicam a mudança —
> confirmam que ela se reproduz de forma limpa, como portão auditável, antes do commit de F2.

---

## 1. Convenções

**Identificadores** `T-28nn`, continuando de `T-2796`, a última em uso (TASKS 053).

**Definição de pronto:** `pnpm lint` e `pnpm build` limpos; `pnpm audit` sem nenhum dos 7 achados
listados na ESPEC 055 §1. Não há suíte E2E na definição de pronto desta entrega — `D-07` da ESPEC
055 justifica a dispensa (nenhum dos quatro pacotes roda no container de produção).

**Convenção de commit** `<tipo>(T-28nn): descrição`. `fix(...)` — é correção de dependência
vulnerável, não *feature*, mesma convenção do commit de fechamento da ESPEC 048.

### 1.1 A regra que atravessa este backlog

**A mudança não altera comportamento de aplicação — só a resolução de quatro dependências de
build/lint.** Qualquer diferença fora de `frontend/package.json`, `frontend/pnpm-lock.yaml` e os
documentos de fechamento (`docs/specs/055-...md`, `docs/CHANGELOG.md`, `README.md`) é sinal de que
algo saiu do escopo aprovado pela ESPEC 055.

*O sinal no diff:* qualquer mudança em `.tsx`/`.ts` de `frontend/src/`, em `frontend/Dockerfile`, ou
em qualquer arquivo de `backend/`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Preparação | T-2797 | — | F0 |
| **E1** Reprodução da validação | T-2798 … T-2802 | **P0** | F1 |
| **E2** Fechamento | T-2803 … T-2806 | **P1** | F2 |

### 2.1 A régua da entrega — o que muda

| Muda | Não muda |
|---|---|
| `sharp`: `^0.35.3` → `^0.35.4` (direto) | `next`/`eslint-config-next` (já fixados pela ESPEC 048) |
| `pnpm.overrides`: `postcss` (`>=8.5.23 <9`), `nanoid` (`^3.3.18`), `js-yaml` (`^4.3.2`) | `frontend/Dockerfile`, `next.config.mjs` |
| `frontend/pnpm-lock.yaml` (regenerado) | Todo `frontend/src/` — nenhum componente |
| Status da ESPEC 055, `docs/CHANGELOG.md`, `README.md` | Todo `backend/` — nenhuma linha |

---

## 3. Épico E0 — Preparação

#### T-2797 — Confirmar o estado da árvore
**Tamanho:** PP

`git status --short` → só `frontend/package.json` e `frontend/pnpm-lock.yaml` modificados,
`docs/specs/055-a-sobrescrita-que-quase-trocou-de-major.md` não rastreado. Nenhum arquivo de
`backend/` ou `frontend/src/` tocado.

**Pronto quando:** o estado confere com o que a ESPEC/o PLANO presumem.

---

## 4. Épico E1 — Reprodução da validação `[portão P0]`

#### T-2798 — `pnpm install`
**Tamanho:** PP · **Ref:** `R-DEP-06`, `R-DEP-07`

Confirma que a árvore resolve de forma determinística a partir do `package.json`/`pnpm-lock.yaml`
já modificados, sem pedir aprovação de script de build nativo novo.

**Pronto quando:** instala sem *prompt*, lockfile inalterado (já está no estado final).

---

#### T-2799 — Lint
**Tamanho:** PP · **Ref:** `R-DEP-08`

`pnpm lint`.

**Pronto quando:** limpo, sem erro novo.

---

#### T-2800 — Build
**Tamanho:** PP · **Ref:** `R-DEP-08`

`pnpm build`. Completa e gera as 5 páginas estáticas, inclusive `icon.png` (exercita o `sharp`
novo).

**Pronto quando:** o build termina sem erro.

---

#### T-2801 — `pnpm audit`
**Tamanho:** PP · **Ref:** `R-DEP-08`

Confirma `No known vulnerabilities found` — nenhum dos 7 achados de `postcss`/`sharp`/`nanoid`/
`js-yaml` listados na ESPEC 055 §1.

**Pronto quando:** o audit fecha zero achados.

---

#### T-2802 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

T-2798–T-2801 no estado esperado, batendo com os números já registrados na ESPEC 055 §8.

**Pronto quando:** os quatro limpos, reprodução confirmada.

---

## 5. Épico E2 — Fechamento `[portão P1]`

#### T-2803 — `docs/CHANGELOG.md`
**Tamanho:** PP

Entrada nova, no molde das anteriores. Cita o quase-incidente do `>=` sem teto de major (ESPEC 055
§2.5) como o ponto que uma pessoa lendo o histórico precisaria saber.

**Pronto quando:** a entrada reflete o que de fato mudou e por quê, não só o resultado.

---

#### T-2804 — `README.md`
**Tamanho:** PP

Linha "Incremento 055", no molde das demais (ex.: linha "Incremento 048").

**Pronto quando:** a linha aparece na tabela de incrementos, com os links corretos.

---

#### T-2805 — Commit de fechamento
**Tamanho:** PP · **Ref:** `R-DEP-07`

`git add frontend/package.json frontend/pnpm-lock.yaml docs/specs/055-...md docs/plans/055-...md
docs/tasks/055-...md docs/CHANGELOG.md README.md`; commit único, mesmo molde do commit `50427ed`
da ESPEC 048 (código + ESPEC + PLANO + TASKS + CHANGELOG + README juntos).

**Pronto quando:** commit criado, mensagem referencia ESPEC 055 / PLANO 055 / TASKS 055.

---

#### T-2806 — Nenhuma âncora fora do previsto `[portão]`
**Tamanho:** PP · **Portão P1**

`git diff --stat` do commit contra o `HEAD` anterior: só os arquivos previstos em §2.1 — nada em
`backend/`, nada em `frontend/src/`.

**Pronto quando:** o *diff* bate com a régua.

---

## 6. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-DEP-06` (overrides com teto de major) | T-2798, T-2802 |
| `R-DEP-07` (lockfile commitado) | T-2798, T-2805, T-2806 |
| `R-DEP-08` (audit fecha os 7 achados) | T-2799, T-2800, T-2801, T-2802 |

---

## 7. O que este backlog não faz

- **Não publica em produção** — decisão do usuário, fora deste backlog.
- **Não roda a suíte E2E** — `D-07` da ESPEC 055.
- **Não mexe em `next`/`eslint-config-next`** — já fixados pela ESPEC 048.
- **Não resolve `I-03`/`I-05`** (gate de auditoria automática) — decisão de processo separada.
- **Não commita nada fora do commit único explícito (`T-2805`)**.

---

## 8. Sequência e commits

```
E0 ──► E1 ──► E2
       P0     P1

E0  confirmação do estado                (sem commit)
E1  reprodução da validação              (sem commit — só verificação)
E2  fechamento                           fix(T-2797…2806): overrides de postcss/nanoid/js-yaml
                                          + bump de sharp                          [T-2805]
```

---

## 9. Insumos em aberto (herdados da ESPEC)

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-05` | Vale estender o gate de auditoria (`I-03` da ESPEC 048) agora que há duas specs seguidas motivadas por varredura manual/Dependabot? | Não — decisão de processo separada |
| `I-06` | Quando o `next` publicar uma versão própria com `postcss` corrigido, remover o override ou manter como cinto-e-suspensório? | Não bloqueia — decisão para quando a situação mudar |
