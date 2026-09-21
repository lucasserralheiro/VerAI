# TASKS 056 — Backlog de "O rodapé que ganhou link no logo e nos ícones sociais"

| | |
|---|---|
| **Especificação** | [ESPEC 056](../specs/056-o-logo-do-rodape-que-virou-link-para-o-portal.md) v1.1 |
| **Plano** | [PLANO 056](../plans/056-plano-o-logo-do-rodape-que-virou-link-para-o-portal.md) v1.0 |
| **Versão** | 1.0 — 2026-09-14 |
| **Total** | 13 tarefas · 4 portões |
| **Status** | **Em aberto** — nenhuma fase executada ainda |

---

## 1. Convenções

**Identificadores** `T-28nn`, continuando de `T-2823`, a última em uso (PLANO 050) — começa em
`T-2824`.

**Definição de pronto:** `pnpm lint` e `pnpm build` limpos; `rodape.spec.ts` verde; suíte e2e
completa (127 testes herdados + os novos) sem falha nova, rodada com o backend no ar; checagem
manual de teclado/clique nos três links.

**Convenção de commit** `<tipo>(T-28nn…nn): descrição`. `feat(...)` — é funcionalidade nova
(hiperlink), não correção.

### 1.1 A regra que atravessa este backlog

**A mudança é só de comportamento de UI no rodapé — três elementos ganham `<a>`.** Qualquer
diferença fora de `Rodape.tsx`, do teste novo e dos documentos de fechamento é sinal de que algo
saiu do escopo aprovado pela ESPEC 056.

*O sinal no diff:* qualquer mudança em `Barra.tsx`, em `frontend/package.json`/`pnpm-lock.yaml`, ou
em qualquer arquivo de `backend/`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Preparação | T-2824 | **P0** | F0 |
| **E1** Os três links | T-2825 … T-2829 | **P1** | F1 |
| **E2** Teste e2e | T-2830 … T-2831 | **P2** | F2 |
| **E3** Fechamento | T-2832 … T-2836 | **P3** | F3 |

### 2.1 A régua da entrega — o que muda

| Muda | Não muda |
|---|---|
| `frontend/src/app/components/Rodape.tsx` — logo, Instagram e LinkedIn viram `<a>` | `/prodamsp` — continua texto, sem `href` (`D-08`) |
| `frontend/e2e/rodape.spec.ts` (novo) | `Barra.tsx` — logo "Confere" do cabeçalho |
| `docs/specs/006-rodape-institucional.md` — nota de revisão | `frontend/package.json`/`pnpm-lock.yaml` (ESPEC 055, separada) |
| Status da ESPEC 056, `docs/CHANGELOG.md`, `README.md` | Todo `backend/` — nenhuma linha |

---

## 3. Épico E0 — Preparação `[portão P0]`

#### T-2824 — Confirmar o estado da árvore e a linha de base
**Tamanho:** PP

`git status --short` → só `frontend/package.json`/`pnpm-lock.yaml` modificados e as specs/plano/
tasks 055 não rastreados (nenhum arquivo tocado por este backlog ainda). `pnpm dev --port 3000` sobe
sem erro. `pnpm exec playwright test --list` → 127 testes em 16 arquivos.

**Pronto quando:** os três confirmados e registrados. **Portão P0.**

---

## 4. Épico E1 — Os três links `[portão P1]`

#### T-2825 — Logo → portal institucional
**Tamanho:** PP · **Ref:** `R-ROD-12`, `R-ROD-15`, `R-ROD-16`

`<Image src="/prodam-branca.svg" .../>` (linhas 39-45 de `Rodape.tsx`) passa a ficar dentro de
`<a href="https://portal.prodam.sp.gov.br/" target="_blank" rel="noopener noreferrer"
aria-label="Prodam — abrir o portal institucional em nova aba">`.

**Pronto quando:** o elemento renderiza dentro do `<a>`, sem mudança visual de tamanho/posição.

---

#### T-2826 — Ícone do Instagram → perfil oficial
**Tamanho:** PP · **Ref:** `R-ROD-13`, `R-ROD-15`, `R-ROD-16`

`<Instagram className="h-[1.1rem] w-[1.1rem] text-prodam-orange" />` passa a ficar dentro de
`<a href="https://www.instagram.com/prodamsp/" target="_blank" rel="noopener noreferrer"
aria-label="Instagram da Prodam — abre em nova aba">`. O SVG mantém `aria-hidden="true"` (D-05 da
ESPEC 006) — o nome acessível vem só do `<a>`.

**Pronto quando:** o ícone renderiza dentro do `<a>`, mesmo tamanho/cor de antes.

---

#### T-2827 — Ícone do LinkedIn → página da empresa
**Tamanho:** PP · **Ref:** `R-ROD-14`, `R-ROD-15`, `R-ROD-16`

`<LinkedIn className="h-[1.05rem] w-[1.05rem] text-prodam-orange" />` passa a ficar dentro de
`<a href="https://br.linkedin.com/company/prodamsp" target="_blank" rel="noopener noreferrer"
aria-label="LinkedIn da Prodam — abre em nova aba">`, mesmo padrão de T-2826.

**Pronto quando:** o ícone renderiza dentro do `<a>`, mesmo tamanho/cor de antes.

---

