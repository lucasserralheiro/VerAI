# PLANO 053 — Implementação de "A marca do parágrafo que herdou 12pt"

| | |
|---|---|
| **Especificação** | [ESPEC 053](../specs/053-a-marca-do-paragrafo-que-herdou-12pt.md) v1.1 |
| **Versão** | 1.1 — 2026-09-10 — **executado** em 2026-09-10. Todos os cinco portões fechados, sem desvio de escopo |
| **Estado inicial** | Ramo `feature/evolucao`. **1.624 testes coletados** (`python -m pytest --collect-only -q`, medido nesta árvore). `word/document.xml`: piloto `a5f730bf…`, PGM `e205b9ec…` |
| **Colisão conhecida** | A árvore carregava as ESPECs 051 e 052, já implementadas e testadas, ainda não commitadas no início deste plano — commitadas por conta própria (`293eb67`, "Atualização do readme") durante a execução, junto com a ESPEC/PLANO 053 (ainda sem o código). Este plano soma-se a elas, sem revertê-las |
| **Numeração de tarefas** | `T-27nn`, continuando de `T-2781`, a última em uso (ESPEC 052) — começa em `T-2782` |

---

## 1. O que este plano tem de diferente

> **A causa já foi isolada e medida antes deste plano existir — a implementação é a parte fácil.**
> A ESPEC 053 §2 já mediu o defeito no documento real (Word + PDF + `pdfplumber`) e isolou a causa
> em dois documentos sintéticos, comparando "com marca" contra "sem marca" célula a célula. O que
> falta é gravar a correção e confirmar que a medição se repete depois dela — não descobrir o que
> está errado.

> **O oráculo da ESPEC 026 (`test_escrever_reproduz_a_api_publica`, `R-DES-06`) não cobre o elemento
> novo, e precisa de um segundo dip em oxml — não um enfraquecimento.** A API pública do
> `python-docx` não expõe `w:pPr/w:rPr` (confirmado: `CT_PPr` nem declara o atributo no nível do
> oxml). A função de referência (`_escrever_de_referencia`, `test_desempenho.py`) já dipa em oxml bruto
> para o `w:rFonts`/`w:cs` da execução — o mesmo padrão, aplicado à marca, mantém o teste como
> oráculo de verdade em vez de acomodar a lacuna comparando menos coisa.

> **A marca copia o `w:sz` que a própria API já calculou para a execução, em vez de recalcular o
> truncamento.** `ooxml._meio_ponto` trunca (`int(int(pontos*12700)/12700*2)`), e é a fonte de
> verdade testada pela ESPEC 026 `T-2005`. Recalculá-la de novo em `_escrever_de_referencia` seria
> uma segunda implementação do mesmo truncamento — lendo o `w:sz` que a execução (montada pela API
> pública, `font.size = Pt(...)`) já gravou, a marca herda o valor certo sem duplicar a fórmula.

> **O alcance sobre a tabela de comprovação (`D-02` da espec) é medido nesta execução, não
> presumido.** Não se sabe, antes de rodar, se o piloto ou o PGM têm célula vazia nas páginas 2-3
> (`Quantidade Contratada` não declarada, ou data do levantamento ausente) — a `F0` mede isso antes
> de qualquer correção, para que a `F4` saiba se a reancoragem é só das páginas de anexo ou também
> das primeiras.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base, e o alcance sobre a comprovação medido** | Fim da `F0` | `1.624` coletados; hashes de `word/document.xml` conferidos; contagem de células vazias na tabela de comprovação do piloto e do PGM (páginas 2-3), medida e registrada — não estimada | Régua de outra árvore não serve |
| **P1 — `R-CEL-04`, provado sem o documento inteiro** | Fim da `F1` | Teste isolado de `ooxml.escrever` (sem `Document` completo, como os de `test_desempenho.py`): célula vazia produz `w:pPr/w:rPr/w:sz` igual ao corpo passado. `test_escrever_reproduz_a_api_publica` (toda a matriz de `texto`×`alinhamento`×`negrito`×`corpo`) verde outra vez, com `_escrever_de_referencia` estendida | Reverter. Um caractere de sobra no XML do oráculo é mais barato de achar aqui que depois de renderizar |
| **P2 — `R-CEL-05`, no separador** | Fim da `F2` | Teste sobre um anexo real de mais de um segmento (`Comunicação Dados` ou `Servidores`): o parágrafo separador tem `w:pPr/w:rPr/w:sz` igual ao seu próprio corpo (1pt) | Reverter |
| **P3 — O vão medido, ponta a ponta** | Fim da `F3` | `.docx` regerado da aba `Comunicação Dados`, medido no Word real (mesma metodologia da ESPEC 053 §2.1): os três vãos caem para a ordem de uma linha populada (~4 a 6pt), não mais ~17 a 31pt | Reverter. Vão que não caiu é a correção pela metade |
| **P4 — O conjunto, com a reancoragem que a `F0` já sabia prever** | Fim da `F4` | Suíte completa verde, **≥ 1.624** mais os testes novos; `ruff`/`mypy` limpos; reancoragem de `test_identidade_dos_artefatos.py` provada por desligamento — no escopo que a `F0` mediu (só anexos, ou anexos + comprovação); `git diff --stat` restrito ao inventário do `§7` | Não entregar |

