# PLANO 020 — Implementação da Capa do Documento

| | |
|---|---|
| **Especificação** | [ESPEC 020](../specs/020-capa-do-documento.md) v1.2 |
| **Versão** | 1.2 — 2026-08-17 — **executado**, salvo o `P5`. Desvios no TASKS 020 §11 |
| **Estado inicial** | **488 testes** (coleta 1,38 s; execução completa ~15 min) · o documento do PGM sai hoje com **13 ocorrências de `SMIT`**, das quais **12 são resíduo do modelo** e **1 é dado legítimo do cliente** (§5.3) · a capa tem **2 testes**, e os dois **protegem o defeito** |
| **Instrumento existente** | As medições da ESPEC 020 §2, todas reproduzíveis sobre o modelo e os dois pares reais |

---

## 1. O princípio que ordena este plano

Este plano é pequeno e tem um risco desproporcional ao seu tamanho: **o artefato que ele muda é o
único que sai da aplicação e vai ao cliente**, e a única prova de que está certo é alguém olhar.

Três regras decorrem disso.

> **O critério de aceite vem antes de qualquer código, porque o da espec está errado.**
> A ESPEC 020 §9.3 pede que *"a cadeia `SMIT` não apareça em lugar nenhum do pacote"*. Medido: o
> documento do PGM contém `SMIT` **por um motivo legítimo** — a aba `NAS` do levantamento do
> próprio cliente traz a palavra numa célula, e ela vira anexo. O critério, como escrito, é
> impossível de satisfazer. A F0 o conserta antes de existir código que o persiga (§6).

> **O instrumento vem antes da correção, e tem de reprovar.**
> É a regra que a ESPEC 017 estabeleceu e a 019 confirmou. A varredura de `R-CAP-09` é escrita na
> F1, contra o código intocado, e **tem de acusar as 12 ocorrências de resíduo**. Uma varredura
> escrita depois da correção mede a correção, não o defeito.

> **Alguém abre o Word.**
> A ESPEC 003 registrou que a suíte de DOCX releu por meses o que ela mesma escrevia e deixou seis
> defeitos passarem. Este plano escreve **dentro de caixas de texto do Word**, e nenhuma asserção
> sobre XML prova que o texto coube na caixa, que a fonte não mudou, ou que a arte não ficou por
> cima. O `I-05` da espec — o estouro da linha de propostas — só se responde assim. É o `K-20`.

E uma quarta, que é específica desta espec:

> **O piloto é o oráculo.**
> Esta é a rara mudança cujo resultado correto já está escrito: a capa do SMIT, gravada no modelo.
> §2.4 da espec mede que as regras de derivação a reproduzem **caractere por caractere**. Qualquer
> fase cujo resultado no piloto divirja do modelo está errada, e não há discussão sobre gosto.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — O alvo é atingível** | Fim da F0 | O critério de aceite distingue **resíduo do modelo** de **dado legítimo do cliente**. A lista das cadeias identificadoras está escrita e é a única fonte da varredura | Não começar a F1. Perseguir um alvo impossível produz teste que ninguém consegue deixar verde, e o desfecho é afrouxá-lo sob pressão |
| **P1 — Os instrumentos existem, e o que tem de reprovar reprova** | Fim da F1 | A varredura acusa **12** ocorrências de resíduo no PGM e **0** no piloto, nominalmente por cadeia. O **delta sancionado** do piloto está escrito — 6 campos idênticos, 3 mudados — e a **invariância do corpo** passa desde já | O instrumento está errado. Descobrir agora, não na F4 |
| **P2 — O piloto é reproduzido** | Fim da F3 | **T-1407 inteira verde**: cliente, subtítulo e rodapé da capa idênticos ao modelo caractere por caractere; contrato, linha de propostas e `caixa 2 · ¶2` nos três valores sancionados. Nada mais se move | A derivação está errada. O piloto é o oráculo |
| **P3 — Nenhum resíduo, nos dois** | Fim da F4 | Varredura limpa nos dois pares. As **duas cópias** de cada caixa lógica com o mesmo valor. `caixa 3 · ¶2` com a lista, `caixa 2 · ¶2` vazio | Não entregar. É o critério de aceite da ESPEC 020 §9.3, corrigido |
| **P4 — O que não devia mudar não mudou** | Fim da F4 | Estrutura da capa intacta: 6 blocos `w:txbxContent`, 3 parágrafos cada. `test_nenhuma_parte_do_pacote_se_perde`, `test_fontes_imagens_e_timbrado_sobrevivem`, `test_o_modelo_nao_e_alterado` e os 32 de anexo **sem uma linha alterada** | O escopo vazou para a diagramação da capa, que a espec põe fora |
| **P5 — Alguém abriu** | Fim da F5 | Os dois documentos abertos no Word, com a lista do `K-20` conferida item a item. **Inclui o `I-05`** — a linha de propostas do PGM não foi cortada | Não entregar. É o portão que nenhum teste substitui |
| **P6 — O conjunto** | Fim da F5 | Suíte verde; `ruff`, `mypy` limpos; contagem reconciliada | Não entregar |

