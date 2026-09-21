# TASKS 043 — Backlog de "O cartão sem título"

| | |
|---|---|
| **Especificação** | [ESPEC 043](../specs/043-o-cartao-sem-titulo.md) v1.0 |
| **Plano** | [PLANO 043](../plans/043-plano-o-cartao-sem-titulo.md) v1.0 |
| **Versão** | 1.0 — 2026-09-03 |
| **Total** | 12 tarefas · 3 portões · 3 insumos em aberto |
| **Status** | **Concluído** — 2026-09-03. Portões `P0` a `P2` fechados. Backend **1.566 → 1.573 passed** |

> **Escrito antes da implementação.** A `§11` é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

> **Dois arquivos de produção.** `contract_validations.py` (cinco funções) e
> `measurement_validations.py` (duas). Nenhum outro — nem `ResultadoPanel.tsx`, que já sabe desenhar
> o card certo desde a ESPEC 025.

> **O risco real é menor do que parece à primeira vista, e está medido, não suposto.** Das sete
> validações, só três têm teste que lê `.mensagem`. As outras quatro não têm asserção de texto
> nenhuma para quebrar — e duas delas (`V-MED-03`, `V-MED-04`) não têm teste dedicado nenhum hoje.

---

## 1. Convenções

**Identificadores** `T-26nn`, continuando de `T-2649`, a última em uso (ESPEC 042).

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde. Medido nesta árvore em 2026-09-03, antes de começar: `backend/` com as
ESPECs 040/041/042 implementadas e ainda não commitadas; **1.566 testes coletados**.

**Convenção de commit** `<tipo>(T-26nn): descrição`. `test(...)` para `E0`/`E1`; `fix(...)` para
`E2` — corrige vocabulário exposto, não muda comportamento; `docs(...)` para `E3`.

### 1.1 Três regras que atravessam este backlog

**1 — Nenhuma condição de disparo muda.** As sete validações continuam registrando exatamente nos
mesmos casos, com a mesma severidade. Só a forma de registrar muda — `registrar` vira
`registrar_em_partes`.

*O sinal no diff:* qualquer `if`/condição alterada dentro de uma das sete funções.

**2 — As três substrings de `V-CTR-07` são a régua mais apertada deste backlog.** `causa` precisa
conter o código do item, `"página N"` e o texto de `meses_bruto` — os três, sempre, senão
`test_periodo_por_extenso.py` reprova por perda de informação.

*O sinal no diff:* `causa`/`ação` de `V-CTR-07` sem um dos três dados dinâmicos.

**3 — `V-MED-03` e `V-MED-04` ganham teste dedicado pela primeira vez.** Não é regressão a evitar —
é lacuna a fechar. Tratar como "só preciso não quebrar o que existe" para essas duas seria deixar
passar a parte da tarefa que mais vale.

*O sinal no diff:* `T-2652` sem um teste isolado para cada uma das duas.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Medição e desenho do texto | T-2650 … T-2651 | **P0** (1ª metade) | F0 |
| **E1** Os testes, escritos antes | T-2652 … T-2653 | **P0** | F1 |
| **E2** As sete validações | T-2654 … T-2656 | **P1** | F2 |
| **E3** Fechamento | T-2657 … T-2661 | **P2** | F3 |

### 2.1 A régua da entrega — o que muda

| Muda | Não muda |
|---|---|
| Sete validações ganham `titulo`/`causa`/`ação`/`detalhe` | Severidade, condição de disparo, ordem na tela |
| `mensagem` de `V-CTR-06`/`V-ADT-02`/`V-CTR-07` (recalculada, mas com as substrings antigas preservadas) | `mensagem` das outras quatro (sem teste que a leia hoje) |
| Status da ESPEC 043, `docs/CHANGELOG.md`, `README.md` | `ResultadoPanel.tsx`, `CartaoAgregado`, `V-CAP-01`, `V-CTR-05`, as quatro `BLOQUEIA` |

---

## 3. Épico E0 — Medição e desenho do texto `[portão P0, 1ª metade]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-2650 — O inventário, reproduzido
**Tamanho:** PP · **Ref:** ESPEC §2.1, `D-04`

Para cada uma das sete siglas: quais arquivos de teste a citam, e quais dessas citações leem
`.mensagem`. Esperado, medido nesta sessão: só `V-CTR-06`, `V-ADT-02` e `V-CTR-07` têm asserção de
texto; as outras quatro não.

**Pronto quando:** a tabela bate com o §1 deste documento, sem ajuste.

---

#### T-2651 — O texto de `causa`/`ação`, com as substrings garantidas
**Tamanho:** PP · **Ref:** ESPEC §5.1

