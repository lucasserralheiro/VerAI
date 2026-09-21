# ESPEC 053 — A marca do parágrafo que herdou 12pt

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-10. `R-CEL-04`/`R-CEL-05` gravadas e testadas; oráculo `R-DES-06` estendido para cobrir a marca. Vãos da aba `Comunicação Dados` medidos no Word real: 17,47pt/linha → 5,45pt/linha; 30,94pt → 3,39pt. Backend **1.624 → 1.626 passed, 0 failed** (1254,48s), `ruff check` e `mypy src/` limpos. Moveu deliberadamente o `.docx` do piloto e do PGM — `word/document.xml` foi de novo a única entrada a se mover, nos dois —, e `test_identidade_dos_artefatos.py` foi reancorado, com o delta provado por desligamento. Medido antes da correção (`T-2783`): zero célula vazia na tabela de comprovação nos dois pacotes, então o alcance ficou restrito às páginas de anexo |
| **Versão** | 1.1 — 2026-09-10 |
| **Depende de** | [ESPEC 004](004-anexos-de-detalhamento.md) `R-ANX-04` — o corpo de fonte é medido no GRC e declarado por anexo (3,5 a 11pt); [ESPEC 049](049-o-respiro-maior-que-a-linha-de-dado.md) `R-CEL-01` a `R-CEL-03` — a normalização de parágrafo que esta espec **completa**; [ESPEC 051](051-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) `R-SEG-03`/`R-SEG-04` — o corte que separa segmentos de tabela, onde a mesma causa aparece por um caminho de código diferente; [ESPEC 026](026-o-mesmo-documento-em-um-quinto-do-tempo.md) `R-DES-01` — identidade byte a byte do `.docx`, e `R-DES-06` — `ooxml.escrever` testado contra a API pública |
| **Revisa** | `R-CEL-01`: "a normalização de parágrafo" passa a incluir também a **marca do parágrafo** (`w:pPr/w:rPr`), não só a execução (`w:r/w:rPr`) e o espaçamento antes/depois. A 049 corrigiu dois terços do problema sem saber que o terço que faltava existia — só ficou visível num anexo de corpo bem menor que o que ela testou |
| **Não toca** | `ooxml.py` fora de `escrever`; `layout.py`; `medidas_grc.json`; `anexos.json` (os corpos por anexo continuam os medidos no GRC, não mudam); a geometria de larguras/alturas de anexo (ESPEC 014) |
| **Referência normativa** | Medição direta no Word real (automação COM, exportado a PDF, medido com `pdfplumber` — mesma metodologia da ESPEC 049), sobre o `.docx` gerado do piloto e sobre três documentos de teste isolados, construídos para separar a variável |
| **Origem** | Duas capturas de tela reais anexadas em conversa (aba `Comunicação Dados`, contrato SMIT Sustentação): o espaçamento entre linhas no `.docx` gerado sai visivelmente maior do que na planilha de origem, nas mesmas linhas |

---

## 1. Problema

**Uma célula de anexo sem texto — linha em branco entre blocos, ou o parágrafo separador entre duas tabelas do mesmo anexo — renderiza com altura de linha herdada do documento (12pt), não do corpo do próprio anexo, mesmo depois da normalização de espaçamento da ESPEC 049.** O efeito é proporcional à distância entre o corpo do anexo e 12pt: imperceptível em `Internet` (corpo 11pt, a aba que a 049 mediu), visível e desproporcional em `Comunicação Dados` (corpo 3,5pt, o menor dos 19).

## 2. O que foi levantado no código

### 2.1 O vão medido no documento real

Aba `Comunicação Dados`, `.docx` gerado a partir de `levantamento.xlsx`, renderizado e medido no Word real (automação COM → PDF → `pdfplumber`):

| Trecho | Vão medido |
|---|---|
| `Cliente/Órgão/Tipo` (cabeçalho) → `SMIT/PRODAM/MPLS...` (dado) — sem linha em branco entre as duas | 1,77pt |
| `SMIT/PRODAM/MPLS...` → `LINKS - OPERACIONAL` (4 linhas em branco entre as duas) | 69,89pt → **17,47pt por linha em branco** |
| `LINKS - OPERACIONAL` → `COD. MPLS` (fronteira do corte — ESPEC 004/051 — com o parágrafo separador de 1pt no meio) | **30,94pt** |

Uma linha **com** texto mede ~3,4 a 3,5pt de altura — consistente com o corpo configurado, 3,5pt (`anexos.json`). Uma linha vazia deveria medir perto disso; mede ~17,5pt, **cerca de cinco vezes mais**.

### 2.2 A causa isolada, fora do pipeline inteiro

