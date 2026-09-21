# TASKS 044 — Backlog de "As duas que sobraram"

| | |
|---|---|
| **Especificação** | [ESPEC 044](../specs/044-as-duas-que-sobraram.md) v1.0 |
| **Plano** | [PLANO 044](../plans/044-plano-as-duas-que-sobraram.md) v1.0 |
| **Versão** | 1.0 — 2026-09-04 |
| **Total** | 9 tarefas · 3 portões · 1 insumo em aberto |
| **Status** | **Concluído** — 2026-09-04. Portões `P0` a `P2` fechados. Backend **1.573 → 1.575 passed** |

> **Escrito antes da implementação.** A `§11` é a única seção que não pode ser escrita agora.

> **Um arquivo de produção.** `contract_validations.py`, em duas funções que a ESPEC 043 não tocou.
> Nenhum outro — `CartaoAgregado` fica de fora por decisão (`D-02` da ESPEC), mesmo desbloqueado.

> **O risco já chegou medido em zero.** Nenhum dos sete arquivos que citam `V-CAP-01`/`V-CTR-05` lê
> `.mensagem` — a `F0` reconfirma isso em segundos, não descobre.

---

## 1. Convenções

**Identificadores** `T-26nn`, continuando de `T-2661`, a última em uso (ESPEC 043).

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde. Medido nesta árvore em 2026-09-04, antes de começar: `backend/` com a
ESPEC 043 implementada e ainda não commitada; **1.573 testes coletados**.

**Convenção de commit** `<tipo>(T-26nn): descrição`. `test(...)` para `E0`/`E1`; `fix(...)` para
`E2`; `docs(...)` para `E3`.

### 1.1 Duas regras que atravessam este backlog

**1 — Nenhuma condição de disparo muda.** Só a forma de registrar o achado muda.

*O sinal no diff:* qualquer `if` alterado dentro das duas funções.

**2 — `CartaoAgregado` não é tocado, mesmo estando tecnicamente pronto para ser generalizado.** É
decisão da ESPEC (`D-02`), não esquecimento — a tentação de "aproveitar a viagem" é o risco real
deste backlog pequeno.

*O sinal no diff:* qualquer linha em `ResultadoPanel.tsx`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Reconfirmação | T-2662 | **P0** (1ª metade) | F0 |
| **E1** Os testes, escritos antes | T-2663 … T-2664 | **P0** | F1 |
| **E2** As duas validações | T-2665 … T-2666 | **P1** | F2 |
| **E3** Fechamento | T-2667 … T-2670 | **P2** | F3 |

### 2.1 A régua da entrega

| Muda | Não muda |
|---|---|
| `V-CAP-01`, `V-CTR-05` ganham `titulo`/`causa`/`ação` | `CartaoAgregado`, `ResultadoPanel.tsx` — nenhuma linha |
| Status da ESPEC 044, `docs/CHANGELOG.md`, `README.md` | As sete validações da ESPEC 043, as quatro `BLOQUEIA` |

---

## 3. Épico E0 — Reconfirmação `[portão P0, 1ª metade]`

#### T-2662 — Os sete arquivos, reconferidos
**Tamanho:** PP · **Ref:** ESPEC §2.1, `D-01`

`grep -rln "V-CAP-01\|V-CTR-05" tests --include="*.py"` e conferência manual de cada ocorrência:
nenhuma lê `.mensagem`.

**Pronto quando:** os sete arquivos batem com a ESPEC, sem surpresa.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2663 — Dois testes isolados
**Tamanho:** PP · **Ref:** `R-CLA-05`

No molde de `test_cartao_com_titulo.py` (ESPEC 043): `V-CAP-01` (`Contract` sem `cliente`) e
`V-CTR-05` (código no contrato ausente da medição) — cada um afirmando `titulo`/`causa`/`ação`
preenchidos.

**Pronto quando:** os dois testes existem.

---

#### T-2664 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

Contra o `HEAD`: os dois testes novos reprovam (`titulo == ""`). Os sete arquivos do §2.1, sem
tocar, continuam verdes.

**Pronto quando:** a reprovação/passagem bate com o esperado.

