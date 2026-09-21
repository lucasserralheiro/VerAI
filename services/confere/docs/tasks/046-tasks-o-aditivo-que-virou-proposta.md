# TASKS 046 — Backlog de "O aditivo que virou proposta"

| | |
|---|---|
| **Especificação** | [ESPEC 046](../specs/046-o-aditivo-que-virou-proposta.md) v1.0 |
| **Plano** | [PLANO 046](../plans/046-plano-o-aditivo-que-virou-proposta.md) v1.0 |
| **Versão** | 1.0 — 2026-09-08 |
| **Total** | 7 tarefas · 2 portões · 1 insumo herdado da ESPEC |
| **Status** | **Concluído** — 2026-09-08. Portões `P0` e `P1` fechados na primeira passagem. Backend **1.601 → 1.601 passed**, zero falhas — nenhum teste novo, nenhum removido. `ruff`/`mypy` limpos. Nenhuma fase revertida |

> **Um arquivo de produção.** `contract_validations.py` — a mesma função (`v_adt_03_peca_repetida_ou_trocada`)
> que nenhuma spec anterior tocou. Um arquivo de teste: `test_consolidacao_aditivos.py`.

---

## 1. Convenções

**Identificadores** `T-26nn`, continuando de `T-2691`, a última em uso (ESPEC 045).

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde. Medido antes de começar: árvore com a ESPEC 045 implementada e testada,
ainda não commitada; backend em **1.601 passed**.

**Convenção de commit** `<tipo>(T-26nn): descrição`. `test(...)` para `E0`; `fix(...)` para `E1`
(é remoção de comportamento, não correção de defeito — mas o tipo semântico mais próximo, dado que
não há convenção `remove(...)` neste repositório); `docs(...)` para `E2`.

### 1.1 A regra que atravessa este backlog

**Isto não é uma correção de bug — é a remoção deliberada de uma proteção, a pedido explícito, com o
risco conhecido e aceito (ESPEC 046 §9).** Nenhuma tarefa deste backlog existe para mitigar esse
risco — ele não tem mitigação dentro do sistema, por decisão (`D-01`). O que cada tarefa garante é que
a remoção é **exatamente** a pedida: só a segunda forma de `V-ADT-03` (bloco único sem rótulo em
aditivo), nada mais.

*O sinal no diff:* qualquer alteração fora de `v_adt_03_peca_repetida_ou_trocada` e do teste
correspondente é sinal de que o escopo vazou.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** O teste, invertido antes | T-2692 … T-2693 | **P0** | F0 |
| **E1** A remoção | T-2694 … T-2695 | **P1** | F1 |
| **E2** Fechamento | T-2696 … T-2698 | **P1** | F2 |

### 2.1 A régua da entrega — o que muda

| Muda | Não muda |
|---|---|
| `v_adt_03_peca_repetida_ou_trocada` perde o ramo de "bloco único sem rótulo" | A primeira forma de `V-ADT-03` (peça repetida) |
| Um aditivo nesse formato passa a gerar relatório sem os itens dele, sem aviso | `Contract.aplicar()` — continua ignorando bloco sem rótulo, só deixa de ser impedido de chegar até ela |
| `test_t1332_v_adt_03_bloqueia_proposta_no_campo_de_aditivo` passa a afirmar o oposto | `test_t1350_aditivo_repetido_bloqueia` (API, primeira forma) |
| Status da ESPEC 046, `docs/CHANGELOG.md`, `README.md` | Todo o resto de `backend/` — nenhuma outra linha |

---

## 3. Épico E0 — O teste, invertido antes `[portão P0]`

#### T-2692 — `test_t1332` reescrito
**Tamanho:** PP · **Ref:** `R-ADT-03-rev`

Mesma peça construída à mão (`_peca("PA-BASE", _bloco(None, "10.050.00001.00"))` como aditivo). A
asserção `assert achados.bloqueado` e a checagem da mensagem saem; entra `assert achados.achados ==
[]`. O docstring passa a explicar que, depois da ESPEC 046, essa forma deixou de bloquear — por pedido
explícito, não por correção.

**Pronto quando:** reescrito, ainda reprovando contra o código de hoje.

