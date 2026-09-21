# TASKS 042 — Backlog de "O total que não tinha TOTAL:"

| | |
|---|---|
| **Especificação** | [ESPEC 042](../specs/042-o-total-que-nao-tinha-total.md) v1.0 |
| **Plano** | [PLANO 042](../plans/042-plano-o-total-que-nao-tinha-total.md) v1.0 |
| **Versão** | 1.0 — 2026-09-03 |
| **Total** | 13 tarefas · 3 portões · 1 insumo em aberto |
| **Status** | **Concluído** — 2026-09-03. Portões `P0` a `P2` fechados. Backend **1.561 → 1.566 passed** |

> **Escrito antes da implementação.** A `§11` é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

> **Um arquivo de produção.** `pdfplumber_extractor.py`, num terceiro ponto — nem `_montar_item`
> (ESPEC 040) nem o laço principal (ESPEC 041), mas o fim de `extrair()`. Se o diff trouxer
> `grid.py`, `contract_validations.py` ou `container.py`, alguma tarefa reabriu escopo alheio.

> **O teste que mais importa neste backlog é o que prova que uma fonte só não basta.** `T-2640(c)`
> — o caso do `aditivo_pgm.pdf`, onde só o `TOTAL` do cronograma existe e ele **não** pode virar
> `total_declarado`. Sem esse teste, uma simplificação futura poderia usar só uma fonte e ninguém
> notaria até o dia em que ela mentisse sobre o total de um aditivo real.

---

## 1. Convenções

**Identificadores** `T-26nn`, continuando de `T-2636`, a última em uso (ESPEC 041).

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde. Medido nesta árvore em 2026-09-03, antes de começar: `backend/` com as
ESPECs 040/041 implementadas e ainda não commitadas; **1.561 testes coletados**.

**Convenção de commit** `<tipo>(T-26nn): descrição`. `test(...)` para `E0`/`E1`; `fix(...)` para
`E2` — corrige um bloqueio indevido, não acrescenta função de negócio nova; `docs(...)` para `E3`.

### 1.1 Quatro regras que atravessam este backlog

**1 — Um arquivo de produção, e num ponto novo.** `pdfplumber_extractor.py`, só no fim de
`extrair()`. `_montar_item` (040) e o laço principal (041) não são tocados de novo.

*O sinal no diff:* qualquer linha em `grid.py`, `contract_validations.py` ou `container.py`.

**2 — Duas fontes, sempre, nunca uma só.** `total_declarado` só recebe valor quando a frase de
prosa **e** a linha `TOTAL` do cronograma existem **e** concordam. Uma reprovação de `T-2640(b)` ou
`T-2640(c)` com o produto entregando valor mesmo assim é a regressão mais grave possível neste
backlog — pior que não entregar nada.

*O sinal no diff:* um `or` onde devia haver `and` entre as duas condições, ou uma função que só
verifica uma das fontes.

**3 — O custo novo só aparece no caminho que já bloqueia.** A função roda dentro do
`if total_declarado is None:`, ao fim do laço — nunca antes, nunca para os documentos que já têm o
total. Os dez documentos do corpus não pagam um milissegundo a mais.

*O sinal no diff:* a chamada nova fora da guarda `is None`, ou dentro do laço por página.

**4 — Não é objetivo o aditivo real (`PA-CGM-250912-127`) fechar.** Ele tem outro defeito — ordem
de colunas trocada — que bloqueia antes de chegar aqui. A prova sobre aditivo é por caso construído
com os valores reais medidos na ESPEC, não pelo PDF inteiro.

*O sinal no diff:* uma tentativa de "aproveitar" e mexer em `COL_PRECO`/`COL_QUANTIDADE`/`COL_MESES`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Reprodução da medição | T-2637 … T-2639 | **P0** (1ª metade) | F0 |
| **E1** Os testes, escritos antes | T-2640 … T-2642 | **P0** | F1 |
| **E2** `R-TOT-01` a `R-TOT-03` | T-2643 … T-2645 | **P1** | F2 |
| **E3** Fechamento | T-2646 … T-2649 | **P2** | F3 |

### 2.1 A régua da entrega — o que pode mudar

| Muda | Não muda |
|---|---|
| `pdfplumber_extractor.py` ganha `_FRASE_TOTAL_EM_PROSA`, a leitura da linha `TOTAL` do cronograma, e `_total_por_convergencia` | `_montar_item`, o laço principal, `grid.py`, `_e_item_completo` |
| `contrato_cgm.pdf`: `total_declarado` deixa de ser `None` | Os dez documentos do corpus — nenhum `total_declarado` já preenchido muda |
| Status da ESPEC 042, `docs/CHANGELOG.md`, `README.md` | `contract_validations.py`, `container.py` — nenhuma linha |

---

