# PLANO 047 — Implementação de "O mês que virou data cheia"

| | |
|---|---|
| **Especificação** | [ESPEC 047](../specs/047-o-mes-que-virou-data-cheia.md) v1.0 |
| **Versão** | 1.0 — 2026-09-09 — **executado** em 2026-09-09. Todos os portões fechados na primeira passagem; nenhuma fase revertida |
| **Backlog** | [TASKS 047](../tasks/047-tasks-o-mes-que-virou-data-cheia.md) — numeração continua de `T-2698`, a última em uso (ESPEC 046) |
| **Estado inicial** | Árvore de `backend/` carrega as ESPECs 043-046 implementadas, **ainda não commitadas** — `contract.py`, `grid.py`, `pdfplumber_extractor.py`, `container.py`, `contract_validations.py`, `measurement_validations.py`, `conftest.py`, `test_consolidacao_aditivos.py`, `docs/CHANGELOG.md`, mais três módulos de teste novos e uma fixture. `aba_reader.py` e `test_aba_reader.py` estão **limpos**, intocados por qualquer uma delas. **1.601 testes coletados** (`python -m pytest --collect-only -q`) |
| **Colisão conhecida** | **Nenhuma.** Este plano toca só `aba_reader.py` e `test_aba_reader.py` — nenhum dos dois aparece em nenhuma das quatro entregas pendentes acima |
| **Instrumento existente** | A medição de risco já está na ESPEC 047 `§2`/`Origem`: nenhuma das 19 abas configuradas em `anexos.json` tem, em nenhuma fixture de teste, célula de data cujo `number_format` não tem token de dia. A única ocorrência do padrão no corpus de fixtures (`Alta Plataforma`/`mmm-yy` em `levantamento_pgm.xlsx`) não é uma aba configurada e não é exercitada por teste algum |

---

## 1. O que este plano tem de diferente

> **O risco de regressão já foi medido, não só argumentado.** A ESPEC 047 (`Origem`) registra a varredura de todas as fixtures `.xlsx` contra as 19 abas de `anexos.json`: zero células hoje exercitadas caem no ramo novo. `R-DAT-04` não é uma promessa — é uma contagem já feita, que o portão `P1` só reconfirma.

> **Não há corpus de PDF a medir.** Diferente das ESPECs 040/045, esta entrega não toca extração de contrato nem `Decimal`/checksum — é normalização de texto de célula de planilha, isolada em `AbaReader`. A régua é a suíte de `test_aba_reader.py`, não um `sha` de itens.

> **O escopo é deliberadamente estreito** (`D-01` da ESPEC): só o caso "sem token de dia" muda. Data completa continua saindo `dd/mm/aaaa` fixo, mesmo quando a planilha usa outro separador — isso é o comportamento de hoje, e este plano não o toca. Se alguma tarefa tentar "aproveitar" para also reproduzir o formato de data completa, está fora do escopo aprovado.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Testes novos escritos, reprovando pelo motivo certo** | Fim da F1 | Os casos novos em `test_aba_reader.py` reprovam contra o `HEAD` por `AttributeError` (`_data_sem_dia` ainda não existe) — não por erro de construção da planilha em memória | Reprovar por outro motivo é sinal de que o teste não está exercitando o código certo |
| **P1 — `R-DAT-01` a `R-DAT-04` implementadas** | Fim da F2 | Os casos da F1 passam: `mmm/yy` → `"dez/26"`, `mmmm/yyyy` → `"dezembro/2026"`, formatos com dia (`dd/mm/yyyy`, `mm-dd-yy`) continuam `"09/12/2026"`. Suíte completa: `1.601 → 1.601 + N`, zero reprovação nova | Reverter a F2 |
| **P2 — Fechamento** | Fim da F3 | Suíte, `ruff`/`mypy` limpos; `git diff --stat backend/` só em `aba_reader.py` e `test_aba_reader.py`; documentos atualizados | Não entregar |

---

## 3. Fases

### F0 — Preparação

| # | Tarefa | Ref. |
|---|---|---|
| T-2699 | Confirmar a linha de base: `python -m pytest --collect-only -q` → 1.601; `git status --short -- backend/src/infrastructure/measurement/aba_reader.py backend/tests/test_aba_reader.py` → limpo | — |

**Verificação:** preparação. **Tamanho:** PP — cinco minutos.

---