Para `V-CTR-06`: `causa` contém `"página {pagina}"`. Para `V-ADT-02`: `ação` contém a frase
`"documento sai igual"`. Para `V-CTR-07`: `causa` contém o código do item, `"página {pagina}"` e o
texto de `meses_bruto` — os três juntos, porque é o teste com três asserções.

**Pronto quando:** o texto de cada uma das três está escrito, com as substrings sublinhadas para
conferência na `F1`.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2652 — Um teste por validação, isolado
**Tamanho:** P · **Ref:** `R-CLA-01`, `R-CLA-02`

Sete testes, cada um com `Contract`/`ContractItem`/`Measurement` construído à mão (sem PDF, sem
planilha), no molde de `test_cauda_de_pagina.py:249-268`. Cada um afirma `titulo`, `causa`, `ação` e
`detalhe` preenchidos, com o conteúdo de `T-2651` onde aplicável.

**Para `V-MED-03` e `V-MED-04`**: não há teste anterior a seguir de exemplo dentro do próprio
arquivo — são os primeiros. Construir o cenário mínimo que faz cada uma disparar (código repetido
sem marca, bloco descontado sem par), no molde do que as docstrings das próprias funções já
descrevem.

**Pronto quando:** os sete testes existem, com as asserções de `titulo`/`causa`/`ação`/`detalhe`.

---

#### T-2653 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

Contra o `HEAD`: os sete testes novos reprovam (`titulo == ""`, ainda não preenchido). Os três
testes antigos com asserção de `mensagem` (`V-CTR-06`, `V-ADT-02`, `V-CTR-07`) **continuam
passando** — o código de produção ainda não mudou.

**Pronto quando:** a tabela de reprovação/passagem bate com o esperado, transcrita neste documento.

---

## 5. Épico E2 — As sete validações `[portão P1]`

#### T-2654 — `contract_validations.py`
**Tamanho:** P · **Ref:** `R-CLA-01` · **Primeiro toque em `src/`**

`v_ctr_04_geometria_nao_canonica`, `v_ctr_06_cauda_sem_linha_anterior`,
`v_ctr_07_periodo_nao_numerico`, `v_adt_02_aditivo_sem_efeito`,
`v_adt_04_movimento_de_codigo_ausente`: `achados.registrar(...)` → `achados.registrar_em_partes(...)`,
com `titulo`/`causa`/`ação`/`detalhe` de `T-2651`/ESPEC §5.1.

**Pronto quando:** as cinco funções compilam, `mypy` limpo.

---

#### T-2655 — `measurement_validations.py`
**Tamanho:** PP · **Ref:** `R-CLA-01`

`v_med_03_desconto_por_posicao`, `v_med_04_apuracao_sem_par`: idem.

**Pronto quando:** as duas funções compilam, `mypy` limpo.

---

#### T-2656 — O portão `[portão]`
**Tamanho:** PP · **Portão P1**

Os sete testes de `T-2652` verdes. Os três testes antigos (`V-CTR-06`, `V-ADT-02`, `V-CTR-07`)
verdes, agora contra o código novo — sem editar a asserção deles. Todos os testes de
disparo/não-disparo das sete validações, já existentes antes desta entrega, continuam verdes sem
alteração.

**Pronto quando:** os três grupos conferem.

---

## 6. Épico E3 — Fechamento `[portão P2]`

#### T-2657 — Suíte completa
**Tamanho:** PP · **Portão P2**

`1.566 → 1.566 + N` (sete testes novos esperados), zero falhas.

**Pronto quando:** verde, número reconciliado.

---

#### T-2658 — Ferramentas
**Tamanho:** PP · **Portão P2**

`ruff check` e `mypy src/` nos dois arquivos de produção e nos módulos de teste tocados.

**Pronto quando:** os dois limpos.

---

#### T-2659 — Conferência manual na tela
**Tamanho:** PP

Os sete cards, vistos no aplicativo real (ou reconferidos contra o artefato já publicado nesta
conversa): título em português, causa, ação, e "Detalhes técnicos" recolhido com a sigla dentro.

**Pronto quando:** os sete conferem visualmente — registrar aqui se algum ficou diferente do
previsto em `T-2651`.

---

#### T-2660 — Documentos
**Tamanho:** PP

Status da ESPEC 043 (Proposta → Implementada, números medidos), `docs/CHANGELOG.md`, `README.md`.

**Pronto quando:** os três refletem o estado final.

---

#### T-2661 — Nenhuma âncora alheia tocada
**Tamanho:** PP · **Portão P2**

