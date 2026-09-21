# ESPEC 045 — A ordem que não era regra

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-08. Backend **1.575 → 1.601 passed** (26 testes novos), zero falhas reais — uma reprovação de `test_desempenho.py` (custo de mesclagem de anexo, área não tocada por esta entrega) foi ruído de carga sob a suíte completa, confirmada isolada em seguida (`1 passed` sozinha). `ruff`/`mypy` limpos nos cinco arquivos de produção tocados. `aditivo_cgm.pdf` (cópia de `PA-CGM-250912-127 v4.0.pdf`) extrai **27 itens, zero erro**, checksum fechado em `R$ 6.110.655,79` — igual ao total declarado. Os nove documentos do corpus não se movem: zero troca de papel registrada em nenhum deles, confirmado tanto pelas contagens/`sha` de `test_extractor_aditivo_smul.py::REGUA` (idênticas) quanto pelo campo `ordem_de_colunas_alternativa`, vazio nos nove. `V-CTR-08` dispara para `aditivo_cgm.pdf` — páginas 3 e 4 — e para nenhum outro documento, confirmado pelo `DIContainer` real. **Um bug pego na primeira rodada de testes**: `meses_bruto` ainda lia `celulas[COL_MESES]` fixo em vez do índice resolvido pelo papel — corrigido antes de qualquer commit (ver TASKS 045 §12) |
| **Versão** | 1.0 — 2026-09-08 |
| **Depende de** | [ESPEC 017](017-grade-do-contrato-derivada-do-documento.md) — a grade derivada do próprio documento, princípio que esta espec estende às **colunas**, não só às bordas. [ESPEC 019](019-contrato-e-aditivos.md) `R-ADT-08`/`D-05` — mais de uma geometria por documento, e o crivo de admissão que esta espec não reabre. [ESPEC 040](040-o-mes-que-veio-com-dias.md) `R-MES-01`/`R-MES-04` — a tolerância a período não numérico, cujo caminho esta espec passa a acionar corretamente. [ESPEC 041](041-a-regua-da-tabela-errada.md) `R-FXA-09` — a união de geometrias admitidas, reaproveitada aqui sem alteração. [ESPEC 042](042-o-total-que-nao-tinha-total.md) `I-01` — **esta espec fecha aquele ponto em aberto**: §2.3 daquela espec já media a mesma ordem trocada e a deixava explicitamente de fora ("corrigir a ordem de colunas do `PA-CGM-250912-127` — outra causa, e bloqueia a extração antes de chegar a `total_declarado`"); `_total_por_convergencia` (ESPEC 042) é o que fecha o checksum de `aditivo_cgm.pdf` nesta entrega, sem nenhuma mudança nela |
| **Revisa** | O comentário `R-GRD-01` em [grid.py:32-36](../../backend/src/infrastructure/contract/grid.py#L32-L36) e as constantes `COL_PRECO`/`COL_QUANTIDADE`/`COL_MESES` em [pdfplumber_extractor.py:33-39](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L33-L39): sete colunas **são** fato do negócio — isso não muda —, mas a *ordem* de preço, quantidade e período dentro delas não é fato do documento, é convenção **por seção**, e o cabeçalho já diz qual é |
| **Não toca** | A descoberta de geometria (`R-GRD-02` a `R-GRD-04`), a leitura por faixa (`R-FXA-01` a `R-FXA-10`, ESPECs 033/041), o crivo de admissão de geometrias (`_e_item_completo`/`_geometrias_de_itens`, `D-05` da ESPEC 019), o checksum de `V-CTR-03`, a tolerância a período não numérico (`R-MES-01` a `R-MES-05`, ESPEC 040) e as colunas código/descrição/unidade/total, que nenhum documento medido move |
| **Referência normativa** | `docs/documentos/CGM/PA-CGM- 250912-127 v4.0.pdf` (o defeito; candidato a fixture `aditivo_cgm.pdf`) · os nove documentos de `backend/tests/fixtures/` (a não-regressão) |
| **Origem** | Submissão real: *"item 14.049.00039.00 (página 4) sem quantidade — extração incompleta da tabela do contrato"*, ao gerar o relatório `.docx` do aditivo `PA-CGM-250912-127 v4.0`. Investigada nesta conversa |

---

## 1. Problema

**A ordem das colunas preço/quantidade/período é lida como se fosse fixa para o documento inteiro, mas uma peça pode declarar ordens diferentes em seções diferentes — e a extração lê a coluna errada como se fosse a certa, sem avisar, até que o conteúdo de uma célula deslocada não seja mais um número.**

`_montar_item` ([pdfplumber_extractor.py:590-636](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L590-L636)) lê `quantidade`, `preço unitário` e `meses` por posição fixa — `COL_PRECO=3`, `COL_QUANTIDADE=4`, `COL_MESES=5` — declarada como fato do negócio. O aditivo `PA-CGM-250912-127 v4.0` tem duas ordens **na mesma geometria**, ambas na página 3: as seções "5.2 Redes e Conectividades" e "5.3 Serviços de Comunicação" trazem `PREÇO UNITÁRIO · QTDE · PERÍODO(MÊS)`, na ordem que o código assume; a seção seguinte, "5.4 Data Center" — que é onde vive o item `14.049.00039.00` —, traz `Quantidade Contratado · Período Mês · Unitário`, a ordem **invertida**.

O item `14.049.00039.00` estoura porque o seu período não é um inteiro — é `"2 meses e 16 dias"`, a cauda de um servidor provisionado no meio do ciclo de faturamento. Lido na posição errada (a que o código chama de "quantidade"), esse texto não parseia como `Decimal`, e `_montar_item` recusa a linha inteira. **O erro visível é a ponta menos grave do problema**: todo item da seção 5.4 cujo período é um inteiro simples — a maioria — passa hoje **sem erro nenhum**, com preço e quantidade trocados entre si, porque as duas colunas deslocadas continuam parseando como números válidos, só que com o significado errado.

## 2. O que foi levantado no código

### 2.1 Prova aritmética — a seção 5.4 lê preço e quantidade trocados

Medido diretamente nas células que `ler_celulas` produz para a página 4, geometria `(32.9, 81.7, 214.5, 275.4, 330.8, 401.0, 482.2, 567.2)` — a mesma que a ESPEC 019 já usa para a tabela de itens desta peça:

| código | col. 3 (`COL_PRECO` hoje) | col. 4 (`COL_QUANTIDADE` hoje) | col. 5 (`COL_MESES` hoje) | total (col. 6) | conferência |
|---|---|---|---|---|---|
| `14.049.00038.00` | `1` | `12` | `R$ 3.129,89` | `37.558,68` | `3.129,89 × 1 × 12 = 37.558,68` ✓ |
| `14.049.00048.00` | `7` | `12` | `R$ 3.129,89` | `262.910,76` | `3.129,89 × 7 × 12 = 262.910,76` ✓ |
| `14.048.00012.00` | `1` | `12` | `R$ 109.393,21` | `1.312.718,52` | `109.393,21 × 1 × 12 = 1.312.718,52` ✓ |

A aritmética só fecha lendo a coluna 3 como **quantidade**, a coluna 4 como **período** e a coluna 5 como **preço** — o oposto do que `COL_PRECO=3`/`COL_QUANTIDADE=4`/`COL_MESES=5` fazem hoje. Hoje, para essas três linhas, o relatório sairia com quantidade `12` (na verdade o período) e preço unitário `1`, `7` ou `1` (na verdade a quantidade) — sem nenhum erro, sem nenhum aviso.

### 2.2 O cabeçalho já diz a ordem — por posição de coluna, não por prosa

Medido nas coordenadas de palavra da página 3 (`pagina.extract_words()`), dentro das mesmas oito divisórias:

| seção | texto do cabeçalho (colunas 3-5) | ordem |
|---|---|---|
| 5.2 Redes e Conectividades | `PREÇO UNITÁRIO (R$)` · `QTDE` · `PERIODO (MÊS)` | preço, quantidade, período — **canônica** |
| 5.3 Serviços de Comunicação | `PREÇO UNITÁRIO (R$)` · `QTDE` · `PERIODO (MÊS)` | canônica |
| **5.4 Data Center** | `Quantidade Contratado` · `Período Mês` · `Unitário` | **quantidade, período, preço — invertida** |
| 5.1 Produtos Customizados Por Órgão (mais abaixo, página 4) | `PREÇO UNITÁRIO (R$)` · `QTDE` · `PERIODO (MÊS)` | canônica de novo |

Os rótulos do cabeçalho caem exatamente nas mesmas colunas da grade que os dados — `ler_celulas` já os devolve como uma linha comum, descartada hoje só porque a coluna 0 não bate `_CODIGO_EXATO`. Não é preciso nenhuma leitura nova de coordenada: **o cabeçalho já passa pelo mesmo laço que os itens**, e é ignorado no mesmo lugar onde um item seria aceito.

### 2.3 Por que só um item bloqueia, e os outros da mesma seção não

`para_decimal` ([quantity.py:30-61](../../backend/src/domain/value_objects/quantity.py#L30-L61)) não distingue "número na coluna errada" de "número certo": ambos parseiam. A seção 5.4 tem período inteiro em quase todas as linhas (`12`), e um inteiro na posição de "quantidade" é um `Decimal` válido — a inversão passa **calada**. Só `14.049.00039.00`, cujo período é `"2 meses e 16 dias"` / `"9meses e 14 dias"`, expõe o problema, porque texto não numérico não sobrevive a `Decimal()` em posição nenhuma.

Isso já tem tratamento — só que para o campo errado. `_montar_item` já tolera período não numérico (`R-MES-01`, ESPEC 040): guarda o texto em `meses_bruto` e avisa por `V-CTR-07`, sem bloquear. O defeito não é a ausência de tolerância — é que o roteamento manda `"2 meses e 16 dias"` para `quantidade`, campo que continua obrigatório (`R-MES-02`), em vez de para `meses`, que já sabe absorver isso.

### 2.4 Medição: rastreamento de papel por linha, com estado por geometria

Prototipado em memória (nenhuma linha gravada): um vocabulário fechado —

```
preço:      PREÇO | UNITÁRIO
quantidade: QTDE | QUANTIDADE
período:    PERÍODO | MÊS | MESES
```

— classificando o texto das colunas 3, 4 e 5 de cada linha que **não** é item (não bate `_CODIGO_EXATO`), acumulado num buffer por geometria até a próxima linha de item aparecer; nesse ponto, se as três colunas tiverem casado com os três papéis, um cada, o mapeamento ativo da geometria muda; senão, o mapeamento anterior continua valendo. O buffer é limpo a cada linha de item, resolvendo ou não.

Rodado contra os nove documentos de `backend/tests/fixtures/`: **nenhum registra troca de papel** — todos leem cabeçalho `PREÇO`/`QTDE`/`PERÍODO` (ou não têm cabeçalho legível na banda, e ficam no padrão canônico por ausência de sinal). Rodado contra `PA-CGM-250912-127 v4.0.pdf`, na ordem em que as linhas realmente aparecem no documento:

| página | evento | papel resultante |
|---|---|---|
| 3 | cabeçalho de "5.2 Redes e Conectividades" | preço=3, quantidade=4, período=5 (canônico — sem mudança) |
| 3 | itens `11.051.00012.00`, `11.027.00001.00` | lidos no canônico |
| 3 | cabeçalho de "5.3 Serviços de Comunicação" | canônico (sem mudança) |
| 3 | itens da seção C (`12.029.*`, `12.055.*`, `12.030.*`) | lidos no canônico |
| 3 | cabeçalho de "5.4 Data Center" (duas linhas: `Quantidade`/`Período` numa, `Contratado`/`Mês`/`Unitário` na outra) | **muda para quantidade=3, período=4, preço=5** |
| 3-4 | itens `14.049.00037.00` até `14.023.00005.00` (dezenove códigos, sem repetir cabeçalho, atravessando a quebra de página) | lidos no papel invertido — **inclusive `14.049.00039.00`, que passa a extrair sem erro** |
| 4 | cabeçalho de "5.1 Produtos Customizados Por Órgão" | volta para canônico |
| 4 | item `15.069.00001.00` | lido no canônico |

Um detalhe que valida o vocabulário fechado: a frase *"Ocorrerá limitação de banda na **quantidade** contratada"*, que antecede o cabeçalho de 5.4, tem a palavra `quantidade` — mas cai na coluna de descrição (1), não nas colunas 3-5, e não entra no buffer. Zero falso positivo medido no corpus inteiro.

### 2.5 Com o papel correto, o documento real fecha o checksum

Reconstruída a extração completa com o papel por linha (protótipo, sem gravar nada): `PA-CGM-250912-127 v4.0.pdf` produz **27 itens, nenhum erro**. A soma dos totais dá **R$ 6.110.655,79** — e é exatamente o valor que a peça declara em prosa (*"Valor total dos Serviços... é estimado em R$ 6.110.655,79"*) e na linha `TOTAL` do cronograma físico-financeiro, ambos já lidos pela `_total_por_convergencia` da ESPEC 042 sem qualquer mudança. **O checksum de `V-CTR-03` fecha.** O documento real não fica só "sem erro" — fica pronto para gerar o relatório.

## 3. Objetivo

Que a ordem de preço, quantidade e período seja lida do cabeçalho de cada seção, e não presumida fixa — preservando, para todo documento cujo cabeçalho já está na ordem de hoje (o corpus inteiro, medido), exatamente o comportamento atual.

**Não é objetivo:**
- interpretar `"N meses e M dias"` como fração de mês — já resolvido e fora de escopo (`D-01` da ESPEC 040);
- generalizar a leitura para qualquer ordem de coluna imaginável — código, descrição, unidade e total continuam fixos, porque nenhum documento medido os move;
- mudar a descoberta de geometria ou o crivo de admissão.

## 4. Escopo

### 4.1 Dentro do escopo

- Duas funções puras novas em `grid.py`, no molde de `_escolher_gabarito`/`_faixa_mais_estreita`: classificar o rótulo de uma célula de cabeçalho, e resolver o papel das três colunas a partir do que foi acumulado;
- o laço de `extrair` ([pdfplumber_extractor.py:240-336](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L240-L336)), que passa a manter o papel ativo por geometria e a acumular/resolver a cada linha;
- `_montar_item`, que passa a receber o papel resolvido em vez de usar as constantes de módulo diretamente;
- `DiagnosticoDaGrade`, com um campo novo para as trocas de papel observadas (mesmo padrão de `palavras_descartadas`/`caudas_orfas`, ESPEC 035);
- `V-CTR-08`, validação nova, `AVISA`, para quando o papel ativo de uma geometria diverge do canônico;
- `aditivo_cgm.pdf`, fixture nova a partir de `PA-CGM-250912-127 v4.0.pdf`.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Parser de período fracionário (`"N meses e M dias"`) | `D-01` da ESPEC 040 — já resolvido, e por decisão deliberada não se ensina o sistema a inventar fração de mês |
| Ordem variável de código, descrição, unidade ou total | Não observado em documento nenhum — os quatro são âncora (código pela regex, total pelo `BRL`/posição de fechamento); variá-los sem medição seria presunção |
| Descoberta de geometria (`R-GRD-02` a `R-GRD-04`) e leitura por faixa (`R-FXA-*`) | Mecanismos intactos — esta espec consome as geometrias já admitidas, não decide quais entram |
| O crivo de admissão de geometrias (`_e_item_completo`) | `D-05` da ESPEC 019, preservado pelo mesmo racional das ESPECs 033/041: ele testa "parseia como número" em posição fixa, e continua passando nas seções invertidas porque um número na coluna errada ainda é um número — não há motivo para tocá-lo |
| Cabeçalho ausente ou em vocabulário fora da lista fechada | Cai no fallback canônico (`R-COL-05`) — comportamento de hoje, sem mudança |

## 5. Regras

| ID | Regra |
|---|---|
| `R-COL-01` | A tabela de itens tem sete colunas fixas em posição (`R-GRD-01`, inalterado), mas a ordem semântica das três colunas numéricas centrais — preço unitário, quantidade, período — **não é fixa para o documento**: é declarada pelo cabeçalho de cada seção, e pode variar entre seções que compartilham a mesma geometria |
| `R-COL-02` | Vocabulário fechado de classificação do rótulo de uma célula de cabeçalho: `PREÇO\|UNITÁRIO` → papel `preço`; `QTDE\|QUANTIDADE` → papel `quantidade`; `PERÍODO\|MÊS\|MESES` → papel `período`. Rótulo fora da lista não classifica |
| `R-COL-03` | Toda linha que **não** é item (código não bate `_CODIGO_EXATO`) tem o texto das suas colunas 3, 4 e 5 acumulado num buffer por geometria, desde a última linha de item processada |
| `R-COL-04` | Ao encontrar uma linha de item: se o buffer tiver classificado as três colunas em três papéis distintos, um-para-um, o papel ativo da geometria muda para esse mapeamento; senão, o papel ativo permanece o que já valia. O buffer é **sempre** esvaziado neste ponto, resolvendo ou não |
| `R-COL-05` | Papel inicial de toda geometria, antes de qualquer cabeçalho resolver algo: o canônico — `preço=COL_PRECO(3)`, `quantidade=COL_QUANTIDADE(4)`, `período=COL_MESES(5)`. É o fallback, e é o comportamento de hoje |
| `R-COL-06` | `_montar_item` lê `quantidade`, `preço unitário` e `meses` pelos índices do papel ativo da geometria da linha — nunca mais pelas constantes de módulo diretamente. `código`, `descrição`, `unidade` e `total` continuam nas posições 0, 1, 2 e 6, sem exceção |
| `R-COL-07` | Nova validação `V-CTR-08`, severidade `AVISA`: para cada trecho do documento em que o papel ativo divergiu do canônico, registra a página onde a mudança ocorreu e a ordem lida, convidando conferência |
| `R-COL-08` | **Invariante de não-regressão:** nos nove documentos do corpus que hoje extraem, o papel nunca diverge do canônico — medido (§2.4) —, logo nenhuma tupla de item, nenhum total e nenhum bloco se move |

### 5.1 Validações

`V-CTR-08` entra em [contract_validations.py](../../backend/src/infrastructure/validations/contract_validations.py), no molde de `v_ctr_04_geometria_nao_canonica` (mesma ideia — leitura diferente da referência —, campo diferente):

```
A tabela de itens da página {pagina} foi lida com a ordem de preço, quantidade
e período invertida em relação ao padrão do sistema — conferida como
{ordem lida}. Não é preciso fazer nada: a extração foi conferida pela soma dos
totais.
```

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Estado por geometria, atualizado ao longo da leitura — não uma resolução única por documento nem por página** | Medido (§2.4): a **mesma** geometria (mesmas oito divisórias, página 3 e 4) hospeda três seções com duas ordens diferentes no mesmo `PA-CGM-250912-127 v4.0`. Resolver uma vez por geometria teria aplicado a ordem de "5.2" à "5.4" — o defeito de novo, só que mais difícil de encontrar |
| `D-02` | **Vocabulário fechado, não um parser genérico de cabeçalho** | Mesmo racional de `_VOCABULARIO_DE_ORGAO` (ESPEC 034 `D-04`): lista fechada é decisão, não descoberta por acaso de texto. Reduz a três palavras o que poderia disparar — e o teste do "quantidade contratada" em prosa (§2.4) mostra que a coluna, não a palavra, é a guarda real |
| `D-03` | **O buffer é limpo a cada linha de item, resolvendo ou não** | Sem isto, fragmentos de um cabeçalho antigo — ou de prosa que por acidente caísse nas colunas 3-5 páginas depois — poderiam se combinar tarde demais com um rótulo não relacionado. Header e primeira linha de item estão sempre próximos nos documentos medidos; exigir proximidade no código, e não só na leitura, evita acúmulo silencioso |
| `D-04` | **Sem resolução nova, o papel ativo anterior continua valendo — não reseta para o canônico a cada linha** | Medido (§2.4): o cabeçalho de "5.4" aparece **uma vez**; as dezenove linhas seguintes, inclusive atravessando a virada de página 3→4, não o repetem. Resetar para o canônico a cada linha sem cabeçalho quebraria exatamente as linhas que esta espec existe para consertar |
| `D-05` | **`V-CTR-08` é registrada no `DiContainer` — ao contrário de `V-CTR-04`, que a ESPEC 017 `R-REL-13` deixa deliberadamente de fora** | `V-CTR-04` dispara para "todo contrato que não seja o piloto" — alto ruído, baixo sinal, por isso silenciada e só visível no `DiagnosticoDaGrade` para quem dá suporte. Ordem de coluna invertida é o oposto: zero ocorrências em nove documentos, e quando ocorre troca o significado de preço por quantidade — baixo ruído, alto risco. É o mesmo padrão de `V-CTR-06`/`V-CTR-07`: anomalia rara e consequente, registrada |
| `D-06` | **Código, descrição, unidade e total continuam em posição fixa** | Nenhum documento medido — nos nove do corpus nem no `PA-CGM-250912-127 v4.0` — move essas quatro. Generalizar sem medição seria presunção; a ESPEC 041 §11 já fez essa escolha pelo mesmo motivo em outro eixo (geometria, não ordem de coluna) |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/contract/grid.py` | Duas funções puras novas: `classificar_rotulo_de_coluna(texto) -> str \| None` (o vocabulário de `R-COL-02`) e `resolver_papel_das_colunas(pendentes: dict[int, list[str]]) -> dict[str, int] \| None` (a fusão de `R-COL-04`). Nenhuma mudança em `montar_grade`, `ler_celulas` ou `verticais_por_linha` — o cabeçalho já passa pelo mesmo `ler_celulas` que os itens |
| `infrastructure/contract/pdfplumber_extractor.py` | `extrair`: um `dict[tuple[float, ...], dict[str, int]]` de papel ativo por geometria (inicializado ao canônico) e um buffer de pendentes por geometria, atualizados no laço existente ([linhas 304-336](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L304-L336)), antes/depois do teste de `_CODIGO_EXATO`. `_montar_item` ganha um parâmetro `papel`, usado no lugar de `COL_PRECO`/`COL_QUANTIDADE`/`COL_MESES` |
| `domain/entities/contract.py` | `DiagnosticoDaGrade` ganha `ordem_de_colunas_alternativa: tuple[tuple[int, str], ...] = ()` — página e ordem lida, no molde de `palavras_descartadas` |
| `infrastructure/validations/contract_validations.py` | `v_ctr_08_ordem_alternativa_de_colunas`, no molde de `v_ctr_04_geometria_nao_canonica` |
| `infrastructure/di/container.py` | Registra `v_ctr_08_ordem_alternativa_de_colunas` ao lado de `v_ctr_06`/`v_ctr_07`, para a proposta e para cada aditivo — a mesma lição da ESPEC 040 §13: uma validação que existe e não é chamada não avisa ninguém |
| `tests/fixtures/` | `aditivo_cgm.pdf`, cópia de `PA-CGM-250912-127 v4.0.pdf` |
| `application/`, `api/`, `frontend/` | **Nenhuma.** `V-CTR-08` reaproveita o cartão de achado que a ESPEC 025 já sabe desenhar (`registrar_em_partes`), no mesmo molde de `V-CTR-06`/`V-CTR-07` |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-COL-01` a `R-COL-04` | Testes unitários das duas funções puras, com os dados sintéticos de §2.2 — cabeçalho de uma linha (5.2/5.3), cabeçalho de duas linhas (5.4), e um caso ambíguo/incompleto que não resolve |
| `R-COL-05` | Geometria sem cabeçalho legível (ex.: `modelo.pdf`, sem tabela) usa o canônico, sem exceção |
| `R-COL-06` | `aditivo_cgm.pdf`: `14.049.00038.00` extrai com `quantidade=1`, `preco_unitario=Decimal('3129.89')` — não invertidos. `14.049.00039.00` extrai sem `ExtractionError`, com `meses=None` e `meses_bruto` carregando o texto original |
| `R-COL-07` | `V-CTR-08` dispara para `aditivo_cgm.pdf`, com a página e a ordem lida; **não** dispara nos nove documentos do corpus |
| `R-COL-08` | §8.2 |

### 8.2 Regressão

Mesma técnica das ESPECs 033/040/041: `sha256` da tupla de item de cada documento do corpus, antes e depois — nenhum se move, porque `R-COL-08` já mediu que nenhum deles exercita um papel não canônico.

### 8.3 Critério de aceite

1. Nenhum `sha` do corpus se move;
2. `aditivo_cgm.pdf` extrai **27 itens, sem `ExtractionError`**, soma dos totais `R$ 6.110.655,79`, igual ao total declarado — checksum de `V-CTR-03` fechado;
3. `V-CTR-08` aparece para `aditivo_cgm.pdf` e para nenhum documento do corpus atual;
4. a lista de geometrias admitidas por documento não muda.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Vocabulário fechado casar por acidente com prosa nas colunas 3-5 de algum documento futuro | `D-02`/`D-03` — exige as três colunas resolvendo a papéis distintos na mesma janela, e o checksum de `V-CTR-03` continua sendo prova independente: papel errado desloca valor, e valor deslocado não fecha soma |
| Papel resolvido incorretamente herdar para itens de uma seção seguinte que não repete cabeçalho | `D-04` é medido, não presumido (§2.4): a hipótese testada foi exatamente "o cabeçalho de 5.1, mais abaixo, volta para o canônico" — e a medição confirma que ele reverte corretamente |
| `V-CTR-08` nunca chegar à tela por falta de wiring no `DiContainer` | `D-05` cita a lição da ESPEC 040 §13 diretamente — o teste de aceite (§8.1, `R-COL-07`) exercita o container real, não só a validação isolada |
| A fixture nova divergir do documento que gerou a submissão original | Ela é cópia byte a byte de `docs/documentos/CGM/PA-CGM- 250912-127 v4.0.pdf`, o arquivo real já no repositório |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | **Resolvido.** `aditivo_cgm.pdf` está em `backend/tests/fixtures/`, cópia byte a byte de `docs/documentos/CGM/PA-CGM- 250912-127 v4.0.pdf` (`sha256` conferido) | Não |
| `I-02` | Quantos outros contratos, ainda não vistos, declaram ordem de coluna diferente da canônica? Só o `PA-CGM-250912-127 v4.0` a exercita hoje | Não. `R-COL-01` a `R-COL-05` são gerais — não dependem de conhecer documentos futuros, só do cabeçalho que cada um trouxer |
| `I-03` | **Resolvido.** Reconfirmado na árvore real, não só em protótipo: `aditivo_cgm.pdf` extrai 27 itens, soma `R$ 6.110.655,79`, igual ao `total_declarado` — `test_ordem_alternativa_de_colunas.py::test_t2676d_checksum_fecha_com_o_valor_declarado` | Não |

## 11. Relação com as ESPECs 040 e 041

As três nascem da mesma peça real (`PC-CGM-240603-82` e, agora, `PA-CGM-250912-127 v4.0`) e do mesmo tipo de sintoma — `ExtractionError` citando um campo isolado —, mas corrigem defeitos de classes diferentes. A 041 corrigiu **geometria emprestada de outra tabela** (colunas certas, bordas erradas). A 040 corrigiu **o que fazer** quando o conteúdo de uma célula não numérica é legítimo, mas o campo é obrigatório (bordas certas, conteúdo tipado errado). Esta corrige **qual coluna é qual** — bordas certas, célula certa, mas o rótulo semântico atribuído a ela presumido em vez de lido.

A relação é mais que temática: sem a `R-MES-01` da ESPEC 040 já existir, corrigir só o roteamento desta espec teria deslocado o erro de `14.049.00039.00` de "sem quantidade" para "sem meses" — e travaria de novo, porque `meses` ainda seria obrigatório. É o roteamento certo **encontrando** a tolerância que já existia, não uma tolerância nova.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | As duas funções puras em `grid.py`, com os testes de §8.1 (`R-COL-01` a `R-COL-05`) | P |
| B | O estado por geometria no laço de `extrair`, e `_montar_item` recebendo o papel | PP |
| C | `DiagnosticoDaGrade`, `V-CTR-08` e o wiring no `DiContainer` | P |
| D | `aditivo_cgm.pdf` como fixture, e a suíte completa com conferência de `sha` do corpus | P |

**Estimativa: cerca de um dia.** A medição mais cara desta espec — o protótipo de rastreamento de papel contra o corpus inteiro e contra o documento real, com checksum fechando — já está feita (§2.4, §2.5).
