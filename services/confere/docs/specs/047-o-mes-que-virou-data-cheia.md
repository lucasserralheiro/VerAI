# ESPEC 047 — O mês que virou data cheia

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-09. Backend **1.601 → 1.607 passed** (`1.601 → 1.601 + 6` — os seis casos novos de `test_aba_reader.py`), zero falha real. Uma reprovação de `test_desempenho.py::test_o_custo_de_um_anexo_e_linear` apareceu na suíte completa — confirmada ruído de carga: reproduz mesmo isolada e mesmo com `aba_reader.py`/`test_aba_reader.py` retirados do diff (`git stash`), área não tocada por esta entrega. `ruff check` e `mypy src/` limpos |
| **Versão** | 1.0 — 2026-09-09 |
| **Depende de** | [ESPEC 004](004-anexos-de-detalhamento.md) `R-ANX-07` — "valores numéricos e datas usam a formatação da planilha". Esta espec completa essa regra para o caso que a implementação de `AbaReader` nunca cobriu |
| **Revisa** | Nada de decisão anterior. `R-ANX-07` já existia; o que muda é a implementação passar a cumpri-la também quando a célula não tem dia |
| **Não toca** | `LevantamentoReader` (aba `Levantamento` — lê o cabeçalho por regex de texto, caminho totalmente separado de `AbaReader`), a data de cabeçalho do relatório (`docx_renderer.py:279`, mesmo padrão fixo, fora do escopo), e a formatação de **data completa** — `dd/mm/aaaa` continua fixo quando a célula tem dia, mesmo que a planilha exiba outro separador (`D-01`) |
| **Referência normativa** | [ESPEC 004](004-anexos-de-detalhamento.md) `R-ANX-07`; captura de tela real da aba `CertificadosDigitais`, contrato CGM |
| **Origem** | Print real anexado em conversa: a aba `CertificadosDigitais` tem, à direita de `DATA VALIDADE`, uma coluna sem cabeçalho formatada `mmm/aa` no Excel (`dez/26`, `jan/26`, `nov/26`...). No `.docx` gerado, a mesma célula sai `01/12/2026` — um dia 1º que a planilha nunca mostrou |

---

## 1. Problema

**Uma célula de data sem dia — só mês e ano — sai no `.docx` com um dia inventado.**

