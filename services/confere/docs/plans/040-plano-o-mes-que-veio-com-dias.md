# PLANO 040 — Implementação de "O mês que veio com dias"

| | |
|---|---|
| **Especificação** | [ESPEC 040](../specs/040-o-mes-que-veio-com-dias.md) v1.2 |
| **Versão** | 1.0 — 2026-09-03 — **executado** em 2026-09-03. Backend fechou em 1.555 passed depois de uma revisão de código pós-entrega corrigir `V-CTR-07` sem chamada em `container.py` — ver TASKS 040 §12.1 |
| **Backlog** | TASKS 040, a escrever. Numeração continua de `T-2603`, a última em uso no repositório |
| **Estado inicial** | Árvore de `backend/` **limpa**: nenhum arquivo tocado. `frontend/` e `docs/CHANGELOG.md`/`docs/specs/002`/`008` trazem mudanças não commitadas de trabalho anterior (ESPEC 039), alheias a este plano — nenhum dos arquivos que este plano toca está entre elas. Backend medido nesta sessão: **1.543 testes coletados** (`python -m pytest --collect-only -q`) |
| **Colisão conhecida** | Nenhuma. Os três arquivos de produção tocados — `contract_item.py`, `pdfplumber_extractor.py`, `contract_validations.py` — não aparecem nas mudanças pendentes de outra entrega |
| **Instrumento existente** | O PDF real já está no repositório e foi medido nesta sessão (leitura, nada gravado): `docs/documentos/CGM/PC-CGM-240603-82 v3.0.pdf`, `sha256` `e1e75af8459fbfc1…`. Reproduz a mensagem original **byte a byte**. Um protótipo em memória — sem tocar o repositório — confirmou que a correção proposta faz a extração avançar e falhar de novo exatamente onde a ESPEC §2.3 prevê, com a mensagem prevista |

---

## 1. O que este plano tem de diferente dos anteriores

> **O documento real não fecha ao final deste plano, e isso é esperado — não é entrega incompleta.**
> `PC-CGM-240603-82` carrega dois defeitos independentes na mesma página. Este plano corrige um
> (`R-MES-*`). O outro (`I-04` da ESPEC, item `14.023.00002.00`) fica de pé, por decisão, e é o que
> prova que a correção é real e não está mascarando nada: depois da `F2`, a mesma peça tem de falhar
> **com uma mensagem diferente e prevista**, não gerar relatório completo. Se ela gerar, algo além do
> que este plano previu mudou — provavelmente `_e_item_completo`, e é sinal de alarme, não de sorte.

> **O oráculo de sucesso não é "o CGM extrai".** É: (1) a mensagem original não ocorre mais; (2) a
> mensagem nova é exatamente a prevista; (3) os dez documentos que já extraem hoje não se movem um
> byte. As três coisas são medidas por igualdade, não por leitura de log.

> **Nenhum PDF sintético.** A ESPEC 040 v1.0 previa poder precisar construir um — não há biblioteca de
> geração de PDF no projeto (só leitura, via `pdfplumber`), e teria sido a parte mais cara deste
> plano. O PDF real já está em `docs/documentos/`, no mesmo lugar de onde as fixtures do SMIT e do PGM
> vieram; entra do mesmo jeito, sem sanitização — é proposta comercial, não planilha com dado pessoal
> (`D-08` da ESPEC 033 é o precedente).

> **A maior parte da prova não depende do PDF nenhum.** `_montar_item` é testável com uma lista de
> células construída à mão — no espírito de `T-13` da ESPEC 033, que testou `para_decimal` sem abrir
> PDF. É onde a maioria dos casos deste plano (célula limpa, célula em prosa, célula ausente) é
> provada, rápido e sem depender de geometria de página nenhuma. O PDF real entra só para as duas
> asserções que precisam ser sobre o documento que originou a espec: a mensagem que some, e a que
> aparece no lugar dela.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base, fixture dentro, testes reprovando pelo motivo certo** | Fim da F1 | `contrato_cgm.pdf` na suíte, com `sha256` do arquivo registrado. Testes novos de `_montar_item` reprovam só no caso da célula em prosa; os demais já passam. O teste sobre o PDF real passa **hoje**, documentando a mensagem original — ele existe para virar, na F2, o teste que prova que ela sumiu | Inventário deduzido é o defeito que o projeto já cometeu antes. Teste que reprova pelo motivo errado não é régua |
| **P1 — `R-MES` implementado; CGM falha com a mensagem prevista; os dez `sha` intactos** | Fim da F2 | `10.050.00001.00` não levanta mais `ExtractionError`. O mesmo documento levanta, agora, `item 14.023.00002.00 (página 10) sem preço unitário, valor total` — **mensagem exata**, não aproximada. A régua dos dez documentos de `test_extractor_aditivo_smul.py::REGUA` idêntica | Reverter a F2. `sha` que se mova é o próprio defeito que a ESPEC 033 existe para não causar, e esta espec herda a régua |
| **P2 — `V-CTR-07` implementada e isolada do PDF** | Fim da F3 | Dispara com código/página/texto certos no caso construído à mão; não dispara em nenhum item dos dez documentos do corpus; nenhum achado `BLOQUEIA` novo em lugar nenhum | Reverter a F3 |
| **P3 — O conjunto** | Fim da F4 | Suíte de backend verde, **1.543 → 1.543 + N**, sem regressão; `ruff`/`mypy` limpos; nenhuma âncora de documento (`.docx`, `.xlsx`, `linhas_do_documento.json`) reancorada | Não entregar |