---

## 3. Fases

### F0 — Linha de base, e o alcance sobre a comprovação `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2782 | Confirmar `1.624` coletados e os hashes atuais de `word/document.xml` (piloto `a5f730bf…`, PGM `e205b9ec…`) | **P0** |
| T-2783 | Medir, sem tocar código: quantas células da tabela de comprovação (páginas 2-3) do piloto e do PGM têm texto vazio hoje — `Quantidade Contratada` não declarada (ESPEC 028) e data do levantamento ausente. Registrar o número, não estimar (`D-02` da espec) | **P0** |

**Verificação:** P0. **Tamanho:** PP — quinze minutos.

---

### F1 — `R-CEL-04`: a marca em `ooxml.escrever`, e o oráculo estendido `[portão]`

**Objetivo:** o elemento novo, no único lugar que escreve célula de anexo e de comprovação — e o
teste que garante byte a byte que ele reproduz o que a API pública faria, se ela cobrisse o caso.

| # | Tarefa | Ref. |
|---|---|---|
| T-2784 | `ooxml.escrever`: depois do bloco de `w:spacing`/`w:jc` dentro de `w:pPr`, acrescenta `w:rPr` (a marca) com `w:rFonts` (mesmas três fontes da execução) e `w:sz` (mesmo `corpo`, via `_meio_ponto`) | `R-CEL-04`, `D-01` |
| T-2785 | `test_desempenho.py::_escrever_de_referencia`: depois de montar `w:rFonts`/`w:cs` da execução (o dip já existente), monta a marca à mão (`OxmlElement("w:rPr")`), copiando o `w:sz` já gravado na execução — sem recalcular o truncamento | `R-DES-06` |
| T-2786 | **[portão]** `test_escrever_reproduz_a_api_publica` e `test_escrever_reproduz_a_api_publica_nas_cores` verdes, matriz inteira; teste novo `test_a_celula_vazia_recebe_a_marca_do_paragrafo` (isolado, sem `Document`) confirma `w:pPr/w:rPr/w:sz` na célula vazia | **P1** |

**Verificação:** P1. **Tamanho:** P — quarenta minutos.

---

### F2 — `R-CEL-05`: o separador entre segmentos `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2787 | `_faixa_de_tabelas` (`docx_renderer.py`): o parágrafo separador ganha a marca — `w:sz` no mesmo corpo (`Pt(1)`) que já usa, lido de uma variável só para os dois (evitar o "1" duplicado) | `R-CEL-05` |
| T-2788 | Teste novo em `test_docx_anexos.py`: sobre `Comunicação Dados` (dois segmentos, corte na linha de cabeçalho), o parágrafo entre as duas tabelas tem `w:pPr/w:rPr/w:sz` correspondente a 1pt | `R-CEL-05` |
| T-2789 | **[portão]** `T-2788` verde | **P2** |

**Verificação:** P2. **Tamanho:** PP — vinte e cinco minutos.

