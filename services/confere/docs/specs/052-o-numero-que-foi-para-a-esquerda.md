# ESPEC 052 — O número que foi para a esquerda

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-10. `CelulaAnexo.alinhamento` lido da aba e escrito no anexo; testes novos de `R-ALN-01` a `R-ALN-04` (`test_aba_reader.py`) e ponta a ponta na aba `NAS` (`test_docx_anexos.py`), confirmados por caracterização. Backend **1.613 → 1.624 passed, 0 failed** (1493,07s), `ruff check` e `mypy src/` limpos. Moveu deliberadamente o `.docx` do piloto e do PGM — `word/document.xml` foi de novo a única entrada a se mover, nos dois —, e `test_identidade_dos_artefatos.py` foi reancorado nos dois, com o delta provado por desligamento |
| **Versão** | 1.1 — 2026-09-10 |
| **Depende de** | [ESPEC 004](004-anexos-de-detalhamento.md) `R-ANX-06` — o que é preservado da aba sem declarar nada por anexo; `R-ANX-07` — valores numéricos usam a formatação da planilha; [ESPEC 026](026-o-mesmo-documento-em-um-quinto-do-tempo.md) `R-DES-01` — o `.docx` do piloto e do PGM não mudam um byte sem motivo declarado, e `R-DES-06` — `ooxml.escrever` é testado contra a API pública do `python-docx`, inclusive com `alinhamento` |
| **Revisa** | `R-ANX-06`: a lista do que vem da aba passa a incluir o alinhamento horizontal da célula, do mesmo jeito que cor da fonte e bordas entraram depois da redação original — a formatação existe na aba e a implementação de `_celula_do_anexo` nunca a leu |
| **Não toca** | `ooxml.escrever` (`ooxml.py`) — já aceita `alinhamento` e já é testado com `left`/`center`/`right` (`test_desempenho.py:298`); a tabela de comprovação (`_bloco_de_linhas`, `_bloco_titulo`) — já declara `alinhamento="right"`/`"center"` manualmente célula a célula e não usa `CelulaAnexo`; `medidas_grc.json`, larguras e alturas de anexo |
| **Referência normativa** | Duas capturas de tela reais anexadas em conversa (aba `NAS`, contrato SMIT Sustentação): o `.docx` gerado e a planilha de levantamento, mesma tabela `ARMAZENAMENTO NAS (FATURÁVEL)`; medição direta da aba `NAS` do fixture `backend/tests/fixtures/levantamento.xlsx` com `openpyxl` (§2.1) |
| **Origem** | Prints reais anexados em conversa: no `.docx`, os valores das colunas `Usado(GB)`/`Alocado(GB)` saem colados à esquerda da coluna; na planilha, os mesmos valores saem à direita — e os cabeçalhos das colunas, centralizados na planilha, saem à esquerda no `.docx` |

---

## 1. Problema

**Toda célula dos 19 anexos de detalhamento sai alinhada à esquerda no `.docx`, não importa o que a aba diz.** A planilha declara alinhamento por célula — cabeçalhos centralizados, texto à esquerda, números e datas à direita —, e nenhum desses três alinhamentos chega ao documento: os números da coluna `Usado(GB)`/`Alocado(GB)` da aba `NAS`, por exemplo, saem colados à esquerda da célula, quando na planilha de origem saem colados à direita.

## 2. O que foi levantado no código

### 2.1 O alinhamento é dado real da aba, não inferência

Medida célula a célula a aba `NAS` de `backend/tests/fixtures/levantamento.xlsx` (`openpyxl`, `cell.alignment.horizontal`), sem transcrever a imagem:

```
F3 'USADO (GB)'   horizontal=center  bold=True   (cabeçalho)
F4 2636.87        horizontal=right   bold=True   (número)
A7 'Secretaria'   horizontal=center  bold=True   (cabeçalho)
A8 'SMIT'         horizontal=left    bold=False  (texto)
D8 'nas.prodam'   horizontal=center  bold=False  (texto, centralizado)
F8 219.92         horizontal=right   bold=False  (número)
G8 220             horizontal=right  bold=False  (número)
```