**P0 é o portão mais barato e o mais fácil de pular.** Ele não produz código. Pulá-lo significa
escrever, na F1, uma varredura que procura `SMIT` — e descobrir na F4 que ela nunca fica verde.

---

## 3. Fases

### F0 — O critério de aceite, corrigido `[portão]`

**Objetivo:** tornar o alvo atingível. **Nenhum arquivo de `src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1400 | Registrar em `modelo.py` a lista nominal das **cadeias identificadoras do modelo** — as cinco medidas em §5.3, e só elas | `R-CAP-09` |
| T-1401 | **[portão]** Provar que a lista é necessária **e** suficiente: contra o modelo, ela cobre as 12 ocorrências; contra o documento do PGM de hoje, ela **não** casa a ocorrência da aba `NAS` | **P0**, §6 |
| T-1402 | Emenda à ESPEC 020: §9.2 e §9.3 passam de *"não contém a cadeia `SMIT`"* para *"não contém nenhuma cadeia identificadora do modelo"*. `R-CAP-09` já estava certa; eram as seções de teste que a contradiziam | §6 |

**Verificação:** P0.

> **A T-1401 é a que separa duas afirmações que parecem a mesma.** *"O documento do PGM não fala
> em SMIT"* é falso e sempre será: a planilha do cliente fala. *"Nada do contrato do SMIT vaza
> para o documento do PGM"* é o que interessa, é verdadeiro, e é verificável. A diferença é uma
> célula na aba `NAS`, e ela derruba o critério inteiro se não for vista antes.

**Tamanho:** PP — uma hora. **Encerra:** P0.

---

### F1 — A varredura, e ela reprova `[portão]`

**Objetivo:** poder afirmar, ao final, que o resíduo sumiu. **Nenhum arquivo de `src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1403 | Varredura: gerado o documento, nenhuma cadeia de T-1400 aparece em **nenhuma parte do pacote** | `R-CAP-09` |
| T-1404 | **[portão]** Rodar contra o código atual e exigir que reprove: **12** ocorrências no PGM, nominais por cadeia — não uma contagem agregada | **P1** |
| T-1405 | Simétrico: a varredura das cadeias do **PGM** contra o documento do **piloto** já passa hoje, e tem de continuar passando | `R-CAP-09` |
| T-1406 | Teste da estrutura da capa — 6 blocos `w:txbxContent`, 3 parágrafos cada —, que `D-09` passa a pressupor | **P4** |
| T-1407 | **Delta sancionado da capa do piloto** — dos nove parágrafos, **seis idênticos ao modelo e três mudados**, com os valores escritos à mão a partir do modelo, nunca copiados da saída | ESPEC §9.1 |
| T-1408 | **Invariância do corpo**: no piloto, o conjunto de `<w:t>` **fora** das seis caixas da capa é idêntico antes e depois | **P4** |

**Verificação:** P1. T-1404 reprova; T-1405 a T-1408 passam desde já — T-1407 na metade que afirma
o estado atual, e é a outra metade que fica vermelha até a F3.

> **A T-1407 é a que transforma custo declarado em custo verificado.** `D-03` e `D-04` dizem, em
> prosa, que o piloto perde o ` - TA 02` e a pilha histórica. Sem asserção, quem vir a capa do
> piloto diferente não consegue distinguir *"era esperado"* de *"quebrou"* — e um portão de
> não-regressão existe justamente para permitir essa triagem. Os valores têm de ser transcritos do
> modelo: um teste que compare o código consigo mesmo não mede nada.