---

## 5. Épico E2 — As duas validações `[portão P1]`

#### T-2665 — `contract_validations.py`
**Tamanho:** PP · **Ref:** `R-CLA-05`, `R-CLA-06` · **Primeiro toque em `src/`**

`v_cap_01_cliente_nao_derivado`, `v_ctr_05_codigo_contratado_ausente_da_aba`: `registrar` →
`registrar_em_partes`, texto da ESPEC §5.1.

**Pronto quando:** as duas funções compilam, `mypy` limpo.

---

#### T-2666 — O portão `[portão]`
**Tamanho:** PP · **Portão P1**

Os dois testes de `T-2663` verdes. Os sete arquivos do §2.1 verdes, sem edição. Testes de
disparo/não-disparo das duas validações, intocados.

**Pronto quando:** os três grupos conferem.

---

## 6. Épico E3 — Fechamento `[portão P2]`

#### T-2667 — Suíte completa
**Tamanho:** PP · **Portão P2**

`1.573 → 1.573 + N` (dois testes novos esperados), zero falhas.

**Pronto quando:** verde, número reconciliado.

---

#### T-2668 — Ferramentas
**Tamanho:** PP · **Portão P2**

`ruff check` e `mypy src/` no arquivo tocado e no módulo de teste.

**Pronto quando:** os dois limpos.

---

#### T-2669 — Documentos
**Tamanho:** PP

Status da ESPEC 044 (Proposta → Implementada), `docs/CHANGELOG.md`, `README.md`.

**Pronto quando:** os três refletem o estado final.

---

#### T-2670 — Nenhuma âncora alheia tocada
**Tamanho:** PP · **Portão P2**

`git diff --stat backend/`: só `contract_validations.py` (além do que a 043 já modificou) e o teste
novo — nada em `frontend/`.

**Pronto quando:** o `diff` bate com essa lista.

---

## 7. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-CLA-05` | T-2663, T-2665 |
| `R-CLA-06` | T-2666 |
| `R-CLA-07` | T-2662, T-2664 |

---

## 8. O que este backlog não faz

- **Não generaliza `CartaoAgregado`** (`I-01` da ESPEC 043, ainda sem spec).
- **Não toca as quatro validações `BLOQUEIA`** (Fase D).
- **Não toca `frontend/`.**
- **Não commita nada** — decisão à parte.

---

## 9. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3
P0     P0     P1     P2

E0  reconfirmação, nenhum arquivo tocado
E1  dois testes, o código de produção intocado    test(T-2663)
E2  as duas validações                             fix(T-2665)
E3  fechamento                                      docs(T-2669)
```

---

## 10. Insumos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Com a Fase C (`CartaoAgregado`) tecnicamente desbloqueada, vale abri-la em seguida? | Não bloqueia este backlog — é chamada de próxima entrega |

---

## 11. Emenda de execução

**2026-09-04.** As três fases correram na ordem prevista, sem reverter fase nenhuma — a medição
de risco zero (§2.1 da ESPEC) se confirmou exata na execução: os sete arquivos permaneceram
intocados, sem uma linha editada.

**A suíte completa (T-2667) precisou ser reexecutada** — a sessão foi interrompida entre o disparo
do comando e a leitura do resultado (reinício de ambiente, sem relação com o código). Reexecutada do
zero: 1.575 passed, zero falhas, em 29min44 — desta vez sem a reprovação intermitente de
`test_desempenho.py` que apareceu em entregas anteriores.

**Contagem final:** 1.573 no início, **1.575** ao final — dois testes novos
(`test_v_cap_01_ganha_titulo_causa_e_acao`, `test_v_ctr_05_ganha_titulo_causa_e_acao`), nenhum
removido. `ruff check` e `mypy src/` limpos de primeira. `git diff --stat backend/` restrito a
`contract_validations.py` e ao módulo de teste — nada em `frontend/`, nada em `CartaoAgregado`.

**O que ficou aberto, e é de outra entrega.** A generalização de `CartaoAgregado` (`I-01`) e as
quatro validações `BLOQUEIA` (Fase D) seguem sem spec própria.