`AbaReader` é o leitor genérico das 19 abas de anexo (`aba_reader.py`, T-301): lê forma, não
significado, e por isso um anexo novo não exige código novo. `R-ANX-07` já manda que "valores
numéricos e datas usam a formatação da planilha" — mas `_texto`
([aba_reader.py:93-123](../../backend/src/infrastructure/measurement/aba_reader.py#L93-L123)) só
enxerga o **valor** da célula (`celula.value`), nunca o formato
(`celula.number_format`). Toda `datetime`/`date` sai fixa em `%d/%m/%Y` — ou `%d/%m/%Y %H:%M` quando
a hora não é meia-noite.

Isso funciona quando a planilha também mostra data completa. Mas o Excel guarda internamente a mesma
`datetime` para "09/12/2026" e para "dez/26" — a diferença está inteira no `number_format` da célula,
não no valor. Sem consultá-lo, o código não tem como distinguir os dois casos, e sempre escolhe o
primeiro: um dia 1º (ou o dia real, se houver) que a planilha correspondente **nunca exibiu**.

## 2. O que foi levantado no código

### 2.1 Onde a formatação se perde

`_celula` ([aba_reader.py:84-91](../../backend/src/infrastructure/measurement/aba_reader.py#L84-L91))
passa só `celula.value` para `_texto`. `celula.number_format` — a string do Excel (`"mmm/yy"`,
`"dd/mm/yyyy"`, `"mm-dd-yy"`...) — nunca é lida em lugar nenhum de `aba_reader.py`.

### 2.2 O caso completo já é coberto, o caso sem dia não

Testado neste levantamento, contra a fixture real (`tests/fixtures/levantamento.xlsx`, aba
`CertificadosDigitais`, coluna `DATA VALIDADE`): o `number_format` da célula é `"mm-dd-yy"`, e mesmo
assim o `.docx` sai `dd/mm/aaaa` — formato diferente do da planilha, mas **ainda uma data completa**,
o que já é o comportamento histórico e não é o defeito reportado.

O defeito é específico: quando o `number_format` **não tem token de dia** (`mmm/yy`, `mm/yyyy`,
`mmmm/yyyy`...), a planilha nunca decidiu qual dia mostrar, e o `.docx` decide por ela — sempre errado,
porque não existe dia "certo" a reproduzir.

### 2.3 O caminho da `Levantamento` não é afetado

`LevantamentoReader` ([levantamento_reader.py:40-56](../../backend/src/infrastructure/measurement/levantamento_reader.py#L40-L56))
lê a mesma aba por outro leitor, com sua própria `_texto`, e não passa pelo `AbaReader`. A data de
cabeçalho do relatório (`docx_renderer.py:279`) vem desse caminho, também com formato fixo — mas não é
alimentada por nenhuma célula de anexo, e o print de origem não a envolve. Fora do escopo (`Não toca`).

## 3. Objetivo

Que uma célula de data **sem dia** no Excel (só mês e/ou ano) saia no `.docx` sem dia também — no
mesmo padrão que a planilha exibe — em vez de uma data completa com dia inventado.

**Não é objetivo:** reproduzir o `number_format` exato de **toda** célula de data, incluindo as que já
têm dia — `dd/mm/aaaa` fixo continua sendo o padrão do relatório nesse caso (`D-01`).

## 4. Escopo

### 4.1 Dentro do escopo

- `AbaReader` passa a consultar `celula.number_format` para células `date`/`datetime`;
- quando o formato **não tem token de dia** (`d`, `dd`, `ddd`, `dddd`), o texto sai no padrão da
  planilha — mês por extenso, abreviado ou numérico, e ano com 2 ou 4 dígitos, conforme os tokens
  (`mmmm`/`mmm`/`mm`/`m`, `yyyy`/`yy`) e o mesmo separador que o formato usa;
- meses abreviados e por extenso saem em português (`dez`, `dezembro`), porque é o único idioma que os
  outros 18 anexos já usam;
- quando o formato **tem** token de dia (ou está ausente/`"General"`), o comportamento não muda:
  `dd/mm/aaaa`, ou `dd/mm/aaaa HH:MM` com hora não-zero.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Reproduzir o `number_format` de datas completas (`dd/mm/aaaa` → o que a planilha realmente usa) | `D-01` — 18 abas dependem do padrão fixo hoje; mudar esse caso exigiria auditar as 19 abas uma a uma para não regredir nenhuma, e o print de origem não pede isso |
| `LevantamentoReader` / data de cabeçalho do relatório | Caminho de código separado, não tocado pelo print de origem (§2.3) |
| Tokens de formato em outros idiomas (`aaaa`, `dddd` como ano/dia em português) | O OOXML grava o `number_format` sempre em tokens ingleses (`d`/`m`/`y`), mesmo quando o Excel exibe o editor de formato em português — a localização é só de exibição na UI do Excel, não do arquivo |

## 5. Regras

| ID | Regra |
|---|---|
| `R-DAT-01` | Célula `date`/`datetime` cujo `number_format` não contém token de dia sai formatada só com mês e ano, seguindo os tokens do próprio formato (`mmmm`/`mmm`/`mm`/`m`, `yyyy`/`yy`) e o separador literal entre eles |
| `R-DAT-02` | Mês por extenso ou abreviado sai em português — mesmo idioma do resto do anexo |
| `R-DAT-03` | Célula cujo `number_format` contém token de dia, está vazio ou é `"General"` mantém o comportamento atual: `dd/mm/aaaa`, ou `dd/mm/aaaa HH:MM` quando a hora não é meia-noite |
| `R-DAT-04` | **Invariante de não-regressão:** nenhuma célula de data hoje formatada como `dd/mm/aaaa` (ou com hora) muda de saída — a regra nova só se aplica ao caso sem token de dia |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Datas completas continuam em `dd/mm/aaaa` fixo, não no formato exato da planilha** | Cumprir `R-ANX-07` à risca em todo caso exigiria auditar as 19 abas para garantir que nenhuma regride — as datas completas já funcionam hoje, e o print de origem só evidencia o caso sem dia. Estreitar o escopo ao caso comprovadamente quebrado evita risco sem necessidade |
| `D-02` | **Detecção de "sem dia" por presença do caractere `d` no formato (fora de literais entre aspas e colchetes `[...]`)** | O OOXML só usa `d`/`m`/`y` para tokens de data — não há ambiguidade com outro uso de `d` num formato de data, e evita escrever um parser completo de `number_format` para um caso que só precisa distinguir "tem dia" de "não tem" |
| `D-03` | **Nomes de mês em português ficam hard-coded em `aba_reader.py`, não vêm de `locale`** | O projeto não depende de `locale` do sistema em nenhum outro ponto (é frágil entre ambientes Windows/Linux); os nomes de mês são 12 constantes que não mudam |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/measurement/aba_reader.py` | `_celula` passa `celula.number_format` para `_texto`; `_texto` delega a data para um novo método que decide, pelo formato, entre o padrão fixo (`R-DAT-03`) e o padrão sem dia (`R-DAT-01`, `R-DAT-02`) |
| `tests/test_aba_reader.py` | Casos novos com planilha construída em memória (mesmo padrão de `test_reader_measurement.py`): célula `mmm/yy` sem dia, célula `dd/mm/yyyy` com dia (não regride), célula `mm-dd-yy` (não regride, é o formato real de `DATA VALIDADE` na fixture) |
| `application/`, `api/`, `domain/`, `.docx` (estrutura) | **Nenhuma.** A mudança é só na normalização de texto que `AbaReader` já produz |

## 8. Testes e critério de aceite

| Regra | Verificação |
|---|---|
| `R-DAT-01` | Célula com `datetime(2026, 12, 9)` e `number_format="mmm/yy"` sai `"dez/26"` |
| `R-DAT-02` | Mesma célula com `number_format="mmmm/yyyy"` sai `"dezembro/2026"` |
| `R-DAT-03` | Célula com `number_format="dd/mm/yyyy"` ou `"mm-dd-yy"` continua saindo `"09/12/2026"` |
| `R-DAT-04` | Suíte completa do backend sem regressão — nenhuma asserção existente sobre texto de data muda |

**Critério de aceite:** os quatro casos acima passam, e a suíte completa do backend roda com
`python -m pytest` sem nenhuma falha nova.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Formato do Excel com literal entre aspas contendo a letra `d` (ex.: `"dia" mmm/yy`) ser lido como "tem dia" | A detecção remove o conteúdo entre aspas antes de procurar `d` (`D-02`) |
| Célula sem `number_format` nenhum (`None`) cair no ramo novo por engano | `R-DAT-03` trata `None`/vazio/`"General"` explicitamente como "tem dia" — mantém o padrão fixo |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Vale, no futuro, estender `R-ANX-07` também às datas completas (fora do escopo desta espec, `D-01`)? | Não — decisão para quando/se outra aba pedir |

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `_data_sem_dia` em `aba_reader.py` e o ajuste de `_celula`/`_texto` | PP |
| B | Testes novos em `test_aba_reader.py` | PP |
| C | Suíte completa | PP |

**Estimativa: menos de meio dia.**

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-09 | Redação inicial, a partir do print real da aba `CertificadosDigitais` (contrato CGM) |