> **A T-1408 é um cinto de uma linha, e a F2 abre o renderizador.** Nada na suíte afirma hoje que o
> **corpo** do documento não se moveu — os 488 testes o cobrem indiretamente. Tirar o texto de fora
> das caixas e comparar pega edição acidental no corpo enquanto o arquivo está aberto, que é o
> risco clássico desta fase e o que a ESPEC 018 `D-10` tratou como prioridade.

> **A T-1404 exige as ocorrências nominais, e não o número.** Uma varredura que diga *"12
> ocorrências"* fica verde quando alguém trocar quatro campos e esquecer o quinto **se outro
> passar a aparecer duas vezes**. A asserção é por cadeia, e o relatório de falha diz qual.

> **A T-1406 parece decorativa e é o que sustenta `D-09`.** Endereçar campo por `(caixa,
> parágrafo)` só é seguro enquanto a forma da capa for essa. Se um modelo novo entrar com outra
> estrutura, este teste acusa **antes** de o endereçamento escrever no parágrafo errado.

**Tamanho:** P — duas horas. **Encerra:** P1.

---

### F2 — Escrever nos campos, com o que o `Report` já tem

**Objetivo:** matar o vazamento mais grave. **Publicável sozinha.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1409 | Mapa de posições em `modelo.py`: `(caixa lógica, parágrafo) → campo`, com as duas cópias de cada caixa | `R-CAP-03`, `D-09` |
| T-1410 | `_preencher_a_capa` no `docx_renderer`: escreve o texto do `<w:t>` endereçado, escapando o que insere | `R-CAP-02`, §10 |
| T-1411 | Contrato ← `contrato_referencia`, **sem sufixo** | `R-CAP-06`, `D-03` |
| T-1412 | Propostas ← `Report.propostas`, unidas por ` / `. `caixa 2 · ¶1` com o prefixo `Proposta : `; `caixa 2 · ¶2` **vazio**; `caixa 3 · ¶2` com a lista sem prefixo | `R-CAP-07`, `D-09` |
| T-1413 | **[risco]** Teste: `caixa 3 · ¶2` recebe a lista **e** `caixa 2 · ¶2` fica vazio. É o teste que pega o endereçamento por cadeia | `D-09` |
| T-1414 | Teste: as duas cópias de cada caixa lógica têm valores iguais entre si | `R-CAP-03`, `D-02` |
| T-1415 | Cliente e subtítulo ainda **não derivados**: os dois caem para `contrato_referencia` por `D-10`. Estado intermediário deliberado | `R-CAP-10` |
| T-1416 | Teste: nesta fase, a varredura já passa nos dois pares — o vazamento acabou, mesmo sem as derivações | **P3** parcial |

**Verificação:** a varredura de T-1403 passa. T-1413 e T-1414 verdes.

> **A T-1415 é a decisão que torna a fase publicável.** Com o cliente caindo para
> `TC 015/PGM/2024`, a capa fica menos informativa do que ficará — e **já não nomeia outro
> órgão**. O vazamento de número de contrato e de propostas alheias, que é o dano de verdade,
> some aqui. Se o plano parar por qualquer motivo, esta fase valeu.

> **A T-1410 escapa o que insere, e isso não é zelo abstrato.** O nome do órgão vem de PDF; um
> `&` cru no `<w:t>` produz XML inválido e o Word recusa o arquivo inteiro — falha total, num
> caminho que só aparece com um cliente cujo nome tenha `&`.

**Tamanho:** P — três horas.

---

### F3 — As derivações, e o piloto é reproduzido `[portão]`

**Objetivo:** a capa passa a dizer o que dizia, por derivação.

