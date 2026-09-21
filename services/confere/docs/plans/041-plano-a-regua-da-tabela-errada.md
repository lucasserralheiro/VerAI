# PLANO 041 — Implementação de "A régua da tabela errada"

| | |
|---|---|
| **Especificação** | [ESPEC 041](../specs/041-a-regua-da-tabela-errada.md) v1.0 |
| **Versão** | 1.0 — 2026-09-03 — **executado** em 2026-09-03. Backend fechou em 1.561 passed; nenhum desvio do plano — ver ESPEC 041, Status |
| **Backlog** | TASKS 041, a escrever. Numeração continua de `T-2622`, a última em uso (o ajuste de `container.py` da ESPEC 040) |
| **Estado inicial** | Árvore de `backend/` carrega a ESPEC 040 **implementada e testada, ainda não commitada** — `contract_item.py`, `pdfplumber_extractor.py`, `container.py`, `contract_validations.py`, `conftest.py`, e a fixture `contrato_cgm.pdf`. `grid.py` está **limpo**, intocado pela 040. 1.555 testes coletados (`python -m pytest --collect-only -q`) |
| **Colisão conhecida** | `pdfplumber_extractor.py` já foi tocado pela 040 (o tratamento de `meses`). Este plano toca o mesmo arquivo, em outro ponto (o laço principal, para passar a união de geometrias) — sem sobrepor as linhas da 040. `grid.py` é o único arquivo novo nesta entrega |
| **Instrumento existente** | **A medição inteira já está na ESPEC 041 §2.3 e §2.4** — a união de geometrias por documento, a contagem de linhas fora dela (com e sem código), e o protótipo de extração completa do `contrato_cgm.pdf` (33 itens, soma `5.532.203,96`). Nada a remedir do zero: a `F0` **reproduz**, não descobre |

---

## 1. O que este plano tem de diferente

> **Não é objetivo o `contrato_cgm.pdf` gerar relatório completo.** `total_declarado` vem `None` nesse documento (`I-01` da ESPEC, total expresso em prosa) — depois desta correção ele ainda bloqueia, só que em `V-CTR-03`, não mais em `_montar_item`. Se alguém, no calor da entrega, "aproveitar" para também resolver isso, está fora do escopo aprovado.

> **O oráculo é duplo, e o segundo é herdado.** (1) `14.023.00002.00` e `15.069.00001.00` param de levantar `ExtractionError`. (2) A régua dos dez documentos (`test_extractor_aditivo_smul.py::REGUA`) continua idêntica — mesma técnica da ESPEC 033/040, reaproveitada sem alteração.

> **Um teste da ESPEC 040 fica desatualizado por construção, e é esperado.** `test_t2609_mensagem_prevista_apos_a_correcao` afirma hoje que `contrato_cgm.pdf` falha com `sem preço unitário, valor total` em `14.023.00002.00` — essa é exatamente a mensagem que este plano faz desaparecer. Atualizá-lo é tarefa própria (`T-2627`), não acidente a descobrir depois.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Medição reproduzida, testes novos reprovando pelo motivo certo** | Fim da F1 | Os números da ESPEC §2.3/§2.4 reproduzidos nesta árvore, idênticos. Testes novos de `R-FXA-09` reprovam; a régua dos dez documentos já passa | Número diferente do que a ESPEC registrou é sinal de que a árvore não está no estado que o plano presume — investigar antes de codificar |
| **P1 — `R-FXA-09`/`10` implementadas; as duas linhas do CGM não erram mais; a régua intacta** | Fim da F2 | `contrato_cgm.pdf` extrai sem `ExtractionError` (33 itens, `total_declarado is None` — `I-01`, não regressão). Os dez `sha` do corpus idênticos | Reverter a F2 |
| **P2 — O conjunto** | Fim da F3 | Suíte de backend verde, `1.555 → 1.555 + N`; `ruff`/`mypy` limpos; nenhuma âncora de documento reancorada | Não entregar |

---

## 3. Fases

### F0 — Reprodução da medição

**Objetivo:** conferir, nesta árvore, os números que a ESPEC já mediu — não descobri-los de novo.

| # | Tarefa | Ref. |
|---|---|---|
| T-2623 | Reproduzir a tabela da ESPEC §2.3 (união de geometrias por documento, linhas fora dela, com/sem código) para os dez documentos do corpus. Tem de bater exato | ESPEC §2.3 |
| T-2624 | Reproduzir o protótipo do §2.4: `contrato_cgm.pdf` extrai 33 itens somando `5.532.203,96`, com `total_declarado is None` | ESPEC §2.4, `I-01` |
| T-2625 | Régua de hoje dos dez documentos (`_medida()` de `test_extractor_aditivo_smul.py`) — a linha de base desta entrega | `R-FXA-11` |