## 3. Épico E0 — Reprodução da medição `[portão P0, 1ª metade]`

> **Nenhum arquivo de `src/` é tocado neste épico.** A ESPEC já mediu tudo; aqui só se confere.

#### T-2637 — Os dois valores reais, reproduzidos
**Tamanho:** PP · **Ref:** ESPEC §2.1

Sobre `contrato_cgm.pdf` (fixture) e sobre `docs/documentos/CGM/PA-CGM-250912-127 v4.0.pdf` (texto,
fora da suíte): a frase *"Valor total dos Serviços... estimado em R$ X"* e a linha `TOTAL` do
cronograma físico-financeiro, para as duas peças. Esperado: `5.532.203,96` e `6.110.655,79`, cada
par batendo entre si.

**Pronto quando:** os quatro valores conferem, sem ajuste.

---

#### T-2638 — A ausência confirmada no `aditivo_pgm.pdf`
**Tamanho:** PP · **Ref:** ESPEC §2.2/§2.3, `D-01`

A frase de prosa não existe em nenhuma página. Só o cabeçalho de coluna "VALOR TOTAL" do cronograma
aparece — e não é a frase.

**Pronto quando:** confirmado — zero ocorrências da frase, no documento inteiro.

---

#### T-2639 — A régua de hoje dos dez documentos
**Tamanho:** PP · **Ref:** `R-TOT-04`

`test_extractor_aditivo_smul.py` completo. Linha de base desta entrega.

**Pronto quando:** verde.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2640 — `tests/test_total_por_convergencia.py`
**Tamanho:** P · **Ref:** `R-TOT-01` a `R-TOT-03`, `D-01`

Casos construídos (string, sem PDF), com os valores reais da `T-2637`:

| caso | frase de prosa | linha do cronograma | esperado |
|---|---|---|---|
| (a) concordam | `5.532.203,96` | `5.532.203,96` | `Decimal("5532203.96")` |
| (b) só a frase | `5.532.203,96` | ausente | `None` |
| (c) só a linha — **o caso do `aditivo_pgm.pdf`** | ausente | `24.551.037,60` | `None` |
| (d) discordam | `5.532.203,96` | `6.110.655,79` | `None` |

**Pronto quando:** os quatro casos escritos, com (c) destacado como o teste que não pode voltar a
passar sozinho se a regra virar "uma fonte basta".

---

#### T-2641 — O teste de integração
**Tamanho:** PP

`extrator.extrair(caminho_contrato_cgm).total_declarado == Decimal("5532203.96")`.

**Pronto quando:** escrito, vermelho contra o `HEAD` (`total_declarado` ainda `None`).

---

#### T-2642 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

Contra o `HEAD`, `git diff src/` vazio: `T-2640` inteiro reprova (a função não existe — `AttributeError`
ou equivalente); `T-2641` reprova (`total_declarado is None`). A régua da `T-2639` já passa.

**Pronto quando:** as reprovações batem com o motivo esperado, transcritas neste documento.

---

## 5. Épico E2 — `R-TOT-01` a `R-TOT-03` `[portão P1]`

#### T-2643 — As duas fontes e a função de cruzamento
**Tamanho:** PP · **Ref:** `R-TOT-01`, `R-TOT-02`, `R-TOT-03`, `D-03` · **Primeiro toque em `src/`**

`pdfplumber_extractor.py`: `_FRASE_TOTAL_EM_PROSA` (regex sobre a frase de prosa), a leitura da linha
`TOTAL` dentro da seção "CRONOGRAMA FÍSICO-FINANCEIRO", e `_total_por_convergencia(texto) -> Decimal
| None` — só devolve valor quando as duas fontes existem e a diferença entre elas está dentro de
`TOLERANCIA_CHECKSUM` (`0,01`).

**Pronto quando:** `T-2640` inteiro verde, isolado (sem passar pelo laço de extração).

---

#### T-2644 — A chamada, sob a guarda certa
**Tamanho:** PP · **Ref:** `D-04`

Ao fim de `extrair()`, só dentro de `if total_declarado is None:` — depois do laço principal, antes
do `return Contract(...)`.

**Pronto quando:** `T-2641` verde, e nenhuma outra linha do método alterada.

---

#### T-2645 — O portão `[portão]`
**Tamanho:** PP · **Portão P1**

`T-2640` e `T-2641` verdes. Régua dos dez documentos (`T-2639`) idêntica.

**Pronto quando:** os dois conferem.

---

## 6. Épico E3 — Fechamento `[portão P2]`

#### T-2646 — Suíte completa
**Tamanho:** PP · **Portão P2**

`1.561 → 1.561 + N` (cinco testes novos esperados: quatro de `T-2640`, um de `T-2641`), zero falhas.

**Pronto quando:** verde, número reconciliado.

---

