# PLANO 052 — Implementação de "O número que foi para a esquerda"

| | |
|---|---|
| **Especificação** | [ESPEC 052](../specs/052-o-numero-que-foi-para-a-esquerda.md) v1.1 |
| **Versão** | 1.1 — 2026-09-10 — **executado** em 2026-09-10. Todos os cinco portões fechados; uma frente extra fora do inventário original (ajuste de tipagem em `_alinhamento` para o `mypy`, `§8`) resolvida na `F4` |
| **Estado inicial** | Ramo `feature/evolucao`, `HEAD` em `fb078d1`. **1.613 testes coletados** (`python -m pytest --collect-only -q`, medido nesta árvore). `word/document.xml`: piloto `8561819f…`, PGM `7d00e15d…` |
| **Colisão conhecida** | A árvore de trabalho **não está limpa** — carrega a implementação da ESPEC 051 (`docx_renderer.py`, `annex.py`, `anexo_reader.py`, `configuracao.py`, `anexos.json`, `ooxml.py` e as suítes de anexo), já testada e com status "Implementada", mas **ainda não commitada**. Este plano não reverte nem depende dessa mudança — soma-se a ela. Onde uma tarefa toca arquivo que a 051 também tocou, o `git diff` da 051 continua presente depois desta entrega; só a parte referente a `R-ALN-*` é desta espec |
| **Numeração de tarefas** | `T-27nn`, continuando de `T-2766`, a última em uso (ESPEC 051) — começa em `T-2767` |

---

## 1. O que este plano tem de diferente

> **O risco não é de generalização — é de esquecer um dos quatro caminhos do fallback.** Ao
> contrário da ESPEC 051 (onde três lugares do código assumiam "no máximo um corte"), aqui não há
> suposição escondida para desfazer: a mudança é aditiva em três arquivos, cada um com um só ponto de
> entrada (`CelulaAnexo`, `AbaReader._celula`, `_celula_do_anexo`). O risco real é dentro de uma única
> função nova — `_alinhamento`, em `aba_reader.py` — que precisa acertar `R-ALN-01` a `R-ALN-04`
> junto, na ordem certa: `bool` é subclasse de `int` em Python, e checar `isinstance(valor, int)`
> antes de `isinstance(valor, bool)` faria todo booleano cair em `right`, não `center` (`R-ALN-02`).
> É o mesmo cuidado que `AbaReader._texto` já tem, na função vizinha — só precisa ser repetido, não
> inventado.

> **Nenhuma célula real do corpus de teste é booleana.** Medido (`§7`, busca 3): as 22 abas de
> `levantamento.xlsx` não têm uma única célula com valor `bool`. A regra `R-ALN-02` para booleano só
> pode ser travada por teste sintético — o mesmo já vale para `R-ALN-04` (alinhamento fora dos quatro
> conhecidos), que nenhuma aba real produz. Isso não é lacuna desta entrega: é o que a própria
> ESPEC 052 já registrou (`§8` da espec).

> **A reancoragem de `test_identidade_dos_artefatos.py` é condicional, e a condição já está
> resolvida.** A aba `NAS` — uma das 19 configuradas — tem célula `right` e `center` reais (`ESPEC 052
> §2.1`), e ela entra no piloto e no PGM. Portanto os dois pacotes **vão** mudar de hash em
> `word/document.xml`; a única pergunta em aberto era se algum *outro* anexo do piloto/PGM teria
> alinhamento não-`left` que esta entrega ainda não cobrisse — e não há: o mecanismo é o mesmo
> `_celula_do_anexo` para as 19 abas, não há condicional por nome de aba.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base** | Fim da `F0` | `HEAD` e árvore conferidos contra `§Estado inicial`; `1.613` coletados; hashes de `word/document.xml` conferidos | Régua de outra árvore não serve |
| **P1 — O campo, inerte** | Fim da `F1` | `CelulaAnexo.alinhamento` existe, default `"left"`. **Nenhum pacote se move** — nada lê o campo ainda. `1.613` coletados (o campo não cria teste novo sozinho) | Pacote movido aqui é sinal de que a `F2` foi antecipada |
| **P2 — O leitor, provado sem renderizar** | Fim da `F2` | Sonda `AbaReader().ler(livro["NAS"])`: `F3`/`G3` (cabeçalho) → `center`; `F4`/`G4`/`F8`/`G8` (números) → `right`; `A8`/`B8`/`C8` (texto) → `left`; `D8`/`E8` (texto centralizado na aba) → `center`. Testes novos de `R-ALN-01` a `R-ALN-04` verdes. **Nenhum pacote `.docx` se move** — `_celula_do_anexo` ainda não lê `celula.alinhamento` | Reverter a `F2`. Um valor errado aqui é mais barato de achar sem renderizar |
| **P3 — O documento, ponta a ponta** | Fim da `F3` | `.docx` renderizado da aba `NAS`: `w:jc="right"` nas células de `Usado(GB)`/`Alocado(GB)`, `w:jc="center"` no cabeçalho, nenhum `w:jc` (== `left`) nas colunas de texto puro. Teste de caracterização (`T-2775`) reprova sem a correção e passa com ela | Reverter. `w:jc` errado num anexo é o próprio defeito, corrigido pela metade |
| **P4 — O conjunto, e a reancoragem se necessária** | Fim da `F4` | Suíte completa (`python -m pytest`) verde, **≥ 1.613** mais os testes novos; `ruff check`/`mypy src/` limpos; se `test_identidade_dos_artefatos.py` reprovar, reancoragem provada por desligamento (`§1`, terceiro parágrafo); `git diff --stat` restrito ao inventário do `§7` | Não entregar |

