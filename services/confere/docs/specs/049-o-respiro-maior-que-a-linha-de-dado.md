# ESPEC 049 — O respiro maior que a linha de dado

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-09. Correção aplicada, teste de regressão escrito e confirmado por caracterização, `test_identidade_dos_artefatos.py` reancorado (achado durante a execução, `R-DES-01`). Backend **1.607 → 1.608 passed** (`1608 passed, 1 warning in 1310,15s`), zero falha. `ruff check` e `mypy src/` limpos |
| **Versão** | 1.1 — 2026-09-09 |
| **Depende de** | [ESPEC 004](004-anexos-de-detalhamento.md) `R-ANX-06` — mesclagens, preenchimento, negrito e cor da fonte da aba chegam ao documento; [ESPEC 014](014-bordas-nas-areas-vazias-do-anexo.md) `R-BRD-04` — a linha de respiro entre blocos permanece, com a altura do GRC; [ESPEC 026](026-o-mesmo-documento-em-um-quinto-do-tempo.md) `R-DES-03` — `ooxml.escrever` já tem, testado, o caminho de texto vazio; e `R-DES-01` — o `.docx` não muda um byte sem motivo declarado, e esta entrega é um desses motivos |
| **Revisa** | Nada de decisão anterior. Completa `R-ANX-06`/`R-BRD-04` para o caso que a implementação de `_celula_do_anexo` nunca cobriu: a normalização de parágrafo que as células com texto recebem |
| **Não toca** | `ooxml.altura_fixa`, `medidas_grc.json`, o bloco de título (`_bloco_titulo`) e a tabela de comprovação (`_bloco_de_linhas`) — os dois últimos já chamam `ooxml.escrever` sem condicional e não têm o defeito. Toca `test_identidade_dos_artefatos.py`, mas só a reancoragem mecânica exigida por `R-DES-01` (§2.5) — nenhuma regra de negócio |
| **Referência normativa** | [ESPEC 004](004-anexos-de-detalhamento.md) `R-ANX-06`; capturas de tela reais da aba `Internet`, contrato CGM, comparando planilha e `.docx` |
| **Origem** | Prints reais anexados em conversa: a planilha de levantamento do CGM mostra as faixas `INTERNET - CGM`, `INTERNET` e `Uso Internet - Medição em Julho/2026` bem próximas; no `.docx` gerado, o espaço entre elas ficou visivelmente maior que na planilha |

---

## 1. Problema

**A linha em branco que separa faixas de título, dentro da mesma tabela de anexo, sai bem maior do que a linha de dado ao lado dela — mesmo as duas tendo a mesma altura mínima declarada.**

A planilha de levantamento (tanto a de referência do GRC quanto a real do CGM) não declara altura de linha
nenhuma: todas as linhas da aba `Internet` — títulos, respiros e dados — usam a altura padrão da própria
aba, uniforme. No `.docx`, porém, o vão entre `INTERNET - CGM` e `INTERNET` mede visivelmente mais do que o
vão entre uma faixa de título e a tabela de dados abaixo dela, quebrando a proporção que a planilha mostra.

## 2. O que foi levantado no código

### 2.1 A hipótese descartada: perda da altura do Excel

A primeira hipótese testada foi que `AbaReader` descartasse `row_dimensions[...].height` do Excel. Não é
o caso: inspecionando o XML bruto (`xl/worksheets/sheetNN.xml`) dos dois arquivos reais —
`docs/documentos/SMIT SUSTENTAÇÃO_Levantamento_05969_TC 52SMIT2024_15072026_101414_V2.0.xlsx` (o arquivo
atrás do PDF de referência do GRC) e `docs/documentos/CGM/CGM_Levantamento_06034_TC 16CGM2024_03082026_105905_V1.0.xlsx`
(o arquivo real da captura de tela) — nenhuma linha das abas `Internet` e `Usuários` tem atributo `ht` ou
`customHeight`. Todas usam `defaultRowHeight` da aba, sem exceção. Não há dado de altura sendo perdido,
porque não existe variação nenhuma para perder.

### 2.2 A causa real: célula vazia não recebe a mesma normalização de parágrafo