---

### F3 — O vão medido, ponta a ponta `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2790 | Regerar o `.docx` da aba `Comunicação Dados` (piloto), converter a PDF via Word real (automação COM) e medir os mesmos três vãos da ESPEC 053 §2.1 com `pdfplumber` | **P3** |
| T-2791 | **[portão]** Os três vãos medidos caem para a ordem de uma linha populada — comparados contra os valores "antes" já registrados na espec (1,77 / 17,47-por-linha / 30,94pt) | **P3** |

**Verificação:** P3. **Tamanho:** PP — vinte minutos (uma renderização e uma conversão).

---

### F4 — Fechamento, com a reancoragem que a `F0` já mediu `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2792 | Suíte de backend completa (`python -m pytest`); `ruff check`/`mypy src/` nos arquivos tocados | **P4** |
| T-2793 | Se `test_identidade_dos_artefatos.py` reprovar: confirmar por script quais entradas mudam nos dois pacotes — `word/document.xml` esperado; conferir se o alcance bate com o que `T-2783` previu (só anexo, ou anexo + comprovação). Prova por desligamento: revertendo `T-2784`/`T-2787` localmente, os dois pacotes voltam aos hashes da `T-2782` byte a byte. Só então reancorar, com o parágrafo de justificativa no cabeçalho do arquivo | **P4**, `R-DES-01` |
| T-2794 | Suíte completa reexecutada após `T-2793`, se ela rodou | **P4** |
| T-2795 | `git diff --stat`: restrito a `ooxml.py`, `docx_renderer.py`, `tests/test_desempenho.py`, `tests/test_docx_anexos.py`, `tests/test_identidade_dos_artefatos.py` — nada em `anexos.json`, `medidas_grc.json`, `layout.py` (além da colisão conhecida das ESPECs 051/052) | **P4** |
| T-2796 | Status da ESPEC 053 (Proposta → Implementada, com os números reais); linha "Incremento 053" em `README.md`; entrada em `docs/CHANGELOG.md` | — |

**Verificação:** P4. **Tamanho:** PP — vinte minutos, mais o tempo da suíte (uma ou duas execuções).

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4
P0     P1     P2     P3     P4