`git diff --stat backend/`: só `contract_validations.py`, `measurement_validations.py` e os
arquivos de teste tocados por esta entrega — nada em `grid.py`, `pdfplumber_extractor.py`,
`container.py`, `contract_item.py`, `conftest.py`. Nada em `frontend/`.

**Pronto quando:** o `diff` bate com essa lista.

---

## 7. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-CLA-01` | T-2651, T-2654, T-2655 |
| `R-CLA-02` | T-2652 |
| `R-CLA-03` | T-2656 |
| `R-CLA-04` | T-2650, T-2653 |

---

## 8. O que este backlog não faz

- **Não toca `V-CAP-01`, `V-CTR-05`** (Fase B) nem as quatro `BLOQUEIA` (Fase D).
- **Não generaliza `CartaoAgregado`** (`I-01` da ESPEC, Fase C).
- **Não toca `frontend/`** — nenhum arquivo.
- **Não muda severidade nem condição de disparo** de nenhuma das sete validações.
- **Não commita nada** — decisão à parte.

---

## 9. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3
P0     P0     P1     P2

E0  medição e texto, nenhum arquivo de produção tocado
E1  sete testes, o código de produção intocado         test(T-2652)
E2  as sete validações                                  fix(T-2654, T-2655)
E3  fechamento                                           docs(T-2660)
```

---

## 10. Insumos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | `CartaoAgregado` tem texto fixo para qualquer validação com mais de um achado (ESPEC 043 §2.3) — `V-MED-03` pode disparar várias vezes no mesmo relatório | Não bloqueia este backlog. Fase C, depois das Fases A e B |
| `I-02` | Não há teste de navegador cobrindo o conteúdo dos cards `AVISA` | Não. Fora do escopo desta entrega de conteúdo |
| `I-03` | `V-CAP-01`/`V-CTR-05` (Fase B) e as quatro `BLOQUEIA` (Fase D) seguem sem spec própria | Não bloqueia — são as próximas fatias, não esta |

---

## 11. Emenda de execução

**2026-09-03.** As três fases correram na ordem prevista, os três portões fecharam sem reverter
fase nenhuma.

**O inventário previu certo: só três das sete têm teste de `mensagem`, e os três sobreviveram sem
edição.** `V-CTR-06` (`"página 7"`), `V-ADT-02` (`"documento sai igual"`) e `V-CTR-07` (código,
`"página 10"`, texto extraído) continuaram verdes contra o código novo, porque `causa`/`ação` foram
desenhadas em `T-2651` para preservar essas substrings exatas — nenhuma delas precisou de ajuste
posterior, diferente do que aconteceu nas duas entregas anteriores (040 e 041), onde um teste da
entrega anterior sempre precisava de correção.

**`V-MED-03` e `V-MED-04` ganharam o primeiro teste dedicado.** Nenhum dos dois tinha uma chamada
direta em `tests/` antes desta entrega — só uma menção em docstring de fixture e um comentário,
respectivamente. Os dois testes novos exercitam as funções isoladas, sem PDF nem planilha real.

**A suíte completa acusou a mesma reprovação intermitente de sempre**,
`test_desempenho.py::test_o_custo_de_um_anexo_e_linear` — área não tocada por esta entrega, ruído de
carga, confirmada passando isolada em 6,58s.

**Um achado da própria sessão, fora do escopo desta entrega:** ao rodar `git status` no meio da
execução, a árvore apareceu "limpa" das ESPECs 040/041/042 — não porque o trabalho tivesse sumido,
mas porque o usuário as commitou (`f343be5 Ajuste contrato da CGM`) em paralelo, fora desta
conversa. Conferido por `git show --stat`: o commit contém exatamente os arquivos das três entregas
anteriores, byte a byte. Vale como lembrete: um `git status` "mais limpo do que o esperado" pode ser
progresso, não perda — confirmar com `git log`/`git show` antes de supor.

**Contagem final:** 1.566 coletados no início, **1.573** ao final — sete testes novos, nenhum
removido. `ruff check` e `mypy src/` limpos, depois de duas linhas longas corrigidas (>100
caracteres) em `contract_validations.py` e `measurement_validations.py`. `git diff --stat backend/`
trouxe só os dois arquivos de produção e o módulo de teste novo — nada em `frontend/`, nada nas
demais validações.

**O que ficou aberto, e é de outra entrega.** `V-CAP-01`/`V-CTR-05` (Fase B), a generalização de
`CartaoAgregado` (`I-01`, Fase C) e as quatro validações `BLOQUEIA` (Fase D) seguem sem
implementação.
