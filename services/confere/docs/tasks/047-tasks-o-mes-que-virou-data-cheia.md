# TASKS 047 — Backlog de "O mês que virou data cheia"

| | |
|---|---|
| **Especificação** | [ESPEC 047](../specs/047-o-mes-que-virou-data-cheia.md) v1.0 |
| **Plano** | [PLANO 047](../plans/047-plano-o-mes-que-virou-data-cheia.md) v1.0 |
| **Versão** | 1.0 — 2026-09-09 |
| **Total** | 12 tarefas · 3 portões · 1 insumo herdado da ESPEC |
| **Status** | **Concluído** — 2026-09-09. Portões `P0` a `P2` fechados na primeira passagem. Backend **1.601 → 1.607 passed** (seis testes novos, zero regressão) — uma reprovação de `test_desempenho.py::test_o_custo_de_um_anexo_e_linear` na suíte completa foi ruído de carga, confirmada isolada e mesmo sem os arquivos desta entrega (`git stash`). `ruff`/`mypy` limpos. Nenhuma fase revertida |

> **Dois arquivos.** `aba_reader.py` (produção) e `test_aba_reader.py` (teste). Nenhum outro —
> nem `levantamento_reader.py`, que lê a mesma aba `Levantamento` por um caminho totalmente separado,
> nem `docx_renderer.py`, cuja data de cabeçalho não vem de célula de anexo.

---

## 1. Convenções

**Identificadores** `T-27nn`, continuando de `T-2698`, a última em uso (ESPEC 046).

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **não** `uv run pytest`, que quebra a coleta do backend nesta árvore.
Medido antes de começar: árvore com as ESPECs 043-046 já implementadas, ainda não commitadas;
`aba_reader.py`/`test_aba_reader.py` limpos; **1.601 testes coletados**.

**Convenção de commit** `<tipo>(T-27nn): descrição`. `test(...)` para `E1`; `fix(...)` para `E2`
(a normalização de data já deveria seguir `R-ANX-07`, então é correção de um caso não coberto, não
feature nova); `docs(...)` para `E3`.

### 1.1 A regra que atravessa este backlog

**A detecção de "sem dia" olha só o `number_format` da célula, nunca o valor.** Uma
`datetime(2026, 12, 9)` com `number_format="mmm/yy"` e a mesma `datetime` com `number_format="dd/mm/
yyyy"` têm de sair diferente — a primeira sem dia, a segunda com. Confundir as duas (por exemplo,
decidir pelo valor ter ou não hora zerada, em vez de pelo formato) reintroduziria o próprio defeito
que esta entrega corrige.

*O sinal no diff:* qualquer ramo novo que decida o formato de saída olhando `valor` em vez de
`formato`/`number_format`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Preparação | T-2699 | — | F0 |
| **E1** Os testes, escritos antes | T-2700 … T-2703 | **P0** | F1 |
| **E2** `R-DAT-01` a `R-DAT-04` | T-2704 … T-2707 | **P1** | F2 |
| **E3** Fechamento | T-2708 … T-2710 | **P2** | F3 |

### 2.1 A régua da entrega — o que muda

| Muda | Não muda |
|---|---|
| Célula de data cujo `number_format` não tem token de dia sai só com mês/ano, no idioma e separador da planilha | Célula de data com dia no formato — continua `dd/mm/aaaa` fixo, mesmo com outro separador na planilha |
| `_celula`/`_texto` em `aba_reader.py` passam a consultar `celula.number_format` | `LevantamentoReader`, `docx_renderer.py` — caminhos separados, não tocados |
| `test_aba_reader.py` ganha os casos novos de `R-DAT-01`-`R-DAT-04` | As 19 abas hoje configuradas em `anexos.json` — nenhuma tem célula no padrão novo (medido na ESPEC) |
| Status da ESPEC 047, `docs/CHANGELOG.md`, `README.md` | Todo o resto de `backend/` — nenhuma outra linha |

---

## 3. Épico E0 — Preparação

#### T-2699 — Linha de base
**Tamanho:** PP

`python -m pytest --collect-only -q` → 1.601 testes coletados. `git status --short -- backend/src/
infrastructure/measurement/aba_reader.py backend/tests/test_aba_reader.py` → nenhuma saída (árvore
limpa nos dois arquivos).