| # | Tarefa | Ref. |
|---|---|---|
| T-1417 | `_cliente(pdf)` no extrator — o nome do órgão da primeira página, com o padrão de `R-CAP-04`: sem a sigla, com ou sem espaço antes do hífen | `R-CAP-04`, §2.5 |
| T-1418 | **[risco]** Teste dos **dois separadores** medidos: `Tecnologia- SMIT` e `Paulo - PGM`, no mesmo teste | `R-CAP-04`, §2.5 |
| T-1419 | `Contract.cliente`, `Report.cliente`, e o repasse no caso de uso | `D-07` |
| T-1420 | **[risco]** `Contract.aplicar` repassa `cliente` — sem isso o consolidado do PGM o perde, e a capa quebra **no caso com aditivo** | `D-07`, ESPEC 019 |
| T-1421 | Teste: o cliente sobrevive à consolidação com aditivo. Falha hoje se T-1420 não existir | `D-07` |
| T-1422 | Subtítulo ← miolo do título da aba | `R-CAP-05` |
| T-1423 | Cascata de `D-10`: cliente → subtítulo → `contrato_referencia`; subtítulo → `contrato_referencia` | `R-CAP-10`, `D-10` |
| T-1424 | `v_cap_01_cliente_nao_derivado` (`AVISA`) | ESPEC §8.1 |
| T-1425 | Teste: `V-CAP-01` dispara em fixture sem a frase; **não** dispara nos dois pares | ESPEC §9.2 |
| T-1426 | **[portão]** Teste-oráculo: no piloto, cliente e subtítulo saem **idênticos ao modelo** — `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` e `SMIT SUSTENTAÇÃO` | **P2** |

**Verificação:** P2. T-1426 é a asserção que fecha a fase.

> **A T-1426 é o portão mais forte deste plano, e custa três linhas.** A capa correta do piloto já
> existe, gravada no modelo. Se a derivação a reproduz caractere por caractere, ela está certa —
> não *provavelmente certa*, certa. É a mesma natureza da T-1112 do PLANO 017, que exigiu que o
> gabarito derivado fosse **igual** à constante que ele substituía.

> **A T-1420 é a que a espec 1.0 não via.** A ESPEC 019 introduziu `Contract.aplicar` há um dia, e
> ela monta um `Contract` novo a partir de uma lista fixa de campos. Um campo novo que não entre
> nessa lista some **em silêncio, e só no caminho com aditivo** — que é o do PGM, que é o motivo
> desta espec existir. T-1421 é o teste que a torna impossível de esquecer.

**Tamanho:** P — três horas. **Encerra:** P2.

---

### F4 — Converter os testes de capa `[portão]`

**Objetivo:** a suíte deixa de proteger o defeito.

| # | Tarefa | Ref. |
|---|---|---|
| T-1427 | `test_a_capa_e_identica_a_do_modelo` → **igualdade menos os cinco campos**: os três textos da PRODAM idênticos, a estrutura idêntica | `D-08`, `R-CAP-08` |
| T-1428 | `test_a_capa_traz_o_conteudo_esperado` → cita o que foi submetido, **nos dois pares** | `D-08` |
| T-1429 | `relatorio_vazio` ganha `cliente` e um `titulo` que case o padrão | ESPEC §7 |
| T-1430 | **Fixture nova** com `titulo` fora do padrão e sem cliente, para exercitar a cascata de `D-10`. Não reaproveitar a `relatorio_vazio`: ela passa a ser o caso feliz | `R-CAP-10` |
| T-1431 | Capa do PGM: `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO`, `PGM TC 015`, `Contrato : TC 015/PGM/2024`, `Proposta : PA-PGM-251015-159 / PA-PGM-260304-715` | `R-CAP-01` |
| T-1432 | **[portão]** `test_docx_anexos.py` verde **sem uma linha alterada** — 32 testes que provam que o escopo não vazou | **P4** |
| T-1433 | **[portão]** Varredura limpa nos dois pares; estrutura da capa intacta | **P3**, **P4** |

**Verificação:** P3 e P4.

> **A T-1430 existe porque a `relatorio_vazio` muda de papel.** Hoje ela é *"um relatório sem
> conteúdo"*; depois de T-1429 ela é *"um relatório cuja capa preenche"*. O caso de cascata perde
> o seu exemplar se ninguém criar outro — e é justamente o caso que a revisão da espec descobriu
> estar aberto (`D-10`).

**Tamanho:** P — duas horas. **Encerra:** P3 e P4.

---