Contada a distribuição nas 22 abas do mesmo arquivo (`Levantamento`, `Detalhes`, `Servidores`, `NAS`, `Office365`, `Usuários`, ...), só quatro valores aparecem: `left`, `center`, `right` e `None`. Nenhuma aba usa `justify`, `distributed`, `fill` ou `centerContinuous`. `None` é comum — 3.694 células com valor e `horizontal=None` entre as 22 abas — e corresponde ao alinhamento "Geral" do Excel: sem estilo explícito, o próprio Excel alinha texto à esquerda e número à direita automaticamente. Conferido em amostra (`Detalhes`, célula `A2`/`F2`): texto sai `None`+`str`, número sai `None`+`int`, na mesma linha.

### 2.2 Onde a informação se perde

Três pontos na cadeia, nenhum lê ou carrega alinhamento:

1. `AbaReader._celula` ([aba_reader.py:103-110](../../backend/src/infrastructure/measurement/aba_reader.py#L103-L110)) lê `texto`, `negrito`, `preenchimento`, `cor`, `borda` — não lê `celula.alignment.horizontal`.
2. `CelulaAnexo` ([annex.py:24-40](../../backend/src/domain/entities/annex.py#L24-L40)) não tem campo de alinhamento — não há onde guardar o dado, mesmo se o leitor o lesse.
3. `_celula_do_anexo` ([docx_renderer.py:600-606](../../backend/src/infrastructure/report/docx_renderer.py#L600-L606)) chama `ooxml.escrever(...)` sem o parâmetro `alinhamento`, cujo padrão é `"left"` ([ooxml.py:255](../../backend/src/infrastructure/report/ooxml.py#L255)). Toda célula de todo anexo sai à esquerda, sempre.

A tabela de comprovação (`_bloco_de_linhas`/`_bloco_titulo`) não tem esse defeito: ela não usa `CelulaAnexo` e já passa `alinhamento="right"`/`"center"` manualmente, célula a célula, conforme o layout do próprio relatório (`layout.py`), não da planilha.

### 2.3 `ooxml.escrever` já suporta os três valores

`escrever` já recebe `alinhamento: str = "left"` e emite `w:jc` quando o valor não é `"left"` ([ooxml.py:249-292](../../backend/src/infrastructure/report/ooxml.py#L249-L292)). É exercitado com os três valores pelo teste-oráculo `test_escrever_reproduz_a_api_publica` (`test_desempenho.py:298`, `@pytest.mark.parametrize("alinhamento", ["left", "center", "right"])`), que compara o XML produzido por `SubElement` com o que a API pública do `python-docx` produziria. Não há mudança necessária em `ooxml.py`: falta só passar o valor certo para ele.

## 3. Objetivo

Que o alinhamento horizontal de cada célula dos 19 anexos reproduza o que a aba de origem declara — explícito (`left`/`center`/`right`) quando a aba o declara, e o comportamento "Geral" do Excel (texto à esquerda, número e data à direita) quando não declara — em vez do `"left"` fixo de hoje.

**Não é objetivo:** alinhamento vertical de célula (não medido, não é o defeito relatado); alinhamento da tabela de comprovação ou do bloco de título (já corretos, `§2.2`); suportar `justify`/`distributed`/`fill`/`centerContinuous` como valor de primeira classe — nenhuma das 22 abas medidas os usa (`§2.1`).

## 4. Escopo

### 4.1 Dentro do escopo

- `CelulaAnexo` ganha um campo de alinhamento;
- `AbaReader` passa a ler `cell.alignment.horizontal` e a resolvê-lo para as 19 abas de anexo, com o mesmo leitor genérico de sempre — nenhuma aba exige tratamento próprio;
- `_celula_do_anexo` passa o alinhamento lido para `ooxml.escrever`.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Alterar `ooxml.escrever` ou `ooxml.py` | Já suporta os três valores, já testado (`§2.3`) |
| Alterar `_bloco_de_linhas`/`_bloco_titulo` | Não usam `CelulaAnexo`; já corretos hoje |
| Suportar `justify`/`distributed`/`fill`/`centerContinuous` | Não aparecem em nenhuma das 22 abas medidas (`§2.1`); ver `R-ALN-04` para o que acontece se aparecerem |
| Alinhamento vertical | Fora do que foi relatado e medido |

## 5. Regras

| ID | Regra |
|---|---|
| `R-ALN-01` | Quando a célula da aba declara alinhamento horizontal explícito (`left`, `center` ou `right`), o mesmo valor é usado no `.docx` |
| `R-ALN-02` | Quando a célula não declara alinhamento (`None` — "Geral" do Excel), o `.docx` reproduz o comportamento automático do Excel: `right` para número e data, `center` para booleano, `left` para texto e para célula sem valor |
| `R-ALN-03` | O alinhamento é decidido sobre o **valor original da célula** (antes da conversão para texto de `_texto`), porque é aí que o tipo (número vs. texto vs. booleano) ainda existe — depois da conversão, `"220"` e `"CACISP"` são ambos `str` |
| `R-ALN-04` | Um valor de alinhamento do Excel fora de `left`/`center`/`right`/`None` cai no mesmo caminho de `R-ALN-02` (decide pelo tipo do valor), em vez de propagar um `w:jc` não verificado — mesmo critério que `_hexadecimal` já usa para cor de tema não resolvida: aproximar em silêncio é pior que usar o padrão conhecido |
| `R-ALN-05` | **Invariante de não-regressão:** nenhuma célula cujo alinhamento resolvido hoje já é `left` muda de saída — nem a tabela de comprovação, nem o bloco de título, nenhum dos dois tocados por esta espec |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Campo novo em `CelulaAnexo`, não parâmetro solto em `_celula_do_anexo`** | O alinhamento é dado da célula, do mesmo jeito que `cor` e `preenchimento` já são — `CelulaAnexo` é a fronteira que carrega forma da aba até o renderizador (`R-ANX-06`); inventar um caminho paralelo só para alinhamento duplicaria essa fronteira |
| `D-02` | **Fallback por tipo do valor, não por número da coluna ou nome da aba** | A planilha já mistura `None` (Geral) com `left`/`center`/`right` explícitos na mesma aba e às vezes na mesma coluna (`§2.1`); decidir por posição exigiria uma regra por anexo — o oposto do que `R-ANX-06`/`R-ANX-07` já resolvem sem configuração |
| `D-03` | **Não alterar `ooxml.escrever`** | Já correto e testado para os três valores (`§2.3`); a mudança é só passar o valor certo, não criar um caminho novo |
| `D-04` | **Valor padrão do campo novo é `"left"`** | Preserva byte a byte qualquer célula cujo alinhamento resolvido já seja `left` hoje — é o que dá a `R-ALN-05` |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `domain/entities/annex.py` | `CelulaAnexo` ganha `alinhamento: str = "left"` |
| `infrastructure/measurement/aba_reader.py` | `_celula` resolve o alinhamento antes de converter o valor para texto (`R-ALN-03`) e o passa para `CelulaAnexo`; função nova para o mapeamento de `R-ALN-01`/`R-ALN-02`/`R-ALN-04` |
| `infrastructure/report/docx_renderer.py` | `_celula_do_anexo` passa `alinhamento=celula.alinhamento` para `ooxml.escrever` |
| `tests/test_aba_reader.py` | Casos novos: alinhamento explícito (`left`/`center`/`right`) preservado; `None` com número vira `right`; `None` com texto vira `left`; `None` com booleano vira `center` |
| `tests/test_docx_anexos.py` | Caso novo: célula de anexo com `alinhamento="right"`/`"center"` emite `w:jc` correspondente no XML |
| `tests/test_identidade_dos_artefatos.py` | Provável reancoragem de `PACOTE_DO_PILOTO`/`PACOTE_DO_PGM` (`§9`) — só se o piloto e o PGM reais tiverem, de fato, célula de anexo com alinhamento diferente de `left`; a confirmar na execução |
| `ooxml.py`, `layout.py`, `medidas_grc.json`, `application/` | **Nenhuma.** |

## 8. Testes e critério de aceite

| Verificação | Como |
|---|---|
| `R-ALN-01` | Teste de `AbaReader` com célula de alinhamento explícito nos três valores |
| `R-ALN-02`/`R-ALN-03` | Teste de `AbaReader` com célula `None` + `int`/`float`/`date`/`bool`/`str`/vazia |
| `R-ALN-04` | Teste de `AbaReader` com um valor de alinhamento fora dos quatro conhecidos (construído à mão, já que nenhuma aba real o produz) |
| `R-ALN-05` | Suíte completa (`python -m pytest`, a partir de `backend/`) sem nenhuma reprovação não explicada por reancoragem de identidade (`§9`) |
| Ponta a ponta | Regerar o `.docx` a partir de `levantamento.xlsx` (aba `NAS`) e conferir visualmente que `Usado(GB)`/`Alocado(GB)` saem à direita, como na planilha |

**Critério de aceite:** os testes novos de `R-ALN-01` a `R-ALN-04` passam; a suíte completa do backend roda sem falha não explicada por `§9`; a inspeção visual do `.docx` regerado da aba `NAS` mostra os números alinhados à direita e os cabeçalhos centralizados, como na planilha.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| O `.docx` do piloto e do PGM mudam de hash byte a byte, travando `test_identidade_dos_artefatos.py` (`R-DES-01`) | Esperado se algum anexo real tiver célula com alinhamento diferente de `left` (§2.1 mostra que é o caso pelo menos em `NAS`, `Levantamento`, `SOA`, `ServicosVcloud`...). Mesmo protocolo já usado pela ESPEC 049 (`§2.5` daquela espec): comparar entrada a entrada do pacote antigo com o novo, confirmar que só `word/document.xml` muda, reancorar |
| Uma coluna que hoje "parece certa" por acaso (texto curto, coluna estreita, diferença visual pequena entre `left` e `center`) passa despercebida na inspeção visual | O teste de `AbaReader` (`R-ALN-01`/`R-ALN-02`) trava o valor resolvido por tipo de célula, não depende de inspeção visual para pegar regressão futura |
| Alinhamento herdado de estilo de coluna/linha (`col.alignment`, não `cell.alignment`) não é capturado | Não verificado nesta espec — `§2.1` mediu `cell.alignment.horizontal`, que é o que o `openpyxl` resolve por célula (inclui herança de estilo nomeado); nenhuma célula das 22 abas mostrou incoerência entre o que a captura de tela mostra e o que `cell.alignment.horizontal` devolve |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | O piloto e o PGM reais (não só o fixture de teste) têm célula de anexo com alinhamento não-`left`, a ponto de exigir reancoragem de `R-DES-01`? | Não — só muda o tamanho do trabalho de reancoragem (`§9`), não a correção em si; confirma-se rodando a suíte |

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `CelulaAnexo.alinhamento` + leitura em `AbaReader` (`R-ALN-01` a `R-ALN-04`) + testes de `test_aba_reader.py` | P |
| B | `_celula_do_anexo` passa o valor adiante + teste em `test_docx_anexos.py` | PP |
| C | Suíte completa, reancoragem de `test_identidade_dos_artefatos.py` se necessário (`§9`) | PP |

**Estimativa: menos de meio dia.**

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-10 | Redação inicial, a partir de duas capturas de tela reais (aba `NAS`, contrato SMIT Sustentação) e da medição direta da aba com `openpyxl` |
| 1.1 | 2026-09-10 | Implementada: `CelulaAnexo.alinhamento`, leitura em `AbaReader._alinhamento` (`R-ALN-01` a `R-ALN-04`, com `bool` checado antes de `int` — `§1` do PLANO 052) e escrita em `_celula_do_anexo`. Sonda sem renderizar confirmou os quatro cantos da aba `NAS` antes do documento; teste ponta a ponta confirmado por caracterização (reprova sem a correção). Backend 1.613 → 1.624 passed, 0 failed; `word/document.xml` reancorado nos dois pacotes (piloto `8561819f…` → `a5f730bf…`, PGM `7d00e15d…` → `e205b9ec…`), delta provado por desligamento |
