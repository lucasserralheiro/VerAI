# PLANO 046 — Implementação de "O aditivo que virou proposta"

| | |
|---|---|
| **Especificação** | [ESPEC 046](../specs/046-o-aditivo-que-virou-proposta.md) v1.0 |
| **Versão** | 1.0 — 2026-09-08 — **executado** em 2026-09-08. Os dois portões fecharam na primeira passagem; nenhuma fase revertida |
| **Backlog** | [TASKS 046](../tasks/046-tasks-o-aditivo-que-virou-proposta.md) — numeração continua de `T-2691`, a última em uso (ESPEC 045) |
| **Estado inicial** | Árvore de `backend/` carrega a ESPEC 045 implementada e testada, ainda não commitada — `grid.py`, `pdfplumber_extractor.py`, `contract.py`, `contract_validations.py` (já tem `v_ctr_08_...`), `container.py`, `conftest.py`, `fixtures/aditivo_cgm.pdf` e dois módulos de teste novos. Backend em **1.601 passed** (medido no fechamento da ESPEC 045) |
| **Colisão conhecida** | `contract_validations.py` já foi tocado pelas ESPECs 043/044 (formato dos avisos) e 045 (`v_ctr_08_...`, ao final do arquivo). Este plano toca `v_adt_03_peca_repetida_ou_trocada`, uma função que nenhuma das três tocou — sem sobreposição de linhas |

---

## 1. O que este plano tem de diferente

> **Este plano remove uma proteção, não adiciona uma.** O critério de aceite não é "nada se move" — é "o comportamento assimétrico desaparece, e o silêncio resultante é o esperado" (ESPEC 046 §9), não uma regressão a investigar depois.

> **Não há medição de corpus a fazer.** A mudança não depende de nenhum documento específico do corpus — é a remoção de um ramo de código, coberta por um teste unitário já existente, que só precisa ser invertido.

> **O risco desta entrega é de negócio, não de código, e já está registrado na ESPEC §9 — não se remede aqui.** Este plano garante que a remoção é exatamente a pedida, cirúrgica, sem sobra; não reabre a discussão do risco.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Teste invertido, reprovando contra o `HEAD`** | Fim da F0 | `test_t1332_v_adt_03_bloqueia_proposta_no_campo_de_aditivo`, reescrito para afirmar ausência de achado, reprova contra o código de hoje (que ainda bloqueia) | Reprovar por outro motivo é sinal de que o teste não está testando o ramo certo |
| **P1 — O ramo removido; a régua da forma que resta intacta** | Fim da F1 | O teste da F0 passa. `test_t1350_aditivo_repetido_bloqueia` (a primeira forma, API) continua verde, sem alteração. Suíte completa verde | Reverter a F1 |

---

## 3. Fases

### F0 — O teste, invertido antes `[portão P0]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2692 | `test_t1332_v_adt_03_bloqueia_proposta_no_campo_de_aditivo` ([test_consolidacao_aditivos.py:253-267](../../backend/tests/test_consolidacao_aditivos.py#L253-L267)): a asserção de bloqueio é substituída por `achados.achados == []`, mesma peça construída à mão. Docstring reescrito para citar a ESPEC 046, não mais a ESPEC 019 como razão do bloqueio | `R-ADT-03-rev` |
| T-2693 | **[portão]** Rodar contra o `HEAD`: o teste reescrito reprova — a função ainda bloqueia. Confirma que o teste exercita o ramo certo, antes de ele ser removido | **P0** |

**Verificação:** P0. **Tamanho:** PP — dez minutos.

---

### F1 — A remoção `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2694 | `v_adt_03_peca_repetida_ou_trocada` ([contract_validations.py:384-424](../../backend/src/infrastructure/validations/contract_validations.py#L384-L424)): remove o laço `for aditivo in aditivos: if len(aditivo.blocos) == 1 and aditivo.blocos[0].rotulo is None: ...`. Docstring reescrito para descrever só a forma que resta (peça repetida) | `R-ADT-03-rev` |
| T-2695 | **[portão]** `T-2692` passa. `test_t1350_aditivo_repetido_bloqueia` (`test_api_e2e.py`) continua verde, sem tocar uma linha dele. Suíte completa: `1.601 → 1.601` (uma reprovação a menos de comportamento, zero teste novo — a contagem não sobe) | **P1** |

**Verificação:** P1. **Tamanho:** PP — quinze minutos.

---

### F2 — Fechamento

| # | Tarefa | Ref. |
|---|---|---|
| T-2696 | Suíte completa, `ruff check` e `mypy src/` no arquivo tocado | **P1** |
| T-2697 | Status da ESPEC 046 (Proposta → Implementada), `docs/CHANGELOG.md`, `README.md` — a entrada precisa deixar claro que o silêncio é intencional, não um efeito colateral descoberto depois | — |
| T-2698 | `git diff --stat backend/`: só `contract_validations.py` e `tests/test_consolidacao_aditivos.py`. Nenhuma outra linha | — |

**Verificação:** P1 (fechamento). **Tamanho:** PP — quinze minutos.

---

## 4. Sequência

```
F0 ──► F1 ──► F2
P0     P1
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~40 minutos |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Remover mais do que o segundo ramo (ex.: tocar a checagem de peça repetida por engano) | `T-2695` — `test_t1350_aditivo_repetido_bloqueia` continua verde só se essa checagem não mudar |
| Deixar código morto (import, variável) depois da remoção | `T-2696` — `ruff`/`mypy` |
| A entrada do CHANGELOG minimizar ou esconder o risco de negócio | `T-2697` — a entrada precisa nomear o silêncio, não só descrever "removida uma checagem" |

---

## 6. O que este plano não faz

- **Não adiciona `AVISA` nem sinal substituto** — decisão `D-01` da ESPEC, não esquecimento.
- **Não toca a primeira forma de `V-ADT-03`** (peça repetida).
- **Não muda `Contract.aplicar()`** — o bloco sem rótulo continua sendo ignorado por ela; só deixa de ser impedido de chegar lá.
- **Não mede o corpus** — não há `sha` a conferir; a régua desta entrega é o par de testes (F0/F1), não os documentos reais.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Teste invertido | PP |
| F1 | Remoção do ramo | PP |
| F2 | Fechamento | PP |

**Total: ~40 minutos.** É a menor entrega desta série de specs.