#### T-2647 — Ferramentas
**Tamanho:** PP · **Portão P2**

`ruff check` e `mypy src/` no arquivo tocado e no módulo de teste novo.

**Pronto quando:** os dois limpos.

---

#### T-2648 — Documentos
**Tamanho:** PP

Status da ESPEC 042 (Proposta → Implementada, números medidos, `I-01` mantido aberto), entrada nova
em `docs/CHANGELOG.md`, linha nova em `README.md`.

**Pronto quando:** os três refletem o estado final.

---

#### T-2649 — Nenhuma âncora alheia tocada
**Tamanho:** PP · **Portão P2**

`git diff --stat backend/`: só `pdfplumber_extractor.py` e `tests/test_total_por_convergencia.py`
além do que as ESPECs 040/041 já tinham modificado — nada em `grid.py`, `contract_validations.py`,
`container.py`, `contract_item.py`, `conftest.py`.

**Pronto quando:** o `diff` bate com essa lista.

---

## 7. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-TOT-01` | T-2640, T-2643 |
| `R-TOT-02` | T-2640, T-2643 |
| `R-TOT-03` | T-2640(b,c,d), T-2643 |
| `R-TOT-04` | T-2639, T-2645, T-2646 |
| `D-01` | T-2638, T-2640(c) |
| `D-04` | T-2644 |

---

## 8. O que este backlog não faz

- **Não corrige a ordem de colunas do `PA-CGM-250912-127`** (`I-01`) — outra causa, outra spec.
- **Não traz o aditivo real como fixture de extração completa** — depende de `I-01`.
- **Não cria validação nova** — `V-CTR-03` continua sendo o oráculo.
- **Não toca `grid.py`, `_e_item_completo`, `R-FXA-*` nem `R-MES-*`.**
- **Não commita nada** — decisão à parte.

---

## 9. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3
P0     P0     P1     P2

E0  medição reproduzida, nenhum arquivo tocado
E1  quatro casos + um teste de integração        test(T-2640, T-2641)
E2  as duas fontes + a função de cruzamento       fix(T-2643, T-2644)
E3  fechamento                                    docs(T-2648)
```

---

## 10. Insumos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | `PA-CGM-250912-127` tem a ordem das colunas trocada e não extrai por completo — impede virar fixture de extração completa e confirmar em documento real que `R-TOT-*` fecha o relatório de um aditivo | Não bloqueia este backlog — a prova sobre aditivo usa caso construído (`T-2640c`). Candidato a spec própria |

---

## 11. Emenda de execução

**2026-09-03.** As três fases correram na ordem prevista, os três portões fecharam sem reverter
fase nenhuma.

**Os cinco testes da `T-2640`/`T-2641` passaram de primeira**, sem ajuste — incluindo `T-2640(c)`, o
mais importante do backlog. Diferente da ESPEC 041 (que exigiu corrigir `Decimal` vs `float` em dois
testes), aqui a medição prévia da ESPEC (§2.1 a §2.3) já tinha os valores exatos, e transcrevê-los
para casos construídos não teve superfície de erro.

**A suíte completa acusou uma reprovação — não em código novo, mas num teste da entrega anterior.**
`test_regua_da_tabela_errada.py::test_t2627_as_duas_linhas_de_escopo_nao_bloqueiam_mais_a_extracao`
(ESPEC 041) afirmava `contrato.total_declarado is None`, porque no momento em que foi escrito isso
era verdade — `I-01` da 041 ainda estava aberto. Esta entrega fechou esse `I-01`, e a asserção antiga
passou a estar errada pelo motivo certo: o produto melhorou, o teste é que precisava saber disso.
Corrigido para `== Decimal("5532203.96")`, no mesmo padrão da correção que a `T-2627` da própria 041
já tinha feito sobre um teste da 040 — é a segunda vez seguida que uma entrega desta série termina
"consertando" uma asserção de sucesso da anterior, e vale como padrão a esperar nas próximas: **toda
entrega que fecha um `I-0x` deve revisar os testes que dependiam dele continuar aberto.**

**Contagem final:** 1.561 coletados no início, **1.566** ao final — cinco testes novos de
`test_total_por_convergencia.py`, nenhum removido, mais o ajuste (não adição) da `T-2627` alheia.
`ruff check` e `mypy src/` limpos no único arquivo de produção tocado. `git diff --stat backend/`
trouxe só `pdfplumber_extractor.py` e o módulo de teste novo, além do ajuste already-tracked em
`test_regua_da_tabela_errada.py` — nenhuma âncora de documento, nenhum arquivo de `grid.py`,
`contract_validations.py` ou `container.py` tocado por esta entrega.

**O que ficou aberto, e é de outra entrega.** `I-01` — a ordem de colunas trocada no
`PA-CGM-250912-127` — segue sem investigação própria.