### F1 — Os testes, escritos antes `[portão P0]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2700 | `test_aba_reader.py`: nova seção com planilha construída em memória (`openpyxl.Workbook()`, mesmo padrão de `test_reader_measurement.py`), célula `datetime(2026, 12, 9)` com `number_format="mmm/yy"` → `AbaReader().ler(...)` produz `"dez/26"` | `R-DAT-01`, `R-DAT-02` |
| T-2701 | Mesmo valor, `number_format="mmmm/yyyy"` → `"dezembro/2026"`; `number_format="mm/yyyy"` → `"12/2026"` | `R-DAT-01` |
| T-2702 | Casos de não-regressão: `number_format="dd/mm/yyyy"` → `"09/12/2026"`; `number_format="mm-dd-yy"` (o formato real de `DATA VALIDADE` na fixture `levantamento.xlsx`) → `"09/12/2026"`; `number_format=None`/`"General"` → `"09/12/2026"` | `R-DAT-03` |
| T-2703 | **[portão]** Rodar contra o `HEAD`: `T-2700`/`T-2701` reprovam por `AttributeError` (`_data_sem_dia` não existe); `T-2702` já passa hoje — é o comportamento atual, registrado como não-regressão | **P0** |

**Verificação:** P0. **Tamanho:** PP — vinte minutos.

---

### F2 — `R-DAT-01` a `R-DAT-04` `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2704 | `aba_reader.py`: constantes `_MESES_ABREVIADOS`/`_MESES_COMPLETOS` (pt-BR, doze posições) e `_TOKEN_DE_DATA` (regex dos tokens `d`/`m`/`y` do `number_format`, mais literais entre aspas) | `R-DAT-01`, `R-DAT-02` |
| T-2705 | `_data_sem_dia(valor: date, formato: str \| None) -> str \| None`: `None` quando o formato tem token de dia, é vazio ou `"General"`; senão substitui os tokens de mês/ano pelos valores de `valor`, preservando separador e literais entre aspas | `R-DAT-01`, `R-DAT-02`, `R-DAT-03` |
| T-2706 | `_celula` passa `celula.number_format` para `_texto`; `_texto` chama `self._data_sem_dia(valor, formato)` para `date`/`datetime` e só cai no `strftime` fixo quando o retorno é `None` | `R-DAT-01`, `R-DAT-03` |
| T-2707 | **[portão]** `T-2700`-`T-2702` inteiro verdes. Suíte completa: `1.601 → 1.601 + N` (só os casos novos, zero reprovação) | **P1** |

**Verificação:** P1. **Tamanho:** PP — quarenta e cinco minutos.

---

### F3 — Fechamento `[portão P2]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2708 | Suíte de backend completa (`python -m pytest`); `ruff check` e `mypy src/` em `aba_reader.py` | **P2** |
| T-2709 | Status da ESPEC 047 (Proposta → Implementada, com os números medidos); `docs/CHANGELOG.md`; linha nova de "Incremento 047" em `README.md`, no molde das linhas 55-56 | — |
| T-2710 | `git diff --stat backend/`: só `aba_reader.py` e `tests/test_aba_reader.py`. Nada em `levantamento_reader.py`, `docx_renderer.py` ou qualquer arquivo já tocado pelas ESPECs 043-046 | **P2** |

**Verificação:** P2. **Tamanho:** PP — vinte minutos, mais o tempo da suíte.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3
       P0     P1     P2
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~1h30, mais duas execuções de suíte completa |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Detectar "sem dia" olhando `d` dentro de um literal entre aspas do `number_format` (ex.: `"dia" mmm/yy`) | `_data_sem_dia` remove o conteúdo entre aspas antes de checar — sem teste dedicado a este caso no corpus (nenhuma fixture o usa), mas coberto pela leitura do código na ESPEC `D-02` |
| Célula com `number_format=None` ou `"General"` cair, por engano, no ramo novo | `T-2702`/`T-2705` — tratado explicitamente como "tem dia" |
| Tocar `_texto`/`_celula` de um jeito que quebre alguma das 19 abas hoje verdes | `T-2707`, suíte completa — nenhuma delas tem célula no padrão novo (medido na ESPEC), então nenhuma deveria mudar de saída |
| Generalizar sem querer para replicar o formato de data completa | Fora do escopo aprovado (`D-01`) — nenhuma tarefa deste plano pede isso |

---

## 6. O que este plano não faz

- **Não reproduz o `number_format` de datas completas** — continuam `dd/mm/aaaa` fixo (`D-01`).
- **Não toca `LevantamentoReader`** nem a data de cabeçalho do relatório (`docx_renderer.py:279`).
- **Não mede corpus de PDF** — não há `sha` de item a conferir nesta entrega.
- **Não commita nada por conta própria** — commit é decisão à parte do usuário.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Linha de base | PP |
| F1 | Testes escritos antes | PP |
| F2 | `_data_sem_dia` + wiring em `_celula`/`_texto` | PP |
| F3 | Fechamento | PP |

**Total: ~1h30.** A menor entrega desta série depois da 046 — nenhuma medição de corpus, nenhum arquivo em colisão com o que já está pendente na árvore.