---

## 3. Fases

### F0 — Preparação `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2767 | Confirmar `HEAD`, `git status --short` e `1.613` coletados (`python -m pytest --collect-only -q`, a partir de `backend/`); registrar os hashes atuais de `word/document.xml` (piloto `8561819f…`, PGM `7d00e15d…`) | **P0** |

**Verificação:** P0. **Tamanho:** PP — cinco minutos.

---

### F1 — `CelulaAnexo.alinhamento`, inerte `[portão]`

**Objetivo:** o campo nasce e não muda nada — mesmo movimento das ESPECs 037/051 para campo aditivo.

| # | Tarefa | Ref. |
|---|---|---|
| T-2768 | `annex.py`: `CelulaAnexo` ganha `alinhamento: str = "left"`, com o comentário de campo explicando a origem (`w:jc` do OOXML, valor lido da aba ou inferido do tipo) | `D-01` |
| T-2769 | **[portão]** Os quatro pacotes (`.docx` e `.xlsx` do piloto e do PGM) idênticos aos hashes da `T-2767`; `1.613` ainda coletados | **P1** |

**Verificação:** P1. **Tamanho:** PP — dez minutos.

---

### F2 — `AbaReader` lê e resolve o alinhamento, provado sem renderizar `[portão]`

**Objetivo:** `_alinhamento` decide os quatro casos da espec, testada isolada antes de qualquer
renderização pagar o custo de uma suíte completa.

| # | Tarefa | Ref. |
|---|---|---|
| T-2770 | `aba_reader.py`: função `_alinhamento(celula) -> str` — mapeia `"left"`/`"center"`/`"right"` explícitos direto (`R-ALN-01`); para `None` **e** para qualquer valor fora desses três (`R-ALN-04`), decide pelo **valor original** da célula (`celula.value`, antes de `_texto`): `bool` → `"center"` (checado **antes** de `int`/`float`, `§1`), `int`/`float`/`Decimal`/`date`/`datetime` → `"right"`, resto (inclusive `None`) → `"left"` (`R-ALN-02`, `R-ALN-03`) | `R-ALN-01` a `R-ALN-04`, `D-02` |
| T-2771 | `_celula` passa `alinhamento=self._alinhamento(celula)` para `CelulaAnexo` | `R-ALN-03` |
| T-2772 | `test_aba_reader.py`: casos novos — três com `horizontal` explícito (`left`/`center`/`right` preservados); `None`+`int`, `None`+`float`, `None`+`date`, `None`+`str`, `None`+vazio (`""`/`None`); `None`+`bool` (sintético — nenhuma célula real é booleana, `§1`); um valor de alinhamento fora dos quatro conhecidos (sintético, `R-ALN-04`) | `R-ALN-01` a `R-ALN-04` |
| T-2773 | **[portão]** Sonda sem `Document`: `AbaReader().ler(livro["NAS"])` — `F3`/`G3`/`A7`.. (cabeçalho) `center`; `F4`/`G4`/`F8`..`G20` (números) `right`; `A8`..`C8` (texto) `left`; `D8`/`E8` (texto centralizado) `center` — confere contra a medição da ESPEC 052 `§2.1`. `T-2772` verde. **Nenhum pacote `.docx` se move** | **P2** |

**Verificação:** P2. **Tamanho:** P — quarenta minutos.

---

### F3 — `_celula_do_anexo` escreve o alinhamento, ponta a ponta `[portão]`

**Objetivo:** o último elo — passar o valor já lido para `ooxml.escrever`, que já sabe emiti-lo.