---

## 3. Fases

### F0 — Linha de base e a fixture

**Objetivo:** ter o "antes" medido e o PDF real dentro da suíte, antes de qualquer teste novo.

| # | Tarefa | Ref. |
|---|---|---|
| T-2604 | Medir, na árvore parada, a mensagem exata que `PdfPlumberContractExtractor().extrair(...)` levanta sobre `docs/documentos/CGM/PC-CGM-240603-82 v3.0.pdf` — já medida nesta sessão (§ Instrumento existente), a repetir na execução para não supor | ESPEC §1 |
| T-2605 | Copiar o PDF para `backend/tests/fixtures/contrato_cgm.pdf`, registrar o `sha256` do arquivo (`e1e75af8459fbfc1…`) — igual ao que `test_extractor_aditivo_smul.py` faz para os PDFs do SMUL | `I-01` da ESPEC |
| T-2606 | `caminho_contrato_cgm` em `conftest.py`, `scope="session"`, no molde de `caminho_aditivo_smul` (linha 90) | — |
| T-2607 | Reexecutar `_medida()` (de `test_extractor_aditivo_smul.py`) sobre a `REGUA` dos dez documentos e conferir que bate com o que já está gravado ali — é a linha de base desta entrega, não uma nova | `R-MES-05` |

**Verificação:** P0 (primeira metade).

**Tamanho:** PP — vinte minutos.

---

### F1 — Os testes, escritos antes `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2608 | Módulo novo `tests/test_periodo_por_extenso.py`. Chamadas diretas a `extractor._montar_item(celulas, codigo, pagina)` com listas de célula construídas à mão: (a) `meses` limpo — item sai igual a hoje; (b) `meses = '2 meses e 14 dias'` — sem exceção, `meses is None`, `meses_bruto == '2 meses e 14 dias'`; (c) `preço` ausente — ainda levanta; (d) `quantidade` ausente — ainda levanta; (e) `total` ausente — ainda levanta; (f) `meses` **e** `preço` ausentes — a mensagem cita só `preço unitário` | `R-MES-01`, `R-MES-02` |
| T-2609 | No mesmo módulo, com a fixture `contrato_cgm`: `pytest.raises(ExtractionError, match="10\.050\.00001\.00.*sem meses")` — documenta o defeito atual | — |
| T-2610 | **[portão]** Rodar contra o `HEAD`: `T-2608(b)` reprova; `T-2608(a, c, d, e, f)` já passam, porque não mudam; `T-2609` passa hoje | **P0** |

**Verificação:** P0.

> **`T-2608(a)` já passa antes de qualquer código novo, e isso é resultado, não folga.** Ele afirma
> que o caminho comum — célula de `meses` limpa — não muda. Se ele reprovasse aqui, a premissa de que
> a mudança é estreita estaria errada antes de começar.

**Tamanho:** P — uma hora.

---

### F2 — `R-MES-01` a `R-MES-03` `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2611 | `domain/entities/contract_item.py` — `meses: int` → `meses: int \| None`; campo novo `meses_bruto: str \| None = None` | `D-02`, `D-03` |
| T-2612 | `pdfplumber_extractor.py::_montar_item` — `meses` sai da lista `faltando`; quando `para_decimal(celulas[COL_MESES])` é `None`, monta o item com `meses=None, meses_bruto=_limpar(celulas[COL_MESES])`. `_e_item_completo` **não muda** | `R-MES-01`, `R-MES-03` |
| T-2613 | **[portão]** `T-2608` inteiro verde. `T-2609` passa a **reprovar** — ajustar a asserção para `pytest.raises(ExtractionError, match="14\.023\.00002\.00.*sem preço unitário, valor total")`, e essa mensagem tem de bater **exata** com a prevista na ESPEC §2.3 | **P1** |
| T-2614 | **[portão]** Reexecutar a régua dos dez documentos (`T-2607`): `sha` idênticos, e a lista de geometrias admitidas por documento também | **P1** |

**Verificação:** P1.