**Verificação:** P0 (primeira metade). **Tamanho:** PP — vinte minutos, é conferência.

---

### F1 — Os testes, escritos antes `[portão P0]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2626 | Módulo novo `tests/test_regua_da_tabela_errada.py`: casos construídos com os traços medidos na ESPEC §2.1 — linha com traços fora da união de geometrias → nenhuma célula produzida (`R-FXA-09`); linha sem traço próprio nenhum → comportamento de hoje, inalterado (`R-FXA-10`) | `R-FXA-09`, `R-FXA-10` |
| T-2627 | Atualizar `test_t2609_mensagem_prevista_apos_a_correcao` (ESPEC 040, `test_periodo_por_extenso.py`): a asserção de `ExtractionError` sai; entra a extração bem-sucedida — 33 itens, `total_declarado is None`. O nome e o docstring do teste passam a citar a ESPEC 041, não mais o `I-04` como pendência | — |
| T-2628 | **[portão]** Rodar contra o `HEAD`: `T-2626` (caso "fora da união") reprova; `T-2627`, com a asserção **antiga**, ainda passa (documenta o defeito de hoje antes de virar o teste). A régua da `T-2625` já passa | **P0** |

**Verificação:** P0. **Tamanho:** P — quarenta minutos.

---

### F2 — `R-FXA-09`/`R-FXA-10` `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2629 | `grid.py::verticais_por_linha` — o quarto degrau passa a computar (ou receber) a união das geometrias admitidas e, havendo `tracos` não vazios e fora dela, devolve `None` para aquela linha em vez das divisórias da página | `R-FXA-09` |
| T-2630 | `grid.py::ler_celulas` — a palavra cuja linha resolve para `None` é ignorada, mesmo caminho que já ignora palavra fora da grade | `D-02` |
| T-2631 | `pdfplumber_extractor.py` — o laço principal passa a união das geometrias já calculadas (`self._geometrias_de_itens`) para a leitura por faixa | — |
| T-2632 | **[portão]** `T-2626` inteiro verde. `T-2627`, com a asserção **nova** (`T-2627` já reescrita), verde. Régua dos dez documentos (`T-2625`) idêntica | **P1** |

**Verificação:** P1. **Tamanho:** PP — quarenta minutos.

---

### F3 — Fechamento `[portão P2]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2633 | Suíte de backend completa, `1.555 → 1.555 + N` | **P2** |
| T-2634 | `ruff`/`mypy` nos arquivos tocados | **P2** |
| T-2635 | Status da ESPEC 041 (Proposta → Implementada, números medidos, `I-01`/`I-02` mantidos abertos), `docs/CHANGELOG.md`, `README.md` | — |
| T-2636 | `git diff --stat backend/`: só `grid.py` (novo nesta entrega), `pdfplumber_extractor.py`, e os dois módulos de teste — nada em `contract_item.py`, `contract_validations.py`, `container.py` (esses já são da 040, não desta) | **P2** |

**Verificação:** P2. **Tamanho:** PP — trinta minutos, mais o tempo da suíte.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3
P0     P0     P1     P2
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~2h, mais duas execuções de suíte |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Mover um item nos dez documentos que já extraem | `T-2625`/`T-2632`, a régua de `sha` |
| Esquecer de atualizar `T-2609` (da 040) e deixá-lo reprovando sem explicação | `T-2627`, tarefa própria, não acidente |
| Tentar fazer o `contrato_cgm.pdf` gerar relatório completo nesta entrega | `I-01` — fora do escopo, declarado no plano e na spec |
| Comparar só contra o gabarito único, não contra a união de geometrias | `D-01` da ESPEC — é exatamente o erro que a primeira hipótese cometeu, e a `T-2626` cobre o caso do `aditivo_pgm.pdf` que o exporia |

---

## 6. O que este plano não faz

- **Não lê `total_declarado` em prosa** (`I-01`) — outra causa, outra spec.
- **Não toca `_e_item_completo`** nem a escolha do gabarito.
- **Não cria validação nova** — `V-CTR-03` continua sendo o oráculo.
- **Não traz fixture nova** — `contrato_cgm.pdf` já está na suíte desde a 040.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Reprodução da medição | PP |
| F1 | Testes escritos antes, incluindo o ajuste do teste da 040 | P |
| F2 | `grid.py` + `pdfplumber_extractor.py` | PP |
| F3 | Fechamento | PP |

**Total: ~2h.** A medição já paga na spec é o que torna esta entrega mais curta que a 040.
