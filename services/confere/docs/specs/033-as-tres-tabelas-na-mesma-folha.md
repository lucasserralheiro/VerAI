# ESPEC 033 — As três tabelas na mesma folha

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-27. Backend **1.422 → 1.458 passed**, zero falhas. Os dez documentos que já extraíam saem com as tuplas de item **idênticas**, `sha` por `sha`; **nenhum artefato reancorado**. O `PA-SMUL-250314-22` extrai 16 itens em três blocos e fecha em `364.793,93` |
| **Versão** | **1.1** — 2026-08-27. A §2.3 e a `D-04` foram **corrigidas na execução** (`T-2198`): a v1.0 atribuía o encaixe da geometria da `Inclusão` sobre a `Redução` à `TOLERANCIA = 1.5`, com três folgas de 0,6 pt. **Medido na fixture: não há folga nenhuma** — as cinco candidatas casam exatas, e a tolerância não é exercida. A correção e todas as medições de não-regressão não mudam; muda a explicação do mecanismo |
| **Depende de** | [ESPEC 017](017-grade-do-contrato-derivada-do-documento.md) — a grade derivada do documento. [ESPEC 019](019-contrato-e-aditivos.md) `R-ADT-08` — mais de uma geometria por documento |
| **Revisa** | [ESPEC 019](019-contrato-e-aditivos.md) §2.4. Aquela seção mediu três geometrias num aditivo e as encontrou em **páginas diferentes** (6, 6 e 7). A premissa que sobrou — *cada página é lida por uma geometria só* — não é do negócio: é do acaso da amostra |
| **Não toca** | O crivo de admissão de geometrias (`R-ADT-08`, ESPEC 019 `D-05`), a escolha do gabarito (`R-GRD-02`), a costura da cauda (`R-CON-01`), a ordem dos itens (`R-REL-03`), a leitura da aba `Levantamento` e o `.docx` de quem já gera |
| **Referência normativa** | `PA-SMUL-250314-22 v5.0.pdf` (o defeito) · `PC-SMUL-240916-136 v2.0.pdf`, `contrato.pdf`, `contrato_pgm.pdf`, `aditivo_pgm.pdf`, `PA-SMIT-260319-739`, `PA-PGM-251015-159`, `PA-PGM-260304-715`, `PA-PGM-260818-201`, `modelo.pdf`, `amostra_sem_tabela.pdf` (a não-regressão) |
| **Origem** | Submissão real: *"item 12.030.00002.00 (página 4) sem preço unitário, meses — extração incompleta da tabela do contrato"* |

---

## 1. Problema

O aditivo `PA-SMUL-250314-22` do Contrato 17/2024-SMUL **não é lido**. A extração morre na primeira
linha do bloco `Redução`:

```
ExtractionError: item 12.030.00002.00 (página 4) sem preço unitário, meses
                 — extração incompleta da tabela do contrato
```