### F5 — Alguém abre o Word, e o conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-1434 | **[portão]** Gerar os dois documentos e **abrir no Word**. Lista do `K-20` conferida item a item | **P5** |
| T-1435 | **[portão]** `I-05` respondido com o que se viu: a linha `Proposta :` do PGM, com duas peças, **não foi cortada**. Registrar quantas peças foram observadas cabendo | **P5**, `I-05` |
| T-1436 | Suíte completa verde; contagem reconciliada contra os 488 iniciais mais os novos | **P6** |
| T-1437 | `ruff`, `mypy` limpos | **P6** |
| T-1438 | ESPEC 020 → implementada, com as emendas de execução. ESPEC 018 `I-01` → **resolvido** | — |
| T-1439 | CHANGELOG e TASKS 020 com resultado, desvios e a resposta ao `I-05` | — |

**Tamanho:** PP — duas horas. **Encerra:** P5 e P6.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──────────────────────► publicável sozinha
P0     P1     (vazamento acaba)
                    │
                    └──► F3 ──► F4 ──► F5
                         P2     P3·P4   P5·P6
                    (piloto     (suíte  (Word)
                   reproduzido) converte)
```

**A F2 é o corte natural de entrega.** Ao fim dela o documento do PGM já não carrega nada do SMIT
— que é o dano de verdade —, com a capa ainda identificando o órgão pelo número do contrato. As
F3 a F5 melhoram a capa; a F2 para de vazar.

F0 e F1 não tocam `src/`.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 1 dia (13 h) |
| — até a F2, publicável | 6 h |

---

## 5. A regressão que já está escrita

Lida no repositório, não presumida. **488 testes.**

### 5.1 Os dois que mudam de asserção

| Arquivo | Teste | Por quê |
|---|---|---|
| `test_docx_estrutura.py` | `test_a_capa_e_identica_a_do_modelo` | Afirma a igualdade total com o modelo. **Fica falso por construção** — é `R-DOC-02` escrita como asserção, e era a regra certa quando havia um cliente só |
| `test_docx_estrutura.py` | `test_a_capa_traz_o_conteudo_esperado` | Cita `SMIT SUSTENTAÇÃO` e `TC 52/SMIT/2024` como conteúdo esperado de **qualquer** documento |

**São dois, e nenhum morre.** Os dois invertem de sentido e ficam mais fortes (`D-08`). Nenhum
outro teste da suíte afirma conteúdo de capa.

### 5.2 Os que não podem ser tocados — e o que **muda e é sancionado**

A ESPEC 020 §9.1 separa as duas categorias, e a distinção é o que torna este portão utilizável.
**A capa do piloto muda**: dos nove parágrafos, seis ficam idênticos e três perdem o ` - TA 02` e a
pilha histórica (`D-03`, `D-04`). T-1407 escreve esse delta; sem ele, "a capa do piloto está
diferente" não é triável.

Os intocáveis:

`test_nenhuma_parte_do_pacote_se_perde`, `test_fontes_imagens_e_timbrado_sobrevivem`,
`test_o_modelo_nao_e_alterado`, `test_duas_secoes_retrato_e_paisagem`,
`test_nao_ha_pagina_em_branco_entre_a_capa_e_a_tabela`, `test_o_modelo_conserva_o_alinhamento_original`
— os 11 restantes de `test_docx_estrutura.py` — e os **32** de `test_docx_anexos.py`.

**A fixture `relatorio_vazio` é compartilhada** entre `test_docx_estrutura.py` e
`test_docx_anexos.py`. T-1429 a altera, e por isso T-1432 é portão: os 32 testes de anexo têm de
ficar verdes **sem uma linha alterada**.

### 5.3 O resíduo de hoje, medido

Gerado o documento do par completo do PGM com o código atual:

```
ocorrências de "SMIT" em word/document.xml : 13
partes do pacote que contêm "SMIT"          :  1
```

Discriminadas:

| cadeia | origem | é resíduo? |
|---|---|---|
| `Contrato : TC 52/SMIT/2024 - TA 02` | modelo | **sim** |
| `Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-250220-15 V 1.4 /` | modelo | **sim** |
| `PA-SMIT-260319-739` | modelo, 4× | **sim** |
| `SMIT SUSTENTAÇÃO` | modelo | **sim** |
| **`SMIT`** | **aba `NAS` do levantamento do PGM** | **não — dado do cliente** |

**São 12 de resíduo e 1 legítima.** A décima terceira é uma célula da planilha que o próprio
cliente enviou, e que vira linha de anexo. É a medição que corrige o critério de aceite (§6).

---

## 6. Um acerto à ESPEC 020

A espec, em §9.2 e §9.3, escreve o critério de aceite como

> *"o documento do PGM não contém a cadeia `SMIT`"*

e isso é **falso e inatingível**. §5.3 mede por quê: a aba `NAS` do levantamento do PGM traz `SMIT`
numa célula, e ela sai no anexo — corretamente, porque é dado que o cliente enviou.

A regra `R-CAP-09` já estava certa — *"nenhuma das cadeias do modelo que identificam um contrato"*
—; eram as seções de teste que a contradiziam, por atalho de redação. A T-1402 as alinha.

**A lição é a mesma da ESPEC 018 §1.1**: medi o modelo, concluí sobre o documento gerado, e os dois
não são a mesma coisa. Um critério de aceite escrito sobre a fonte errada teria produzido, na F4,
um teste que ninguém consegue deixar verde — e a saída, sob pressão de entrega, seria afrouxá-lo
até não provar mais nada.

---

## 7. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Escrever só numa das cópias do `mc:AlternateContent` | T-1414. O defeito não se reproduz na máquina de quem testa — depende da versão do Word de quem abre |
| Endereçar por cadeia e escrever no campo errado | T-1413. Era o defeito da ESPEC 020 v1.0, e a revisão o pegou antes do código |
| `rsplit(' - ')` no cliente, que falha no piloto | T-1418, com os dois separadores medidos |
| `cliente` sumir na consolidação com aditivo | T-1421. É o caminho do PGM, e o silêncio é total sem o teste |
| Capa com campo vazio | T-1430, a fixture da cascata |
| `&` no nome do órgão invalidar o XML | T-1410 escapa; teste com nome sintético |
| **A linha de propostas ser cortada na caixa** | **Nenhum teste pega.** Só T-1434/T-1435, no Word. É o `I-05`, e é a razão de P5 existir |
| O escopo vazar para a diagramação da capa | T-1432 e T-1406 |
| A varredura ficar verde por afrouxamento | T-1404 exige as ocorrências **nominais**; T-1401 prova que a lista não casa dado legítimo |
| **Mexer no corpo do documento** com o renderizador aberto na F2 | T-1408. Nenhum outro teste afirma que o texto fora da capa não se moveu |
| **Não conseguir triar** uma diferença na capa do piloto | T-1407. Custo declarado em prosa não distingue *esperado* de *quebrado* |
| **Tomar a conferência do PGM por prova** | §9.4 da espec e o portão P5. O PGM prova o **negativo** — nada do SMIT sobrou; quem prova o positivo é o piloto, contra o modelo |

---

## 8. Insumos

| ID | Insumo | Para quê |
|---|---|---|
| `K-20` | **Lista do que conferir com o Word aberto**: o nome do órgão na caixa 1; o subtítulo; a linha `Contrato :`; a linha `Proposta :` **inteira e não cortada**; o rodapé da capa; os três textos da PRODAM; a arte de fundo; e a ausência de página em branco depois da capa | P5 |
| `K-21` | Resposta ao `I-05`: quantas peças cabem na linha `Proposta :` antes do corte, observado no Word | `I-05` |
| `K-22` | Decisão de negócio sobre o `I-01` — se o ` - TA 02` faz falta, e se entra como campo do formulário | ESPEC `I-01` |

---

## 9. O que este plano não faz

- **Não toca a diagramação da capa.** Fonte, corpo, cor, posição e arte ficam. Só o texto dos
  parágrafos muda (`D-01`).
- **Não inventa o ` - TA 02` nem a pilha histórica de propostas.** `D-03` e `D-04` decidem por não
  escrever o que a aplicação não sabe, e o `K-22` é onde o negócio pode reverter.
- **Não mexe no modelo `modelo_prodam.docx`.** Ele continua sendo entrada, e
  `test_o_modelo_nao_e_alterado` continua provando isso sem mudança.
- **Não resolve o estouro da caixa.** Mede se ele existe (`K-21`) e para aí. Se existir, é espec
  própria — abreviar lista é decisão de apresentação, não de correção.
- **Não toca o rodapé do documento**, que a ESPEC 019 `D-09` acabou de mexer, nem o corpo, nem os
  anexos.