#### T-2828 — Afordância visual sutil
**Tamanho:** PP · **Ref:** `D-05`

Hover/focus com leve redução de opacidade nos três `<a>` (ex.: `transition-opacity hover:opacity-80`),
sem sublinhado — o rodapé continua sem competir visualmente (ESPEC 006 §4.1).

**Pronto quando:** a transição é visível ao passar o mouse/focar, sem alterar o layout.

---

#### T-2829 — O portão `[portão]`
**Tamanho:** PP · **Portão P1**

No navegador: clique em cada um dos três abre a URL certa em nova aba; a partir do link social mais
próximo, `Tab` alcança logo/Instagram/LinkedIn em sequência, cada um com contorno de foco visível;
`/prodamsp` permanece fora de qualquer `<a>`.

**Pronto quando:** os três comportamentos confirmados manualmente.

---

## 5. Épico E2 — Teste e2e `[portão P2]`

#### T-2830 — `frontend/e2e/rodape.spec.ts`
**Tamanho:** PP · **Ref:** `R-ROD-12` a `R-ROD-17`

Casos: `href` de cada `<a>` bate exatamente com a URL esperada; `target="_blank"` e `rel` contendo
`noopener`/`noreferrer` nos três; nome acessível de cada um não vazio e distinto dos outros dois;
`/prodamsp` sem `href`; percurso de `Tab` alcança os três com `outline` computado > 0 (mesma técnica
de `a11y-teclado.spec.ts`).

**Pronto quando:** o arquivo existe e cobre os seis pontos acima.

---

#### T-2831 — O portão `[portão]`
**Tamanho:** PP · **Portão P2**

`pnpm exec playwright test e2e/rodape.spec.ts` verde. Suíte completa, com backend no ar em
`127.0.0.1:8000`: 127 testes herdados + os novos, sem falha nova fora de `rodape.spec.ts`.

**Pronto quando:** os dois números batem, sem regressão.

---

## 6. Épico E3 — Fechamento `[portão P3]`

#### T-2832 — Lint e build
**Tamanho:** PP

`pnpm lint` e `pnpm build` limpos.

**Pronto quando:** os dois sem erro novo.

---

#### T-2833 — Nota de revisão na ESPEC 006
**Tamanho:** PP

Em `docs/specs/006-rodape-institucional.md`, nota curta em D-06 e no §10 ponto 1, apontando para a
ESPEC 056 — sem reabrir ou reescrever o resto do documento.

**Pronto quando:** a nota existe e não altera nenhuma regra `R-ROD-01` a `R-ROD-11`.

---

#### T-2834 — `docs/CHANGELOG.md` e `README.md`
**Tamanho:** PP

Status da ESPEC 056 (Proposta → Implementada); entrada nova em `CHANGELOG.md`, no molde das
anteriores; linha "Incremento 056" em `README.md`.

**Pronto quando:** os três refletem o que de fato mudou.

---

#### T-2835 — `git diff --stat` restrito ao previsto
**Tamanho:** PP

Confere contra a régua de §2.1: `Rodape.tsx`, `rodape.spec.ts`, `docs/specs/006-...md`,
`docs/specs/056-...md`, `docs/plans/056-...md`, `docs/tasks/056-...md`, `README.md`,
`docs/CHANGELOG.md` — nada em `frontend/package.json`/`pnpm-lock.yaml`, nada em `Barra.tsx`, nada em
`backend/`.

**Pronto quando:** o diff bate com a régua.

---

#### T-2836 — Commit de fechamento `[portão]`
**Tamanho:** PP · **Portão P3**

Commit único com os arquivos de `T-2835`, mensagem referenciando ESPEC 056 / PLANO 056 / TASKS 056.

**Pronto quando:** commit criado, diff conferido.

---

## 7. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-ROD-12` (logo → portal) | T-2825, T-2830, T-2831 |
| `R-ROD-13` (Instagram → perfil) | T-2826, T-2830, T-2831 |
| `R-ROD-14` (LinkedIn → empresa) | T-2827, T-2830, T-2831 |
| `R-ROD-15` (nova aba + `rel`) | T-2825, T-2826, T-2827, T-2830, T-2831 |
| `R-ROD-16` (nome acessível próprio) | T-2825, T-2826, T-2827, T-2830 |
| `R-ROD-17` (invariante — `/prodamsp` sem link) | T-2829, T-2830, T-2835 |

---

## 8. O que este backlog não faz

- **Não toca `frontend/package.json`/`pnpm-lock.yaml`** — ESPEC 055, entrega separada.
- **Não altera `Barra.tsx`** — logo "Confere" do cabeçalho, fora do pedido.
- **Não torna `/prodamsp` um link** — `D-08` da ESPEC 056.
- **Não commita nada fora do commit único (`T-2836`)**.

---

## 9. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3
       P0     P1     P2     P3

E0  confirmação do estado                (sem commit)
E1  os três links + afordância           (sem commit — só verificação manual)
E2  teste e2e novo                       (sem commit — só verificação)
E3  fechamento                           feat(T-2824…2836): três links no rodapé
                                          (logo, Instagram, LinkedIn)          [T-2836]
```

---

## 10. Insumos em aberto (herdados da ESPEC)

Nenhum. A ESPEC 056 §10 não lista pendência.