Em `_celula_do_anexo`
([docx_renderer.py:570-592](../../backend/src/infrastructure/report/docx_renderer.py#L570-L592)):

```python
if celula.texto:
    ooxml.escrever(alvo, celula.texto, negrito=celula.negrito, cor=celula.cor or layout.PRETO, corpo=corpo)
```

`ooxml.escrever` ([ooxml.py:249-316](../../backend/src/infrastructure/report/ooxml.py#L249-L316)) é a única
função que zera o espaçamento do parágrafo (`w:spacing w:before="0" w:after="0"`) e fixa o corpo de fonte do
anexo. Ela só roda quando a célula tem texto. Uma célula vazia — a linha de respiro entre faixas de título —
recebe um `<w:p/>` cru, sem `w:pPr` nem `w:rPr`, e herda o padrão do documento, declarado em
`word/styles.xml` do modelo institucional (`modelo_prodam.docx`):

```xml
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault>
<w:rPrDefault><w:rPr>...<w:sz w:val="24"/></w:rPr></w:rPrDefault>
```

Isto é, 8pt de espaço **depois** do parágrafo e fonte padrão de 12pt (maior que os 11pt do corpo do anexo
`Internet`), com entrelinha 1,15×. Como a altura da linha é `hRule="atLeast"` — mínimo, não exato, por
desenho de `R-BRD-04` — o Word estica a linha para acomodar esse parágrafo, que é maior que o próprio
mínimo declarado (`altura_linha_pt`).

### 2.3 Confirmação por renderização real

Gerado o `.docx` a partir do arquivo real do CGM pelo pipeline de produção, aberto no Microsoft Word via
automação COM, exportado para PDF e medidas as coordenadas reais (`pdfplumber`):

| Vão medido | Valor real | Mínimo declarado (`altura_linha_pt` de `Internet`) |
|---|---|---|
| `INTERNET - CGM` → `INTERNET` | 25,4pt | 13,6pt |
| `INTERNET` → `Uso Internet - Medição em Julho/2026` | 25,5pt | 13,6pt |

Os dois vãos excedem o mínimo declarado por quase o dobro — consistente com a hipótese: o parágrafo vazio,
não normalizado, é maior que o mínimo que a tabela declara para a linha.

### 2.4 A correção testada, com a mesma medição

Removida a condicional `if celula.texto:` (chamando `ooxml.escrever` sempre, inclusive com texto vazio — o
próprio caminho já suportado e testado por `R-DES-03`), regerado o mesmo documento e remedido:

| Vão medido | Antes | Depois | Diferença |
|---|---|---|---|
| `INTERNET - CGM` → `INTERNET` | 25,4pt | **17,4pt** | −8,0pt |
| `INTERNET` → `Uso Internet - Medição em Julho/2026` | 25,5pt | **17,5pt** | −8,0pt |

A queda de exatamente 8,0pt nos dois vãos é o `w:after="160"` (8pt) que deixou de ser herdado — confirma o
mecanismo, não apenas o efeito. Visualmente, as três faixas passam a ficar tão próximas quanto na planilha
de origem.

### 2.5 Achado na execução: a correção move o hash byte a byte, e é esperado

A suíte completa revelou duas reprovações que a validação inicial (subconjunto de `test_docx_anexos.py`
e companhia) não alcançava: `test_identidade_dos_artefatos.py::test_o_docx_do_piloto_e_byte_a_byte_o_de_sempre`
e `test_o_docx_do_pgm_e_byte_a_byte_o_de_sempre` (ESPEC 026 `R-DES-01`). Essas duas travam o `.docx` do
piloto e do PGM contra um hash gravado por entrada do pacote — e a correção desta espec muda,
deliberadamente, o XML de toda célula vazia de anexo, nos dois documentos.

Não é regressão: é o próprio caso que `R-DES-01` existe para distinguir de um. Verificado, não presumido:

- comparação chave a chave (script, sem transcrição manual de hexadecimal) entre o hash antigo e o novo —
  40 entradas nos dois pacotes, zero adicionada, zero removida, **uma só** diferente: `word/document.xml`;
- prova por desligamento (o mesmo protocolo que o próprio `test_identidade_dos_artefatos.py` já documenta
  para as reancoragens das ESPECs 024/028/036/037): com `if celula.texto:` restaurado localmente, os dois
  pacotes voltam byte a byte ao hash antigo — confirma que é esta mudança, e só ela, que move o pacote.

`PACOTE_DO_PILOTO`/`PACOTE_DO_PGM` foram reancorados, com parágrafo novo no docstring do arquivo.

## 3. Objetivo

Que uma célula de anexo **sem texto** receba a mesma normalização de parágrafo que uma célula **com
texto** já recebe hoje — espaçamento zerado e corpo de fonte do próprio anexo — para que a altura mínima
declarada da linha (`altura_linha_pt`, medida no GRC) deixe de ser artificialmente ultrapassada pelo padrão
de parágrafo do documento.

**Não é objetivo:** tornar a altura de linha exata (`hRule="exact"`) ou derivada da altura real do Excel —
os dois já foram avaliados e descartados (§2.1, e a `R-BRD-04` já decidiu por "mínimo, não exato" para não
cortar texto que o Word quebra em duas linhas e o Excel não).

## 4. Escopo

### 4.1 Dentro do escopo

- `_celula_do_anexo` passa a chamar `ooxml.escrever` para **toda** célula do anexo, com ou sem texto;
- o efeito vale para as 19 abas de anexo, igualmente — a causa (parágrafo vazio não normalizado) não é
  específica da aba `Internet` nem do arquivo do CGM.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Alterar `ooxml.altura_fixa` ou `medidas_grc.json` | O mínimo continua vindo da medição do GRC; o defeito era o que ultrapassava esse mínimo, não o mínimo em si |
| Ler `row_dimensions` do Excel | Hipótese verificada e descartada (§2.1) — não há dado de altura na planilha real para aproveitar |
| Bloco de título (`_bloco_titulo`) e tabela de comprovação (`_bloco_de_linhas`) | Já chamam `ooxml.escrever` sem condicional hoje; não têm o defeito |

## 5. Regras

| ID | Regra |
|---|---|
| `R-CEL-01` | Toda célula de anexo — com ou sem texto — recebe a normalização de parágrafo de `ooxml.escrever`: `w:spacing before="0" after="0"` e o corpo de fonte do próprio anexo |
| `R-CEL-02` | A altura da linha continua um **mínimo** (`hRule="atLeast"`, `R-BRD-04`), não um valor exato. Esta espec remove o excesso que vinha do parágrafo não normalizado; não fixa a altura |
| `R-CEL-03` | **Invariante de não-regressão:** nenhuma célula que hoje tem texto muda de saída — a normalização que ela já recebia continua idêntica |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Reusar `ooxml.escrever` com texto vazio, em vez de criar função nova** | A função já suporta esse caminho — `R-DES-03` testa exatamente "texto vazio não emite `<w:t>`". Criar uma segunda função de normalização duplicaria a lógica de espaçamento/corpo que só existe corretamente num lugar |
| `D-02` | **Não tocar `altura_linha_pt` nem `ooxml.altura_fixa`** | O mínimo medido no GRC é o alvo correto (`R-BRD-04`); o defeito é o que o Word soma além dele, não o valor do mínimo |
| `D-03` | **Aceitar o custo extra de desempenho medido, sem otimização prematura** | Medido diretamente: +11% no bloco mais denso testado (`Usuários`, 1.021 linhas, 90 delas vazias — 1,1% do total). O teste de linearidade (`test_o_custo_de_um_anexo_e_linear`) mede uma **razão** entre dois tamanhos, não um tempo absoluto, e uma constante por célula não a altera |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/report/docx_renderer.py` | `_celula_do_anexo`: remove `if celula.texto:` — `ooxml.escrever` passa a ser chamada sempre, com `celula.texto` (que pode ser `""`) |
| `tests/test_docx_anexos.py` | Caso novo: `test_a_celula_vazia_recebe_a_mesma_normalizacao_de_paragrafo`, trava `R-CEL-01` no XML da célula vazia |
| `tests/test_identidade_dos_artefatos.py` | Reancoragem mecânica (§2.5): `PACOTE_DO_PILOTO["word/document.xml"]` e `PACOTE_DO_PGM["word/document.xml"]`, mais o parágrafo de registro no docstring — exigida por `R-DES-01` da ESPEC 026, não por decisão desta espec |
| `ooxml.py`, `layout.py`, `medidas_grc.json`, `domain/`, `application/` | **Nenhuma.** |

## 8. Testes e critério de aceite

| Verificação | Resultado obtido |
|---|---|
| Vão `INTERNET - CGM` → `INTERNET`, medido no Word real via COM + PDF | 25,4pt → 17,4pt |
| Vão `INTERNET` → `Uso Internet...`, mesma medição | 25,5pt → 17,5pt |
| `test_a_altura_de_linha_e_a_do_grc` (`test_docx_anexos.py:496`) | Passou — lê o `w:trHeight` **declarado**, que não muda |
| `test_a_altura_e_minimo_e_nao_valor_exato` (`test_docx_anexos.py:507`) | Passou — `hRule="atLeast"` não muda |
| `test_a_celula_vazia_recebe_a_mesma_normalizacao_de_paragrafo` (novo) | Passou com a correção; reprova (`AttributeError` em `w:pPr` ausente) com a condicional antiga restaurada — caracterização confirmada |
| `test_o_custo_de_um_anexo_e_linear` (`test_desempenho.py:404`) | Passou — razão entre 400 e 800 linhas não afetada por uma constante por célula |
| `test_o_docx_do_piloto_e_byte_a_byte_o_de_sempre` / `..._do_pgm_...` (`test_identidade_dos_artefatos.py`) | Reprovaram antes da reancoragem (§2.5, esperado); passam depois — só `word/document.xml` mudou nos dois pacotes, confirmado por script e por prova de desligamento |
| Suíte completa do backend (`python -m pytest`), com a correção, o teste novo e a reancoragem | **1.608 passed, 0 failed**, 1310,15s (0:21:50) |

**Critério de aceite:** os vãos medidos caem em torno do valor teórico esperado (redução de ~8pt, o
`w:after` removido), o teste de caracterização confirma que exercita a mudança certa, e a suíte completa
do backend roda com `python -m pytest` sem nenhuma falha não explicada por `§2.5`.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Custo de desempenho em anexos muito densos | Medido diretamente (§6, `D-03`): +11% no pior caso testado, célula vazia é minoria nos anexos com muitos dados. Sem indício de quebra do teto de `test_o_custo_de_um_anexo_e_linear` |
| Documentos gerados ficam mais curtos (menos páginas) do que os já entregues/arquivados | Efeito esperado e correto — as linhas de respiro deixam de ocupar espaço além do que a planilha mostra |
| O `.docx` do piloto e do PGM muda de hash byte a byte, travando `test_identidade_dos_artefatos.py` (`R-DES-01`) | **Aconteceu, e não era esperado antes da execução** (o risco original desta linha previa o contrário — que nenhum teste-âncora fixasse contagem de página, e não que o hash do pacote inteiro mudasse). Resolvido por reancoragem, seguindo o protocolo já documentado no próprio arquivo (§2.5, `T-2737` do TASKS): confirmado por script que só `word/document.xml` mudou, e provado por desligamento |
| Alguma célula vazia que hoje conta com o `<w:p/>` cru para algum efeito colateral não identificado | Não encontrada nenhuma asserção de teste sobre a ausência de `w:pPr`/`w:rPr` em célula vazia — apenas sobre `w:tcBorders` (`R-BRD-04` a `R-BRD-07`), que esta mudança não toca. Confirmado pela suíte completa (1.608 passed) |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Vale medir o efeito visual nas outras 18 abas (não só `Internet`), com screenshot real, antes de aplicar? | Não — o mecanismo é o mesmo `_celula_do_anexo` para todas; a medição em `Internet` já isola a causa e a correção não é condicional por aba |

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Remover a condicional em `_celula_do_anexo` | PP |
| B | Rodar a suíte completa e confirmar zero regressão | PP |

**Estimativa: menos de uma hora — a mudança já foi validada; falta apenas gravá-la no repositório.**

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-09 | Redação inicial, a partir de prints reais da aba `Internet` (contrato CGM) e da investigação completa registrada em conversa |
| 1.1 | 2026-09-09 | Implementada: correção gravada, teste de regressão (`R-CEL-01`) escrito e confirmado por caracterização, `test_identidade_dos_artefatos.py` reancorado (`R-DES-01`, achado durante a execução, §2.5). Backend 1.607 → 1.608 passed, `ruff`/`mypy` limpos |