**Pronto quando:** os dois números/estados conferem com o que a ESPEC/o PLANO presumem.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2700 — Mês abreviado
**Tamanho:** PP · **Ref:** `R-DAT-01`, `R-DAT-02`

Planilha construída em memória (`openpyxl.Workbook()`, mesmo padrão de
`test_criar_planilha_sem_levantamento` em `test_reader_measurement.py`): uma célula com
`datetime(2026, 12, 9)` e `number_format="mmm/yy"`. `AbaReader().ler(aba).linhas[0][0].texto` deve
ser `"dez/26"`.

**Pronto quando:** escrito, ainda reprovando contra o código de hoje.

---

#### T-2701 — Mês por extenso e mês numérico
**Tamanho:** PP · **Ref:** `R-DAT-01`

Mesma célula, dois casos adicionais no mesmo módulo: `number_format="mmmm/yyyy"` → `"dezembro/
2026"`; `number_format="mm/yyyy"` → `"12/2026"`.

**Pronto quando:** escrito, ainda reprovando contra o código de hoje.

---

#### T-2702 — Não-regressão: datas com dia
**Tamanho:** PP · **Ref:** `R-DAT-03`

Três casos, mesma célula-base (`datetime(2026, 12, 9)`): `number_format="dd/mm/yyyy"` →
`"09/12/2026"`; `number_format="mm-dd-yy"` (o formato real de `DATA VALIDADE` na fixture
`levantamento.xlsx`, aba `CertificadosDigitais` — conferido por leitura direta da fixture) →
`"09/12/2026"`; `number_format=None` e `number_format="General"` → `"09/12/2026"`.

**Pronto quando:** escrito. Diferente de `T-2700`/`T-2701`, estes três **já passam** hoje — é o
comportamento atual, documentado como não-regressão antes da mudança, não depois.

---

#### T-2703 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

Rodar `pytest tests/test_aba_reader.py` contra o `HEAD`: `T-2700`/`T-2701` reprovam por
`AttributeError` (`_data_sem_dia` não existe); `T-2702` passa. Confirma que os testes novos exercitam
código que ainda não existe, e que a linha de base de não-regressão já está verde antes de qualquer
alteração.

**Pronto quando:** as reprovações são pelo motivo esperado, não por erro de construção da planilha em
memória.

---

## 5. Épico E2 — `R-DAT-01` a `R-DAT-04` `[portão P1]`

#### T-2704 — Constantes e tokenizador
**Tamanho:** PP · **Ref:** `R-DAT-01`, `R-DAT-02`

Em `aba_reader.py`: `_MESES_ABREVIADOS`/`_MESES_COMPLETOS` (doze posições, pt-BR, minúsculas — mesmo
idioma que o resto do anexo já usa) e `_TOKEN_DE_DATA`, uma regex que reconhece, em ordem do mais
longo para o mais curto, literais entre aspas e os tokens `yyyy`/`yy`/`mmmm`/`mmm`/`mm`/`m`/`dddd`/
`ddd`/`dd`/`d`.

**Pronto quando:** compila; sem uso ainda.

---

#### T-2705 — `_data_sem_dia`
**Tamanho:** P · **Ref:** `R-DAT-01`, `R-DAT-02`, `R-DAT-03`

`_data_sem_dia(valor: date, formato: str | None) -> str | None`. Remove colchetes (`[$-416]` e
afins) e isola a primeira seção antes de `;`; se, depois de remover literais entre aspas, sobrar a
letra `d` (`R-DAT-03`) ou não sobrar nem `m` nem `y` (formato não é de data — cobre `None`/
`"General"`), devolve `None`. Senão, substitui cada token pelo valor de `mês`/`ano` de `valor`
(`_MESES_ABREVIADOS`/`_MESES_COMPLETOS` para `mmm`/`mmmm`; dois ou quatro dígitos para `yy`/`yyyy`;
número puro, com ou sem zero à esquerda, para `mm`/`m`) e devolve a string resultante.

**Pronto quando:** `T-2700`-`T-2701` passam quando chamada diretamente (teste unitário da função, se
mais simples que passar por `_celula`); `T-2702` continua passando.