| # | Tarefa | Ref. |
|---|---|---|
| T-2774 | `docx_renderer.py`: `_celula_do_anexo` passa `alinhamento=celula.alinhamento` na chamada a `ooxml.escrever` | `R-ALN-01`, `D-03` |
| T-2775 | `test_docx_anexos.py`: caso novo — renderiza a aba `NAS` (real, do fixture), confere no XML: células de `Usado(GB)`/`Alocado(GB)` com `w:jc/@w:val="right"`; cabeçalho de coluna com `w:jc/@w:val="center"`; célula de `Secretaria`/`Pasta` **sem** `w:jc` (equivalente a `left`, mesmo padrão que `ooxml.escrever` já usa) | `R-ALN-01`, `R-ALN-05` |
| T-2776 | **[portão]** `T-2775` confirmado por caracterização: reprova com `_celula_do_anexo` revertida localmente (sem `alinhamento=`), passa com a correção | **P3** |

**Verificação:** P3. **Tamanho:** PP — trinta minutos.

---

### F4 — Fechamento, com reancoragem condicional `[portão]`

**Objetivo:** suíte completa, e só reancorar se os pacotes de fato se moverem — o que já se sabe que
vai acontecer (`§1`), mas a prova é da execução, não da previsão.

| # | Tarefa | Ref. |
|---|---|---|
| T-2777 | Suíte de backend completa (`python -m pytest`, a partir de `backend/`); `ruff check` e `mypy src/` nos arquivos tocados | **P4** |
| T-2778 | Se `test_identidade_dos_artefatos.py` reprovar (esperado, `§1`): confirmar por script que só `word/document.xml` muda nos dois pacotes; prova por desligamento — revertendo `T-2768`/`T-2771`/`T-2774` localmente, os dois voltam aos hashes da `T-2767` byte a byte, entrada por entrada. Só então reancorar `PACOTE_DO_PILOTO`/`PACOTE_DO_PGM`, com o parágrafo de justificativa no cabeçalho do arquivo, no mesmo formato das reancoragens 036/037/049/051 | **P4**, `R-DES-01` |
| T-2779 | Suíte completa reexecutada após `T-2778`, se ela rodou | **P4** |
| T-2780 | `git diff --stat`: restrito ao inventário do `§7` — em especial nada em `ooxml.py`, `layout.py`, `medidas_grc.json`, `_bloco_de_linhas`/`_bloco_titulo`, `domain/entities/report.py`, `application/`, `frontend/`, `api/` (além do que a colisão conhecida da 051 já trazia) | **P4** |
| T-2781 | Status da ESPEC 052 (Proposta → Implementada, com os números reais); linha "Incremento 052" em `README.md`, no formato das entradas 049/051; entrada em `docs/CHANGELOG.md` se a mudança se qualificar como mudança de rumo (a confirmar contra o critério do próprio changelog) | — |

**Verificação:** P4. **Tamanho:** PP — vinte minutos, mais o tempo da suíte completa (uma ou duas execuções, conforme `T-2778`).

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4
P0     P1     P2     P3     P4

