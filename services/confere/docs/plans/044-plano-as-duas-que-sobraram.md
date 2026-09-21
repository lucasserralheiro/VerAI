# PLANO 044 — Implementação de "As duas que sobraram"

| | |
|---|---|
| **Especificação** | [ESPEC 044](../specs/044-as-duas-que-sobraram.md) v1.0 |
| **Versão** | 1.0 — 2026-09-04 — **executado** em 2026-09-04. Backend fechou em 1.575 passed; nenhum desvio do plano |
| **Backlog** | TASKS 044, a escrever. Numeração continua de `T-2661`, a última em uso (ESPEC 043) |
| **Estado inicial** | Árvore de `backend/` carrega a ESPEC 043 **implementada e testada, ainda não commitada** — `contract_validations.py` (cinco funções), `measurement_validations.py` e `test_cartao_com_titulo.py`. 1.573 testes coletados |
| **Colisão conhecida** | `contract_validations.py` já foi tocado pela 043 (cinco funções diferentes). Esta entrega toca `v_cap_01_cliente_nao_derivado` e `v_ctr_05_codigo_contratado_ausente_da_aba` — nenhuma sobreposição de linha |
| **Instrumento existente** | A medição inteira já está na ESPEC 044 §2.1 — os sete arquivos de teste, nenhum lendo `.mensagem`. Nada a remedir: a `F0` reproduz, em segundos |

---

## 1. O que este plano tem de diferente

> **É a entrega mais barata da série, e por um motivo medido, não por sorte.** As sete anteriores
> (ESPEC 043) precisaram desenhar `causa`/`ação` preservando substrings de teste; estas duas não —
> nenhum dos sete arquivos que citam `V-CAP-01`/`V-CTR-05` lê `.mensagem`. O texto de §5.1 da ESPEC
> já está pronto, sem restrição herdada.

> **`CartaoAgregado` fica de fora, mesmo com o pré-requisito técnico satisfeito depois desta
> entrega.** Não é esquecimento — é `D-02` da ESPEC, escrito antes de a implementação começar.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Medição reconfirmada, testes novos reprovando pelo motivo certo** | Fim da F1 | Os sete arquivos do §2.1 continuam sem asserção de `.mensagem`. Testes novos reprovam por `titulo` vazio | Investigar antes de codificar |
| **P1 — As duas implementadas; os sete arquivos intocados** | Fim da F2 | Testes novos verdes. Os sete arquivos de `V-CAP-01`/`V-CTR-05`, sem nenhuma linha editada, continuam verdes | Reverter a F2 |
| **P2 — O conjunto** | Fim da F3 | Suíte verde, `1.573 → 1.573 + N`; `ruff`/`mypy` limpos | Não entregar |

---

## 3. Fases

### F0 — Reconfirmação

| # | Tarefa | Ref. |
|---|---|---|
| T-2662 | `grep -rln "V-CAP-01\|V-CTR-05" tests --include="*.py"` e conferir que nenhuma ocorrência lê `.mensagem` — bate com ESPEC §2.1 | ESPEC §2.1, `D-01` |

**Verificação:** P0 (primeira metade). **Tamanho:** PP.

---

### F1 — Os testes, escritos antes `[portão P0]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2663 | Dois testes isolados, no molde de `test_cartao_com_titulo.py` (ESPEC 043): `V-CAP-01` (proposta sem `cliente`) e `V-CTR-05` (código no contrato ausente da medição) — cada um afirmando `titulo`/`causa`/`ação` preenchidos | `R-CLA-05` |
| T-2664 | **[portão]** Rodar contra o `HEAD`: os dois testes novos reprovam (`titulo == ""`). Os sete arquivos do §2.1, intocados, continuam verdes | **P0** |

**Verificação:** P0. **Tamanho:** PP.

---

### F2 — As duas validações `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2665 | `contract_validations.py` — `v_cap_01_cliente_nao_derivado`, `v_ctr_05_codigo_contratado_ausente_da_aba`: `registrar` → `registrar_em_partes`, texto de ESPEC §5.1 | `R-CLA-05`, `R-CLA-06` |
| T-2666 | **[portão]** Os dois testes de `T-2663` verdes. Os sete arquivos do §2.1 verdes, sem edição. Todo teste de disparo/não-disparo das duas validações, intocado | **P1** |

**Verificação:** P1. **Tamanho:** PP.

---

### F3 — Fechamento `[portão P2]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2667 | Suíte de backend completa, `1.573 → 1.573 + N` | **P2** |
| T-2668 | `ruff`/`mypy` no arquivo tocado e no módulo de teste | **P2** |
| T-2669 | Status da ESPEC 044 (Proposta → Implementada), `docs/CHANGELOG.md`, `README.md` | — |
| T-2670 | `git diff --stat backend/`: só `contract_validations.py` (além do que a 043 já tocou) e o teste novo — nada em `frontend/`, nada em `CartaoAgregado` | **P2** |

**Verificação:** P2. **Tamanho:** PP.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3
P0     P0     P1     P2
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~45min |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Algum dos sete arquivos ler `.mensagem` afinal, e a medição da ESPEC estar errada | `T-2662`/`T-2664` — reconfirmação antes de codificar |
| Tocar `CartaoAgregado` "já que está desbloqueado" | `D-02` da ESPEC — fora do escopo, declarado |

---

## 6. O que este plano não faz

- **Não generaliza `CartaoAgregado`** (`I-01` da ESPEC 043, ainda sem spec).
- **Não toca as quatro validações `BLOQUEIA`** (Fase D).
- **Não toca `frontend/`** — nenhum arquivo.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Reconfirmação | PP |
| F1 | Dois testes | PP |
| F2 | Duas validações | PP |
| F3 | Fechamento | PP |

**Total: ~45min.**