---

#### T-2706 — Ligação em `_celula`/`_texto`
**Tamanho:** PP · **Ref:** `R-DAT-01`, `R-DAT-03`

`_celula` passa a chamar `self._texto(celula.value, celula.number_format)`. `_texto` ganha o
parâmetro `formato: str | None = None`; para `datetime`/`date`, tenta `self._data_sem_dia(valor,
formato)` primeiro e só cai no `strftime` fixo (`%d/%m/%Y`, ou com hora) quando o retorno é `None`.

**Pronto quando:** `T-2700`-`T-2702` passam pelo caminho completo (`AbaReader().ler(...)`, não só a
função isolada).

---

#### T-2707 — O portão `[portão]`
**Tamanho:** PP · **Portão P1**

`T-2700`-`T-2702` inteiro verdes. Suíte completa do backend: `1.601 → 1.601 + N` (só os casos novos
desta entrega contam; zero reprovação, zero teste pré-existente mudando de resultado).

**Pronto quando:** os quatro testes relevantes no estado esperado, suíte completa reconciliada.

---

## 6. Épico E3 — Fechamento `[portão P2]`

#### T-2708 — Suíte e ferramentas
**Tamanho:** PP · **Portão P2**

`python -m pytest` completo; `ruff check` e `mypy src/` em `aba_reader.py`.

**Pronto quando:** os três limpos.

---

#### T-2709 — Documentos
**Tamanho:** PP

Status da ESPEC 047 (Proposta → Implementada, com os números medidos em `T-2707`/`T-2708`). Entrada
em `docs/CHANGELOG.md`. Linha nova de "Incremento 047" em `README.md`, no molde das linhas 55-56 (uma
frase objetiva: o que passou a acontecer, com qual regra, e que as 19 abas hoje configuradas não
mudam de saída).

**Pronto quando:** os três documentos refletem o estado final.

---

#### T-2710 — Nenhuma âncora fora do previsto
**Tamanho:** PP · **Portão P2**

`git diff --stat backend/`: só `aba_reader.py` e `tests/test_aba_reader.py`. Nada em
`levantamento_reader.py`, `docx_renderer.py`, ou em qualquer arquivo já tocado pelas ESPECs 043-046
(`contract.py`, `grid.py`, `pdfplumber_extractor.py`, `container.py`, `contract_validations.py`,
`measurement_validations.py`, `conftest.py`, `test_consolidacao_aditivos.py`).

**Pronto quando:** o `diff` bate com essa lista.

---

## 7. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-DAT-01` (formata sem dia pelos tokens do `number_format`) | T-2700, T-2701, T-2703, T-2704, T-2705, T-2706, T-2707 |
| `R-DAT-02` (mês em português) | T-2700, T-2701, T-2704, T-2705 |
| `R-DAT-03` (formato com dia, vazio ou `General` mantém o padrão fixo) | T-2702, T-2705, T-2706 |
| `R-DAT-04` (não-regressão) | T-2699, T-2702, T-2707, T-2710 |
| `D-01` (data completa não replica o formato exato) | T-2702 — é o próprio critério de não-regressão |
| `D-02` (detecção por `d` fora de aspas/colchetes) | T-2705 |

---

## 8. O que este backlog não faz

- **Não reproduz o `number_format` de datas completas** — decisão `D-01` da ESPEC, não esquecimento.
- **Não toca `LevantamentoReader`** nem a data de cabeçalho do relatório.
- **Não mede corpus de PDF** — não há `sha` de item a conferir nesta entrega.
- **Não commita nada por conta própria** — commit é decisão à parte do usuário.

---

## 9. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3
       P0     P1     P2

E0  linha de base                          (sem commit)
E1  testes escritos antes, reprovando      test(T-2700 … T-2703)
E2  R-DAT-01 a R-DAT-04                    fix(T-2704 … T-2707)
E3  fechamento                             docs(T-2709)
```

---

## 10. Insumos em aberto (herdados da ESPEC)

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Vale, no futuro, estender `R-ANX-07` também às datas completas (fora do escopo desta espec, `D-01`)? | Não — decisão para quando/se outra aba pedir |