F0  mede o alcance sobre a comprovação ANTES de mexer em código
F1  a marca em ooxml.escrever, com o oráculo (R-DES-06) estendido junto
F2  o separador — caminho de código diferente, mesma causa
F3  o vão real, medido no Word — não só o XML
F4  reancoragem no escopo que a F0 previu, provada por desligamento
```

| Alocação | Duração estimada |
|---|---|
| 1 desenvolvedor | ~1h40 de implementação e teste dirigido, mais uma renderização/medição real (`F3`) e uma ou duas execuções de suíte completa (~20-25min cada) |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| O oráculo (`R-DES-06`) divergir porque a marca foi montada em ordem diferente da que o schema pede (`w:spacing`/`w:jc`/`w:rPr`, nessa ordem dentro de `w:pPr`) | `T-2786` — a matriz inteira de `test_escrever_reproduz_a_api_publica` compara XML byte a byte, e qualquer ordem errada reprova imediatamente |
| A marca do separador (`F2`) usar um corpo diferente do que a execução realmente tem, por causa do "1" duplicado em dois lugares | `T-2787` lê de uma variável só, não repete o literal |
| O vão medido na `F3` não cair o suficiente — sinal de uma segunda causa não identificada | `T-2791` compara contra os valores exatos já registrados na espec, não contra "melhorou" |
| A reancoragem alcançar a tabela de comprovação e isso não ser percebido — mistura de causas no `word/document.xml` | `T-2783` mede o alcance **antes** de qualquer código mudar, e `T-2793` confere se bate com o previsto |
| Custo de desempenho — um elemento XML a mais por célula, em anexos com milhares de linhas (`Usuários`, `Office365`) | Mesma classe de mudança que a ESPEC 049 (`R-CEL-01`) já pagou e mediu (+11% no pior caso). Não é objeto de tarefa própria aqui porque o padrão de custo já está estabelecido; `T-2792` roda `test_o_custo_de_um_anexo_e_linear`, que mede razão, não tempo absoluto |

---

## 6. O que este plano não faz

- **Não altera `altura_linha_pt`, `medidas_grc.json` ou `corpo` de nenhum anexo** — o mínimo e os
  corpos continuam os medidos no GRC (`R-ANX-04`, `R-BRD-04`).
- **Não refatora o separador para reusar `ooxml.escrever`** — `D-03` da espec: é o único chamador
  fora de célula, e generalizar a função para um caso só não compensa.
- **Não mede as outras 18 abas por captura de tela** — `D-04` da espec: o mecanismo é o mesmo em
  todas, e a causa já foi isolada num documento sintético, sem depender de nenhuma aba real.
- **Não commita nada por conta própria** — commit é decisão à parte do usuário.

---

## 7. Inventário

| # | Arquivo | O que muda |
|---|---|---|
| 1 | `infrastructure/report/ooxml.py` | `escrever` — a marca do parágrafo, `R-CEL-04` |
| 2 | `infrastructure/report/docx_renderer.py` | `_faixa_de_tabelas` — a marca no separador, `R-CEL-05` |
| 3 | `tests/test_desempenho.py` | `_escrever_de_referencia` estendida; nenhum teste novo (a matriz existente já cobre) |
| 4 | `tests/test_docx_anexos.py` | Dois casos novos (célula vazia de anexo, separador) |
| 5 | `tests/test_identidade_dos_artefatos.py` | Reancoragem condicional (`T-2793`) |
| — | `anexos.json`, `medidas_grc.json`, `layout.py`, `ooxml.py` fora de `escrever` | **Nenhuma** |

---

## 8. Emenda de execução

Todos os cinco portões fecharam na ordem prevista, sem desvio de escopo. Uma interrupção externa,
sem consequência para o resultado:

**O usuário commitou a árvore por conta própria, no meio da execução (`293eb67`, "Atualização do
readme"), capturando o trabalho já pronto — ESPECs/PLANOs 051-053 e o código das 051/052 — mas
**antes** do código desta espec (`ooxml.escrever`/`_faixa_de_tabelas`) existir.** A `F1`/`F2` já
estavam escritas quando o commit aconteceu; `git diff --stat HEAD` depois dele mostrou exatamente
os cinco arquivos do inventário (`§7`), com o tamanho esperado de cada mudança — nada foi perdido
nem duplicado. O `git log` e o `git diff --stat` confirmaram antes de seguir para o fechamento
(`T-2795`).

**Números finais**, medidos nesta árvore:

| Medição | Valor |
|---|---|
| Vão `dado → título` (4 linhas vazias), Word real | 17,47pt/linha → **5,45pt/linha** |
| Vão `título → cabeçalho` (corte + separador), Word real | 30,94pt → **3,39pt** |
| `T-2783` — células vazias na tabela de comprovação (piloto/PGM) | 0 / 0 — alcance restrito às páginas de anexo, como previsto |
| Suíte completa, antes da reancoragem | 1.624 passed, **2 failed** (esperado — `§1.1`) |
| Suíte completa, depois da reancoragem | **1.626 passed, 0 failed**, 1254,48s (0:20:54) |
| `ruff check` / `mypy src/`, arquivos tocados | Limpos |
| `word/document.xml` — piloto | `a5f730bf…` → `5a0c4fd5…` |
| `word/document.xml` — PGM | `e205b9ec…` → `6dd36e33…` |
| `git diff --stat` (arquivos desta entrega) | `ooxml.py`, `docx_renderer.py`, `test_desempenho.py`, `test_docx_anexos.py`, `test_identidade_dos_artefatos.py` — nenhum arquivo fora do inventário do `§7` |

A prova por desligamento (`T-2793`) reverteu as duas marcas — o bloco inteiro em `ooxml.escrever` e
a adição em `_faixa_de_tabelas` — e confirmou, rodando só os quatro testes de
`test_identidade_dos_artefatos.py`, que os dois pacotes voltam aos hashes anteriores (`a5f730bf…`/
`e205b9ec…`) antes de qualquer hash ser trocado.