> **`T-2613` é o portão mais importante deste plano.** Terminar com o CGM **ainda quebrado**, e com a
> mensagem certa, é o que separa *"corrigi o campo"* de *"corrigi o campo sem mascarar outra coisa"*.
> Se a mensagem vier diferente da prevista, alguma outra parte do laço de extração se comportou
> diferente do que a ESPEC §2.3 mediu — parar e investigar antes de seguir para a `F3`.

**Tamanho:** PP — quarenta minutos.

---

### F3 — `V-CTR-07` `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2615 | `infrastructure/validations/contract_validations.py::v_ctr_07_periodo_nao_numerico`, no molde de `v_ctr_06_cauda_sem_linha_anterior` | `R-MES-04` |
| T-2616 | No mesmo módulo de teste, `Contract`/`ContractItem` construídos à mão (padrão de `test_cauda_de_pagina.py:249-264`): item com `meses=None, meses_bruto="2 meses e 14 dias"` dispara `AVISA` com código, página e texto certos; item com `meses=12` não dispara; contrato sem itens não dispara | `R-MES-04` |
| T-2617 | **[portão]** Testes novos verdes. Suíte de validações existente sem nenhum achado `BLOQUEIA` novo introduzido | **P2** |

**Verificação:** P2.

**Tamanho:** PP — trinta minutos.

---

### F4 — Fechamento `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2618 | Suíte de backend completa, número declarado, comparado com os 1.543 coletados na `F0` | **P3** |
| T-2619 | `ruff` e `mypy` nos arquivos tocados | **P3** |
| T-2620 | `docs/CHANGELOG.md` (entrada nova), status da ESPEC 040 de **Proposta** para **Implementada** com os números medidos, e o `I-04` explicitamente mantido como ponto em aberto — não fechado por esta entrega | — |
| T-2621 | Conferir, pelo `git diff`, que nenhuma âncora de documento (`.docx`, `.xlsx`, `linhas_do_documento.json`) foi tocada — o `diff` de `backend/` deve conter só `contract_item.py`, `pdfplumber_extractor.py`, `contract_validations.py`, `conftest.py`, dois módulos de teste novos, e a fixture binária nova | **P3** |

**Tamanho:** PP — vinte minutos, mais o tempo da suíte.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4
P0     P0     P1     P2     P3
              │
              └─ CGM falha com a mensagem PREVISTA, não mais a original; dez sha intactos
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~2h30, mais três execuções de suíte |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Mover um valor num dos dez documentos que hoje extraem sem erro | `T-2607`/`T-2614`, a régua de `sha` reexecutada |
| A mensagem do CGM, depois da correção, sair diferente da prevista — sinal de que algo mais mudou | `T-2613`, com o texto exato como asserção, não `match` frouxo |
| Tentar "aproveitar" e corrigir também o `I-04` (a linha de escopo) dentro desta entrega | `4.2` da ESPEC — fora do escopo por decisão. Este plano não abre `grid.py` nem `R-FXA-04` |
| Tratar célula vazia (`''`) como o mesmo caso de célula em prosa | Não é: `para_decimal('')` já devolve `None` hoje, e esse comportamento é anterior a este plano — `T-2608` não testa célula vazia porque ela já segue o caminho de hoje sem mudança |
| Confundir "o CGM não fechou" com regressão desta entrega | `§1` deste plano, por extenso — é o comportamento esperado, e `I-04` é quem o explica |

---

## 6. O que este plano não faz

- **Não toca `grid.py`, `_e_item_completo`, nem o crivo de admissão de geometria.** `I-04` fica de pé.
- **Não traz `PA-CGM-250912-127 v4.0.pdf`** (o aditivo do CGM) como fixture — ele também tem a célula
  "N meses e M dias" (página 4, item `14.049.00039.00`), mas falha por um terceiro motivo, ainda não
  investigado (`sem quantidade, preço unitário` no `10.050.00001.00`, página 2). Trazê-lo misturaria
  três defeitos numa entrega que é sobre um.
- **Não exibe `meses_bruto` no `.docx` ou na API** — `meses` não é servido a nenhum consumidor hoje, e
  adicioná-lo é entrega própria (`I-02` da ESPEC).
- **Não sanitiza o PDF do CGM** — é proposta comercial (preços e serviços), não planilha com dado
  pessoal; entra sem tratamento, como os demais PDFs de contrato já commitados.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Fixture e linha de base | PP |
| F1 | Testes escritos antes | P |
| F2 | `contract_item.py` + `pdfplumber_extractor.py` | PP |
| F3 | `V-CTR-07` | PP |
| F4 | Fechamento | PP |

**Total: ~2h30**, a maior parte em F1 (escrever os seis casos de `_montar_item`) e na espera das
execuções de suíte.