`ExtractionError` estoura **dentro da extração**, antes de qualquer `V-CTR-*`.
[reports.py:279](../../backend/src/api/routers/reports.py#L279) e
[reports.py:357](../../backend/src/api/routers/reports.py#L357) a convertem em `422`, e a submissão
inteira é recusada: nem relatório parcial, nem diagnóstico de grade, nem a lista de achados que
existe justamente para dizer o que houve.

**Não é PDF defeituoso, e não é tabela truncada.** A tabela está inteira e legível; o que falta é o
extrator saber **com quais divisórias** ler cada linha. São **dois defeitos independentes**, e ambos
bloqueiam: corrigido só o primeiro, a mensagem passa a `sem valor total`, no mesmo item (§2.6).

## 2. O que foi levantado no código

Tudo nesta seção foi medido no documento real, com o extrator de produção.

### 2.1 A página 4 traz **quatro** tabelas de sete colunas

`_faixas_verticais` ([grid.py:94](../../backend/src/infrastructure/contract/grid.py#L94)) sobre a
página 4, mostrando só as faixas de oito divisórias:

| faixa (`y`) | o que é | divisórias |
|---|---|---|
| 28,5 – 80,7 | `Inclusão`, continuação da p3 | 38.7 · 99.9 · **230.1** · 299.7 · **379.5 · 429.3 · 462.9** · 515.1 |
| 80,7 – 201,3 | `Inclusão`, **a mesma tabela**, borda 0,6 pt à esquerda | 38.7 · 99.9 · **230.7** · 299.7 · **378.9 · 428.7 · 462.3** · 515.1 |
| 258,3 – 363,9 | **`Redução`** | 38.7 · 99.9 · 230.1 · 299.7 · **343.5** · 378.9 · 428.7 · **516.9** |
| 418,5 – 561,3 | **`Aumento`** | 38.7 · 99.9 · 230.1 · 299.7 · **343.5** · 378.9 · **431.7** · 515.1 |
| 693,3 – 807,3 | cronograma físico-financeiro | 38.7 · 82.5 · 147.9 · 213.3 · 278.7 · 344.1 · 409.5 · 474.9 |

`Redução` e `Aumento` têm uma divisória **a mais em 343,5**: o cabeçalho `PREÇO LISTA (R$)` quebra em
três linhas e estreita a coluna. Da coluna 4 em diante, **tudo anda uma casa** em relação à geometria
da `Inclusão`.

E o desenho não é uniforme nem dentro de uma tabela só: a `Inclusão` muda de faixa no meio da página,
0,6 pt à esquerda, o que sozinho já produz **duas** candidatas para **uma** tabela.

### 2.2 A grade é da página; a leitura, também

`montar_grade` ([grid.py:306](../../backend/src/infrastructure/contract/grid.py#L306)) devolve **as
verticais de uma geometria × todas as horizontais da página**, e `ler_celulas`
([grid.py:423](../../backend/src/infrastructure/contract/grid.py#L423)) varre a página inteira com
elas. A faixa que **descobriu** aquela geometria — a `R-ADT-08`, que existe desde a ESPEC 019 — é
descartada na hora de ler.

O laço de extração
([pdfplumber_extractor.py:141-169](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L141-L169))
aplica **toda** geometria admitida a **toda** página que casar:

```python
for numero, pagina in enumerate(pdf.pages, start=1):
    for divisorias in geometrias:
        grade = montar_grade(pagina, divisorias)
        ...
        for celulas in ler_celulas(pagina, grade):
```

Não há, em lugar nenhum, a pergunta *"esta linha é desta tabela?"*.

### 2.3 A união dos traços da folha satisfaz as quatro geometrias

`_fronteiras_verticais` ([grid.py:281](../../backend/src/infrastructure/contract/grid.py#L281))
pergunta, para cada coluna do gabarito, *"esta coluna tem candidata perto?"* — e as candidatas são
**todas as verticais desenhadas na página**, sem juízo sobre a que tabela pertencem. Na página 4 são
22:

```
38.7  82.5  99.9  147.9  213.3  230.1  230.7  278.7  299.7  343.5  344.1
378.9 379.5 409.5 428.7  429.3  431.7  462.3  462.9  474.9  515.1  516.9
```

É a **união** das quatro tabelas, e nela **toda** coluna de **toda** geometria tem correspondência
**exata** — `TOLERANCIA` não é sequer exercida. Medido: as cinco candidatas saem de `montar_grade`
idênticas ao seu gabarito, sem um único ajuste.

Consequência: as quatro grades casam na folha inteira, cada uma cobrindo também as linhas das
outras. É a `R-GRD-03` — *"a página entra quando **contém** o gabarito"* — funcionando exatamente
como escrita, numa folha para a qual ela não foi pensada.

**O dano não é aproximação; é fronteira que falta e fronteira que sobra.** Os tokens da linha do
`12.030.00002.00`, com os dois cortes:

| token | `cx` | grade da `Redução` | grade da `Inclusão` |
|---|---|---|---|
| `BRL` · `986,81` | 320,7 | preço (299,7–343,5) | preço (299,7–**379,5**) |
| `-200,00` | 361,2 | quantidade (343,5–378,9) | preço — **falta o corte em 343,5** |
| `5` | 404,0 | meses (378,9–428,7) | quantidade (379,5–429,3) |
| `BRL` | 452,3 | total (428,7–516,9) | meses (429,3–462,9) |
| `-` | 462,2 | total | meses — **corte espúrio em 462,9** |
| `986.810,00` | 483,1 | total | total (462,9–515,1) |

A `Inclusão` não tem a divisória `343,5`, e tem uma em `462,9` que cai **dentro** da coluna de total
da `Redução`, 0,7 pt à direita do sinal.

### 2.4 O que a linha vira

Palavras reais da linha do `12.030.00002.00`, e as células que saem da geometria da `Inclusão`:

```
PDF:      Mbps/MÊS │ BRL 986,81 │ -200,00 │ 5 │ BRL - 986.810,00
                   ↑299.7   ↑343.5    ↑378.9  ↑428.7        ↑516.9

lido:     ['12.030.00002.00', 'CONEXÃO INTERNET…', 'Mbps/MÊS',
           'BRL -200,00 986,81',  '5',  'BRL -',  '986.810,00']
            └ preço+quant ┘      └qtd┘  └meses┘   └ total ┘
```

`preço = 'BRL -200,00 986,81'` → `None`. `meses = 'BRL -'` → `None`. `_montar_item`
([pdfplumber_extractor.py:386](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L386))
levanta a exceção, e é **certo** que levante: um item com preço zerado por erro de leitura produziria
relatório errado sem sinal nenhum (ESPEC 001 §9.4). O defeito não está na guarda; está na grade que
ela recebeu.

### 2.5 Nenhuma geometria admitida lê a página 4 inteira

A simetria é o que fecha o diagnóstico — não existe ordem de iteração que salve:

| geometria | linhas da `Inclusão` (p4) | linha da `Redução` | linhas do `Aumento` |
|---|---|---|---|
| `Inclusão` (2 candidatas) | corretas | `falta preço, meses` | `falta preço, meses` |
| `Redução` | `falta quant, total` | correta | `falta total` (§2.6) |
| `Aumento` | `falta quant, total` | `falta total` (§2.6) | corretas |

O mesmo vale para as linhas `TOTAL:`. Lida pela geometria da `Inclusão`, a do bloco `Redução` sai
`['…', 'Redução TOTAL:', '-986.810,00', 'BRL']`, e `_total_declarado`
([pdfplumber_extractor.py:365](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L365))
devolve `None` — a última célula com `BRL` é a que só tem `BRL`. O bloco `Redução` **não fecharia**, e
os seus itens migrariam para o bloco seguinte, com o rótulo errado.

### 2.6 O segundo defeito: o sinal separado do número

Independente do primeiro, e igualmente bloqueante. Na célula de total daquela linha o `-` é **token
próprio**, e `para_decimal` ([quantity.py:29](../../backend/src/domain/value_objects/quantity.py#L29))
não trata o espaço interno:

```python
para_decimal('BRL - 986.810,00')  -> None       # Decimal('- 986810.00') → InvalidOperation
para_decimal('BRL -986.810,00')   -> -986810.00
```

Medido nos dois sentidos, com o protótipo:

| correção aplicada | resultado no `PA-SMUL-250314-22` |
|---|---|
| só a geometria | `item 12.030.00002.00 (página 4) sem **valor total**` |
| só o sinal | `item 12.030.00002.00 (página 4) sem **preço unitário, meses**` |
| as duas | **16 itens, 3 blocos, `364.793,93`** |

O PGM grafa `BRL -897.734,40`, colado, e por isso nunca expôs isto. A mesma linha do SMUL grafa
`BRL - 986.810,00`; e a linha `Redução TOTAL:` da **mesma página** grafa `-986.810,00` colado. É
variação de composição dentro de um único documento — não há regra de grafia a invocar.

**O alcance da normalização foi medido no corpus inteiro**, comparando resposta antiga e nova célula
a célula:

| fonte | células examinadas | respostas que mudam |
|---|---|---|
| dez PDFs (as duas leituras, todas as geometrias) | 7.882 | **6** — todas a mesma cadeia, `'BRL - 986.810,00'` |
| três planilhas `Levantamento` (214 itens) | 428 | **0** |

Uma cadeia distinta no corpus todo. `PACOTE`, `Perfil D` e as demais não-numéricas continuam `None`.

### 2.7 Por que os documentos de hoje não expõem nada disso

No `PA-PGM-260304-715` as três geometrias estão em **páginas diferentes** — 6, 6 e 7 —, e as duas da
página 6 são a mesma tabela com 0,8 pt de deriva. Cada página é, de fato, lida por uma tabela só.

Foi a amostra, não a regra: um aditivo é feito de blocos curtos, e três blocos curtos cabem numa
folha. A ESPEC 019 §2.3 já havia observado que *"bloco curto divide folha"* — e tirou dali a
descoberta por faixa. **A leitura ficou por página.**

### 2.8 O crivo de admissão não faz a pergunta que faltava

`_geometrias_de_itens`
([pdfplumber_extractor.py:253](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L253))
pergunta *"esta geometria rende alguma linha completa?"*. No SMUL **as quatro rendem** — cada uma nas
suas próprias linhas. O crivo da ESPEC 019 `D-05` continua certo no que faz: barrar a geometria do
cronograma. Ele nunca prometeu dizer de quem é cada linha.

## 3. Objetivo

Que **cada linha da tabela seja lida com as divisórias da tabela a que ela pertence**, e que o sinal
separado do número deixe de perder um valor — sem que uma única tupla de item mude nos documentos que
hoje extraem.

**Não é objetivo:** mudar quais geometrias são admitidas; mudar a escolha do gabarito; adivinhar
divisória que não esteja desenhada; nem tratar tabela sem grade desenhada.

## 4. Escopo

### 4.1 Dentro do escopo

- As divisórias que valem em cada linha da grade, e a herança para a linha `TOTAL:`.
- A normalização do espaço entre o sinal e os dígitos em `para_decimal`.
- O `PA-SMUL-250314-22` e a sua proposta como referência normativa versionada.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| O crivo de admissão (`R-ADT-08` / ESPEC 019 `D-05`) | `D-03` — mantê-lo intacto é o que garante que **quais** geometrias entram não muda em documento nenhum |
| `TOLERANCIA = 1.5` | `D-04` — medido, ela **não participa** deste defeito: na página 4 os cinco gabaritos casam exatos (§2.3). Mexer nela mudaria a `R-GRD-04` sem tocar no problema |
| Escolher **uma** tabela por página | Contraria a `R-ADT-01`: a página 4 tem três blocos, e os três contam |
| Reordenar itens ou blocos | `R-REL-03` e `R-ADT-01` continuam mandando |
| O aviso de cliente não derivado no par SMUL | Pré-existente, da `R-CAP-04`; independente desta espec (§8.4) |

## 5. Regras

| ID | Regra |
|---|---|
| `R-FXA-01` | Cada **linha** da grade é lida com as **oito divisórias desenhadas na faixa que a cobre**. Cobrir é conter a linha, e não coincidir com ela |
| `R-FXA-02` | Havendo mais de uma faixa de oito cobrindo a mesma linha, vale a **mais estreita** — a mais específica é a da própria linha, não a da moldura que a contém |
| `R-FXA-03` | Linha sem faixa própria de oito **herda** as divisórias da linha anterior **se, e só se, os traços que ela própria desenha forem subconjunto delas**. É o que traz a linha `TOTAL:` — desenhada com células mescladas, dois traços — para dentro da tabela a que pertence, e o que impede a herança de atravessar para a tabela seguinte |
| `R-FXA-04` | Não havendo faixa própria nem herança admissível, valem **as divisórias da página** — o comportamento de hoje, bit a bit. `R-GRD-03` e `R-GRD-04` ficam intactas |
| `R-FXA-05` | A cobertura é medida com a **espessura do traço** (`ESPESSURA_MAXIMA_DO_TRACO = 2,0 pt`), e não com `TOLERANCIA`. A razão é geométrica e medida: a fronteira horizontal é lida em `top` e o traço vertical começa na **base** dela — `57,0` contra `57,7` no piloto |
| `R-FXA-06` | **A admissão de geometrias não muda**: `_geometrias_de_itens` continua respondida com as divisórias da página. Quais geometrias entram é decisão da ESPEC 019, e esta espec não a reabre |
| `R-FXA-07` | **Invariante de não-regressão, afirmado por extenso:** os dez documentos do corpus que hoje extraem produzem as **mesmas tuplas de item**, o mesmo `total_declarado`, os mesmos blocos e o mesmo `sha` (§8.2) |
| `R-FXA-08` | O `PA-SMUL-250314-22` extrai **16 itens em 3 blocos** — `Inclusão` 12 / `1.304.002,55`, `Redução` 1 / `-986.810,00`, `Aumento` 3 / `47.601,38` — e `V-CTR-03` fecha em `364.793,93`, que é o valor impresso na própria peça |
| `R-NUM-01` | `para_decimal` normaliza **espaço entre o sinal e os dígitos** (`- 986.810,00` → `-986.810,00`). Nada mais: não remove espaço interno em outra posição, e o conjunto do que era `None` e passa a ser número tem **uma** cadeia no corpus (§2.6) |

### 5.1 Validações

**Nenhuma validação nova, e é decisão** (`D-07`). O oráculo desta espec já existe e é o mais forte que
o sistema tem: `V-CTR-03`
([contract_validations.py:66](../../backend/src/infrastructure/validations/contract_validations.py#L66))
soma os totais das linhas e compara com o `TOTAL:` declarado, **por peça**. Grade errada move valor;
valor movido não fecha checksum. No `PA-SMUL-250314-22` ele fecha exatamente, e nos dez documentos de
hoje continua fechando.

Uma `V-CTR` que avisasse *"esta página tem mais de uma geometria"* dispararia na página 4 do SMUL —
que passa a ser o caminho **normal** — e seria ruído desde o primeiro dia.

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **A unidade de decisão é a linha, não a região nem a página** | A alternativa medida foi delimitar a região vertical de cada geometria e ler só dentro dela. Ela **perde a linha `TOTAL:`**: no SMUL a `Inclusão` termina em `y=201,3` e o seu `TOTAL:` está em `201,3–225,3`, faixa que não pertence a geometria nenhuma. Por linha, com a herança de `R-FXA-03`, ela é recuperada pela tabela certa |
| `D-02` | **O conjunto de linhas lidas não muda** | As horizontais continuam sendo as da página. Só muda **como cada linha é fatiada em células**. É o que torna a não-regressão verificável por igualdade, e não por argumento |
| `D-03` | **A admissão fica intocada** (`R-FXA-06`) | **Medido:** com divisórias por linha, o crivo de `_e_item_completo` aprovaria **todas** as candidatas — 2 de 2 no piloto, 2 de 2 no PGM, 4 de 4 no aditivo do PGM, 5 de 5 no SMUL —, inclusive a geometria do cronograma, que a ESPEC 019 §2.5 barrou por medição. Deixar a admissão respondida do jeito de hoje mantém aquela medição válida e reduz a superfície da mudança a uma função |
| `D-04` | **`TOLERANCIA` não se mexe** | **Medido: ela não participa do defeito.** Na página 4 toda coluna de toda geometria tem correspondência exata entre as 22 candidatas (§2.3), e `montar_grade` devolve os cinco gabaritos sem um único ajuste. Baixá-la — ou zerá-la — não mudaria nada aqui, e quebraria a `R-GRD-04`, que existe para reencontrar a **mesma** tabela na página seguinte |
| `D-05` | **A herança é por subconjunto, não por proximidade** | *"A linha herda de quem está logo acima"* atravessaria a fronteira entre duas tabelas empilhadas. O teste de subconjunto é fato do desenho: os dois traços do `Redução TOTAL:` — `428,7` e `516,9` — pertencem ao conjunto da `Redução` e **não** ao da `Inclusão`, que não tem `516,9` |
| `D-06` | **`para_decimal` normaliza só o sinal** | Remover todo espaço interno transformaria `'BRL -200,00 986,81'` — a célula corrompida do §2.4 — em algo que ainda não é número, mas por sorte. A guarda de `_montar_item` precisa continuar recusando célula fundida, e é o que a normalização estreita preserva |
| `D-07` | **Sem validação nova** | O checksum já é o oráculo, e é por peça. Ver §5.1 |
| `D-08` | **O par SMUL entra como fixture** | Terceiro órgão, e o **único** com três tabelas na mesma folha. Sem ele, a regra volta a valer por argumento. Entram a proposta (`PC-SMUL-240916-136`, 41 itens / `27.415.244,95`) e o aditivo — e a proposta confere o valor que o próprio aditivo declara como *"valor inicial do contrato"* |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/contract/grid.py` | Função nova — as divisórias que valem em cada linha da grade (`R-FXA-01` a `R-FXA-05`). `ler_celulas` passa a atribuir a coluna com as divisórias **daquela linha**, sob parâmetro; sem o parâmetro, o comportamento de hoje |
| `infrastructure/contract/pdfplumber_extractor.py` | **Uma linha**: o laço de extração lê por faixa. `_linhas`, usada pela admissão, **não** muda (`R-FXA-06`) |
| `domain/value_objects/quantity.py` | `para_decimal` normaliza o espaço depois do sinal (`R-NUM-01`) |
| `tests/fixtures/` | O par SMUL — proposta e aditivo —, com o levantamento correspondente |
| `domain/`, `application/`, `api/`, `frontend/` | **Nenhuma.** Nenhuma entidade, nenhum contrato de API, nenhuma tela |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-FXA-01` · `R-FXA-02` | A linha do `12.030.00002.00` sai com os quatro valores — `-200,00`, `986,81`, `5`, `-986.810,00` — por extenso no teste |
| `R-FXA-03` | Os três blocos do SMUL fecham com os rótulos certos. **É o teste decisivo da herança**: sem ela, `Redução` não fecha e os seus itens migram para o bloco `Aumento` |
| `R-FXA-04` | Linha sem faixa de oito continua lida como hoje — exercitada pelo `contrato_pgm.pdf`, que tem linhas de item assim |
| `R-FXA-05` | A cobertura reconhece `57,0` contra `57,7` no piloto. Caso construído, sem abrir PDF, no espírito de `_escolher_gabarito` |
| `R-FXA-06` | A lista de geometrias admitidas é a mesma, documento a documento — na ordem da §8.2: 1 · 1 · 3 · 0 · 0 · 1 · 1 · 3 · 0 · 1, e **4** no SMUL |
| `R-FXA-07` | §8.2, por igualdade |
| `R-FXA-08` | 16 itens, 3 blocos e `364.793,93` por extenso |
| `R-NUM-01` | `'BRL - 986.810,00'` → `-986810.00`; `'PACOTE'`, `'Perfil D'`, `'- '` → `None`; `'BRL 229,02'`, `'4.000,00'`, `'1500'`, `'117,2889'` inalterados |

### 8.2 Regressão — medida no protótipo, não prevista

Extração completa de cada peça, antes e depois. `sha` é o `sha256` da lista de tuplas
`(código, descrição, unidade, quantidade, preço, meses, total, página)` de **todos** os itens:

| documento | itens | `TOTAL:` declarado | blocos | geometrias | `sha` antes | depois |
|---|---|---|---|---|---|---|
| `contrato.pdf` (piloto) | 60 | 10.637.425,00 | 1 | 1 | `430e506c…` | **igual** |
| `contrato_pgm.pdf` | 47 | 24.551.037,72 | 1 | 1 | `b8a7117b…` | **igual** |
| `aditivo_pgm.pdf` | 7 | −0,12 | 3 | 3 | `0e7ec8ef…` | **igual** |
| `modelo.pdf` | 0 | — | 0 | 0 | `4f53cda1…` | **igual** |
| `amostra_sem_tabela.pdf` | 0 | — | 0 | 0 | `4f53cda1…` | **igual** |
| `PA-SMIT-260319-739` | 60 | 10.637.425,00 | 1 | 1 | `430e506c…` | **igual** |
| `PA-PGM-251015-159` | 47 | 24.551.037,72 | 1 | 1 | `b8a7117b…` | **igual** |
| `PA-PGM-260304-715` | 7 | −0,12 | 3 | 3 | `0e7ec8ef…` | **igual** |
| `PA-PGM-260818-201` | 0 | — | 0 | 0 | `4f53cda1…` | **igual** |
| `PC-SMUL-240916-136` | 41 | 27.415.244,95 | 1 | 1 | `6d0df306…` | **igual** |
| `PA-SMUL-250314-22` | — | — | — | — | `ExtractionError` | **16 · 364.793,93 · 3 blocos** |

**Suíte completa: 1.422 passed, zero falhas**, medida nas duas árvores — no `HEAD` (930,5 s) e com o
protótipo aplicado (891,5 s). É o mesmo número da ESPEC 032: a correção não acrescenta nem remove
teste nenhum dos que existem.

**Tempo de extração, mínimo de três execuções:**

| documento | hoje | com a correção |
|---|---|---|
| `contrato.pdf` | 5,62 s | 5,63 s |
| `contrato_pgm.pdf` | 6,87 s | 6,97 s |
| `aditivo_pgm.pdf` | 3,07 s | 3,00 s |
| `PC-SMUL-240916-136` | 3,80 s | 3,82 s |
| `PA-SMUL-250314-22` | 2,19 s | 2,28 s |

Dentro do ruído. `_faixas_verticais` percorre `pagina.rects`, que o `pdfplumber` já tem em memória — a
ESPEC 026 continua valendo.

### 8.3 As linhas que mudam de leitura, e por que nenhuma delas importa

A leitura **não** é idêntica linha a linha; é idêntica no que sai. Medido comparando as células das
duas leituras, página por página, geometria por geometria:

| documento | linhas lidas | linhas que mudam | onde | o que são |
|---|---|---|---|---|
| `contrato.pdf` | 76 | 12 | p29 | cronograma físico-financeiro |
| `contrato_pgm.pdf` | 69 | 15 | p25 | cronograma físico-financeiro |
| `aditivo_pgm.pdf` | 42 | 14 | p7 | cronograma físico-financeiro |
| `PC-SMUL-240916-136` | 63 | 14 | p13 | cronograma físico-financeiro |
| `PA-SMUL-250314-22` | 126 | 50 | p4 | **as tabelas de itens** |

Nos quatro primeiros, **toda** linha que muda é do cronograma, e muda **para melhor**:

```
antes : ['Mês 01', 'R$ 115.082,55 R$ 2.166,83', 'R$ 177.995,76', …, 'R$', '4.657,58', …]
depois: ['Mês 01', 'R$ 115.082,55', 'R$ 2.166,83', 'R$ 177.995,76', …, 'R$ 4.657,58', …]
```

Nenhuma tem código de serviço; nenhuma tem `TOTAL:` — o cronograma grafa `TOTAL`, **sem
dois-pontos**, e `_MARCA_TOTAL` exige os dois-pontos. Por isso o `sha` não se move.

### 8.4 O par SMUL de ponta a ponta

Com a correção, o trio real — proposta, aditivo e levantamento — **gera**: 53 linhas de relatório,
`V-CTR-03` fechando nas duas peças, e dois achados `AVISA`, ambos pré-existentes e alheios a esta
espec:

- `R-CAP-04` — o nome do órgão não sai da prosa da capa da proposta SMUL; a capa cai para o título do
  levantamento, como a regra manda;
- `R-MED-02` — o `14.031.00023.00` aparece duas vezes no levantamento sem bloco de desconto.

Registrados aqui porque foram observados, e **não** são objetivo desta espec.

### 8.5 Critério de aceite

1. Qualquer `sha` da §8.2 que se mova **reprova a entrega**;
2. a suíte fecha em 1.422 ou mais, com zero falhas;
3. o `PA-SMUL-250314-22` sai com 16 itens, 3 blocos e `364.793,93`;
4. a lista de geometrias admitidas é a mesma, documento a documento (`R-FXA-06`).

## 9. Riscos

| Risco | Mitigação |
|---|---|
| A herança atravessar de uma tabela para a seguinte e fatiar linha alheia | `R-FXA-03` exige subconjunto. O `Redução TOTAL:` é o caso real que reprova herança por proximidade: `516,9` não existe no conjunto da `Inclusão` |
| Documento cuja tabela não desenhe traço por linha deixar de ser lido | Não pode acontecer: `R-FXA-04` cai para as divisórias da página, que é o que ele já usa. Medido — o piloto e o PGM têm linhas assim e saem idênticos |
| O cronograma passar a ser lido como tabela de itens, agora que sai limpo | `R-FXA-06`: a admissão não muda, e o cronograma continua barrado pelo crivo da ESPEC 019 `D-05`. Segunda barreira: as linhas não têm código de serviço, e o `TOTAL` delas não tem dois-pontos |
| Alguém, numa refatoração futura, usar a leitura por faixa também na admissão | `R-FXA-06` é regra, e o teste de §8.1 afirma a lista de geometrias por documento — inclusive o `4` do SMUL |
| A normalização do sinal aceitar o que hoje é recusado | Medido: 8.310 células, uma cadeia muda (§2.6). `D-06` mantém a normalização estreita para que célula fundida continue sendo recusada |
| A regra valer só para os documentos conhecidos | `I-01`. É limitação declarada — mas o checksum de `V-CTR-03` é independente do documento, e é ele que acusa grade errada em peça nova |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Existe contrato cuja linha de item **não** tenha oito traços na sua faixa **e** divida a folha com outra tabela de largura diferente? Aí nem a faixa própria nem a herança respondem, e a linha cai na página | Não. Nenhum dos dez documentos o exercita; e o caso termina em `ExtractionError` ou em `V-CTR-03` — nunca em número errado calado |
| `I-02` | A `Inclusão` do SMUL rende **duas** candidatas para uma tabela só, por 0,6 pt de deriva. Vale consolidar candidatas quase iguais na descoberta? | Não bloqueia. Com a leitura por faixa as duas passam a produzir células idênticas, e a `linhas_vistas` as reduz a uma. Consolidar seria mexer na `R-GRD-02` para ganhar desempenho, não correção |
| `I-03` | Três das cinco geometrias do SMUL só existem porque o cabeçalho quebra linha. Um gerador de PDF diferente produziria outras. Vale medir a família toda de propostas antes de fechar a regra? | Não. A regra não depende de **quantas** geometrias há, e sim de cada linha ser lida pela sua |

## 11. Relação com a ESPEC 019 §2.4

Aquela seção mediu, no `PA-PGM-260304-715`, três geometrias que um gabarito único não lê, e concluiu —
corretamente — que a descoberta tinha de ser **por faixa**. O que ficou foi a outra metade: a
**leitura** continuou por página.

Enquanto as faixas de um documento estiveram em páginas diferentes, a diferença não aparecia. O SMUL
põe três tabelas de larguras diferentes na mesma folha, e a metade que faltou passa a decidir se o
documento é lido ou recusado.

É o mesmo formato da ESPEC 032 em relação à ESPEC 001 §9.4: uma correção resolveu o lado que a
amostra mostrava, e o lado restante esperou o documento que o exibisse.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Fixtures do par SMUL e o inventário de âncoras que os tocam | PP |
| B | Testes escritos antes: os quatro valores da linha do `12.030.00002.00`, os três blocos, e a tabela de `sha` da §8.2 como asserção | P |
| C | As divisórias por linha em `grid.py` e a linha do laço no extrator | PP |
| D | `R-NUM-01` e os casos de `para_decimal` | PP |
| E | Suíte completa e conferência de que nenhum `sha` se moveu | PP |

**Estimativa: meio dia.** O protótipo já existe e está medido; o trabalho está em A, B e E — e é
trabalho de prova.