Construí três documentos de teste mínimos — uma tabela só, mesma `w:trHeight` mínima e mesmo corpo (3,5pt) que o código de produção usa — para separar a variável da célula vazia de tudo o mais que o anexo real tem (mesclagens, bordas, larguras).

**Teste 1 — linha vazia, com e sem a marca do parágrafo (`w:pPr/w:rPr`):**

| Cenário | Vão medido |
|---|---|
| Linha vazia, **sem** `w:pPr/w:rPr` — o que `ooxml.escrever` produz hoje | 16,10pt |
| Linha vazia, **com** `w:pPr/w:rPr/w:sz` igual ao corpo do anexo | **6,00pt** |

**Teste 2 — linhas com texto, com e sem a mesma marca (prova de não regressão):**

| Par medido | Vão |
|---|---|
| Duas populadas, sem marca | 4,7pt |
| Populada sem marca → populada com marca | 4,8pt |
| Duas populadas, com marca | 4,6pt |

As três medições do Teste 2 são estatisticamente idênticas (a variação é ruído de extração de PDF) — **a marca do parágrafo não muda a altura de uma linha com texto**, só a de uma linha sem.

### 2.3 O mecanismo

`ooxml.escrever` ([ooxml.py:249-316](../../backend/src/infrastructure/report/ooxml.py#L249-L316)) monta `w:rPr` — as propriedades da **execução** (`w:r/w:rPr`) — com o corpo do anexo, sempre, inclusive quando o texto é vazio (é o que a ESPEC 049 corrigiu: antes, só rodava com texto). Mas nunca monta `w:pPr/w:rPr` — as propriedades da **marca do parágrafo**, o `rPr` que fica dentro de `pPr`, não dentro de `r`. Quando a execução tem texto de verdade, o Word calcula a altura da linha pela métrica do glifo, e a marca não entra na conta — é o que o Teste 2 confirma. Quando a execução não tem `w:t`, não há glifo para medir, e o Word usa a formatação da **marca do parágrafo**, que — sem override — herda do `w:rPrDefault` do modelo institucional: `w:sz="24"`, 12pt (o mesmo valor que a ESPEC 049 já tinha identificado como o padrão herdado, ao investigar o `w:pPrDefault`).

### 2.4 Por que a ESPEC 049 não pegou isso

Ela mediu e corrigiu a aba `Internet`, corpo **11pt** — a 1pt de distância dos 12pt herdados pela marca. A diferença é pequena demais para notar visualmente, e o sintoma dominante naquele caso era outro: o espaçamento **depois** do parágrafo (`w:after="160"`, 8pt), que a 049 zerou (`R-CEL-01`). A marca nunca foi tocada porque, em `Internet`, ela não doía. Em `Comunicação Dados` (3,5pt) ela dói: 12pt contra 3,5pt é mais de 3x, e o mesmo se aplica, em grau variável, aos outros anexos de corpo pequeno — `Office365` (4,0), `SDWAN` (4,1), `Servidores`/`ServidoresSemDesenv` (4,3/4,4), `DetalhesSemDesenv`/`Detalhes` (4,6/4,8).

### 2.5 Um segundo caminho de código, mesma causa

O vão de 30,94pt na fronteira do corte (`§2.1`) não é só a linha vazia comum: ali existe um **parágrafo separador**, fora de qualquer célula, que `_faixa_de_tabelas` insere entre dois segmentos de tabela para o Word não fundi-los de volta em um só ([docx_renderer.py:508-515](../../backend/src/infrastructure/report/docx_renderer.py#L508-L515)):

```python
separador = documento.add_paragraph()
separador.paragraph_format.space_before = Pt(0)
separador.paragraph_format.space_after = Pt(0)
separador.add_run("").font.size = Pt(1)
```

Mesma forma do defeito: `add_run("")` cria uma execução sem `w:t`, `font.size = Pt(1)` só define o `w:rPr` da execução — a marca do parágrafo não é tocada, e herda os mesmos 12pt. Este caminho não passa por `ooxml.escrever` (é `python-docx` puro, fora de célula), então a correção de `§2.3` não o alcança sozinha.

## 3. Objetivo

Que um parágrafo sem execução visível — célula de anexo vazia, ou o separador entre segmentos de tabela — tenha a altura de linha governada pelo corpo que o código já escolheu para aquele parágrafo (o corpo do anexo, ou 1pt no caso do separador), e não pelo padrão herdado do documento (12pt).

**Não é objetivo:** mudar `altura_linha_pt`/`hRule="atLeast"` (ESPEC 014 `R-BRD-04`, ESPEC 049 `R-CEL-02` — o mínimo continua vindo da medição do GRC); mudar o corpo de fonte de nenhum anexo (`R-ANX-04` já decide isso); tornar a altura de linha exata.

## 4. Escopo

### 4.1 Dentro do escopo

- `ooxml.escrever` passa a montar `w:pPr/w:rPr` com o mesmo corpo (e a mesma fonte) do `w:r/w:rPr` que já monta — para toda célula, com ou sem texto (`R-CEL-04`);
- o parágrafo separador de `_faixa_de_tabelas` ganha a mesma marca, no seu próprio corpo de 1pt (`R-CEL-05`);
- **efeito colateral correto, não uma segunda mudança:** `ooxml.escrever` é compartilhada pela tabela de comprovação (`_bloco_de_linhas`, `_bloco_titulo`), que também pode escrever célula vazia — a coluna `Quantidade Contratada` quando não declarada (ESPEC 028), e a data do levantamento quando ausente. O corpo daquela tabela (`layout.CORPO_FONTE = 5,6pt`) está tão longe dos 12pt herdados quanto o dos anexos pequenos, e hoje tem o mesmo defeito, sem que nenhuma espec o tenha nomeado. A correção é a mesma função, e não há razão para excluir essas duas células do que já vale para as outras 19 abas.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Alterar `altura_linha_pt` de qualquer anexo, ou `medidas_grc.json` | O mínimo continua sendo o medido no GRC (`R-BRD-04`); o defeito é o que o excede, não o mínimo em si |
| Alterar `corpo` de qualquer anexo em `anexos.json` | Já é o medido no GRC (`R-ANX-04`); não é o que está errado |
| Refatorar o parágrafo separador para reusar `ooxml.escrever` | Ele não escreve numa célula (`_Cell`), e sim num parágrafo de corpo de documento — forçar o mesmo caminho exigiria mudar a assinatura da função para um caso só. A correção pontual, no próprio `_faixa_de_tabelas`, é mais barata e não introduz uma ramificação nova em `ooxml.escrever` |

## 5. Regras

| ID | Regra |
|---|---|
| `R-CEL-04` | `ooxml.escrever` monta `w:pPr/w:rPr` — fonte e corpo, iguais aos de `w:r/w:rPr` — para toda célula que escreve, com ou sem texto. É a marca do parágrafo, e governa a altura da linha quando não há execução visível para o Word medir |
| `R-CEL-05` | O parágrafo separador entre segmentos de tabela (`_faixa_de_tabelas`) recebe a mesma marca, no seu próprio corpo (1pt) |
| `R-CEL-06` | **Invariante de não regressão:** nenhuma célula ou parágrafo que hoje tem execução com texto muda de altura — a marca só passa a existir onde, sem ela, o Word já caía para o padrão do documento |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **A marca espelha a execução, não um valor novo** | `w:pPr/w:rPr` recebe o mesmo `corpo`/fonte que `w:r/w:rPr` já recebe — não há um terceiro parâmetro para decidir nem uma segunda fonte de verdade sobre "qual é o corpo desta célula" |
| `D-02` | **Escopo inclui a tabela de comprovação, por consequência da função compartilhada, não por decisão separada** (`§4.1`) | `ooxml.escrever` é uma função só; corrigi-la ali e excluir alguns chamadores exigiria um parâmetro novo (`aplicar_marca: bool`) para um caso que, medido, tem exatamente o mesmo defeito. Menos código, mesma correção |
| `D-03` | **O separador ganha a correção no próprio `_faixa_de_tabelas`, não uma nova função em `ooxml.py`** | É o único chamador fora de célula; generalizar `ooxml.escrever` para aceitar parágrafo solto trocaria uma correção pequena por uma reformulação de assinatura sem outro uso |
| `D-04` | **Não medir as outras 18 abas por captura de tela antes de corrigir** | O mecanismo é o mesmo `ooxml.escrever`/`_faixa_de_tabelas` para todas; `Comunicação Dados` isola a causa (`§2.2`, num documento sintético, sem depender da aba real) e a correção não é condicional por anexo |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/report/ooxml.py` | `escrever`: acrescenta `w:pPr/w:rPr` (fontes + corpo, mesma ordem/conteúdo do `w:r/w:rPr`) antes ou depois do `w:spacing`, dentro do `w:pPr` já criado |
| `infrastructure/report/docx_renderer.py` | `_faixa_de_tabelas`: o parágrafo separador ganha a marca equivalente, no seu corpo de 1pt |
| `tests/test_desempenho.py` | `test_escrever_reproduz_a_api_publica` (`R-DES-06`) precisa incluir a marca na comparação com a API pública — ou ser estendido para o novo elemento, ver `§9` |
| `tests/test_docx_anexos.py` | Caso novo: célula de anexo vazia tem `w:pPr/w:rPr/w:sz` igual ao corpo do anexo |
| `tests/test_identidade_dos_artefatos.py` | Reancoragem esperada de `PACOTE_DO_PILOTO`/`PACOTE_DO_PGM` (`word/document.xml`) — a mudança toca toda célula vazia de anexo e, por `D-02`, possivelmente células vazias da tabela de comprovação também |
| `anexos.json`, `medidas_grc.json`, `layout.py` | **Nenhuma** |

## 8. Testes e critério de aceite

| Verificação | Como |
|---|---|
| `R-CEL-04` | Teste de `ooxml.escrever` isolado (sem `Document`, como os de `test_desempenho.py`): célula vazia produz `w:pPr/w:rPr/w:sz` igual ao corpo passado |
| `R-CEL-05` | Teste sobre o `.docx` de `Comunicação Dados` (ou outro anexo com mais de um segmento): o parágrafo separador tem `w:pPr/w:rPr/w:sz` correspondente a 1pt |
| `R-CEL-06` | `test_escrever_reproduz_a_api_publica` continua verde para todo corpo de `anexos.json`, com texto; suíte completa sem falha não explicada pela reancoragem (`§9`) |
| Ponta a ponta | Regerar o `.docx` da aba `Comunicação Dados`, medir os mesmos três vãos do `§2.1` no Word real — devem cair para a ordem de grandeza de uma linha populada (~4 a 6pt, não ~17 a 31pt) |

**Critério de aceite:** os testes novos de `R-CEL-04`/`R-CEL-05` passam; os vãos medidos na aba `Comunicação Dados` caem para a faixa de uma linha populada; a suíte completa do backend roda sem falha não explicada pela reancoragem.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| `test_escrever_reproduz_a_api_publica` (`R-DES-06`) comparar contra a API pública do `python-docx`, que pode não ter um jeito direto de setar a marca do parágrafo (`paragraph_format` não expõe `w:pPr/w:rPr`) | A verificar na implementação: se a API pública não cobrir esse elemento, o oráculo precisa de um segundo modo de verificação (XML esperado explícito), documentado como exceção pontual, não como enfraquecimento geral do teste |
| A correção alcançar mais do que os 19 anexos — também a tabela de comprovação (`D-02`) — e mover `word/document.xml` por um motivo a mais, fora do que esta narrativa cobre isoladamente | Medir explicitamente, na execução, se alguma célula da tabela de comprovação (páginas 2-3) tem texto vazio nos pacotes de referência hoje, e registrar o achado — não presumir que só as páginas de anexo se movem |
| Reancoragem de `test_identidade_dos_artefatos.py` sem prova | Mesmo protocolo das ESPECs 049/051/052: desligamento (reverter a marca) devolve os pacotes ao hash de antes, entrada por entrada, antes de trocar qualquer hash |
| Efeito em anexos com corpo grande (`Central de Servicos`, `Colocation`, `CertificadosDigitais`, `Internet`, `SOA`, `OutrosServicos` — todos 11pt) | Esperado ser pequeno ou nulo — 11pt está a 1pt dos 12pt herdados, a mesma distância que tornou o efeito imperceptível em `Internet` na ESPEC 049. Não é um risco de regressão, é o motivo de o defeito ter passado despercebido até agora |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Vale medir as outras 18 abas por captura de tela real antes de aplicar, para confirmar visualmente o ganho em cada uma? | Não — `D-04`: o mecanismo é o mesmo em todas, e a causa já foi isolada sem depender de nenhuma aba específica |

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `R-CEL-04` em `ooxml.escrever` + teste isolado | P |
| B | `R-CEL-05` no separador de `_faixa_de_tabelas` + teste | PP |
| C | Suíte completa, reancoragem de `test_identidade_dos_artefatos.py`, medição real da aba `Comunicação Dados` | P |

**Estimativa: menos de meio dia** — a causa já está isolada e medida (`§2`); falta a implementação e a reancoragem.

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-10 | Redação inicial, a partir de duas capturas de tela reais (aba `Comunicação Dados`, contrato SMIT Sustentação) e de medição direta no Word real (documento de produção e três documentos sintéticos isolados) |
| 1.1 | 2026-09-10 | Implementada: `R-CEL-04` (marca em `ooxml.escrever`) e `R-CEL-05` (marca no separador de `_faixa_de_tabelas`), com o oráculo `R-DES-06` estendido (`_escrever_de_referencia` copia o `w:sz` já calculado pela API pública, sem recalcular o truncamento). Vãos da aba `Comunicação Dados`, medidos no Word real: 17,47pt/linha → 5,45pt/linha, 30,94pt → 3,39pt. Backend 1.624 → 1.626 passed, 0 failed; `word/document.xml` reancorado nos dois pacotes (piloto `a5f730bf…` → `5a0c4fd5…`, PGM `e205b9ec…` → `6dd36e33…`), delta provado por desligamento. Alcance restrito às páginas de anexo — medido (`T-2783`), não presumido: zero célula vazia na tabela de comprovação nos dois pacotes |