F1  o campo entra e nada muda         ← inerte até o AbaReader ler
F2  a sonda: quatro cantos da aba NAS conferidos sem renderizar
F3  o documento confirma, por caracterização
F4  reancoragem só se a suíte pedir — e já se sabe que vai pedir (§1)
```

| Alocação | Duração estimada |
|---|---|
| 1 desenvolvedor | ~2h de implementação e teste dirigido, mais uma ou duas execuções de suíte completa (~20min cada) |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| `bool` cair no ramo de `int` em `_alinhamento` (subclasse), saindo `right` em vez de `center` | `T-2772` — caso sintético `None`+`bool`, escrito antes do código (`§1`) |
| A sonda da `F2` medir contra a imagem/intuição, não contra a aba real | `T-2773` compara com a medição já registrada na ESPEC 052 `§2.1`, feita com `openpyxl` direto no fixture |
| O teste novo de `F3` (`T-2775`) não exercitar de fato a mudança | `T-2776` — caracterização contra a versão sem a correção |
| A reancoragem da `F4` mover mais do que `word/document.xml` | `T-2778` exige a comparação entrada a entrada antes de trocar qualquer hash |
| Confundir o `git diff` desta entrega com o da ESPEC 051 (colisão conhecida) | `T-2780` mede contra o inventário do `§7`, que já separa o que é `R-ALN-*` do que já estava modificado antes desta entrega |
| Célula mesclada perder o alinhamento da âncora ao fundir | Não é um risco novo desta entrega: a fusão (`ooxml.mesclar_regiao`) preserva o `w:tc` da célula-âncora e descarta as absorvidas — o mesmo mecanismo que já preserva texto, cor e negrito hoje. Não há tarefa própria porque não há código novo nesse caminho |

---

## 6. O que este plano não faz

- **Não toca `ooxml.py`** — `ooxml.escrever` já suporta os três valores, já testado (`ESPEC 052 §2.3`).
- **Não toca `_bloco_de_linhas`/`_bloco_titulo`** — já corretos, não usam `CelulaAnexo`.
- **Não versiona alinhamento vertical** — fora do que foi medido e relatado.
- **Não cria caminho de primeira classe para `justify`/`distributed`/`fill`/`centerContinuous`** —
  nenhuma das 22 abas do corpus os usa; caem no fallback por tipo (`R-ALN-04`).
- **Não reverte nem depende da ESPEC 051** — soma-se à árvore como está, sem tentar isolar um commit
  limpo antes de começar.
- **Não commita nada por conta própria** — commit é decisão à parte do usuário.

---

## 7. O inventário

Sobre `backend/`, exaustivo:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 1 | `CelulaAnexo(` | todo construtor direto, em código e teste | 1 em produção (`aba_reader.py`), o resto em 6 arquivos de teste — **todos por palavra-chave** (`ESPEC 052 §7` já confirmou). Campo novo com default não quebra nenhum |
| 2 | `celula\.alinhamento\|celula\.texto\|_celula_do_anexo` | todo ponto que hoje monta a chamada a `ooxml.escrever` para anexo | `docx_renderer.py:600-606`, único call site |
| 3 | `isinstance(cell.value, bool)` nas 22 abas de `levantamento.xlsx` | células booleanas reais | Zero — medido nesta sessão. `R-ALN-02` para booleano só tem cobertura sintética (`T-2772`) |
| 4 | `cell.alignment.horizontal` nas 22 abas | distribuição real de valores | Só `left`/`center`/`right`/`None` — nenhuma aba usa `justify`/`distributed`/`fill`/`centerContinuous` (medido, `ESPEC 052 §2.1`) |
| 5 | `PACOTE_DO_`, `word/document.xml` | as âncoras byte a byte | Hoje: piloto `8561819f…`, PGM `7d00e15d…` — já refletem a ESPEC 051 (colisão conhecida) |

**O resultado das cinco manda na `F2`/`F4`, e não o contrário.**

---

## 8. Emenda de execução

Todos os portões fecharam na ordem prevista, sem desvio de escopo. Uma frente não prevista:

**`mypy` acusou `no-any-return` em `_alinhamento`, fora do inventário original.** `celula: Any`
(o tipo genérico que todo o `aba_reader.py` usa para a célula do `openpyxl`) faz
`celula.alignment.horizontal` sair como `Any`; `horizontal in self._ALINHAMENTOS_CONHECIDOS`
não estreita esse tipo para `str` aos olhos do `mypy`, mesmo sendo verdade em tempo de execução.
Corrigido acrescentando `isinstance(horizontal, str)` à condição — o mesmo padrão que
`_hexadecimal` (`aba_reader.py`, pré-existente) já usa para estreitar um valor de tipo `Any` antes
de devolvê-lo. Sem efeito em tempo de execução (a checagem de tipo é redundante com a de conjunto,
já que `_ALINHAMENTOS_CONHECIDOS` só contém `str`), mas necessária para o `mypy` aceitar a
assinatura `-> str`. Suíte reexecutada por inteiro depois do ajuste (`T-2777` rodou duas vezes: a
primeira revelou a reancoragem esperada em `test_identidade_dos_artefatos.py`, T-2778 a resolveu, e
a segunda — depois do ajuste de tipagem — fechou limpa).

**Números finais**, medidos nesta árvore:

| Medição | Valor |
|---|---|
| Suíte completa, antes desta entrega | 1.613 passed |
| Suíte completa, com a correção e os testes novos, antes da reancoragem | 1.622 passed, **2 failed** (`test_identidade_dos_artefatos.py`, esperado — `§1`) |
| Suíte completa, depois da reancoragem e do ajuste de tipagem | **1.624 passed, 0 failed**, 1493,07s (0:24:53) |
| `ruff check` / `mypy src/`, arquivos tocados | Limpos |
| `word/document.xml` — piloto | `8561819f…` → `a5f730bf…` |
| `word/document.xml` — PGM | `7d00e15d…` → `e205b9ec…` |
| `git diff --stat` (arquivos desta entrega, dentro da colisão conhecida) | `domain/entities/annex.py`, `infrastructure/measurement/aba_reader.py`, `infrastructure/report/docx_renderer.py`, `tests/test_aba_reader.py`, `tests/test_docx_anexos.py`, `tests/test_identidade_dos_artefatos.py` — nenhum arquivo fora do inventário do `§7` |

A prova por desligamento (`T-2778`) foi feita revertendo só a linha `alinhamento=celula.alinhamento`
em `_celula_do_anexo` (não as três mudanças inteiras) — suficiente, porque sem essa última ligação
`ooxml.escrever` volta a receber o padrão `"left"` de sempre, e os campos/leitura acrescentados nas
`F1`/`F2` ficam inertes, exatamente como a `F1` já tinha provado.