---

#### T-2693 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

Rodar `pytest tests/test_consolidacao_aditivos.py -k t1332` contra o `HEAD`: reprova, porque a função
ainda bloqueia. Confirma que o teste exercita o ramo certo antes de ele ser removido — mesmo padrão de
todo TDD desta série (ESPEC 040, 041, 045).

**Pronto quando:** a reprovação é pelo motivo esperado (bloqueio ainda presente), não por erro de
construção do teste.

---

## 4. Épico E1 — A remoção `[portão P1]`

#### T-2694 — O ramo removido
**Tamanho:** PP · **Ref:** `R-ADT-03-rev`

```python
for aditivo in aditivos:
    if len(aditivo.blocos) == 1 and aditivo.blocos[0].rotulo is None:
        achados.registrar(...)
```

sai de `v_adt_03_peca_repetida_ou_trocada`. O docstring da função — que hoje descreve "as duas formas
de submeter as peças erradas" — passa a descrever só a que resta (peça repetida), com uma linha
remetendo à ESPEC 046 para quem perguntar pela outra.

**Pronto quando:** compila; `T-2692` passa.

---

#### T-2695 — O portão `[portão]`
**Tamanho:** PP · **Portão P1**

`T-2692` verde. `test_t1350_aditivo_repetido_bloqueia` (`test_api_e2e.py`) — a primeira forma, pela
API — continua verde, sem uma linha tocada. Suíte completa: `1.601 → 1.601` — nenhum teste novo,
nenhum removido, um comportamento a menos sendo exercitado.

**Pronto quando:** os dois testes relevantes no estado esperado, suíte completa reconciliada.

---

## 5. Épico E2 — Fechamento

#### T-2696 — Suíte e ferramentas
**Tamanho:** PP · **Portão P1**

`python -m pytest` completo; `ruff check` e `mypy src/` em `contract_validations.py`.

**Pronto quando:** os três limpos.

---

#### T-2697 — Documentos
**Tamanho:** PP

Status da ESPEC 046 (Proposta → Implementada). Entrada em `docs/CHANGELOG.md` que nomeie o risco
explicitamente — não "removida uma validação", mas "aditivos com bloco único sem rótulo deixam de
bloquear e passam a ser ignorados em silêncio, por decisão". Linha nova em `README.md`.

**Pronto quando:** os três documentos refletem o estado final, sem eufemismo sobre o risco.

---

#### T-2698 — Nenhuma âncora fora do previsto
**Tamanho:** PP · **Portão P1**

`git diff --stat backend/`: só `contract_validations.py` e `tests/test_consolidacao_aditivos.py`.
Nada em `contract.py`, `pdfplumber_extractor.py`, `container.py`, `grid.py` — esses são das ESPECs 043
a 045, não desta.

**Pronto quando:** o `diff` bate com essa lista.

---

## 6. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-ADT-03-rev` | T-2692, T-2693, T-2694, T-2695 |
| `D-01` (sem `AVISA` substituto) | T-2694 — a ausência de qualquer `achados.registrar` é o próprio critério |
| `D-03` (primeira forma intocada) | T-2695 |

---

## 7. O que este backlog não faz

- **Não adiciona aviso substituto** — decisão `D-01`, não esquecimento.
- **Não toca a primeira forma de `V-ADT-03`** (peça repetida).
- **Não muda `Contract.aplicar()`**.
- **Não mede o corpus** — não há `sha` nem documento real a conferir nesta entrega.
- **Não commita nada por conta própria** — commit é decisão à parte do usuário.

---

## 8. Sequência e commits

```
E0 ──► E1 ──► E2
P0     P1

E0  teste invertido, reprovando            test(T-2692, T-2693)
E1  o ramo removido                        fix(T-2694, T-2695)
E2  fechamento                             docs(T-2697)
```

---

## 9. Insumos em aberto (herdados da ESPEC)

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Se o silêncio se mostrar problemático na prática, a alternativa mais segura (distinguir por `PROPOSTA DE ADITIVO AO CONTRATO` e ao menos avisar) continua disponível como espec própria | Não bloqueia este backlog; é o caminho de volta se a decisão precisar ser revista |
